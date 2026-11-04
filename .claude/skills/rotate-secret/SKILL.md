---
name: rotate-secret
description: Rotate an API key, token or database password (dev or prod) across the provider, Infisical and Railway without an outage. Use when a key is leaked, expired or rejected (401), on scheduled rotation, or when Postgres rejects the password after a change.
argument-hint: "[secret and env, e.g. 'OPENROUTER_API_KEY prod' or 'dev DB password']"
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Purpose

Replace a secret and retire the old one with no outage, and with no moment where a running service holds a dead credential.

## Principles

1. New value first, old value revoked last, and only after the new one is verified where it is used. A provider key can sit in several places at once (dev Infisical, prod Infisical, Railway): revoke only when the holders check shows no place still holding the old digest.
2. Infisical owns what it syncs (`prod` `/backend` to Railway `backend`). Edit those keys only in Infisical: Infisical documents that a later sync may overwrite edits made directly in the destination, which can bring back a revoked key.
3. `/health` is static. It stays 200 with a dead DB password or a dead provider key. Verify with the Checks below.
4. Containers read env only at start. Locally use `docker compose up -d` (recreates changed services; `restart` does not re-read env). On Railway, a new deploy.
5. The user creates keys at providers and enters values (UI or clipboard). Never ask for a value in chat, never print one, never pass one as a literal command argument. Prod-side actions (Infisical `prod` edits, the sync trigger, Railway variables, redeploys, anything on the prod database) need the user's explicit go-ahead in this conversation.

## Checks

```bash
# Key names only (never values)
infisical secrets --env=dev --path=/backend -o json --silent | jq -r '.[] | (.secretKey // .key)'
railway variable list --service backend --environment production --json | jq -r 'keys[]' | sort

# Holders check: who holds which value? Equal 8-hex digests = the same value. e3b0c442 = empty or unset; blank = the command failed (drop 2>/dev/null to see why).
# prod == railway: the sync landed. dev == prod (or == railway): one provider key is shared across environments.
NAME=OPENROUTER_API_KEY
D="printf %s \"\$$NAME\" | shasum -a 256 | cut -c1-8"
echo "dev     $(infisical run --env=dev  --path=/backend -- sh -c "$D" 2>/dev/null)"
echo "prod    $(infisical run --env=prod --path=/backend -- sh -c "$D" 2>/dev/null)"
echo "railway $(railway run --service backend --environment production -- sh -c "$D")"

# Is the OpenRouter key accepted? 200 = yes. The dev copy, then prod's copy as Railway holds it
infisical run --env=dev --path=/backend -- sh -c 'curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $OPENROUTER_API_KEY" https://openrouter.ai/api/v1/auth/key'
railway run --service backend --environment production -- sh -c 'curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $OPENROUTER_API_KEY" https://openrouter.ai/api/v1/auth/key'

# Can the API reach Postgres? 200 = yes. API=http://localhost:8000, or the prod backend URL (README, BACKEND_URL)
curl -s -o /dev/null -w '%{http_code}\n' "$API/api/v1/history?limit=1"
railway logs --service backend --environment production --since 15m --filter "password authentication failed"   # prints nothing when healthy

# Does dev Postgres accept the Infisical DB_PASSWORD from the host? Prints "db auth ok"
infisical run --env=dev --path=/backend -- backend/.venv/bin/python -c "import os,psycopg; psycopg.connect(host='localhost', port=int(os.environ.get('DB_PORT','5432')), user='music', password=os.environ['DB_PASSWORD'], dbname='music_app', connect_timeout=5).close(); print('db auth ok')"
```

### Trigger the prod sync

Auto-Sync is off on the sync `prod-backend-to-railway`, so every Infisical `prod` edit needs a manual trigger. UI: Infisical, Integrations, Secret Syncs (button label not confirmed). CLI below. Verified 2026-10-30: the name lookup and the state poll with these exact commands. The POST is Infisical's documented `sync-secrets` route and returned HTTP 200 and queued a sync when used earlier.

