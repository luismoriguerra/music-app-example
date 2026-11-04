# Contract: Railway Services + Images

**Feature**: `002-railway-deploy` | **Date**: 2026-09-15

Phase 1 output. Defines the per-service build/serve contract Railway and
local Docker must both satisfy (US3 parity).

## `frontend` service

- **Root directory**: UNSET (empty) — the CLI provides the root via `./frontend --path-as-root`; any dashboard Root Directory breaks CLI uploads ("could not find root directory"). Service is source-less (Empty Service, no GitHub repo).
- **Config**: `frontend/railway.json` → `build.builder: DOCKERFILE`,
  `build.dockerfilePath: Dockerfile`; `deploy.restartPolicyType: ON_FAILURE`,
  `restartPolicyMaxRetries: 3`. No healthcheck (static server).
- **Image**: `node:22-slim` multi-stage; build `npm ci` (WITH devDeps for
  `prebuild`→`check-content` via `tsx`) + `npm run build`; runtime
  `serve@14`, `serve dist -l tcp://0.0.0.0:${PORT:-3000}`.
- **Serves**: `GET /` → 200 catalog HTML; `GET /courses/ukulele/topics/chords/`
  → 200; unknown paths → 404 page. MUST bind Railway-injected `$PORT`.
- **Upload excludes**: `.railwayignore` (root + service copy) — no
  `node_modules/`, `dist/`, `.astro/`, caches, `.env*`.

## `backend` service

- **Root directory**: UNSET (empty) — the CLI provides the root via `./backend --path-as-root`; any dashboard Root Directory breaks CLI uploads ("could not find root directory"). Service is source-less (Empty Service, no GitHub repo).
- **Config**: `backend/railway.json` → `DOCKERFILE` builder; `deploy` adds
  `healthcheckPath: /health`, `healthcheckTimeout: 30`, same restart policy.
- **Image**: `python:3.12-slim`; `pip install .` (explicit setuptools packaging
  for `app/`+`agents/`+`evals/`+`db.py`); CMD
  `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`.
- **Serves**: `GET /health` → 200 `{"status":"ok","service":"music-app-example-backend",…}`.
  MUST bind `$PORT`. `AGENTOS_ENABLED=false` in v1 (no DB traffic).
- **Env**: `DATABASE_URL=${{pgvector.DATABASE_URL_PRIVATE}}` reference (private internal host);
  `DB_*` fallback for local compose. SQLite rejected everywhere.
- **Upload excludes**: `.railwayignore` + `backend/.gitignore` — no `.venv/`,
  caches, `*.egg-info/`.

## `pgvector` service (template 3jJFCA)

- **Image**: `pgvector/pgvector` (NOT stock `postgres`); volume
  `/var/lib/postgresql/data`; `vector` extension enabled once (verified 0.8.6).
- **Exposes**: NO public endpoint (template's TCP proxy deleted per T017 —
  `railway tcp-proxy delete <proxy-id> -s pgvector -y`); `DATABASE_URL_PRIVATE`
  consumed ONLY via backend variable reference — never a public URL in app
  env, never committed. One-time `psql` via `railway connect pgvector`
  (SSH tunnel auto-enabled when no proxy exists).
