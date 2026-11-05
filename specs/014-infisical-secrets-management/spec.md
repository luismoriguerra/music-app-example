# Feature Specification: Infisical Secrets Management (current state)

**Feature Branch**: `014-infisical-secrets-management`

**Created**: 2026-11-04

**Status**: Draft (brownfield: documents the implementation as it exists; no enhancements)

**Input**: User description: "Reverse-engineer the current Infisical integration (commit fb625e2, 'move dev and prod credentials to Infisical'). Describe what it is, not what it should be."

**Evidence convention**: every claim cites `path:line` in this repository. `[UNVERIFIED]` marks what the repo cannot prove. Commit `fb625e2` is the origin of the change.

## Overview

Credentials no longer live in `.env` files. Secrets and environment-specific config are held in Infisical project `music app`, organized by environment (`dev`, `prod`) and folder (`/backend`, `/infra/auth0`). The project link is `.infisical.yaml:1-5` (`project-id`, default `environment: dev`). A process receives secrets only through the Infisical CLI wrapper `infisical run --env=dev --path=/backend -- <cmd>`, which the docs require (`README.md:34-43`). Prod backend variables are delivered to the Railway `backend` service by a named Secret Sync `prod-backend-to-railway` (`README.md:60`, `.claude/skills/rotate-secret/SKILL.md`, "Trigger the prod sync").

The repo carries: a names-only manifest (`.env.example:1-40`), compose pass-through and fail-fast guards (`docker-compose.yml:7,18-32`), a DB config loader (`backend/db.py:32-75`), test fixtures that read `DB_*` (`backend/tests/conftest.py:25-41`), leak guards (`.gitignore`, `.dockerignore`, `.railwayignore`, `.infisicalignore`, `.claude/settings.json`), and three agent skills (`.claude/skills/{run-app-locally,add-secret,rotate-secret}/SKILL.md`).

Actors: **Maintainer** (single owner; creates provider keys, enters values, approves prod actions), **Developer/agent** (runs stack and tests, never sees values), **Infisical** (store for dev and prod values), **Railway** (prod host; receives values from the sync).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run the backend and tests locally with secrets injected (Priority: P1)

A developer starts Postgres and the API with the wrapper, and runs the backend tests with the wrapper. Nothing is written to a `.env` file.

**Why this priority**: It is the daily entry point (`README.md:31-43`).

**Independent Test**: With the CLI logged in, run `infisical run --env=dev --path=/backend -- docker compose up -d --build`, then `curl localhost:8000/health` and `curl 'localhost:8000/api/v1/history?limit=1'`.

**Acceptance Scenarios**:

1. **Given** the wrapper and a logged-in CLI, **When** compose starts, **Then** `db` and `api` run and the API gets `DB_PASSWORD` (`docker-compose.yml:7,25`).
2. **Given** `DB_PASSWORD` is unset in the shell, **When** any compose command runs, **Then** compose exits with `DB_PASSWORD missing, run via infisical run --env=dev --path=/backend` (`docker-compose.yml:7,25`).
3. **Given** the stack is up, **When** `GET /health` is called, **Then** it returns `status: ok`. This route is static and does not prove the DB is reachable (`backend/app/main.py:77-78`; `README.md:68`).
4. **Given** the stack is up, **When** `GET /api/v1/history?limit=1` is called, **Then** it returns 200 only if the API reached Postgres `[UNVERIFIED: route not exercised in this review; the 200 expectation comes from .claude/skills/run-app-locally/SKILL.md "Workflow"]`.
5. **Given** backend tests run without `DB_PASSWORD` and without `TEST_DATABASE_URL`, **When** a DB fixture is requested, **Then** pytest skips with `DB_PASSWORD not set: run tests via infisical run ...` (`backend/tests/conftest.py:27-33`).
6. **Given** `TEST_DATABASE_URL` is set, **When** DB fixtures run, **Then** it is used verbatim and the `DB_PASSWORD` check is bypassed (`backend/tests/conftest.py:27-28`).
7. **Given** DB-backed tests run, **When** they connect, **Then** the host is forced to `localhost` and user/password are URL-quoted (`backend/tests/conftest.py:36-41`), and the database is a transient `music_app_test` (`backend/tests/conftest.py:22,66-78`).
8. **Given** Postgres is unreachable, **When** `test_engine` starts, **Then** the session skips with `transient Postgres unavailable` instead of failing (`backend/tests/conftest.py:81,88`).
9. **Given** the frontend dev server runs, **When** no secrets exist, **Then** it works; `PUBLIC_API_URL` falls back to `http://localhost:8000` (`.env.example:32`; `.claude/skills/run-app-locally/SKILL.md`, "Frontend").

---

### User Story 2 - Database configuration from DB_* or DATABASE_URL (Priority: P1)