```bash
TOKEN=$(infisical user get token --plain --silent)
PID=$(sed -nE 's/^ *project-id: *(.*)$/\1/p' .infisical.yaml)
SYNC_ID=$(curl -fsS -H "Authorization: Bearer $TOKEN" "https://app.infisical.com/api/v1/secret-syncs?projectId=$PID" | jq -r '.secretSyncs[] | select(.name=="prod-backend-to-railway") | .id')
curl -fsS -X POST -H "Authorization: Bearer $TOKEN" "https://app.infisical.com/api/v1/secret-syncs/railway/$SYNC_ID/sync-secrets" -o /dev/null -w '%{http_code}\n'   # 200 = queued
sleep 5; curl -fsS -H "Authorization: Bearer $TOKEN" "https://app.infisical.com/api/v1/secret-syncs/railway/$SYNC_ID" | jq -r '.secretSync | [.syncStatus, .lastSyncedAt, (.lastSyncMessage // "-")] | @tsv'   # succeeded + a fresh timestamp
railway deployment list --service backend --environment production --limit 1 --json | jq -r '.[0].status'   # BUILDING, then SUCCESS (about a minute)
```

## Procedures

### Provider keys (`OPENROUTER_API_KEY`; same flow for `YOUTUBE_API_KEY`, `GENIUS_ACCESS_TOKEN`)

