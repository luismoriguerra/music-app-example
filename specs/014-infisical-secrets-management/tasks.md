# Tasks: Infisical Secrets Management (current state, validation)

**Input**: `specs/014-infisical-secrets-management/` (spec.md, plan.md, research.md, data-model.md, contracts/env-contract.md, quickstart.md)

**Nature**: Brownfield. The feature already exists. Tasks VALIDATE the reconstruction: each claim in spec.md gets a check, a file reference, or a supervised step. No implementation tasks. No new tests are requested, so none are generated.

**Organization**: by user story from spec.md. Each story has an independent check.

## Format

`- [ ] TaskID [P?] [Story?] Description with path`. `[P]` = parallelizable. `[US#]` = user story.

---

## Phase 1: Setup

- [x] T001 Confirm branch `014-infisical-secrets-management` is checked out and `.specify/feature.json` points to `specs/014-infisical-secrets-management` (`.specify/feature.json`)
- [x] T002 [P] Record the baseline: `git status --short` and `git log --oneline -1` in `/Users/luismoriguerra/github/luismoriguerra/music-app-example`

## Phase 2: Foundational (blocks all stories)

- [x] T003 Verify every `path:line` citation in `specs/014-infisical-secrets-management/spec.md` resolves to a non-empty line: 64 distinct citations checked, 0 missing or out of range
- [x] T004 Verify the constitution gate in `specs/014-infisical-secrets-management/plan.md` against `.specify/memory/constitution.md:113,201`; lint/format gate recorded as NOT VERIFIED

## Phase 3: User Story 1 - Run and test locally (P1)

**Goal**: Compose and tests behave as documented without a `.env` file.
**Independent test**: `quickstart.md` steps 1, 3, 4.

- [x] T005 [US1] Run `env -u DB_PASSWORD docker compose config -q` in repo root; error `DB_PASSWORD missing` shown (`docker-compose.yml:7,25`). Exit code not captured in the run; error text confirmed
- [x] T006 [P] [US1] Run `env -u DB_PASSWORD -u TEST_DATABASE_URL python -m pytest -q tests` in `backend/`: 278 passed, 129 skipped, 0 failed (`backend/tests/conftest.py:27-33`)
- [x] T007 [P] [US1] Verify `test_db_url()` directly (`test_health.py` does not use it, so its passes prove nothing about the bypass): with no `DB_PASSWORD`, the call raises `pytest.skip` with `DB_PASSWORD not set`; with `TEST_DATABASE_URL=postgresql+psycopg://sentinel:none@127.0.0.1:1/x`, it returns that URL unchanged (`backend/tests/conftest.py:27-33`). Verified 2026-11-04
- [ ] T008 [US1] **[supervised, needs Infisical]** Start stack with `infisical run --env=dev --path=/backend -- docker compose up -d --build`, then `curl -s -o /dev/null -w '%{http_code}\n' localhost:8000/api/v1/history?limit=1` expecting 200. This resolves the `[UNVERIFIED]` in spec.md User Story 1 scenario 4. Requires the user to be logged in; the agent stops and asks if prompted

**Checkpoint**: US1 claims verified or marked open.

## Phase 4: User Story 2 - DB configuration (P1)

**Goal**: `DATABASE_URL` precedence and `DB_*` requirements hold.
**Independent test**: `pytest tests/test_health.py` (already in repo).

- [x] T009 [US2] Run `python -m pytest -q tests/test_health.py` in `backend/`: 9 passed (`backend/tests/test_health.py`)
- [x] T010 [US2] Confirm `load_db_config` checks `DATABASE_URL` before `DB_*` at `backend/db.py:73-75`, matching `contracts/env-contract.md`

## Phase 5: User Story 3 - Add or remove a variable (P1)

**Goal**: Compose pass-through and manifest agree with what the app reads.
**Independent test**: diff of names below.

