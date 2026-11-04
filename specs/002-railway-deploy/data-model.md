# Data Model: Railway Deploy (frontend + backend)

**Feature**: `002-railway-deploy` | **Date**: 2026-09-15
**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Phase 1 output. No application data entities: this feature provisions
deployment infrastructure. Entities below are configuration contracts —
field contracts: [contracts/deploy-workflow.md](./contracts/deploy-workflow.md),
[contracts/railway-services.md](./contracts/railway-services.md).

## Entities

### RailwayProject (dashboard-provisioned, referenced — not created by code)

Logical container for all services. Created once by the owner.

| Field | Type | Required | Validation |
|---|---|---|---|
| `name` | string | yes | Railway-assigned (verified: `music-railway-infraestructure`; supersedes `peaceful-fascination` pilot) |
| `environment` | string | yes | MUST be `production` (matches `RAILWAY_ENVIRONMENT` var) |
| `token` | secret | yes | Project token scoped to `production`; stored ONLY as GitHub secret `RAILWAY_TOKEN`, never in repo |

Relationships: has many Services (3 app services in v1: frontend, backend, pgvector — owner's cli-probe excluded).

### Service (`frontend` / `backend` — code-configured via `railway.json` + Dockerfile)

| Field | Type | Required | Validation |
|---|---|---|---|
| `name` | string | yes | MUST equal `RAILWAY_SERVICE_FRONTEND` / `RAILWAY_SERVICE_BACKEND` var value |
| `source` | null | yes (MUST be source-less) | Empty Service — no GitHub repo or image connected (a connected repo auto-deploys on push, double-deploying alongside Actions) |
| `rootDirectory` | null | yes (MUST be unset) | MUST be empty — `deploy.yml` uploads `./<dir> --path-as-root` so the archive root already IS the service dir; a set Root Directory fails the build ("could not find root directory") |
| `builder` | literal | yes | MUST be `DOCKERFILE` (pinned in `railway.json`, R3) |
| `dockerfilePath` | string | yes | `Dockerfile` (relative to service root) |
| `healthcheckPath` | string | backend yes, frontend no | backend MUST be `/health`; frontend has no healthcheck (static `serve`) |
| `port` | int (injected) | yes | Railway injects `$PORT` at runtime; images MUST bind it with local defaults (frontend 3000, backend 8000) |
| `domain` | URL | yes (post-setup) | `https://<service>-production-<hash>.up.railway.app` (verified: `frontend-production-xxxx`, `backend-production-xxxxx`); recorded as `FRONTEND_URL` / `BACKEND_URL` vars for smoke |

### PostgresService (pgvector template — CLI-provisioned via `railway deploy -t 3jJFCA`)

| Field | Type | Required | Validation |
|---|---|---|---|
| `image` | string | yes | MUST start with `pgvector/pgvector` (never stock `postgres`) |
| `volume` | string | yes | Mounted at `/var/lib/postgresql/data` |
| `privateURL` | secret-ref | yes | `DATABASE_URL_PRIVATE` (`pgvector.railway.internal:5432`); backend consumes via `${{pgvector.DATABASE_URL_PRIVATE}}` reference (service is named `pgvector`) |
| `extension` | string | yes | `vector` extension created once (`CREATE EXTENSION IF NOT EXISTS vector;` — verified vector 0.8.6) |

### GitHubVars (repo Settings → Environments → `prod`; deployment branches: `main` only)

| Name | Type | Required | Validation |
|---|---|---|---|
| `RAILWAY_TOKEN` | secret | yes | Non-empty PROJECT token (account tokens need `RAILWAY_API_TOKEN`); only `deploy.yml` jobs (all `environment: prod`) may reference it |
| `RAILWAY_ENVIRONMENT` | variable | yes | `production` |
| `RAILWAY_SERVICE_FRONTEND` | variable | yes | Exact Railway frontend service name |
| `RAILWAY_SERVICE_BACKEND` | variable | yes | Exact Railway backend service name |
| `FRONTEND_URL` | variable | no (post-domain) | `https://…`; empty skips frontend smoke |
| `BACKEND_URL` | variable | no (post-domain) | `https://…`; empty skips backend smoke |

### DatabaseConfig (code entity — extended, not new)

Existing `backend/db.py` dataclass, unchanged shape; only the loader gains a
`DATABASE_URL` path (R4). See 001 data-model for base; new validation:

| Rule | Enforcement |
|---|---|
| `DATABASE_URL` scheme ∈ {`postgres`, `postgresql`} | `config_from_database_url()` raises `ConfigError` naming expected schemes |
| host present, not SQLite; name present, not `*.db`; user + password present | `ConfigError` naming the missing part |
| `DATABASE_URL` takes precedence over `DB_*` when set | loader order; covered by precedence test |
| `DB_*` path unchanged (5 vars, SQLite tripwire) | existing tests untouched |

## Validation rules (build + test)

1. `railway.json` files are valid JSON with `build.builder == "DOCKERFILE"`.
2. Backend `railway.json` declares `deploy.healthcheckPath == "/health"`.
3. Dockerfiles bind `$PORT` with defaults (frontend 3000, backend 8000) —
   proven by `docker run -e PORT=<non-default>` + curl (R9).
4. `deploy.yml` references service names/environment ONLY via
   `${{ vars.… }}` / `${{ secrets.RAILWAY_TOKEN }}` from the `prod`
   Environment (all jobs declare `environment: prod`) — no hardcoded IDs
   (grep-verified in T007).
5. `ci.yml` references NO secrets — PRs cannot deploy (SC-004 structural).
6. `db.py` rules above — 9/9 pytest green, incl. 4 new `DATABASE_URL` tests.

## State transitions

- Services: `BUILDING → DEPLOYING → ACTIVE` (Railway-managed); failed builds
  keep the previous `ACTIVE` deployment (spec acceptance 1.2).
- `FRONTEND_URL`/`BACKEND_URL` vars: empty → set (post `railway domain`);
  smoke steps skip while empty, enforce once set.
- No application data lifecycle in this feature.