The backend builds its connection from `DB_*` variables locally, or from a platform `DATABASE_URL` when present.

**Acceptance Scenarios**:

1. **Given** `DATABASE_URL` is set, **When** `load_db_config()` runs, **Then** it wins over `DB_*` (`backend/db.py:73-74`).
2. **Given** `DATABASE_URL` is set with a non-PostgreSQL scheme, a missing host, database, user or password, **When** it is parsed, **Then** `ConfigError` is raised (`backend/db.py:44-57`).
3. **Given** `DATABASE_URL` is unset, **When** config loads, **Then** `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` are required (`backend/db.py:32,75`).
4. **Given** the app starts with AgentOS disabled, **When** DB config is missing, **Then** the app still boots and per-request DB routes fail (`backend/app/main.py:35-46`). With AgentOS enabled, missing config raises (`backend/app/main.py:93-95`).

---

### User Story 3 - Add or remove a variable end to end (Priority: P1)

A developer plumbs a new variable through compose, the manifest, Infisical and, for prod, the sync. The procedure is in the `add-secret` skill (`.claude/skills/add-secret/SKILL.md`).

**Acceptance Scenarios**:

1. **Given** a new backend variable, **When** added, **Then** it appears under `api.environment` in compose, because only listed names reach the container (`docker-compose.yml:20-32`; `.claude/skills/add-secret/SKILL.md` section 2).
2. **Given** the variable is a secret or config, **When** documented, **Then** its name is in `.env.example` under `# /backend`, with an empty value for secrets (`.env.example:8-24`).
3. **Given** the value changes, **When** the stack is brought up, **Then** `docker compose up -d` is used, not `restart`, because containers read env at creation (`.claude/skills/run-app-locally/SKILL.md`, Troubleshooting).
4. **Given** a browser-visible `PUBLIC_*` variable, **When** added, **Then** it is a Railway frontend variable declared as an `ARG` and `ENV` in the frontend image, and not stored in Infisical (`frontend/Dockerfile:11-14`; `.env.example:30-32`).
5. **Given** a platform variable (`DATABASE_URL`, `PORT`, `RAILWAY_*`), **When** classified, **Then** it is never copied into Infisical (`.env.example` comment block near `DATABASE_URL`; `.claude/skills/add-secret/SKILL.md` section 1).
6. **Given** a variable is retired, **When** removed, **Then** Infisical is deleted with `--type shared` (the CLI default is `personal`), Railway is deleted explicitly in prod, and then compose and the manifest are edited (`.claude/skills/add-secret/SKILL.md` section 7).

---

### User Story 4 - Rotate a secret without an outage (Priority: P1)

The `rotate-secret` skill documents rotation of provider keys, the dev DB password, the prod DB password, the Terraform-state DB, `/infra/auth0` secrets and plumbing tokens.

**Acceptance Scenarios**:

1. **Given** rotation starts, **When** the holders check runs, **Then** it compares 8-hex SHA-256 digests across dev, prod and Railway without printing values (`.claude/skills/rotate-secret/SKILL.md`, "Holders check").
2. **Given** a provider key OLD digest is still held by any location, **When** rotation is considered, **Then** the old key is not revoked (`.claude/skills/rotate-secret/SKILL.md`, Principles 1).
3. **Given** the dev DB password is rotated, **When** the procedure runs, **Then** the store is updated first, then `ALTER ROLE` runs with the value, then services are recreated. Empty values are refused by the procedure text only; `[UNVERIFIED: no guard in code or script enforces the non-empty check]` (`.claude/skills/rotate-secret/SKILL.md`, "Dev `DB_PASSWORD`").
4. **Given** the prod DB password (`pgvector`) is rotated, **When** the procedure is followed, **Then** it is documented but `[UNVERIFIED: never run against prod, per the skill's own note]`.
5. **Given** the sync is triggered, **When** the API is called, **Then** it uses `POST .../sync-secrets` and the status route, with the sync looked up by name (`.claude/skills/rotate-secret/SKILL.md`, "Trigger the prod sync"). The UI label is `[UNVERIFIED]`.

---

### User Story 5 - Prod receives values through a one-way sync (Priority: P2)

Prod values are edited in Infisical `prod /backend` and pushed to Railway by `prod-backend-to-railway`. Auto-sync is off, so every edit needs a manual trigger (`README.md:60`; `rotate-secret` SKILL).

**Acceptance Scenarios**:

1. **Given** a prod edit, **When** no trigger runs, **Then** Railway keeps its previous value `[UNVERIFIED: sync settings (auto-sync off, deletion disabled) are documented in the README and skills; not in the repo as config]`.
2. **Given** the deploy workflow runs on `main`, **When** it deploys, **Then** it uses `RAILWAY_TOKEN` from the `prod` GitHub Environment and `environment: prod` (`.github/workflows/deploy.yml:3-6,30-32`). The Infisical sync is separate and does not touch this workflow.
3. **Given** `DATABASE_URL` is a Railway reference, **When** the backend starts, **Then** it is never frozen into a literal (`.env.example` comment block near `DATABASE_URL`).

