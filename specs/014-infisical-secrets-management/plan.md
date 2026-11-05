# Implementation Plan: Infisical Secrets Management (current state)

**Branch**: `014-infisical-secrets-management` | **Date**: 2026-11-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/014-infisical-secrets-management/spec.md`

**Nature**: Brownfield baseline. This plan documents the design that already exists in commit `fb625e2`. It proposes no changes.

## Summary

Secrets moved out of `.env` files into Infisical (`dev` and `prod` environments, `/backend` and `/infra/auth0` folders). Local processes receive them only through `infisical run`. Compose passes only listed names to the API and fails fast on `DB_PASSWORD`. The backend reads `DATABASE_URL` or `DB_*`. Prod values reach Railway through a manually triggered one-way sync. The repo holds a names-only manifest, leak guards and three agent skills. This plan records that architecture, its inconsistencies, and the checks that prove each claim.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript/Astro (frontend, only `PUBLIC_API_URL` touches this feature)

**Primary Dependencies**: Infisical CLI (`infisical run`), Docker Compose, FastAPI, SQLAlchemy with psycopg, pytest

**Storage**: PostgreSQL 17 with pgvector (`docker-compose.yml:2`); production Postgres is the Railway `pgvector` service (`.claude/skills/rotate-secret/SKILL.md`)

**Testing**: pytest in `backend/` (DB tests skip without credentials); vitest in `frontend/`; `gitleaks` for leak scanning (installed locally, not configured in repo)

**Target Platform**: macOS developer machine (documented); Railway for production (`.github/workflows/deploy.yml`)

**Project Type**: Web application (Astro frontend, FastAPI backend), monorepo with Spec Kit at root

**Performance Goals**: Not applicable to this feature (no runtime behavior beyond startup config)

**Constraints**: No secret value in repo, compose, Dockerfiles, specs or commits; prod changes need explicit approval; `.env` files banned (constitution, `.specify/memory/constitution.md:113,201`)

**Scale/Scope**: One maintainer; two environments; about 12 variables (see `data-model.md`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md`:

| Principle or constraint | Source | Status | Evidence |
|---|---|---|---|
| Secrets MUST come exclusively from environment | constitution:113 | PASS | `infisical run` injects env; no explicit file loader in code. Astro/Vite auto-load `frontend/.env*` when present; none present in this copy (spec SC-003) |
| `.env` never committed | constitution:201 | PASS | `.gitignore:2-4` ignores `.env` and `.env.*`, keeps `.env.example` |
| Lint/format and gates green before merge | constitution:201-215 | NOT VERIFIED here | Not run in this review |
| Backend test-first (Principle III) | constitution:42 | PASS for this feature's guards | DB tests skip with reason (`backend/tests/conftest.py:27-33`) |
| Downward-only layering (Principle VIII) | constitution:124 | PASS | Config in `backend/db.py` is read by `backend/app/main.py` and `backend/db_models.py`, not the reverse |

**Gate result**: PASS. One item is not verified and is recorded in `tasks.md`.

**Justified deviations**: None. The integration has no `.env` fallback, by design (`README.md:43`).

## Project Structure

### Documentation (this feature)

```text
specs/014-infisical-secrets-management/
├── plan.md                    # This file
├── research.md                # Phase 0: decisions behind the current design
├── data-model.md              # Phase 1: variables, locations, consumers
├── quickstart.md              # Phase 1: runnable validation guide
├── contracts/
│   └── env-contract.md        # Phase 1: environment variable contract
├── tasks.md                   # Validation tasks (speckit-tasks output)
├── checklists/requirements.md # Spec quality checklist
└── spec.md                    # Reverse-engineered specification
```

### Source files covered by this feature (repository root)

```text
.infisical.yaml                  project link (identifiers only)
.infisicalignore                 scanner fingerprints
.env.example                     names-only manifest
docker-compose.yml               pass-through and fail-fast guards
.gitignore, .railwayignore       leak guards
backend/db.py                    DB configuration (DATABASE_URL or DB_*)
backend/app/main.py              startup config handling, /health
backend/tests/conftest.py        DB test harness, skip reasons, hermetic guard
backend/tests/test_health.py     DATABASE_URL and DB_* parsing tests
backend/.dockerignore            build-context guard
frontend/.dockerignore           build-context guard
frontend/Dockerfile              PUBLIC_API_URL build argument
.github/workflows/deploy.yml     prod deploy with RAILWAY_TOKEN
.claude/settings.json            agent permission rules
.claude/skills/*/SKILL.md        run, add and rotate procedures
README.md, CLAUDE.md, backend/README.md   documentation
```

**Structure Decision**: No new code. This feature is a set of configuration files, procedures and tests. Its artifacts are documentation in `specs/014-infisical-secrets-management/`.

## Complexity Tracking

Not applicable. No violations to justify.

## Known inconsistencies recorded (not fixed)

1. **Partial wrapper enforcement.** Only `DB_PASSWORD` is fail-fast (`docker-compose.yml:7,25`). Other API variables default silently (`docker-compose.yml:26-32`).
2. **Prod sync list mismatch.** `README.md:60` lists prod variables `OPENROUTER_API_KEY`, `CORS_ORIGINS`, `SECOND_VOICE_MODEL_ID`. The manifest also declares `YOUTUBE_API_KEY` and `GENIUS_ACCESS_TOKEN` as backend secrets (`.env.example:22-23`). Whether prod has them is `[UNVERIFIED]`.
3. **Empty-value guard only in prose.** `ALTER ROLE` is never run with an empty value only because the skill says so (`.claude/skills/rotate-secret/SKILL.md`, "Dev `DB_PASSWORD`"). No script enforces it.
4. **Hermetic guard exemptions.** `_hermetic_enrichment` skips `test_sheets_enrich*` and `evals` paths (`backend/tests/conftest.py:55-56`).
5. **Unused folder.** `backend/infra/auth0/` is empty; `/infra/auth0` secrets have no consumer in the repo.

These are recorded so that a later enhancement branch can decide. This branch changes none of them.