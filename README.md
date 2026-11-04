# Music App Example — course catalog with chords explorer

A spec-driven music course catalog. The first course is **Ukulele**, starting with a **Chords** topic: 24 major/minor chord entries with fingering diagrams, a grouped filter (type + note spelling, enharmonic-aware), and inline-expandable details.

Built with [Spec Kit](https://github.com/github/spec-kit): every feature starts as a spec under `specs/`. Application code lives only in `frontend/` and `backend/`; the repo root holds specs, shared config, and deployment.

| App | Stack | Live |
|---|---|---|
| Frontend | Astro 7 (static) + React 19 islands + Tailwind v4 + shadcn/ui | [frontend.example.com](https://frontend.example.com) |
| Backend | Python 3.12 + FastAPI + AgentOS scaffold + PostgreSQL/pgvector | [backend.example.com/health](https://backend.example.com/health) |

## Repo layout

```
specs/                  # Spec Kit: spec.md / plan.md / tasks.md per feature
frontend/               # Astro static site (Content Layer JSON, one React island)
  src/content/          # courses, topics, games, chords (Zod-validated)
  src/lib/              # pure domain logic (notes, schemas, validate, chords, slug, routes)
  Dockerfile            # node build + serve dist/ on $PORT
backend/                # AgentOS scaffold (v1: health-only, no feature traffic)
  app/main.py           # FastAPI app (GET /health)
  db.py                 # Postgres config: DATABASE_URL or DB_* (no SQLite, ever)
  agents/ evals/        # reserved for future agents + test-scenario evals
  Dockerfile            # uvicorn on $PORT
.github/workflows/      # ci.yml (PR gates) + deploy.yml (merge-to-main Railway deploy)
docker-compose.yml      # local api + pgvector db
```

## Local development

Prereqs: Node 22, Python 3.12, Docker, and the Infisical CLI (`brew install infisical/get-cli/infisical`, then `infisical login` once, with access to the `music app` project).

```bash
# Backend + Postgres (Docker). Secrets come from Infisical (dev); there is no .env file.
infisical run --env=dev --path=/backend -- docker compose up -d --build
curl http://localhost:8000/health   # {"status":"ok",...}
infisical run --env=dev --path=/backend -- docker compose down   # stop (bare down fails too)

# Frontend (dev server)
cd frontend && npm install && npm run dev   # http://localhost:4321
```

There is no `.env` fallback any more. Always run through `infisical run`: a bare `docker compose` fails fast without `DB_PASSWORD`, and a bare `pytest` skips the DB tests with a "DB_PASSWORD not set" reason.

Gates (same as CI; the backend line needs the Infisical dev env for the DB tests):

```bash
cd frontend && npm test && npm run check-content && npm run check && npm run lint && npm run format:check && npm run build
cd backend && infisical run --env=dev --path=/backend -- .venv/bin/pytest && .venv/bin/ruff check . && .venv/bin/ruff format --check .
docker build -t fe ./frontend && docker build -t be ./backend
```

## Secrets (Infisical)

No `.env` files. Secrets live in Infisical (project `music app`, linked by `.infisical.yaml`, default environment `dev`) and reach a process only through `infisical run`. `.env.example` is a names-only manifest of what the app reads.

| Secret or variable | Lives in | Reaches the app via |
|---|---|---|
| Backend secrets and config (`DB_PASSWORD`, `OPENROUTER_API_KEY`, …) | Infisical `dev` `/backend` | `infisical run --env=dev --path=/backend -- …` |
| Prod backend variables (`OPENROUTER_API_KEY`, `CORS_ORIGINS`, `SECOND_VOICE_MODEL_ID`) | Infisical `prod` `/backend` | Secret Sync `prod-backend-to-railway` to the Railway `backend` service. Auto-Sync is off, so trigger it after every edit |
| Terraform and Auth0 provisioning (`AUTH0_*`, `TF_*`) | Infisical `dev` `/infra/auth0` | Terraform only (not scaffolded yet) |
| `DATABASE_URL`, `PORT`, `RAILWAY_*` | Railway (`DATABASE_URL` references `pgvector`) | not in Infisical |
| `RAILWAY_TOKEN` | GitHub environment `prod` | `deploy.yml` |
| `PUBLIC_*` (browser-visible, not secret) | Railway `frontend` service variable | Docker build arg |

**Add a variable.** List it under `api.environment` in `docker-compose.yml` (only listed names reach the container), add the name to `.env.example`, set the dev value in Infisical `dev` `/backend`, then `infisical run … -- docker compose up -d` (`restart` does not re-read env). For prod, add it under Infisical `prod` `/backend` and trigger the sync.

**Rotate.** Create the new value first and revoke the old one last, and only when no other place still holds it: dev, prod and Railway can share one provider key, so compare their 8-hex digests before revoking. `/health` is static and cannot confirm a rotation: check the DB-backed `GET /api/v1/history?limit=1` and the provider's own key check. Prod keys are owned by Infisical: edit them only there, because the next sync overwrites direct Railway edits. Removing a prod key means deleting it in Infisical and in Railway, because the sync never deletes. The prod database password is not a plain variable edit: the `pgvector` image reads `POSTGRES_PASSWORD` only on first init, so the role must be changed first.

Agent skills with the full procedures, checks and recovery steps: [`run-app-locally`](.claude/skills/run-app-locally/SKILL.md), [`add-secret`](.claude/skills/add-secret/SKILL.md), [`rotate-secret`](.claude/skills/rotate-secret/SKILL.md).

## Deploying to Railway

Deploys run from GitHub Actions on every push to `main` (`.github/workflows/deploy.yml`). One-time setup:

### 1. Create the Railway project (CLI — verified 2026-09-15 on `music-railway-infraestructure`)

Project creation itself is dashboard-only ([Railway dashboard](https://railway.app) → New Project → **Empty Project** — do NOT use "Deploy from GitHub repo": a connected repo auto-deploys on every push to `main`, double-deploying alongside Actions and breaking the single-deployment-path contract). Everything after that runs from the repo root with user-auth CLI (`railway login`):

```bash
railway link   # select music-railway-infraestructure / production

# 1. Empty services (source-less, Root Directory unset — required by --path-as-root uploads)
railway add -s backend --json
railway add -s frontend --json

# 2. pgvector database (marketplace template 3jJFCA "pgvector", health 100)
railway deploy -t 3jJFCA   # creates service `pgvector` (+ volume) with private DATABASE_URL

# 3. Wire backend → database over the private network (no egress fees)
railway variable set 'DATABASE_URL=${{pgvector.DATABASE_URL_PRIVATE}}' -s backend --skip-deploys

# 4. One-time: enable the vector extension (verified: vector 0.8.6)
railway connect pgvector -- -c "CREATE EXTENSION IF NOT EXISTS vector;" -c "SELECT extname, extversion FROM pg_extension WHERE extname='vector';"
# (--ssh auto-enables when no proxy exists; no PGURL/psql needed, no credential in shell history)

# 5. Deploy both + generate domains
railway up ./backend --path-as-root --service backend --environment production --ci    # → SUCCESS
railway up ./frontend --path-as-root --service frontend --environment production --ci  # → SUCCESS
railway domain -s backend    # → https://backend.example.com
railway domain -s frontend   # → https://frontend.example.com

# 6. Lock down pgvector: delete the template's public TCP proxy (T017 end state —
#    backend uses DATABASE_URL_PRIVATE only; future psql via `railway connect`)
railway tcp-proxy delete <proxy-id> -s pgvector -y   # id from `railway tcp-proxy list -s pgvector`
```

> Gotcha: dashboard-created Empty Services sometimes show **zero production instances** and `railway up` 404s. Check for an un-applied staged changeset FIRST — Railway stages dashboard changes (adding services included) until the purple **Deploy** banner is clicked ([staged changes](https://docs.railway.com/deployments/staged-changes)): `railway status --json | python3 -c "import json,sys; print(json.load(sys.stdin)['environments']['edges'][0]['node'].get('unmergedChangesCount'))"` — non-null/non-zero means click **Deploy** in the dashboard and the instances appear (CLI commits immediately, which is why `railway add` never hits this). Only if instances are still zero after applying: delete via GraphQL — `railway api 'mutation($id: String!) { serviceDelete(id: $id) }' --var id="<service-id>"` (IDs from `railway status --json`; `railway service delete` can't remove zero-instance shells — "not found in environment") — then re-create with `railway add -s <name>`. Likewise, if a repo got connected or a Root Directory set: Service Settings → **Disconnect** the repo (or Deploy → **Auto-deploy OFF**) and clear **Root Directory** — CLI uploads carry their own root.

### 2. Set GitHub secrets + vars (Environment `prod`)

Repo → Settings → Environments → `prod` (create it if missing):

- **Deployment branches**: Selected branches → `main` only.
- **Environment secrets**: `RAILWAY_TOKEN` = **project** token (Railway project → Settings → Tokens), scoped to `production`. Token type matters: `RAILWAY_TOKEN` accepts only a project token — an account token needs `RAILWAY_API_TOKEN` instead. A wrong type fails as "Not signed in", identical to the v5.3.0 CLI regression — check token type before bisecting the CLI.
- **Environment variables**:

| Name | Value |
|---|---|
| `RAILWAY_ENVIRONMENT` | `production` |
| `RAILWAY_SERVICE_FRONTEND` | `frontend` |
| `RAILWAY_SERVICE_BACKEND` | `backend` |
| `FRONTEND_URL` | `https://frontend.example.com` |
| `BACKEND_URL` | `https://backend.example.com` |

Set via CLI: `gh api repos/<owner>/<repo>/environments/prod/variables -X POST -f name=<NAME> -f value=<VALUE>` (all five set 2026-09-15; branch policy `main` only via `gh api repos/<owner>/<repo>/environments/prod/deployment-branch-policies -X POST -f name=main`).

> GitHub environment `prod` ≠ Railway environment `production`. `prod` is GitHub's label gating which branches can read the token/vars; `RAILWAY_ENVIRONMENT=production` tells the CLI which Railway environment to deploy to. `deploy.yml` declares `environment: prod` on all three jobs — without it, `${{ secrets.RAILWAY_TOKEN }}` resolves empty and the deploy fails "Not signed in".

### 3. Merge to deploy (the merge proves the token path)

Push/merge to `main` → `deploy.yml` installs the pinned Railway CLI (`@railway/cli@5.2.0` — v5.3.0 broke `RAILWAY_TOKEN` CI auth), runs `railway up ./<dir> --path-as-root --service … --environment … --ci` per service (`--ci` streams build logs and fails the job on build failure — `--detach` would return after upload), polls `railway deployment list --json` (tolerant read — transient GraphQL/network failures retry as `UNKNOWN` instead of aborting under `bash -e`) until each deploy reaches `SUCCESS` (fails on `FAILED`/`CRASHED`/timeout — `--ci` alone can't catch crash-on-start), then smoke-tests both public URLs (skipped until `FRONTEND_URL`/`BACKEND_URL` are set).

> No pre-merge dry-run is possible for this first rollout: GitHub only registers workflows present on the default branch, so `workflow_dispatch` can't fire while `deploy.yml` exists solely on the feature branch (verified 2026-09-15 — API dispatch 404s). The PR #1 merge is therefore the first live proof of the `RAILWAY_TOKEN` path. After merge, `workflow_dispatch` stays available for manual re-deploys — dispatching from any non-`main` branch requires temporarily allowing it in the `prod` deployment-branch policy, then re-restricting:
>
> ```bash
> gh api repos/<owner>/<repo>/environments/prod/deployment-branch-policies -X POST -f name=<branch>
> gh workflow run deploy.yml --ref <branch> && gh run watch <run-id>
> gh api repos/<owner>/<repo>/environments/prod/deployment-branch-policies/<id> -X DELETE
> ```

PRs never deploy — `ci.yml` runs the full gate set (tests, `astro check`, content gate, lint/format, both `docker build`s) and must be green before merge.

## Specs

- [`specs/001-music-course-catalog`](specs/001-music-course-catalog/) — catalog, course/topic/game cards, chords explorer (shipped).
- [`specs/002-railway-deploy`](specs/002-railway-deploy/) — Railway containers, GitHub Actions deploy, this README (this PR).

## Constitution

Project principles live in [`.specify/memory/constitution.md`](.specify/memory/constitution.md): spec-driven workflow, monorepo boundaries, test-first, Postgres-only persistence, clean layering (`pages → components → lib → content`, `app → domain → db`).
