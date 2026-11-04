# Research: Railway Deploy (frontend + backend)

**Feature**: `002-railway-deploy` | **Date**: 2026-09-15
**Spec**: [spec.md](./spec.md)

Phase 0 output. Every Technical Context unknown is resolved below as
Decision / Rationale / Alternatives considered. No NEEDS CLARIFICATION remains.
All sources verified 2026-09-15.

---

## R1. Frontend container strategy (Astro static → Railway)

- **Decision**: Multi-stage `node:22-slim` image. Build stage runs full
  `npm ci` (devDeps included) + `npm run build` (4 static pages, `prebuild`
  content gate runs inside Docker); runtime stage serves `dist/` with
  `serve@14` on `${PORT:-3000}` via
  `serve dist -l tcp://0.0.0.0:${PORT:-3000}`.
- **Rationale**: Railway's Astro guide defaults to Railpack zero-config static,
  but an explicit Dockerfile pins the toolchain (Node 22, `npm ci` semantics),
  guarantees the `prebuild` → `check-content` gate runs in the image build, and
  gives CI a byte-identical `docker build` to run. `serve` is a single static
  binary path with no config file to drift; `$PORT` binding satisfies Railway's
  dynamic port injection.
- **Alternatives considered**:
  - Railpack/Nixpacks zero-config (no Dockerfile) — rejected: implicit Node
    version, no guarantee devDeps install for the `tsx` prebuild gate, and CI
    could not reproduce the Railway build locally (breaks US3 parity).
  - `nginx:alpine` runtime — rejected: heavier config surface (custom
    `nginx.conf` for SPA fallback + `$PORT` templating) for a 4-page static
    site with no proxying needs; `serve -s` handles fallback with one flag if
    client routing ever lands.

## R2. Backend container strategy (FastAPI/AgentOS → Railway)

- **Decision**: Keep `python:3.12-slim` base; `pip install .` from pyproject
  (explicit `[build-system]` + setuptools `packages.find`/`py-modules` so
  flat-layout `app/`+`agents/`+`evals/`+`db.py` install correctly); CMD
  `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`.
- **Rationale**: Railway's FastAPI guide auto-detects Dockerfiles and injects
  `$PORT`; uvicorn on `0.0.0.0:$PORT` is the documented shape. `AGENTOS_ENABLED`
  stays `false` in v1 (health-only), so the image needs no Agno runtime
  beyond the installed deps — the Agno `agentos-railway` reference template
  confirms `uvicorn 0.0.0.0:8000` + `/health` as the deploy contract.
- **Alternatives considered**:
  - `agnohq/python:3.12` base image — rejected for v1: adds Agno-specific
    layers with no health-only benefit; revisit when AgentOS mounts real
    agents (needs `AGENTOS_URL`/JWT wiring per Agno deploy docs).
  - Gunicorn + uvicorn workers — rejected: single-worker uvicorn is sufficient
    for a health-only scaffold; worker count is a scale decision for later.

## R3. Railway builder + healthcheck config (`railway.json`)

- **Decision**: Per-service `railway.json` pinning `"builder": "DOCKERFILE"`
  with `dockerfilePath: "Dockerfile"`; backend adds `healthcheckPath:
  "/health"` + `healthcheckTimeout: 30`; both set `ON_FAILURE` restart with 3
  retries. Files kept minimal (builder + healthcheck only).
- **Rationale**: Railway config-as-code reference: `DOCKERFILE` builder always
  wins over Railpack detection, removing build ambiguity. `/health` already
  exists on the backend (001), so the healthcheck is free and gates bad
  deploys (spec acceptance 1.2: previous healthy deployment kept).
- **Alternatives considered**:
  - No `railway.json` (dashboard-configured builder) — rejected: builder choice
    would be invisible in code review and unreproducible from a fresh checkout.
  - Full config-as-code (resources, scaling, env) — rejected: config-as-code is
    deprecated, honored only until 2026-12-01, with IaC as the successor;
    minimal files migrate trivially.

## R4. Backend database configuration (`DATABASE_URL` vs `DB_*`)

