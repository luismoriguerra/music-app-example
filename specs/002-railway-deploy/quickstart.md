# Quickstart: Railway Deploy (frontend + backend)

**Feature**: `002-railway-deploy` | **Date**: 2026-09-15
Validates deployment end to end. Details live in [plan.md](./plan.md),
[data-model.md](./data-model.md), and [contracts/](./contracts/deploy-workflow.md) —
this file is the run guide only.

## Prerequisites

- Node 22+, npm, Python 3.12+, Docker, Railway CLI (`npm i -g @railway/cli`),
  GitHub CLI (`gh`) authenticated.
- Fresh checkout on branch `002-railway-deploy`; `RAILWAY_TOKEN` NOT needed
  locally (user-auth `railway up` for verification; token path proven on
  merge — V1).

## Setup

```bash
# Link to the Railway project (one-time)
railway link   # select music-railway-infraestructure / production

# Local images (US3 parity check)
docker build -t music-app-example-frontend:002 ./frontend
docker build -t music-app-example-backend:002 ./backend
```

## Run

```bash
# Terminal 1 — frontend image on dynamic port
docker run --rm -p 4331:3000 -e PORT=3000 music-app-example-frontend:002
# → http://127.0.0.1:4331/

# Terminal 2 — backend image on dynamic port
docker run --rm -p 8001:8000 -e PORT=8000 music-app-example-backend:002
# → http://127.0.0.1:8001/health → {"status":"ok",...}

# Non-default $PORT proof (Railway injects arbitrary ports)
docker run --rm -p 4332:4567 -e PORT=4567 music-app-example-frontend:002
docker run --rm -p 8002:9123 -e PORT=9123 music-app-example-backend:002
```

## Test

```bash
# Backend DATABASE_URL unit tests (Principle III)
cd backend && .venv/bin/pytest -q && .venv/bin/ruff check . && .venv/bin/ruff format --check .

# Workflows
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); yaml.safe_load(open('.github/workflows/deploy.yml'))"
actionlint .github/workflows/*.yml
grep -rn -E "gho_|railway.*token.*=.*[A-Za-z0-9]{8}" .github/ || echo "no hardcoded secrets"

# Config JSON
python3 -c "import json; json.load(open('frontend/railway.json')); json.load(open('backend/railway.json'))"
```

## Validation scenarios (map 1:1 to user stories)

### V0 — Manual re-deploy via dispatch (post-merge only — SC-001, SC-002)

No pre-merge dry-run exists for the first rollout: GitHub only registers
workflows present on the default branch, so `workflow_dispatch` 404s while
`deploy.yml` lives solely on the feature branch (verified 2026-09-15). The
V1 merge is the first token-path proof. After merge, to re-deploy manually
from a non-`main` branch:

1. Temporarily allow the branch: `gh api
   repos/<owner>/<repo>/environments/prod/deployment-branch-policies -X POST
   -f name=<branch>` (policy is `main`-only otherwise, which would block the
   dispatch from reading `prod` secrets).
2. `gh workflow run deploy.yml --ref <branch>`, then
   `gh run watch <run-id>`. Expect: both `railway up --ci` jobs succeed, both
   `deployment list` polls reach `SUCCESS`, smoke curls both URLs green.
3. Re-restrict: `gh api .../deployment-branch-policies/<id> -X DELETE` for the
   temporary policy. Verify only `main` remains.
4. If any run fails "Not signed in": check token TYPE first (`RAILWAY_TOKEN`
   = project token only; account tokens need `RAILWAY_API_TOKEN`) before
   suspecting the v5.3.0-class CLI regression.

### V1 — Merge to main deploys both services (Story 1, P1 — SC-001, SC-002)

1. Push a trivial commit to `main` (or merge PR #1). Expect: `deploy.yml`
   runs, both `railway up --ci` jobs succeed AND their `deployment list` polls
   reach `SUCCESS`, then the smoke job curls both URLs green.
2. Open `FRONTEND_URL/` → 200 with Ukulele catalog; `BACKEND_URL/health` →
   `{"status":"ok"}`.
3. Break one Dockerfile on a scratch branch, merge to a scratch test (or
   observe CI): Expect `deploy` fails loudly; Railway keeps previous ACTIVE.

### V2 — PRs gated, never deployed (Story 2, P2 — SC-004)

1. Open a PR with a deliberately failing test. Expect: `ci.yml` red, zero
   Railway deployments triggered (no `RAILWAY_TOKEN` in CI).
2. Fix, push green. Expect: CI green (frontend + backend + docker jobs),
   still zero deployments until merge.

### V3 — Local parity check (Story 3, P3 — SC-003)

1. From clean checkout run the Setup + Run commands above. Expect: both
   images build; `/` → 200, `/courses/ukulele/topics/chords/` → 200,
   `/health` → `{"status":"ok"}`; non-default `$PORT` also serves.

### V4 — Railway verification via CLI (executed 2026-09-15 on `music-railway-infraestructure` — SC-001, SC-002)

1. `railway up ./backend --path-as-root --service backend --environment
   production --ci` → SUCCESS; same for frontend. (`--ci` fails the command
   on build failure, and `deploy.yml` polls `railway deployment list --json`
   until `SUCCESS` so crash-on-start fails it too.)
2. `railway domain -s backend` → `https://backend.example.com`
   (ACTIVE); `railway domain -s frontend` →
   `https://frontend.example.com` (ACTIVE).
3. Curl live URLs: frontend `/` 200 (`<title>Music Courses</title>`, Ukulele
   card), chords 200, bogus path 404; backend `/health` 200
   `{"status":"ok","service":"music-app-example-backend","version":"0.1.0"}`. Deploy
   logs show uvicorn + serve on injected `$PORT` 8080, no DB errors.

## Done when

- V1–V3 pass, V4 recorded (T011–T013 done), `pytest` 9/9 + ruff clean,
  `actionlint` clean, `docker compose ps` unaffected, no secrets committed,
  and T014 setup complete (pgvector, `DATABASE_URL` ref, `prod` Environment
  with `RAILWAY_TOKEN` + vars branch-gated to `main`) — only the PR #1 merge
  remains (V0 dispatch is post-merge only).