- [x] T011 [US3] Compared manifest to compose `api` names: only differences are `API_PORT`, `PUBLIC_API_URL`, `TF_STATE_PG_CONN_STR` (expected: host, frontend, `/infra/auth0`). No unexpected mismatch
- [x] T012 [P] [US3] Confirm `PUBLIC_API_URL` is declared as `ARG` and `ENV` in `frontend/Dockerfile:13-14` and listed in `.env.example:32`
- [x] T013 [P] [US3] Confirm `AGENTOS_ENABLED` read at `backend/app/main.py:81` and compose default `false` at `docker-compose.yml:26`

## Phase 6: User Story 4 - Rotation (P1)

**Goal**: Rotation procedures are correct and the gaps they leave are recorded.
**Independent test**: holders check output contains only names and digests.

- [x] T014 [US4] Grep for `ALTER ROLE`: found only in `.claude/skills/rotate-secret/SKILL.md` and spec artifacts, so the empty-value guard is prose-only (`plan.md` Known inconsistency 3)
- [ ] T015 [US4] **[supervised, needs Infisical]** Run the holders check from `.claude/skills/rotate-secret/SKILL.md` "Checks" for `OPENROUTER_API_KEY` dev and prod; record digests only, never values
- [ ] T016 [US4] **[supervised, prod, needs explicit user approval]** `pgvector` password rotation: NOT run. Keep `[UNVERIFIED]` in spec.md until a supervised run exists

## Phase 7: User Story 5 - Prod sync (P2)

**Goal**: Prod deploy and sync facts match the docs.
**Independent test**: deploy workflow lines match spec claims.

- [x] T017 [US5] Confirm `environment: prod` and `RAILWAY_TOKEN` usage in `.github/workflows/deploy.yml:30-32`
- [ ] T018 [US5] **[supervised, needs Infisical UI]** Confirm sync `prod-backend-to-railway` settings (auto-sync off, deletion disabled) and whether prod holds `YOUTUBE_API_KEY` and `GENIUS_ACCESS_TOKEN`. Resolves plan.md Known inconsistency 2

## Phase 8: User Story 6 - Leak guards (P2)

**Goal**: Sensitive paths are ignored; `.env.example` stays tracked.
**Independent test**: `quickstart.md` steps 5 and 7.

- [x] T019 [P] [US6] Run `git check-ignore -v` on `.env .env.local frontend/.env.production backend/.env.test secrets.key cert.pem terraform.tfstate`: 7 of 7 matched
- [x] T020 [P] [US6] Run `git check-ignore -v .env.example`: not ignored, as expected
- [x] T021 [P] [US6] Run the `dotenv` grep over `backend` and `frontend/src`: 0 matches. This covers explicit loaders only; Astro/Vite auto-loading of `frontend/.env*` is NOT covered by this grep (see spec SC-003)
- [x] T022 [P] [US6] Run `gitleaks detect --no-git --source . --redact`: no leaks found

---

## Phase 9: Polish & cross-cutting

- [ ] T023 Update `spec.md`: change each `[UNVERIFIED]` resolved by T008, T015, T018 to its result; keep the rest
- [ ] T024 Update `checklists/requirements.md`: tick SC-003 and any item resolved above
- [ ] T025 Run `/speckit-analyze` over spec.md, plan.md and tasks.md; read-only; record contradictions in this file

---

## Dependencies

- T001-T004 block everything.
- Stories are independent of each other; each can run after Phase 2.
- T008, T015, T016, T018 need the maintainer; agents stop and ask before running them.
- T023 depends on T008, T015, T018 finishing.

## Parallel examples

- After Phase 2: T006, T007 run together; T012, T013 run together; T019-T022 run together.

## Implementation strategy (validation)

MVP = Phase 3 (US1). It proves the most-used claims (compose guard and test skips) without any credentials. Supervised tasks (T008, T015, T018) are scheduled after the offline checks.

## Task count

25 tasks: 2 setup, 2 foundational, 4 US1, 2 US2, 3 US3, 3 US4, 2 US5, 4 US6, 3 polish. Supervised tasks: T008, T015, T016, T018.
