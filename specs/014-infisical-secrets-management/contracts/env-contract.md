# Environment Variable Contract (current state)

Interface: the environment the backend container and tests read. Producer: Infisical (`dev` `/backend`, `prod` `/backend` via sync) and Railway. Consumer: `docker-compose.yml` `api` service, `backend/db.py`, `backend/tests/conftest.py`.

## Backend container (compose `api`)

| Name | Required | Default in compose | Meaning |
|---|---|---|---|
| `DB_HOST` | fixed | `db` | Postgres host inside the compose network (`docker-compose.yml:21`) |
| `DB_PORT` | fixed | `5432` | (`docker-compose.yml:22`) |
| `DB_NAME` | optional | `music_app` | (`docker-compose.yml:23`) |
| `DB_USER` | optional | `music` | (`docker-compose.yml:24`) |
| `DB_PASSWORD` | **required** | none; fails with `DB_PASSWORD missing, run via infisical run --env=dev --path=/backend` | (`docker-compose.yml:25`) |
| `AGENTOS_ENABLED` | optional | `false` | (`docker-compose.yml:26`) |
| `OPENROUTER_API_KEY` | optional | empty | provider key (`docker-compose.yml:27`) |
| `SECOND_VOICE_MODEL_ID` | optional | empty | model id (`docker-compose.yml:28`) |
| `YOUTUBE_API_KEY` | optional | empty | (`docker-compose.yml:29`) |
| `GENIUS_ACCESS_TOKEN` | optional | empty | (`docker-compose.yml:30`) |
| `CORS_ORIGINS` | optional | `http://localhost:4321,http://127.0.0.1:4321` | (`docker-compose.yml:31`) |
| `OWNER_ID` | optional | `owner` | (`docker-compose.yml:32`) |

Only names in this table reach the container (compose pass-through; `add-secret` SKILL section 2).

## Backend configuration precedence

1. `DATABASE_URL` set: parsed as PostgreSQL URL; `DB_*` ignored (`backend/db.py:73-74`).
2. Otherwise: all of `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` required (`backend/db.py:75`).

## Test harness

| Name | Effect |
|---|---|
| `TEST_DATABASE_URL` | Used verbatim; bypasses `DB_PASSWORD` check (`backend/tests/conftest.py:27-28`) |
| `DB_PASSWORD` absent and no `TEST_DATABASE_URL` | DB tests skip with reason (`conftest.py:29-33`) |
| `DB_USER`, `DB_PORT` | Read for DB-backed tests; host forced to `localhost` (`conftest.py:34-39`) |

## Frontend (build time)

| Name | Effect |
|---|---|
| `PUBLIC_API_URL` | Declared `ARG` and `ENV` in `frontend/Dockerfile:13-14`; falls back to `http://localhost:8000` (`frontend/src/components/SheetView.tsx:29`) |

## Not part of this contract

- `PORT` (Railway-injected; not read for this feature `[UNVERIFIED]`).
- Tuning knobs and test switches (`PROVIDER_THROTTLE_SCALE`, `ENRICH_TIMEOUT_S`, `ENRICH_SEARCH_BACKENDS`, `ENRICH_LIVE_EVALS`), intentionally absent from `.env.example` per its header (`.env.example:1-10`).
- Terraform and Auth0 variables (`/infra/auth0`), which the app never reads.