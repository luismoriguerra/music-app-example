# Implementation Plan: Railway Deploy (frontend + backend)

**Branch**: `002-railway-deploy` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-railway-deploy/spec.md`

## Summary

Merge-to-`main` deploys the Astro frontend and FastAPI/AgentOS backend to
Railway via GitHub Actions, with PRs gated by full CI that can never deploy.
Technical approach (from research): multi-stage `node:22-slim` frontend image
(`npm ci` + build incl. `prebuild` content gate, `serve dist/` on `$PORT`);
`python:3.12-slim` backend image (uvicorn on `$PORT`, default 8000);
per-service `railway.json` pinning the `DOCKERFILE` builder (+ `/health`
check on backend); `db.py` parses Railway-style `DATABASE_URL` with `DB_*`
fallback; `ci.yml` runs all local gates + both `docker build`s on PRs;
`deploy.yml` runs verified `railway up ./<dir> --path-as-root` per service
(CLI pinned 5.2.0) + tolerant poll-until-`SUCCESS` per deploy + smoke curls on
push to `main` (plus `workflow_dispatch` manual re-deploy; all jobs
`environment: prod`); root README documents
the one-time setup (pgvector template, var references, domains — CLI-automated,
README documents the commands)
and the secrets/vars contract.

## Technical Context

**Language/Version**: Dockerfile + YAML (workflows/config) over existing
TypeScript 5.x / Astro 7 + Python 3.12 apps; Node 22 + Python 3.12 in CI

**Primary Dependencies**: `node:22-slim`, `serve@14`, `python:3.12-slim`,
`@railway/cli@5.2.0` (pinned, R6), `actions/checkout@v4`,
`actions/setup-node@v4`, `actions/setup-python@v5`

**Storage**: Railway Postgres via pgvector template (`pgvector/pgvector`
image, volume `/var/lib/postgresql/data`, `vector` extension); backend
consumes private `DATABASE_URL` reference. No new app tables in v1.

**Testing**: pytest + ruff (backend `DATABASE_URL` unit tests, 9/9);
`docker build` + `docker run` + curl incl. non-default `$PORT` (images);
YAML parse + `actionlint` + secret scan (workflows); local `railway up` +
domains + smoke curls + deploy-log review (Railway verification)

**Target Platform**: Railway (Linux containers, `production` environment) —
`frontend` + `backend` as Empty Services (no GitHub source, Root Directory
unset) deployed via CLI, `pgvector` from template 3jJFCA; local Docker for
parity checks

**Project Type**: Web application (frontend + backend) — infrastructure feature

**Performance Goals**: Deploy workflow completes in <12 min end to end
(30×10s SUCCESS-poll per deploy job + 12×20s smoke retries covering cold
rollout); local image builds <5 min each on broadband (npm/pip caches excluded)

**Constraints**: Railway injects dynamic `$PORT` per service (images MUST bind
it, R1/R2); frontend build MUST include devDeps for the `tsx` prebuild gate;
`railway.json` minimal (deprecated → IaC by 2026-12-01, R3); no secrets/IDs
in repo (vars/secrets only); `AGENTOS_ENABLED=false` (health-only, no DB
traffic in v1)

**Scale/Scope**: 3 Railway services, 2 workflows, 2 Dockerfiles, 2
`railway.json` files, 1 `db.py` extension (+4 tests), 1 README; 0 app routes
changed

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Spec-driven (MUST phases) | PASS | specify → plan now; tasks → analyze → implement → converge to follow; `clarify` skipped with written justification (0 NEEDS CLARIFICATION, checklists/requirements.md) |
| II. Monorepo boundaries | PASS | App code untouched outside `backend/db.py` (+tests, same owner); new files are per-app (`frontend/`+`backend/` Dockerfiles/config) or shared root config (workflows, README) — allowed shared config |
| III. Test-first both apps | PASS | `db.py` change test-first (4 new pytest, 9/9 green); Dockerfiles verified by build+run+curl; workflows by actionlint + live CI |
| IV. Agent evals | N/A | No agents ship or change — no test-scenarios required |
| V. Evidence-based models | N/A (recorded) | No hosted inference; no model chosen |
| VI. Browser AI | N/A (compatible) | No browser AI; static serving unchanged |
| VII. Backend runtime + Postgres | PASS | Own Postgres via pgvector template (dev Compose already pgvector); `DATABASE_URL` private reference; no SQLite; JWT/RBAC still deferred (anonymous health-only, no exposed feature traffic) |
| VIII. Clean code & architecture | PASS | `db.py` stays pure config parsing (no web imports); no layering changes; lint/format gates (`ruff`, frontend gates) run in CI |
| Tech Constraints & Standards | PASS | Pinned toolchains (Node 22, Py 3.12, CLI 5.2.0); secrets via env/secret-store only |
| Workflow gates | PASS | One-liner gates preserved and mirrored in CI; README documents dev/test/build |

Post-design re-check: no new violations introduced. No Complexity Tracking
entries needed (no unjustified violations).

## Project Structure

### Documentation (this feature)

```text
specs/002-railway-deploy/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── deploy-workflow.md
│   └── railway-services.md
├── checklists/
│   └── requirements.md  # Spec quality gate (/speckit-specify output)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
.github/
└── workflows/
    ├── ci.yml                 # PR gates: frontend + backend + docker (new)
    └── deploy.yml             # push-to-main: railway up × 2 + smoke (new)

frontend/                       # Astro app (astro-frontend owns)
├── Dockerfile                  # node:22 multi-stage: npm ci + build → serve dist/ on $PORT (new)
├── .dockerignore               # build-context excludes (new)
├── .railwayignore              # CLI-upload excludes (new, copy of root)
└── railway.json                # DOCKERFILE builder + restart policy (new)

backend/                        # AgentOS scaffold (agno-backend owns)
├── Dockerfile                  # $PORT-aware uvicorn CMD + explicit packaging copies (edit)
├── .dockerignore               # build-context excludes (edit: egg-info)
├── .railwayignore              # CLI-upload excludes (new, copy of root)
├── .gitignore                  # .venv/caches/egg-info (new)
├── railway.json                # DOCKERFILE builder + /health check (new)
├── db.py                       # + DATABASE_URL parsing (edit, pure config)
└── tests/test_health.py        # + 4 DATABASE_URL tests (edit)

.railwayignore                   # root CLI-upload excludes (new)
README.md                        # architecture + local dev + Railway setup + secrets contract (new)
```

**Structure Decision**: Web application layout (existing `frontend/` +
`backend/` monorepo, Principle II). Infra files live with their owner app;
cross-cutting deploy orchestration (workflows) and docs (README) live at root
as shared config. No new top-level app directories.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — nothing to track.