---

### User Story 6 - Leak guards (Priority: P2)

**Acceptance Scenarios**:

1. **Given** `.env`, `.env.*` (except `.env.example`), `*.pem`, `*.key`, `.claude/settings.local.json`, `.terraform/`, `*.tfstate`, **When** git status runs, **Then** they are ignored (`.gitignore:2-6,9,39-41`).
2. **Given** the backend or frontend Docker build context, **When** it is formed, **Then** `**/.env` and `**/.env.*` are excluded (`backend/.dockerignore:9-10`; `frontend/.dockerignore:5-6`).
3. **Given** the Railway upload, **When** formed, **Then** `.env`, `.env.local` and `.env.*` are excluded (`.railwayignore:20-22`).
4. **Given** an agent session, **When** it reads `.env*`, `*.pem`, or local settings, **Then** the read is denied; `.env.example` is allowed; `rm -rf *` is denied; wrapped pytest and compose `ps`/`logs` are pre-approved (`.claude/settings.json:11-20,23-33`).
5. **Given** a secret scanner runs on history, **Then** three fingerprints are ignored (`.infisicalignore:1-3`). These are commit hashes from before the migration `[UNVERIFIED: the scanner itself is not configured in the repo; .infisicalignore is read by the Infisical scanner only]`.

## Edge Cases

- **Shell-exported `DB_PASSWORD`**: the compose guard checks only that the variable is set. Exporting it manually runs compose without Infisical (`docker-compose.yml:7,25`). Other variables (`OPENROUTER_API_KEY`, `YOUTUBE_API_KEY`, `GENIUS_ACCESS_TOKEN`, `SECOND_VOICE_MODEL_ID`) have `:-` defaults and are silently empty (`docker-compose.yml:27-30`).
- **`TEST_DATABASE_URL` set**: it bypasses the `DB_PASSWORD` check entirely (`backend/tests/conftest.py:27-28`).
- **Live evals**: skipped unless their gates hold (`backend/evals/test_sheets_fallback.py:26`, `backend/evals/test_second_voice.py:35`, `backend/evals/test_sheets_enrich_live.py:15`).
- **Hermetic guard exceptions**: `_hermetic_enrichment` returns early for files named `test_sheets_enrich*` and for any path with an `evals` component (`backend/tests/conftest.py:52-56`). Those tests can reach providers.
- **Volume password drift**: the Postgres volume keeps the password it was created with (`rotate-secret` SKILL, "Dev `DB_PASSWORD`"). This is documented, not guarded by code.
- **`/health` is static** (`backend/app/main.py:77-78`).

## Requirements *(mandatory)*

### Functional Requirements (as implemented)

**Storage and injection**

- **FR-001**: Secrets and environment config MUST live in Infisical project `music app`, environments `dev` and `prod`, folders `/backend` and `/infra/auth0`. Evidence: `README.md:53-62`, `.infisical.yaml:1-5`.
- **FR-002**: The repo links to the project with a committed file containing identifiers only (`.infisical.yaml`). `[UNVERIFIED: the project-id in this copy is a placeholder; the original is in the source repo's history, not reviewed here]`.
- **FR-003**: Local processes receive secrets only through `infisical run --env=dev --path=/backend`. Evidence: `README.md:34-43`, `.claude/settings.json:11-18`.
- **FR-004**: Compose passes only listed names to `api` (`docker-compose.yml:20-32`).
- **FR-005**: `DB_PASSWORD` is the only fail-fast variable (`docker-compose.yml:7,25`). Others use `:-` defaults (`docker-compose.yml:26-32`).
- **FR-006**: The manifest `.env.example` lists names. Secret values are empty (`.env.example:16,21-24`). Tuning knobs and test switches are not listed; the header says so (`.env.example:1-10`).

**Config and tests**

- **FR-007**: `load_db_config` reads `DATABASE_URL` first, else the five `DB_*` variables (`backend/db.py:32,67-75`).
- **FR-008**: DB-backed tests skip without a password and without `TEST_DATABASE_URL` (`backend/tests/conftest.py:27-33`).
- **FR-009**: Unreachable Postgres skips DB fixtures (`backend/tests/conftest.py:81,88`).
- **FR-010**: Hermetic enrichment patching is skipped for `test_sheets_enrich*` files and any `evals` path (`backend/tests/conftest.py:55-56`).

**Sync and deploy**

