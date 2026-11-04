# Contract: GitHub Workflows (`ci.yml` / `deploy.yml`)

**Feature**: `002-railway-deploy` | **Date**: 2026-09-15

Phase 1 output. Defines the trigger/inputs/jobs/outputs contract for both
workflows. Any workflow edit MUST keep this contract green.

## `ci.yml` — PR gates (never deploys)

- **Trigger**: `pull_request: branches: [main]` ONLY.
- **Secrets**: NONE. `ci.yml` MUST NOT reference `${{ secrets.* }}`.
- **Jobs** (all must pass before merge):
  | Job | Steps (in order) |
  |---|---|
  | `frontend` (`ubuntu-latest`, `working-directory: frontend`, Node 22) | `npm ci`, `npm test`, `npm run check-content`, `npm run check`, `npm run lint`, `npm run format:check`, `npm run build` |
  | `backend` (`ubuntu-latest`, `working-directory: backend`, Python 3.12) | `pip install -e .[dev]`, `pytest`, `ruff check . && ruff format --check .` |
  | `docker` (`ubuntu-latest`) | `docker build -t music-app-example-frontend:ci ./frontend`, `docker build -t music-app-example-backend:ci ./backend` |
- **Outputs**: GitHub Check runs (red/green). No artifacts, no deployments.

## `deploy.yml` — merge-to-main Railway deploy

- **Trigger**: `push: branches: [main]` with `paths-ignore: ['specs/**',
  '**/*.md', '.specify/**', '.claude/**']` (docs/spec-only pushes skip the
  production rebuild entirely) + `workflow_dispatch` (manual re-deploy;
  usable once the file is on `main` — dispatches from other branches require
  temporarily allowing that branch in the `prod` deployment-branch policy,
  then re-restricting to `main`).
- **Concurrency**: group `railway-deploy`, `cancel-in-progress: false`
  (deploys queue, never cancel each other).
- **Inputs** (ALL from the `prod` GitHub Environment — never hardcoded, never repo-level):
  | Name | Source | Example |
  |---|---|---|
  | `RAILWAY_TOKEN` | `${{ secrets.RAILWAY_TOKEN }}` | PROJECT token, `production`-scoped (account tokens need `RAILWAY_API_TOKEN` — wrong type fails as "Not signed in") |
  | `RAILWAY_ENVIRONMENT` | `${{ vars.RAILWAY_ENVIRONMENT }}` | `production` |
  | `RAILWAY_SERVICE_FRONTEND` | `${{ vars.RAILWAY_SERVICE_FRONTEND }}` | `frontend` |
  | `RAILWAY_SERVICE_BACKEND` | `${{ vars.RAILWAY_SERVICE_BACKEND }}` | `backend` |
  | `FRONTEND_URL` | `${{ vars.FRONTEND_URL }}` | `https://…` (empty skips smoke) |
  | `BACKEND_URL` | `${{ vars.BACKEND_URL }}` | `https://…` (empty skips smoke) |
- **Jobs** (ALL declare `environment: prod` — required to read `prod` secrets/vars):
  1. `deploy-frontend` / `deploy-backend` (parallel, `ubuntu-latest`, Node 22):
     `actions/checkout@v4` → `npm install -g @railway/cli@5.2.0` (PINNED, R6)
     → record pre-deploy `PREV_DEPLOYMENT_ID` via `deployment list --limit 1 --json`
     → `railway up ./<dir> --path-as-root --service … --environment … --ci`
     from repo root (VERIFIED form — bare `railway up` from subdir hangs)
     → poll `railway deployment list --service … --environment … --limit 1 --json`
     30×10s until a NEW deploy id (≠ `PREV_DEPLOYMENT_ID`) reaches `SUCCESS`
     (continue) or `FAILED`/`CRASHED`/`CANCELLED`
     (tail `railway logs --deployment`, exit 1). Polling is REQUIRED: `--ci` only
     reports build failure, not crash-on-start (R6). The poll read MUST be
     tolerant (`|| echo UNKNOWN`) so transient failures retry instead of
     aborting under `bash -e`; CLI stderr stays visible (no `2>/dev/null` on
     `railway`) so auth failures ("Not signed in"/"Unauthorized") show in logs,
     and 5 consecutive `UNKNOWN` fails fast. A latest id still equal to `PREV`
     counts as `UNKNOWN` (list-endpoint lag guard).
  2. `smoke` (`needs: [deploy-frontend, deploy-backend]`): frontend step curls
     `$FRONTEND_URL/` expecting HTTP 200 (12 attempts × 20s); backend step curls
     `$BACKEND_URL/health` expecting `"status":"ok"` (12 × 20s). Each step
     skipped while its URL var is empty. Runs only after both deploys poll `SUCCESS`,
     so it always hits the NEW deployment.
- **Failure semantics**: `railway up --ci` exits non-zero on build failure; the
  polling step exits non-zero on start/healthcheck failure or timeout — either
  fails the workflow loudly and Railway retains the previous ACTIVE deployment
  (spec 1.2). Smoke failure fails the workflow but does NOT roll back (Railway
  keeps serving the new deploy — owner investigates via `railway logs`).