Before anything, run the holders check (Checks) and note the digest of the key you are replacing (OLD). Equal digests mean one provider key is shared, and revoking it breaks every place that still holds it. If dev and prod share a key, create one new key per environment (prod's spend-capped), replace both, and only then revoke the shared one. If the key has leaked, revoke it at once and accept a short outage wherever it is still held, then rotate every holder.

Dev:

```bash
# the user creates a new key at the provider and copies it
infisical secrets set OPENROUTER_API_KEY="$(pbpaste)" --env=dev --path=/backend
infisical run --env=dev --path=/backend -- docker compose up -d
# then the dev OpenRouter check from Checks: 200
```

Then re-run the holders check. Revoke the old key at the provider only if no place still shows OLD. If prod or Railway still does, do the prod flow first.

Prod:

1. The user creates a new, spend-capped key (one key per environment, never dev's).
2. The user edits the key in Infisical `prod` `/backend`. The UI keeps it out of shell history.
3. Trigger the prod sync. Railway redeploys the backend.
4. Verify: the digests are equal (the sync landed) and the Railway-side OpenRouter check returns 200.
5. Re-run the holders check: no place, dev included, may still show OLD. Only then the user revokes the old key at the provider.

### Dev `DB_PASSWORD`

The Postgres volume keeps the password it was first created with: `POSTGRES_PASSWORD` is read only on first init. Changing Infisical alone breaks auth, so change the database too. Infisical is set first and is the source of truth, so every step can be re-run from it. `db` must be running.

```bash
# step 1: new value into Infisical. Step 2: make Postgres match it. Step 3: recreate the services.
infisical secrets set DB_PASSWORD="$(openssl rand -hex 24)" --env=dev --path=/backend \
 && infisical run --env=dev --path=/backend -- sh -c "printf \"ALTER ROLE music PASSWORD '%s';\n\" \"\$DB_PASSWORD\" | docker compose exec -T db psql -U music -d music_app -v ON_ERROR_STOP=1 -q -f -" \
 && infisical run --env=dev --path=/backend -- docker compose up -d
```

- If it stops, re-run from the failed step. Re-sync only (Infisical's value is right, Postgres is stale): run steps 2 and 3 only.
- Never run step 2 with an empty value. `PASSWORD ''` sets the password to NULL (PostgreSQL 10 and later), and password auth then always fails.
- Verify with the dev Postgres check from Checks (`db auth ok`).

### Prod database password (`pgvector`)

Not run against prod when written, because it changes the real password: supervise the first run. Flags are checked against `--help`, the order against Railway's guide, the wiring against the live service.

`pgvector` is marketplace template `3jJFCA` on image `pgvector/pgvector:pg18`, not Railway's PostgreSQL template. The variable chain is `POSTGRES_PASSWORD` (the only literal), then `PGPASSWORD`, then `DATABASE_URL_PRIVATE`, then the backend's `DATABASE_URL` (a reference). The image reads `POSTGRES_PASSWORD` only on first init, so editing the variable alone moves every consumer to a password the role does not have, and auth fails at the backend's next deploy. Change the role first.

First check the Railway dashboard. If `pgvector` shows Database, Config, Connection, Regenerate, use that instead and skip the rest: it is Railway's supported path and changes the role and the variable together. Railway documents the button for its PostgreSQL template; it is not confirmed for this marketplace template.

```bash
openssl rand -hex 24 | tr -d '\n' | pbcopy      # new password on the clipboard only
railway connect pgvector --environment production   # interactive psql over an SSH tunnel (no public proxy). Then: \password, paste + Enter twice, \q
pbpaste | railway variable set POSTGRES_PASSWORD --stdin --skip-deploys --service pgvector --environment production
railway redeploy --service backend --environment production -y
```

- `\password` sends a hash, so the plaintext stays out of psql history and the server log. `--skip-deploys` keeps the volume-backed DB from restarting; the engine does not read the variable after init.
- New backend connections can fail between `\password` and the redeploy. Railway documents this window for the single-role path. For zero downtime use its dual-role flow: https://railway.com/guides/rotate-credentials-zero-downtime
- If the clipboard is overwritten after `\password`, the role holds a password nobody has. Recover over the local socket: `railway ssh --service pgvector --environment production`, then `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"` and `\password` again. Local-socket trust is verified for the dev image of the same family and unverified on prod.
- Verify: the history route returns 200 and the log filter prints nothing (Checks). Do not rely on `/health`.

### `terraform-states` database

It is Railway's PostgreSQL template (public TCP proxy on). Use Railway's supported path: dashboard, `terraform-states`, Database, Config, Connection, Regenerate. Do not `ALTER USER` or edit `POSTGRES_PASSWORD` by hand. `TF_STATE_PG_CONN_STR` (Infisical `dev` `/infra/auth0`) logs in as a different role than that service's `PGUSER`, so it should not be affected. Confirm afterwards (prints `terraform_state`):

```bash
infisical run --env=dev --path=/infra/auth0 -- sh -c 'psql "$TF_STATE_PG_CONN_STR" -tAc "select current_database()"'
```

### `/infra/auth0` secrets (`AUTH0_CLIENT_SECRET`, `TF_VAR_resend_smtp_password`, `AUTH0_*`)

Dev only, Terraform only, nothing syncs. The user rotates at the provider (Auth0 dashboard for the `terraform-deployer` M2M client, Resend for the SMTP password), then sets the new value in the UI or with `infisical secrets set NAME="$(pbpaste)" --env=dev --path=/infra/auth0`. If a GitHub Environment holds a copy (specs/007 plans `auth0-dev` and `prod`), update it too: `pbpaste | gh secret set NAME --env <environment>`. Verify with the Terraform run once it exists (specs/007 T005).

### Plumbing tokens

- `infisical-sync-prod` (the Railway project token behind the Infisical App Connection): create a new project token in Railway (project `music-railway-infraestructure`, Settings, Tokens, environment `production`), update the connection's credentials in Infisical (Integrations, App Connections), trigger the sync to prove it, then revoke the old token. Revoking first stops the sync.
- `RAILWAY_TOKEN` (GitHub environment `prod` secret used by `deploy.yml`): must be a project token, not an account token (README). `pbpaste | gh secret set RAILWAY_TOKEN --env prod`, verify on the next merge to `main`, then revoke the old token in Railway.
