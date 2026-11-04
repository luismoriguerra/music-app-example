---
name: run-app-locally
description: Start, stop, test, or debug the music-app-example on this machine (Docker Compose api and Postgres, Astro dev server, pytest, vitest) with dev secrets injected from Infisical. Use when asked to run or restart the app, run the backend tests, or when a local command fails with "DB_PASSWORD missing", skipped DB tests, or Postgres "password authentication failed".
user-invocable: true
disable-model-invocation: false
---

## Purpose

Run the app locally. There are no `.env` files. Dev secrets live in Infisical (environment `dev`, folder `/backend`; the repo is linked by `.infisical.yaml`) and reach a process only through `infisical run`.

## Prerequisites

- Infisical CLI, logged in. Check: `infisical secrets --env=dev --path=/backend --silent -o json | jq length` prints a number. If it fails or asks to log in, stop and ask the user to run `infisical login` (interactive).
- Docker running (`docker info`), Node 22, and `backend/.venv` (`cd backend && python3 -m venv .venv && .venv/bin/pip install -e '.[dev]'`).

## Workflow

From the repo root:

```bash
infisical run --env=dev --path=/backend -- docker compose up -d --build   # api :8000 + Postgres :5432
curl -fsS localhost:8000/health                                           # static: proves the process is up, not the DB
curl -s -o /dev/null -w '%{http_code}\n' 'localhost:8000/api/v1/history?limit=1'   # 200 = the API reached Postgres
infisical run --env=dev --path=/backend -- docker compose ps
infisical run --env=dev --path=/backend -- docker compose logs api
infisical run --env=dev --path=/backend -- docker compose down            # stop; the pgdata volume survives
```

Frontend. It needs no secrets: `PUBLIC_API_URL` falls back to `http://localhost:8000`.

```bash
cd frontend && npm install && npm run dev   # http://localhost:4321
```

Tests. The full CI gate list is in README, Local development.

```bash
cd backend && infisical run --env=dev --path=/backend -- .venv/bin/pytest   # bare pytest skips the DB tests
cd frontend && npm test
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `required variable DB_PASSWORD is missing a value` | compose ran without the wrapper | prefix the command with `infisical run --env=dev --path=/backend --`; never remove the `${DB_PASSWORD:?…}` guard |
| pytest skips DB tests ("DB_PASSWORD not set") | bare `pytest` | same prefix |
| `password authentication failed` from `api` or pytest | the Postgres volume keeps the password it was first created with, and Infisical's `DB_PASSWORD` no longer matches it | `rotate-secret`, "Dev `DB_PASSWORD`" (re-sync only: steps 2 and 3). `docker compose down -v` also fixes it but wipes local data, so ask first |
| a changed Infisical value is not visible in a container | `docker compose restart` does not re-read env | `infisical run … -- docker compose up -d` (recreates changed services) |
| a variable is in Infisical but not in the container | the name is missing from `api.environment` in `docker-compose.yml` | `add-secret` |
| Infisical asks to log in | session expired | the user runs `infisical login` |

## Rules

- Never create or read `.env` files (reads are denied in `.claude/settings.json`). Never print secret values. List key names only: `infisical secrets --env=dev --path=/backend -o json --silent | jq -r '.[] | (.secretKey // .key)'`.
- Always use the wrapper for `docker compose`, including `ps`, `logs` and `down`.
- Ask before `docker compose down -v`: it destroys the local database.
