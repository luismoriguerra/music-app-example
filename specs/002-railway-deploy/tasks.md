# Tasks: Railway Deploy (frontend + backend)

**Input**: Design documents from `/specs/002-railway-deploy/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Backend `DATABASE_URL` unit tests included per Principle III
(test-first, co-located in T004). Dockerfiles/workflows verified by execution
(build+run+curl, actionlint, live CI/Railway) per R9 — recorded as verify tasks.

**Organization**: Tasks grouped by user story (US1/US2/US3) after shared
Setup + Foundational phases, so each story is independently testable.
IDs T001–T015 are stable (referenced in commits + PR #1 + post-merge
validation); T016–T017 are the hardening follow-up (PR #2). Phases reflect
user-story ownership, not numeric order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/`, `frontend/` at repository root (per plan.md)
- Workflows + docs at root: `.github/workflows/`, `README.md`, `.railwayignore`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Container images + Railway service config + upload excludes —
shared by all three user stories (deploy needs images, CI builds them, parity
runs them).

- [x] T001 [P] Frontend container in `frontend/Dockerfile` (node:22-slim
  multi-stage, `npm ci` WITH devDeps for `prebuild`→`check-content` via `tsx`,
  `npm run build`, `serve@14` runtime on `${PORT:-3000}`) + `frontend/railway.json`
  (DOCKERFILE builder + restart policy) + `frontend/.dockerignore` (FR-001, FR-004)
- [x] T002 [P] Backend container: edit `backend/Dockerfile` CMD to honor
  `${PORT:-8000}` + explicit packaging copies (`app/`, `agents/`, `evals/`,
  `db.py` before `pip install .`) + `backend/railway.json` (DOCKERFILE builder,
  `/health` healthcheck, restart policy) + `backend/.dockerignore` (egg-info) (FR-002, FR-004)