- **Decision**: `backend/db.py` parses `DATABASE_URL` first (accepts
  `postgres://` + `postgresql://`, percent-decoding user/password, default port
  5432), falls back to `DB_*` vars; both paths reject SQLite and raise
  `ConfigError` naming the exact gap (missing var, bad scheme, missing
  host/name/user/password).
- **Rationale**: The pgvector template service (named `pgvector`) provisions a
  private `DATABASE_URL_PRIVATE` (`pgvector.railway.internal:5432`) plus an
  initial public `DATABASE_URL` TCP proxy; the runbook deletes the proxy
  (T017 → no public endpoint) and references
  `DATABASE_URL=${{pgvector.DATABASE_URL_PRIVATE}}` for private networking (no
  egress fees, no public URL in env, no live credential surface). `DB_*` fallback preserves local
  `docker compose` dev without a second code path in callers — `load_db_config()`
  signature unchanged.
- **Alternatives considered**:
  - `DB_*`-only with per-field Railway references — rejected: 5 references to
    keep in sync vs 1; Railway's documented pattern is the single-URL reference.
  - SQLAlchemy `create_engine(DATABASE_URL)` passed straight through — rejected:
    skips the SQLite tripwire and gap-naming errors Principle VII requires.

## R5. Railway Postgres: pgvector template (not stock Postgres)

- **Decision**: Provision via CLI `railway deploy -t 3jJFCA` (marketplace
  "pgvector" template, health 100 — creates service `pgvector` on the
  `pgvector/pgvector` image with volume at `/var/lib/postgresql/data`), run
  `CREATE EXTENSION IF NOT EXISTS vector;` once (verified vector 0.8.6).
  Backend references its private URL as
  `DATABASE_URL=${{pgvector.DATABASE_URL_PRIVATE}}`.
- **Rationale**: Constitution VII mandates the project's own PostgreSQL, and
  the local Compose file already uses `pgvector/pgvector:pg17` — prod must
  match dev or vector-dependent migrations diverge. Stock Postgres has no
  `vector` extension; `railway add -d` only offers stock Postgres, but
  `railway deploy -t` provisions the real template — verified 2026-09-15,
  so this is a CLI step (T014), not a dashboard step.
- **Alternatives considered**:
  - Stock Postgres + later migration — rejected: extension install on a live
    stock instance is riskier than starting on pgvector; dev/prod parity breaks.
  - External hosted Postgres (Neon/Supabase) — rejected: adds a second provider,
    public-network latency/egress, and secrets outside Railway's reference
    system.

## R6. Deploy workflow (`deploy.yml`): CLI deploy on push to `main`

