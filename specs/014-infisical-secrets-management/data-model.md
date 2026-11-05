# Data Model: Infisical secrets and configuration (current state)

This feature has no application database entities. Its model is the set of secret stores, environments, folders, variables, and the sync that links them. Each row cites its evidence.

## Entities

| Entity | Identity | Fields | Source |
|---|---|---|---|
| Secrets Project | Infisical project `music app` | `project-id` (identifier, not secret) | `.infisical.yaml:3` |
| Environment | `dev` or `prod` | default `dev` | `.infisical.yaml:4-5`; `README.md:53` |
| Folder | `/backend`, `/infra/auth0` | `/infra/auth0` exists in `dev` only | `README.md:60-61` |
| Variable | name within (environment, folder) | kind, value, consumer | section below |
| Names-only manifest | `.env.example` | name, empty value or dev default, group comment | `.env.example:1-40` |
| Secret Sync | `prod-backend-to-railway` | source `prod /backend`, target Railway `backend` service, auto-sync off | `README.md:60`; `.claude/skills/rotate-secret/SKILL.md` |
| Plumbing token | Railway project token | used by sync connection, or by deploy workflow | `.github/workflows/deploy.yml:30-32`; rotate-secret SKILL |
| Value digest | 8-hex SHA-256 prefix | compares holders without disclosure | rotate-secret SKILL, "Checks" |

## Variables

Kind legend: **S** secret, **C** config, **P** browser-visible public, **O** platform-owned.

| Name | Kind | Infisical dev `/backend` | Infisical prod `/backend` | Railway | Compose (`api`) | Read by |
|---|---|---|---|---|---|---|
| `DB_PASSWORD` | S | yes | no | no (db uses `POSTGRES_PASSWORD`) | required, `:?` (`docker-compose.yml:25`) | `backend/db.py:32,75`; `backend/tests/conftest.py:29` |
| `DB_HOST` | C | no (set in compose) | no | no | fixed `db` (`docker-compose.yml:21`) | `backend/db.py:32` |
| `DB_PORT` | C | no (set in compose) | no | no | fixed `"5432"` (`docker-compose.yml:22`) | `backend/db.py:32`; `conftest.py:35` |
| `DB_NAME` | C | no | no | no | `${DB_NAME:-music_app}` | `backend/db.py:32` |
| `DB_USER` | C | no | no | no | `${DB_USER:-music}` | `backend/db.py:32`; `conftest.py:34` |
| `DATABASE_URL` | O | no | no | yes, a reference to `pgvector` | not passed | `backend/db.py:73-74` |
| `OPENROUTER_API_KEY` | S | yes | yes (per README) | yes (synced) | `${:-}` | `.env.example:21`; evals |
| `YOUTUBE_API_KEY` | S | yes | `[UNVERIFIED]` | `[UNVERIFIED]` | `${:-}` (`docker-compose.yml:29`) | `.env.example:22` |
| `GENIUS_ACCESS_TOKEN` | S | yes | `[UNVERIFIED]` | `[UNVERIFIED]` | `${:-}` (`docker-compose.yml:30`) | `.env.example:23` |
| `SECOND_VOICE_MODEL_ID` | C | yes | yes (per README) | yes (synced) | `${:-}` (`docker-compose.yml:28`) | evals; `.env.example:24` |
| `CORS_ORIGINS` | C | default in compose | yes (per README) | yes (synced) | default `http://localhost:4321,http://127.0.0.1:4321` (`docker-compose.yml:31`) | app |
| `OWNER_ID` | C | default `owner` | no | no | default `owner` (`docker-compose.yml:32`) | `backend/tests/conftest.py:45` |
| `AGENTOS_ENABLED` | C | default `false` | no | no | default `false` (`docker-compose.yml:26`) | `backend/app/main.py:81` (string compare to `"true"`) |
| `API_PORT` | C | no | no | no | host port mapping `${API_PORT:-8000}:8000` (`docker-compose.yml:34`) | compose only |
| `PUBLIC_API_URL` | P | no | no | yes, frontend service variable | not a compose variable | `frontend/Dockerfile:13-14`; `frontend/src/components/SheetView.tsx:29` |
| `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` | S | `/infra/auth0` only | no | no | no | `[UNVERIFIED]` no consumer in repo (`backend/infra/auth0/` is empty) |
| `TF_VAR_resend_smtp_password`, `TF_STATE_PG_CONN_STR` | S | `/infra/auth0` only | no | no | no | no consumer in repo |

`PORT` is Railway-injected. It is not in the manifest and the repo does not read it for this feature `[UNVERIFIED: not checked in backend/app]`.

## State transitions

**Variable lifecycle** (`.claude/skills/add-secret/SKILL.md`):

```text
absent --(classify, compose, manifest, dev value)--> dev-present
dev-present --(prod approval, prod value, sync trigger)--> prod-present
prod-present --(delete in Infisical prod, delete in Railway, then compose and manifest)--> absent
```

**Secret rotation** (`.claude/skills/rotate-secret/SKILL.md`):

```text
OLD held in {dev, prod store, Railway}
  --(create NEW, set in store, recreate or sync)--> NEW in target(s), OLD in others
  --(holders check: no location shows OLD)--> OLD revoked at provider
```

## Validation rules (as implemented)

- `DB_PASSWORD` is required by compose; an unset value fails interpolation (`docker-compose.yml:7,25`).
- `load_db_config` requires all of `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` when `DATABASE_URL` is absent (`backend/db.py:32,75`).
- `DATABASE_URL` must use a PostgreSQL scheme and include host, database, user and password (`backend/db.py:44-57`).
- DB tests skip when neither `DB_PASSWORD` nor `TEST_DATABASE_URL` is set (`backend/tests/conftest.py:27-33`).