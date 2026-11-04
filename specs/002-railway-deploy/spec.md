# Feature Specification: Railway Deploy (frontend + backend)

**Feature Branch**: `002-railway-deploy`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "Deploy all to Railway — frontend and backend. Investigate most recent docs for Astro→Railway and Agno/AgentOS→Railway, write a GitHub Action for deployment, create a private GitHub repo, new README, new PR, then ping me to set env vars so merge deploys the app."

## User Scenarios & Testing

### User Story 1 - Merge to main deploys both services (Priority: P1)

Maintainer merges a PR into `main`; GitHub Actions deploys the Astro frontend and the FastAPI/AgentOS backend to Railway automatically. No manual CLI steps.

**Why this priority**: This is the whole feature — push-button deploys from the default branch.

**Independent Test**: Merge a trivial commit to `main`, watch the `deploy` workflow run green, then open the Railway frontend domain and `/health` on the backend domain.

**Acceptance Scenarios**:

1. **Given** `RAILWAY_TOKEN` secret + service names configured in the `prod` GitHub Environment, **When** a commit lands on `main`, **Then** the deploy workflow deploys frontend and backend services to the `production` environment.
2. **Given** a deploy is in progress, **When** either service fails to build/start, **Then** the workflow fails loudly and Railway keeps the previous healthy deployment.

---

### User Story 2 - PRs are gated by CI, never deployed (Priority: P2)

Every pull request runs the full local gate set (frontend tests/check-content/check/lint/format + backend pytest/ruff + docker builds) so broken code cannot reach `main` and trigger a deploy.

**Why this priority**: Deploy-on-merge is only safe if `main` is always green.

**Independent Test**: Open a PR with a deliberately broken test; CI fails and no deploy runs.

**Acceptance Scenarios**:

1. **Given** an open PR, **When** CI runs, **Then** frontend unit tests, `astro check`, content gate, backend tests, and both `docker build`s all pass before merge is allowed.
2. **Given** an open PR, **When** CI is green, **Then** no Railway deployment is triggered (deploys only fire on `main`).

---

### User Story 3 - One-command local parity check (Priority: P3)

A contributor can build and run both production Docker images locally (`docker build` + `docker run`) and hit the same `/health` and pages Railway will serve, before ever pushing.

**Why this priority**: Catches Dockerfile/PORT/healthcheck mistakes without burning Railway deploys.

**Independent Test**: Build both images locally, run them, `curl` frontend index + backend `/health`.

**Acceptance Scenarios**:

1. **Given** a clean checkout, **When** running the documented docker commands, **Then** both images build and serve traffic on the mapped ports.

---

### Edge Cases

- Railway injects `$PORT` dynamically per service — both images MUST listen on `$PORT` (with a sane local default), not a hardcoded port.
- `frontend/` has a `prebuild` content gate (`check-content` via `tsx`) — the frontend image build MUST run `npm ci` (not `npm ci --omit=dev`) so the gate runs inside Docker too.
- Backend `DATABASE_URL` (Railway pgvector template) vs local `DB_*` vars — backend MUST accept `DATABASE_URL` and fall back to `DB_*`.
- Railway CLI v5.3.0 broke `RAILWAY_TOKEN` auth in CI — workflow MUST pin `@railway/cli@5.2.0` until the regression is fixed upstream.
- Config-as-code (`railway.json`) is deprecated but honored until 2026-12-01 — keep files minimal (builder + healthcheck) so migration to IaC is trivial.

## Requirements

### Functional Requirements