- **Decision**: `push: branches: [main]` (+ `workflow_dispatch` for manual
  re-deploys once the file is on `main`) → two parallel jobs (`railway up
  ./frontend --path-as-root`, `railway up ./backend --path-as-root`, each with
  `--service/--environment/--ci` from `prod` vars, `RAILWAY_TOKEN` from the
  `prod` secret, `environment: prod` declared) → each polls `railway
  deployment list --limit 1 --json` 30×10s until `SUCCESS` (fail on
  `FAILED`/`CRASHED`/`CANCELLED`/timeout; tolerant read — `2>/dev/null` +
  `|| echo UNKNOWN` so transient GraphQL/network failures retry instead of
  aborting under GHA's `bash -e`) → `smoke` job (also `environment:
  prod`) curling `FRONTEND_URL`/`BACKEND_URL` with 12×20s retries, skipped
  until the URL vars exist. CLI pinned `npm i -g @railway/cli@5.2.0`.
  Concurrency group `railway-deploy`, `cancel-in-progress: false`.
- **Rationale**: CLI deploy from Actions keeps Actions the single deployment
  path (no Railway GitHub-app auto-deploy to drift). The `./<dir>
  --path-as-root` form is verified locally: uploads in <2s (5KB backend /
  131KB frontend), while bare `railway up` from inside the subdir spins at full
  CPU forever (observed CLI 5.35.1) — the workflow uses only the verified form.
  Services are Empty (source-less) with Root Directory unset: `--path-as-root`
  makes the uploaded subdir the archive root, so any dashboard Root Directory
  would resolve to a nested path that doesn't exist (verified: live services
  show `source: null`, `rootDirectory: null`).
  Pin 5.2.0 guards the v5.3.0 `RAILWAY_TOKEN` CI-auth regression ("Not signed
  in" on `railway up`); re-pin once upstream confirms the fix.
  `--path-as-root` verified present in 5.2.0 (`npx @railway/cli@5.2.0 up
  --help` shows it with 5.35.1-identical semantics) — the pin is safe.
  `--ci` (also verified in 5.2.0) streams build logs and exits non-zero on
  build failure — but per the CLI's own Automation notes it does NOT wait for
  health, so a crash-on-start passes `--ci` and smoke would curl the previous
  ACTIVE deploy (false green). The polling step closes that gap: only `SUCCESS`
  continues, so smoke always hits the NEW deployment per spec 1.2. `deployment
  list --json` verified in both 5.35.1 (live `SUCCESS` payload) and 5.2.0
  (`--help` shows `--service/--environment/--limit/--json`), parsed with
  `python3` (no `jq` dependency on runners). Smoke widened to 12×20s (~4 min)
  for cold first deploys (npm ci + astro build image + rollout).
  Secrets/vars live in the `prod` GitHub Environment (deployment branches:
  `main` only) with `environment: prod` on all three jobs — without the
  declaration, environment-scoped `secrets.RAILWAY_TOKEN` resolves empty and
  the deploy fails "Not signed in". Token type: `RAILWAY_TOKEN` accepts only
  a project token; an account token needs `RAILWAY_API_TOKEN` — a wrong type
  fails identically to the v5.3.0 regression, so check type before bisecting.
  A pre-merge `workflow_dispatch` dry-run is impossible for this first
  rollout (GitHub only registers workflows on the default branch — dispatch
  404s while the file lives solely on the feature branch, verified
  2026-09-15), so the V1 merge is the first token-path proof; dispatching
  from non-`main` branches works after merge with a temporary policy allow.
- **Alternatives considered**:
  - Railway GitHub-app auto-deploy — rejected: second deployment path outside
    code review; cannot run the smoke job or enforce CLI pin.
  - `railway up` without `--path-as-root` / from subdirs — rejected: hangs as
    documented above; would stall merge deploys.
  - Unpinned `latest` CLI — rejected: exposes CI to the 5.3.0-class regression.
  - `railway up --detach` — rejected: returns right after upload ("does not
    wait for the deployment to become healthy" per 5.2.0 Automation notes),
    so a failed build exits 0 and smoke would curl the previous deployment.
  - `--ci` without status polling (smoke-only health signal) — rejected: `--ci`
    passes on crash-on-start, and a 200 from the surviving OLD deploy makes
    smoke pass too. Polling `deployment list` until `SUCCESS` is the only
    signal that the NEW revision is serving.
  - Repo-level secrets/vars instead of the `prod` Environment — rejected:
    environment gating (branches: `main` only) is a second structural barrier
    beyond the `push: [main]` trigger, and matches the owner's existing `prod`
    environment.

## R7. CI workflow (`ci.yml`): PR gates, never deploy

- **Decision**: `pull_request: branches: [main]` → three jobs: `frontend`
  (`npm ci`, `npm test`, `check-content`, `check`, `lint`, `format:check`,
  `build`), `backend` (`pip install -e .[dev]`, `pytest`, `ruff check` +
  `format --check`), `docker` (both `docker build`, no push).
- **Rationale**: Deploy-on-merge is only safe if `main` is always green; CI
  runs the exact local gate set (README one-liners) plus both image builds so
  Dockerfile/`$PORT` mistakes fail on the PR, not on Railway. No `RAILWAY_TOKEN`
  in CI — PRs physically cannot deploy (SC-004).
- **Alternatives considered**:
  - CI + deploy in one workflow with `if: github.ref == 'refs/heads/main'` —
    rejected: mixes gate and deploy concerns; separate files make the
    never-deploy-on-PR property structural instead of conditional.
  - Skipping `docker build` in CI (build only on deploy) — rejected: Dockerfile
    errors would surface only after merge, breaking `main`.

## R8. Upload size control (`.railwayignore`)

- **Decision**: `.railwayignore` at root + copies in `frontend/` and `backend/`
  excluding `node_modules/`, `.venv/`, `.git/`, `dist/`, `.astro/`, coverage,
  caches, `*.egg-info/`, `.env*`. Plus `backend/.gitignore` for `.venv/`,
  caches, `*.egg-info/`.
- **Rationale**: First local `railway up` attempts tried to compress ~500MB of
  `node_modules`/`.venv`; with ignores, uploads are 5KB/131KB and deploy in
  seconds. `.dockerignore` files separately keep the Docker build context
  small — the two mechanisms cover CLI-upload and Docker-build paths.
- **Alternatives considered**:
  - Relying on `.gitignore` alone — rejected: Railway CLI honors
    `.railwayignore`/`.gitignore` interplay inconsistently across versions;
    explicit files are deterministic.

## R9. Testing strategy

- **Decision**:
  - Backend (pytest, test-first): `DATABASE_URL` parsing (valid URL incl.
    percent-decoding, precedence over `DB_*`, non-Postgres scheme rejection,
    missing-part errors) in `backend/tests/test_health.py` — 4 new tests, 9/9
    total green.
  - Dockerfiles: verified by local `docker build` + `docker run` + `curl`
    (frontend `/` → 200, chords page → 200, backend `/health` →
    `{"status":"ok"}`), including dynamic `$PORT` on non-default ports
    (frontend :4567, backend :9123).
  - Workflows: YAML parse + `actionlint` clean + eyeball secret scan (no
    hardcoded tokens/IDs); CI itself is the live test on PR #1.
  - Railway: local `railway up` to linked project, both reach SUCCESS, domains
    generated, smoke curls green, deploy logs clean (uvicorn + serve on
    injected `$PORT` 8080).
- **Rationale**: Satisfies Principle III (test-first for the one code change,
  `db.py`) and extends it to infra: every artifact is verified by execution,
  not inspection, before merge.
- **Alternatives considered**:
  - Unit-testing YAML with schema validators — rejected: `actionlint` + real CI
    runs subsume static schema checks.

## R10. What stays manual (and why)

- **Decision**: Only Railway project creation + `RAILWAY_TOKEN` minting are
  owner dashboard steps (no CLI command mints project tokens; tokens are
  project-scoped so the new project needed a re-mint). Everything else is CLI:
  `railway add -s <name>` for Empty Services (never Connect Repo),
  `railway deploy -t 3jJFCA` for pgvector-template Postgres,
  `railway variable set 'DATABASE_URL=${{pgvector.DATABASE_URL_PRIVATE}}'`,
  `psql` for `CREATE EXTENSION`, `railway domain -s` for domains, `gh api`
  for the `prod` Environment vars + `main`-only branch policy. Dashboard
  services showing zero instances with
  `railway up` 404ing are FIRST checked for an un-applied staged changeset
  (dashboard Deploy banner unclicked — `unmergedChangesCount` in
  `railway status --json`); only if instances are still zero after applying
  are the shells removed with
  `railway api 'mutation($id: String!) { serviceDelete(id: $id) }'`
  (`railway service delete` cannot remove zero-instance shells) and recreated
  with `railway add -s`. All executed 2026-09-15 on
  `music-railway-infraestructure` (T014); the `RAILWAY_TOKEN` auth path is
  proven on merge (V1) — no pre-merge dispatch possible (V0 is post-merge
  only).
- **Rationale**: The 2026-09-15 session proved the CLI surface covers the whole
  setup except project + token creation — the honest boundary is two dashboard
  clicks, not a manual checklist (T010/T014).
- **Alternatives considered**: none — capability boundary, not a choice.

## Toolchain pins (verified 2026-09-15)

- Node v22.19.0, npm 10.9.3, Python 3.12.11, Docker 29.4.0, Railway CLI 5.35.1
  (local) / 5.2.0 (CI pin), `serve@14`, `node:22-slim`, `python:3.12-slim`.
- `actions/checkout@v4`, `actions/setup-node@v4`, `actions/setup-python@v5`,
  `ubuntu-latest` runners.
- Exact app versions pinned at build time in `frontend/package.json`,
  `backend/pyproject.toml`, Dockerfiles — not guessed here.
