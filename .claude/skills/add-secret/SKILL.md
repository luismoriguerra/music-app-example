---
name: add-secret
description: Add or remove an environment variable or secret end to end, through docker-compose, the .env.example manifest, Infisical dev and prod, and the Railway sync. Use when a feature needs a new env var, API key, token or config value, or when one is no longer needed.
argument-hint: "[NAME and kind, e.g. 'YOUTUBE_API_KEY backend secret']"
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Purpose

Get one new (or retired) variable through every layer that must know about it, so it reaches the local container and prod, and no secret value ever lands in the repo, chat, or shell history.

Scope: plumbing only. The code that reads the variable (`os.getenv` in `backend/`, `import.meta.env` in `frontend/`) comes from a Spec Kit task. Do not hand-write it here; if it does not exist yet, say which spec task must add it.

## 1. Classify

| Kind | Home | Do |
|---|---|---|
| Backend secret or config the API reads | Infisical `/backend`, in `dev` and `prod` | steps 2 to 6 |
| Browser-visible `PUBLIC_*` (not secret, inlined into the bundle at build) | Railway `frontend` service variable, not Infisical | declare `ARG` and `ENV` in `frontend/Dockerfile`, set the Railway variable, list the name under `# /frontend` in `.env.example`; locally export it in the shell or rely on the code's fallback |
| Terraform or Auth0 provisioning (`TF_VAR_*`, `AUTH0_*`) | Infisical `dev` `/infra/auth0` only | set it there; the app never reads it |
| `DATABASE_URL`, `PORT`, `RAILWAY_*` | Railway-managed | never copy into Infisical |
| Tuning knob with a code default | nowhere until you need to override it | see the header of `.env.example` |

## 2. Compose pass-through

`infisical run` puts the value in compose's environment, but only names listed under `api.environment` in `docker-compose.yml` reach the container.

- Optional: `NAME: ${NAME:-}`
- Required (fails fast, like `DB_PASSWORD`): `NAME: ${NAME:?NAME missing, run via infisical run --env=dev --path=/backend}`

## 3. Manifest

Add `NAME=` under `# /backend` in `.env.example`. Names only: a secret stays empty, a non-secret config value may carry its dev default. If it is a secret, add it to the "Secrets:" sentence of that block.

## 4. Dev value

The user enters it. Never ask for the value in chat.

- UI: Infisical, project `music app`, `dev`, `/backend`, Add Secret.
- CLI, secret copied to the clipboard: `infisical secrets set NAME="$(pbpaste)" --env=dev --path=/backend` (shell history records `$(pbpaste)`, not the value).
- CLI, non-secret config: `infisical secrets set NAME=value --env=dev --path=/backend`.

## 5. Apply and verify locally

```bash
infisical run --env=dev --path=/backend -- docker compose up -d   # recreates api with the new env; restart would not
infisical run --env=dev --path=/backend -- docker compose exec -T api sh -c 'test -n "$NAME" && echo set || echo empty'   # replace NAME
```

## 6. Prod (needs the user's go-ahead in this conversation)

1. The user adds `NAME` under Infisical `prod` `/backend` in the UI, with its own prod value (never a copy of dev's).
2. Trigger the Railway sync: `rotate-secret`, "Trigger the prod sync". Railway redeploys the backend by itself.
3. Verify the name is in Railway, then that Railway's value equals Infisical's (digests: `rotate-secret`, "Checks").

```bash
railway variable list --service backend --environment production --json | jq -r 'keys[]' | sort
```

## 7. Remove a variable

- Dev: `infisical secrets delete NAME --type shared --env=dev --path=/backend` (the default type is `personal`).
- Prod: delete it in Infisical `prod` `/backend`, then `railway variable delete NAME --service backend --environment production`. The sync has Disable Secret Deletion on, so Infisical never removes it from Railway, and a rename leaves the old name behind too.
- Then drop it from `docker-compose.yml` and `.env.example` once nothing reads it.

## Rules

- Key names and 8-hex digests only in output. Never run `infisical secrets`, `infisical export` or `railway variable list` without reducing the output to names.
- Keys synced from Infisical `prod` `/backend` are owned by Infisical: edit them there only. The next sync overwrites direct Railway edits.
- Never put a secret value in `.env.example`, a Dockerfile, a compose file, a spec or a commit.