- **FR-001**: Repo MUST contain `frontend/Dockerfile` building the Astro static site (`npm ci` + `npm run build`) and serving `dist/` on `$PORT`.
- **FR-002**: Repo MUST contain an updated `backend/Dockerfile` serving uvicorn on `$PORT` with default 8000.
- **FR-003**: Backend MUST parse `DATABASE_URL` (PostgreSQL scheme) into host/port/name/user/password, falling back to `DB_*` env vars; missing config MUST raise `ConfigError` naming the gap.
- **FR-004**: Repo MUST contain `frontend/railway.json` and `backend/railway.json` pinning `DOCKERFILE` builder; backend config MUST declare `/health` healthcheck path.
- **FR-005**: Repo MUST contain `.github/workflows/deploy.yml` that on push to `main` (plus `workflow_dispatch` for manual re-deploys) deploys both services via `railway up ./<dir> --path-as-root --service <name> --environment production --ci` with CLI pinned to 5.2.0, then polls `railway deployment list --json` (tolerant read retrying as `UNKNOWN` on transient failure) until each deploy reaches `SUCCESS` (failing on `FAILED`/`CRASHED`/timeout); all jobs MUST declare `environment: prod`.
- **FR-006**: Repo MUST contain `.github/workflows/ci.yml` that on PRs runs the full gate set (frontend: test/check-content/check/lint/format/build; backend: pytest/ruff; both docker builds).
- **FR-007**: Service names, environment, and project scoping in `deploy.yml` MUST come from the `prod` GitHub Environment vars/secrets (branch-gated to `main`), never hardcoded IDs.
- **FR-008**: Root `README.md` MUST document architecture, local dev, Railway setup (services, pgvector template, variable references, domains), required GitHub secrets/vars, and the merge-to-deploy flow.
- **FR-009**: Railway Postgres MUST be the pgvector template image (`pgvector/pgvector`), not stock Postgres, with a volume at `/var/lib/postgresql/data`; backend MUST reference its private URL (`DATABASE_URL=${{pgvector.DATABASE_URL_PRIVATE}}` style reference, no public URL in app env).

### Key Entities

- **Railway project**: one project, three services — `frontend` (Empty Service: no GitHub source, Root Directory unset, deployed via `railway up ./frontend --path-as-root`), `backend` (same via `./backend`), `pgvector` (template 3jJFCA image + volume).
- **GitHub environments/secrets**: `prod` Environment (deployment branches: `main` only) holding `RAILWAY_TOKEN` (secret, Railway PROJECT token scoped to `production` — account tokens need `RAILWAY_API_TOKEN`); vars `RAILWAY_ENVIRONMENT`, `RAILWAY_SERVICE_FRONTEND`, `RAILWAY_SERVICE_BACKEND`, `FRONTEND_URL`, `BACKEND_URL`.
- **Deploy workflow**: `deploy.yml` — push-to-`main` + `workflow_dispatch` re-deploy, `environment: prod` on all jobs; two deploy jobs (`railway up --ci` + tolerant poll-until-`SUCCESS`) + smoke job curling both public URLs.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Push to `main` triggers `deploy.yml`; both Railway services reach `ACTIVE` with the new deployment.
- **SC-002**: `GET <frontend-url>/` returns 200 with the catalog; `GET <backend-url>/health` returns `{"status":"ok"}`.
- **SC-003**: `docker build` succeeds for both images from a clean checkout; containers serve traffic on mapped ports locally.
- **SC-004**: A PR with a failing test shows red CI and triggers zero Railway deployments.

## Assumptions

- Railway account + project creation and `RAILWAY_TOKEN` issuance are manual one-time dashboard steps done by the repo owner; services, pgvector template, variable reference, domains, and GitHub vars are CLI-automated (documented in README).
- `main` is the production branch; `production` is the Railway environment name.
- Backend ships with `AGENTOS_ENABLED=false` (health-only) — enabling AgentOS/JWT is out of scope for this spec.
- GitHub repo is private; Railway deploys via CLI from Actions (`railway up`), not via Railway's GitHub-app auto-deploy, so Actions stays the single deployment path.
- Research sources (verified 2026-09-15): Astro Railway guide (Railpack default, zero-config static), Railway config-as-code reference (DOCKERFILE builder always wins; deprecated → IaC by 2026-12-01), Railway FastAPI guide (Dockerfile auto-detected, uvicorn on `$PORT`), Agno deploy docs (`agnohq/python:3.12`, uvicorn `0.0.0.0:8000`, `agentos-railway` reference template, `AGENTOS_URL`/JWT notes), Railway pgvector template (private `DATABASE_URL`, volume mount), Railway CLI docs + station reports (pin `@railway/cli@5.2.0`; `RAILWAY_TOKEN` + `--service/--environment`).