- **FR-011**: Prod backend values are synced from `prod /backend` to Railway by a named sync, and the sync is triggered manually (`README.md:60`; `rotate-secret` SKILL). Sync settings are `[UNVERIFIED]` in-repo.
- **FR-012**: The deploy workflow uses `RAILWAY_TOKEN` from the `prod` GitHub Environment (`.github/workflows/deploy.yml:30-32`). The token type (project vs account) is documented but not enforced `[UNVERIFIED: no check in workflow]`.

**Rotation and removal (procedures, not code)**

- **FR-013**: The holders check uses 8-hex SHA-256 digests; `e3b0c442` means empty (`rotate-secret` SKILL, "Checks").
- **FR-014**: Verification uses the DB-backed history route and provider key checks, not `/health` (`rotate-secret` SKILL, "Checks"; `run-app-locally` SKILL).
- **FR-015**: `add-secret` and `rotate-secret` require user approval for prod actions and forbid agents from creating keys or entering values (`rotate-secret` SKILL, Principles 5; `add-secret` SKILL, section 4 and 6).

**Leak guards and docs**

- **FR-016**: Git, Docker and Railway ignore rules as listed in User Story 6.
- **FR-017**: Agent permissions deny reads of `.env` variants and rm -rf (`.claude/settings.json:22-33`).
- **FR-018**: README, CLAUDE.md and `backend/README.md` document the wrapper rule (`README.md:43`; `CLAUDE.md:50`; `backend/README.md:14-20`).

## Success Criteria *(mandatory)*

- **SC-001**: `docker compose config` fails without `DB_PASSWORD` set; with it exported manually, it succeeds without Infisical. Verifiable with the compose file.
- **SC-002**: Backend tests with neither `DB_PASSWORD` nor `TEST_DATABASE_URL` skip DB tests with a reason (not fail). Verifiable with `pytest -q` in `backend/`.
- **SC-003**: No application code loads a `.env` file explicitly: grep for `dotenv` in `backend/` and `frontend/src/` returns nothing. This does NOT mean the frontend ignores `.env` files. Astro and Vite load `.env`, `.env.local` and `.env.[mode]` from the project directory automatically, and server-side code can read the non-`PUBLIC_` variables (Astro docs, "Using environment variables", section ".env files"). The copy has no `frontend/.env*` file (`ls -a frontend`). Git and Docker ignore such files (`.gitignore:2-4`, `frontend/.dockerignore:5-6`), but no rule blocks a local `frontend/.env` from being read at build or dev time. `[UNVERIFIED: a dummy frontend/.env was not placed and built]`.

## Assumptions

- The maintainer has access to the Infisical project and Railway project (`README.md:31`).
- Docker, Node 22 and Python 3.12 are available (`README.md:31`).
- Auto-sync is off by design (`README.md:60`).
- `/infra/auth0` secrets are stored but not consumed; the Terraform scaffold is not present in the repo (`.env.example:34-40`; `backend/infra/auth0/` is empty).

## Known Gaps (as found in the implementation)

- The prod `pgvector` password rotation has never been run (`rotate-secret` SKILL). `[UNVERIFIED]`.
- The sync's UI label is not confirmed (`rotate-secret` SKILL). `[UNVERIFIED]`.
- No automated test covers ignore files, deny rules, or the compose fail-fast.
- Wrapper enforcement is partial: only `DB_PASSWORD` is guarded (`docker-compose.yml:7,25`).
- Astro/Vite auto-load `frontend/.env*`. A local `frontend/.env` containing `DB_PASSWORD` would be readable by server-side Astro code. The only controls are ignore rules, not a runtime guard.
- `RAILWAY_TOKEN` type is not enforced in code (`.github/workflows/deploy.yml:32`).
- The empty-value guard for `ALTER ROLE` exists only in the procedure text (`rotate-secret` SKILL).
- `backend/infra/auth0/` is empty; the `/infra/auth0` folder has no consumer in this repo.

## As-Built Traceability

| Area | Evidence |
|---|---|
| Project link | `.infisical.yaml:1-5` |
| Compose guards and pass-through | `docker-compose.yml:7,18-32` |
| Manifest | `.env.example:1-40` |
| DB config | `backend/db.py:32,37-75` |
| Test harness | `backend/tests/conftest.py:25-88` |
| Evals gates | `backend/evals/test_sheets_fallback.py:26`, `backend/evals/test_second_voice.py:35`, `backend/evals/test_sheets_enrich_live.py:15` |
| Leak guards | `.gitignore:2-9,39-41`, `backend/.dockerignore:9-10`, `frontend/.dockerignore:5-6`, `.railwayignore:20-22`, `.infisicalignore:1-3` |
| Agent permissions | `.claude/settings.json:11-33` |
| Procedures | `.claude/skills/{run-app-locally,add-secret,rotate-secret}/SKILL.md`, `README.md:53-70` |
| Prod deploy | `.github/workflows/deploy.yml:3-6,30-32` |