- [x] T011 [P] Upload excludes: root `.railwayignore` + copies
  `frontend/.railwayignore` + `backend/.railwayignore` (node_modules, .venv,
  .git, dist, caches, egg-info, .env*) + `backend/.gitignore`; create
  `backend` + `frontend` as Empty Services (no GitHub source, Root Directory
  unset) in linked Railway project via `railway add -s <name>` (project
  `music-railway-infraestructure`, env `production`) — NOTE: services MUST be created via
  `railway add -s` (or dashboard Empty Service WITH a production instance);
  if a dashboard service shows zero instances and `railway up` 404s, FIRST
  check for an un-applied staged changeset (dashboard Deploy banner;
  `unmergedChangesCount` in `railway status --json`) and click Deploy — only
  if instances are still zero after applying, delete via
  `railway api 'mutation($id: String!) { serviceDelete(id: $id) }' --var id=<id>`
  (`railway service delete` can't remove zero-instance shells) + recreate with
  `railway add -s <name>` (observed 2026-09-15)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend config must parse Railway-style `DATABASE_URL` before ANY
deploy/parity story can be verified against a real database URL.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 `DATABASE_URL` parsing in `backend/db.py`
  (`config_from_database_url()`: postgres/postgresql schemes, percent-decoding,
  default 5432, `ConfigError` naming gaps; `load_db_config()` prefers
  `DATABASE_URL`, falls back to `DB_*`, SQLite rejected both paths) (FR-003) + 4 unit
  tests in `backend/tests/test_health.py` (parse, precedence, scheme rejection,
  missing parts); verify `pytest` 9/9 + `ruff check` + `ruff format --check`

**Checkpoint**: Foundation ready — images buildable, backend config Railway-aware;
user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 — Merge to main deploys both services (Priority: P1) 🎯 MVP

**Goal**: Push to `main` deploys frontend + backend to Railway `production`
via `deploy.yml`, then smoke-tests both public URLs.

**Independent Test**: Merge a trivial commit to `main`, watch `deploy.yml`
run green, open Railway frontend domain + `/health` on backend domain (spec V1).

### Implementation for User Story 1

- [x] T006 [US1] Write `.github/workflows/deploy.yml` (push `main` +
  `workflow_dispatch` re-deploy; concurrency `railway-deploy`; `environment: prod`
  on all jobs; two parallel jobs installing pinned `@railway/cli@5.2.0` then
  `railway up ./<dir> --path-as-root --service … --environment … --ci` from
  `prod` vars/secrets, each followed by a 30×10s tolerant
  `railway deployment list --json` poll (`|| echo UNKNOWN`) until `SUCCESS`
  (fail on `FAILED`/`CRASHED`/`CANCELLED`/timeout); `smoke` job curling
  `FRONTEND_URL`/`BACKEND_URL` 12×20s, skipped while empty) (FR-005,
  FR-007) per [contracts/deploy-workflow.md](./contracts/deploy-workflow.md)
- [x] T012 [US1] Deploy both from local for verification:
  `railway up ./backend --path-as-root …` + `railway up ./frontend
  --path-as-root …` (verified form — bare `railway up` from subdir spins on
  CPU, R6); both reach SUCCESS
- [x] T013 [US1] Generate service domains (`railway domain -s …`, both ACTIVE) +
  smoke test live URLs (frontend `/` 200 Ukulele card, chords 200, bogus 404;
  backend `/health` 200 `{"status":"ok"}`) + review deploy logs (uvicorn +
  serve on injected `$PORT` 8080). Verified 2026-09-15:
  `https://frontend.example.com`,
  `https://backend.example.com`

**Checkpoint**: At this point, User Story 1 is fully functional — merge
deploys both services (pending owner T014 secrets/vars for the token path).

---

## Phase 4: User Story 2 — PRs gated by CI, never deployed (Priority: P2)

**Goal**: Every PR runs the full gate set; broken code cannot reach `main`;
PRs structurally cannot deploy (no secrets in CI).

**Independent Test**: Open a PR with a deliberately broken test — CI fails,
zero Railway deployments (spec V2).

### Implementation for User Story 2

- [x] T005 [US2] Write `.github/workflows/ci.yml` (`pull_request: [main]`
  only, NO secrets): `frontend` job (`npm ci`, `npm test`,
  `npm run check-content`, `npm run check`, `npm run lint`,
  `npm run format:check`, `npm run build`), `backend` job
  (`pip install -e .[dev]`, `pytest`, `ruff check` + `format --check`),
  `docker` job (both `docker build`, no push) (FR-006, SC-004) per
  [contracts/deploy-workflow.md](./contracts/deploy-workflow.md)
- [x] T007 [US2] Verify workflows: YAML parses, `actionlint` clean, eyeball
  secret scan (no hardcoded tokens/IDs — FR-007, SC-004/data-model rule 4),
  `ci.yml` references zero secrets (data-model rule 5)

**Checkpoint**: At this point, User Stories 1 AND 2 both work — deploys flow
on merge, PRs gate without deploying.

---

## Phase 5: User Story 3 — One-command local parity check (Priority: P3)

**Goal**: Contributor builds + runs both production images locally and hits
the same pages Railway serves, before pushing.

**Independent Test**: `docker build` both from clean checkout, `docker run`,
curl frontend index + backend `/health` (spec V3).

### Implementation for User Story 3

- [x] T003 [US3] Verify parity: `docker build` both images clean;
  `docker run` + curl `/` → 200, `/courses/ukulele/topics/chords/` → 200,
  `/health` → `{"status":"ok"}`; dynamic `$PORT` on non-default ports
  (frontend :4567, backend :9123); `railway.json` files valid JSON with
  DOCKERFILE builder (FR-001, FR-002, FR-004, SC-003/data-model rules 1–3)

**Checkpoint**: All user stories now independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Docs + repo ops + owner handoff (affects all stories).

- [x] T008 [P] Write root `README.md` (architecture, local dev one-liners,
  Railway setup incl. pgvector template + `DATABASE_URL` reference + domains,
  secrets/vars table, merge-to-deploy flow) — FR-008, FR-009 (pgvector + ref documented)
- [x] T009 Create private GitHub repo `your-org/music-app-example`, push `main` +
  `002-railway-deploy`, open PR #1 with spec link + verification evidence
- [x] T010 Ping owner with secrets/vars checklist to enable merge→deploy
  (RAILWAY_TOKEN, RAILWAY_ENVIRONMENT, SERVICE vars, FRONTEND/BACKEND_URL)
- [x] T014 Provision `music-railway-infraestructure` (Empty Services `frontend` +
  `backend` via `railway add -s`, NO GitHub source, Root Directory UNSET; pgvector
  template via `railway deploy -t 3jJFCA` as service `pgvector`;
  `DATABASE_URL=${{pgvector.DATABASE_URL_PRIVATE}}` ref on backend;
  `CREATE EXTENSION IF NOT EXISTS vector;` → vector 0.8.6; owner re-minted
  `RAILWAY_TOKEN` (project token — `RAILWAY_TOKEN` rejects account tokens, those
  need `RAILWAY_API_TOKEN`) for this project; `prod` GitHub Environment holds
  the token secret + 5 vars, deployment branches `main` only — all executed
  2026-09-15, R10 (no pre-merge dispatch possible: workflow must be on the
  default branch first) (FR-009 live wiring, SC-001/SC-002 unblock); then
  merge PR #1
- [x] T015 [P] Run `quickstart.md` validation end to end (V1–V4) after T014
  merge (SC-001, SC-002); record results in PR #1 — DONE 2026-09-15: merge
  `dde7bf9` → deploy run 35026552269 all green (both `railway up --ci` +
  polls `SUCCESS` attempt 1, smoke attempt 1 both URLs); V2 `ci.yml`
  secret-free + deploy ran only on `push main`; V3 CI docker builds green;
  V4 `deployment list` SUCCESS + live curl matrix (`/` 200, chords 200,
  bogus 404, `/health` 200) + uvicorn/serve on `$PORT` 8080 (see PR #1
  comment 5688497851)
- [x] T016 [US1] Harden `deploy.yml` poll + skip docs-only rebuilds:
  `on.push.paths-ignore: ['specs/**', '**/*.md', '.specify/**', '.claude/**']`;
  per deploy job a `Record previous <svc> deployment id` step
  (`PREV_DEPLOYMENT_ID` to `$GITHUB_ENV`) before `railway up`, then a poll
  that reads `id + status`, treats `id == PREV` as `UNKNOWN` (freshness
  against list-endpoint lag), keeps CLI stderr visible (no `2>/dev/null` on
  `railway` so auth failures show in logs), and fails fast after 5
  consecutive `UNKNOWN`; contract updated in
  `contracts/deploy-workflow.md` — DONE 2026-09-15: merge `d00c96d` (PR #2) →
  deploy run 35028340638 all green, poll logs show `(prev 6a0349d3…)` →
  `id=3decdb64… status=SUCCESS` (backend) and `(prev 10bd4d12…)` →
  `id=3b6a3f20… status=SUCCESS` (frontend), both new ids ≠ prev (FR-005, FR-007)
- [x] T017 Remove `pgvector` public TCP proxy attack surface: verified backend
  `DATABASE_URL` resolves to `pgvector.railway.internal:5432` (PRIVATE, not the
  public `*.proxy.rlwy.net` endpoint), then `railway tcp-proxy delete
  fd21541e… --service pgvector --yes` → `tcp-proxy list` shows `proxies: []`;
  backend `/health` + frontend `/` both 200 after removal. Future manual psql
  via `railway connect pgvector` (no public endpoint). Public URL + password
  were visible only in-session (never committed/logged to GitHub); backend
  needs no redeploy (private networking unaffected). Executed 2026-09-15 (FR-009)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately (T001, T002,
  T011 all [P], different files)
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
  (T004 needs Dockerfiles settled to verify image + config together)
- **User Stories (Phase 3–5)**: All depend on Foundational completion
  - US1 (deploy + Railway verify), US2 (CI), US3 (parity) can then proceed in
    parallel (different files: deploy.yml vs ci.yml vs docker runtime)
  - Or sequentially P1 → P2 → P3
- **Polish (Phase 6)**: Depends on all user stories complete (README documents
  the verified flow; repo/PR wrap the finished work)

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — no dependencies on other stories
  (deploy.yml + Railway verification self-contained)
- **User Story 2 (P2)**: After Foundational — independently testable (ci.yml
  never touches Railway)
- **User Story 3 (P3)**: After Foundational — independently testable (local
  docker only)

### Within Each User Story

- T004 tests written FIRST, FAIL before `db.py` change (Principle III)
- Images/config before workflow verification (T001+T002+T004 → T003/T012)
- `deploy.yml`/`ci.yml` written before their verify steps (T006→T012/T013,
  T005→T007)
- Story complete before moving to next priority (or parallel by owner)

### Parallel Opportunities

- Phase 1: T001 + T002 + T011 all [P] (frontend vs backend vs Railway/ignores)
- Phase 3–5: US1 (T006/T012/T013) + US2 (T005/T007) + US3 (T003) parallel
  once Foundational done (different files/systems)
- Phase 6: T008 + T015 [P] (docs vs validation); T009→T010 sequential
  (PR before ping); T014 owner-gated

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all Setup tasks together (different files, no dependencies):
Task: "T001 Frontend container (frontend/Dockerfile + railway.json)"
Task: "T002 Backend container (backend/Dockerfile + railway.json)"
Task: "T011 Railway services + .railwayignore files"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001, T002, T011)
2. Complete Phase 2: Foundational (T004 — BLOCKS all stories)
3. Complete Phase 3: User Story 1 (T006, T012, T013)
4. **STOP and VALIDATE**: `railway up` both services, domains live, smoke
   green (quickstart V4)
5. Deploy/demo if ready (needs T014 token for CI path; local path works now)

### Incremental Delivery

1. Setup + Foundational → images + config ready
2. Add US1 → merge deploys (MVP!) → validate V1/V4
3. Add US2 → PRs gated → validate V2 (break a test on purpose)
4. Add US3 → local parity → validate V3 (fresh-checkout docker build)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (deploy.yml + Railway verification)
   - Developer B: US2 (ci.yml + actionlint)
   - Developer C: US3 (docker parity + $PORT proof)
3. Stories complete and integrate independently (converge in `deploy.yml`/
   `ci.yml` review + quickstart V1–V4)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to user story for traceability (US1/US2/US3)

[Showing lines 1-300 of 311. Use :301 to continue]