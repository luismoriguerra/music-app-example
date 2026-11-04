# Tasks: App Authentication & Authorization (Auth0 + Terraform)

**Input**: Design documents from `/specs/007-app-auth/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md (R5–R8 decisions), data-model.md, contracts/

**Tests**: Included per Constitution III (Vitest + pytest test-first; JWKS verification mocked — never hit Auth0 in tests). Write failing tests first per story.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Contracts and scaffolding every phase builds on

- [ ] T001 Create auth env contract in `.env.example` (values never committed): backend (Railway) `AUTH0_DOMAIN`, `AUTH0_API_AUDIENCE`, `AUTH0_M2M_CLIENT_ID`, `AUTH0_M2M_CLIENT_SECRET`; frontend server (Railway runtime) `AUTH0_DOMAIN`, `AUTH0_API_AUDIENCE`, `AUTH0_WEB_CLIENT_ID`, `AUTH0_WEB_CLIENT_SECRET`, `SESSION_ENCRYPTION_KEY`, `APP_BASE_URL`, `BACKEND_URL`; CI (GitHub Environments `auth0-dev`, `prod`) `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`/`AUTH0_CLIENT_SECRET` (terraform-deployer M2M, read by the Terraform provider — never reused by apps), `TF_VAR_resend_smtp_password`, `TF_VAR_google_client_secret`, `TF_STATE_PG_CONN_STR` (Terraform `pg` state backend, **DR-009**). No browser-exposed Auth0 vars.
- [ ] T002 [P] Add backend Auth0 dependency to `backend/pyproject.toml` (`auth0-fastapi-api`; `PyJWT` fallback documented)
- [ ] T003 [P] **DR-007** Add server-side OIDC client for Astro to `frontend/package.json` (spike picks Auth0 server SDK vs `openid-client`; record choice in `specs/007-app-auth/research.md`) + `@astrojs/node`; no Auth0 SDK in the browser bundle (replaces spa-js)
- [ ] T004 [P] Document Auth0+Terraform architecture + one-liner gates in `backend/README.md` and `frontend/README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tenant as code, token verification, and local mirror — every story depends on these

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Scaffold Terraform Auth0 root in `backend/infra/auth0/` (versions/providers/variables/tenant/api/roles/clients/connections/actions/attack-protection/email/outputs + `envs/dev.tfvars`; **DR-009** `pg` backend: dedicated `terraform_state` database + role on the Railway Postgres server, `conn_str` from `TF_STATE_PG_CONN_STR`, `schema_name` per environment (`auth0_dev` / `auth0_prod`) via `-backend-config`, reachable from GitHub Actions): `api.tf` `auth0_resource_server.token_lifetime = 86400`; `clients.tf` `music-app-example-web` (`app_type = regular_web`, confidential, Authorization Code, rotating refresh tokens with `refresh_token.leeway`) + backend M2M; `email.tf` Resend SMTP `auth0_email_provider` (`name = "smtp"`, host `smtp.resend.com`, password from `TF_VAR_resend_smtp_password`) + `auth0_email_template` `verify_email` + `reset_email` (not legacy `change_password`), `include_email_in_redirect = false` (**DR-008**); add `infra/`, `**/.terraform/`, `*.tfstate*`, `*.tfplan` to `backend/.dockerignore` and `.terraform/`, `*.tfstate`, `*.tfstate.*`, `*.tfplan` to root `.gitignore` before the first `terraform init` (state holds client secrets + SMTP password); password connection `disable_signup = false` with a Pre-User-Registration Action that denies any email not in the `admission_allowlist` variable (dev: `envs/dev.tfvars`; prod: `TF_VAR_admission_allowlist` secret in the `prod` GitHub Environment, never committed), and the admission Post-Login Action refusing allowlisted logins until `event.user.email_verified` is true, then stamping a namespaced `admission` claim (FR-026, FR-027, **DR-011**, **DR-012**)
- [ ] T006 [P] **DR-002** Spike: `terraform plan` against the dev tenant is clean (roles `user`/`admin`, API scopes, `music-app-example-web`+M2M clients, roles-claim Action, Resend SMTP email provider + templates) ; dev and prod plans show disjoint state (distinct `schema_name`, DR-009); and record result in `specs/007-app-auth/research.md` — a no-go reopens DR-002
- [ ] T007 [P] **DR-005** Spike: dev-tenant round trip (login → `require_auth` accept with `sub`/`aud`/`exp` + namespaced roles claim present for first-login seeding → forged/expired token denied; confirm admin routes do NOT gate on token `permissions`, only the mirror) and record result in `specs/007-app-auth/research.md` — a no-go reopens DR-005
- [ ] T008 Create `users` (auth0_sub mirror), `audit_log` tables + legacy `owner_id → users.id` migration plan in `backend/db_models.py` (**DR-010**: `owner_id` becomes `NOT NULL` UUID FK after T016 runs; no unclaimed state); `feature_flags`, `user_entitlements`, `usage_ledger` are created by 010-admin-governance, not here
- [ ] T009 **DR-005** **DR-006** Implement Auth0 verify deps + `get_current_user`/`require_role` (roles read from the `users.role` mirror loaded on every protected call; token role claims only seed the mirror at first login and drive UI visibility — **DR-007**) + the single decision point with `authorize(subject, action, resource)` and `scope(subject, action, resource_type)` → list filter (FR-022; v1 scope = owner filter; no inline route checks) in `backend/app/auth/deps.py` per `specs/007-app-auth/contracts/session-contract.md` (pin `auth0-fastapi-api` exactly — pre-release; `PyJWT` fallback)
- [ ] T010 [P] Contract tests for verifier + role gate (mocked JWKS) in `backend/tests/test_auth_deps.py` (fail first)
- [ ] T011 **DR-007** Switch Astro to SSR (mandatory: `output: 'server'` + `@astrojs/node` standalone) in `frontend/astro.config.mjs` for the BFF auth endpoints/middleware, and switch the `frontend/Dockerfile` runtime to the Node adapter (`node ./dist/server/entry.mjs`, not `serve dist`)
- [ ] T054 [P] **DR-011** Spike (dev tenant) — pass only if all hold: (1) a first social login for an email whose password user carries `app_metadata.invite_id` is linked AND `api.authentication.setPrimaryUser` makes that first login's tokens carry the invited `sub`; (2) the match uses `app_metadata.invite_id` + the social identity's IdP-verified email (pending invitee is still `email_verified: false`); (3) an uninvited or unverified email is denied via `api.access.deny`, leaving only an orphan Auth0 user (accepted cost, no app account); record result in `specs/007-app-auth/research.md` (moves DR-011 to Accepted or reopens it)
- [ ] T055 [P] Test: registration with a non-allowlisted email is rejected (Universal Login and the Authentication API signup call) and an allowlisted email registers and logs in (FR-026, FR-027, SC-001)
- [ ] T056 [P] **DR-012** `backend/infra/auth0/Makefile` with `init`/`plan`/`apply` targets taking `ENV=dev|prod` (per-environment `-backend-config` `schema_name`, DR-009; reads `TF_VAR_*` from the environment; `apply ENV=prod` refuses to run unless `CI=true`, keeping prod on DR-002's reviewed path); document `make apply ENV=dev` in `backend/infra/auth0/README.md`
- [ ] T057 [P] **DR-012** Spike (dev tenant) — pass only if all hold: (1) the Pre-User-Registration Action denies a non-allowlisted email and admits an allowlisted one; (2) a user created through the Management API (012's invite path) is NOT blocked by it; (3) the `admission` claim reaches the backend on first login; (4) an allowlisted but unverified login is refused until the email is verified; record result in `specs/007-app-auth/research.md` (moves DR-012 to Accepted or reopens it)
- [ ] T046 [P] **DR-008** Verify a project-controlled sending domain with Resend (SPF/DKIM) per environment and store the SMTP password as `TF_VAR_resend_smtp_password` in GitHub Environments `auth0-dev`/`prod`; record in `backend/infra/auth0/README.md` (prerequisite for T005 apply and for 012-admin-invites)

**Checkpoint**: Foundation ready — tenant reproducible, tokens verifiable, mirror tables in place

---

## Phase 3: User Story 1 - Sign up, log in, stay logged in (Priority: P1) 🎯 MVP

**Goal**: Hosted identity end-to-end with local mirror provisioning

**Independent Test**: quickstart §1 with two accounts; close/reopen browser stays logged in

### Tests for User Story 1 (write first, fail before implementation)

- [ ] T012 [P] [US1] Backend tests for mirror provisioning (role seeded from token claim at first login only; unverified account → `403 EMAIL_UNVERIFIED` on mutation/billable call, reads still allowed; accepted invitee verified; first login with an `admission: allowlist` claim → provisioned as `user` (FR-027); first login with neither a pending invite nor an allowlist claim → `403 NOT_INVITED` and no mirror row (FR-026) — FR-025) + `GET /auth/me` in `backend/tests/test_auth_api.py`
- [ ] T013 [P] [US1] Frontend tests for `/api/auth/login`, `/api/auth/callback`, `/api/auth/logout`, `__Host-session` cookie encryption/chunking (>4 KB), single-flight refresh, and the `/api/backend/[...path]` proxy (attaches Bearer) in `frontend/tests/auth.test.ts`
- [ ] T050 [P] [US1] Session-lifetime tests (FR-002): copied `__Host-session` cookie replayed after logout is accepted only within the 24 h access-token window (accepted risk) and denied after expiry; logout revokes the refresh token so replay cannot renew, in `frontend/tests/auth-session.test.ts`

### Implementation for User Story 1

- [ ] T014 [P] [US1] Implement `GET /auth/me` (+ first-login provisioning) in `backend/app/auth/routes_auth.py` per `specs/007-app-auth/contracts/rest-api.md` (provision only for a pending invite matched by verified email, an `admission: allowlist` claim (FR-027, DR-012), or the break-glass first admin; else `403 NOT_INVITED`, FR-026; on acceptance, consume the invite and mark `email_verified` via Management API `PATCH /users/{id}` — FR-025, 012-admin-invites owns the `invitations` row this reads)
- [ ] T015 [US1] **DR-007** Implement BFF auth (replaces spa-js islands): `GET /api/auth/login`, `GET /api/auth/callback`, `POST /api/auth/logout` (clear cookie, revoke refresh token at `/oauth/revoke`, redirect via `/v2/logout`) in `frontend/src/pages/api/auth/`; session lib (encrypted HttpOnly `__Host-session`, `Secure` always (required by `__Host-`), `SameSite=Lax`, chunked, `SESSION_ENCRYPTION_KEY`, single-flight refresh): pure encrypt/chunk/parse helpers in `frontend/src/lib/auth/session-crypto.ts` (zero `astro*` imports, Principle VIII) + Astro-bound cookie read/write, refresh, and guards in `frontend/src/middleware.ts`; browser-island proxy `frontend/src/pages/api/backend/[...path].ts` attaching `Authorization: Bearer` (thin endpoint; Bearer attachment and refresh logic in pure `frontend/src/lib/auth/`, constitution 1.3.0 Logic placement); login/logout buttons in `frontend/src/components/auth/`
- [ ] T016 [US1] **DR-010** Implement the one-time operator migration `backend/app/auth/migrate_legacy.py` (CLI): re-point every `owner_id = "owner"` row to the break-glass first admin's `users.id` in one transaction, write one `legacy_claim` audit row, refuse to re-run or to run without exactly one designated first admin; tests: double-run refused, no-admin refused, row counts audited (FR-010)
- [ ] T017 [US1] Add security audit events (login, logout, password_reset, role_change, user_block, flag_change, limit_change, invite_sent/accepted/revoked, access_denied, legacy_claim, admission_denied) in `backend/app/auth/audit.py` (FR-008)

- [ ] T052 [P] Capture pre-auth baseline: anonymous catalog time-to-first-content on the current static build, before T011 (SC-005)

**Checkpoint**: US1 fully functional and independently testable (MVP: hosted login + mirror)

---

## Phase 4: User Story 2 - My content is mine, curated content is everyone's (Priority: P2)

**Goal**: Per-row ownership enforcement + `user`/`admin` RBAC, public catalog stays anonymous

**Independent Test**: quickstart §2 adversarial ID-swap suite (SC-003: 100 crafted swaps, all denied)

### Tests for User Story 2 (write first, fail before implementation)

- [ ] T018 [P] [US2] Adversarial cross-owner tests (sheets/history/analyses swaps → 404) in `backend/tests/test_ownership.py`
- [ ] T019 [P] [US2] Role-gate tests (`user` denied admin paths, last-admin removal refused, revoked admin denied on next call — mirror authoritative, SC-007) in `backend/tests/test_rbac.py`
- [ ] T020 [P] [US2] Page-guard tests (anonymous mutation → login, catalog readable) in `frontend/tests/authz.test.ts`

### Implementation for User Story 2

- [ ] T021 [US2] Enforce Bearer + ownership via `scope()` (list filters) and `authorize()` (single-resource access) in `backend/app/routes_sheets.py` (FR-022; no inline owner filters; depends on T009)
- [ ] T022 [US2] Enforce Bearer + ownership via `scope()`/`authorize()` in `backend/app/routes_second_voice.py` (FR-022; no inline owner filters; depends on T009)
- [ ] T023 [US2] Coarse frontend route gating + role-based UI hiding in `frontend/src/middleware.ts` + `frontend/src/components/auth/` (enforcement stays backend)

- [ ] T051 [US2] Enforce MCP tool calls through `authorize()`/`scope()` with the same 401/403/404 shapes as REST; parity test REST vs MCP denial in `backend/tests/test_mcp_auth.py` (FR-003)
- [ ] T053 [US2] Retarget islands off `PUBLIC_API_URL` to `/api/backend/[...path]` (`frontend/src/components/SheetGenerator.tsx`, `frontend/src/components/SheetView.tsx`); remove `ARG/ENV PUBLIC_API_URL` from `frontend/Dockerfile` and the Railway variable (before T021/T022)

**Checkpoint**: US1 + US2 both work; zero cross-account leaks; anonymous catalog intact

---

## Phase 5: User Story 3 - Admin blocks a bad actor; minimal safety control (Priority: P2)

**Goal**: Admin can block/unblock as a minimal safety control (invites are
012-admin-invites; full role/flag/rate-limit governance is 010-admin-governance —
both extend this phase's admin page)

**Independent Test**: quickstart §3 (block flow + SC-007)

### Tests for User Story 3 (write first, fail before implementation)

- [ ] T024 [P] [US3] Admin block/unblock tests (block → next call denied; unblock → restored; each mutation writes its `audit_log` row; Management API mocked) in `backend/tests/test_admin_users.py`
  *(list/search, role grant/revoke, last-admin guard, feature-flag, rate-limit and model-allowlist enforcement tests, and admin console island tests — were T024's role/list half, T025, T026, T027 — are specified in 010-admin-governance, not built here)*

### Implementation for User Story 3

- [ ] T028 [US3] Implement Management API client (M2M, cached token, bounded paging) in `backend/app/auth/mgmt.py` (shared: 007's block/unblock, 010's list/search/role/create, and 012's invite issuance all use this client)
- [ ] T029 [US3] Implement admin block/unblock endpoint in `backend/app/auth/routes_admin.py` per `specs/007-app-auth/contracts/rest-api.md` (writes the provider block AND the `users.blocked` mirror in the same request; mirror write failure fails the request — never partial success, FR-018; **DR-007**)
  *(list/search + role grant/revoke endpoints, feature-flag read/evaluate + admin endpoints, entitlement resolution + rate-limit middleware + usage ledger, admin console islands for those sections — were T029's role/list half, T030, T031, T032 — are specified in 010-admin-governance, not built here)*
- [ ] T032b [US3] Implement the Users-section island, limited to find/block/unblock, in `frontend/src/components/admin/UsersIsland.tsx` (010-admin-governance extends it with role grant/revoke) — presentational (props in, events out) with loading/empty/error/ready states via the shared `ViewStates` (constitution 1.3.0 Component completeness, Standalone reusability)
- [ ] T044 [US3] Implement admin page shell `frontend/src/pages/admin/index.astro` (SSR) with server-side guard (no session → redirect `/api/auth/login?next=/admin`; session but not `admin` per `GET /auth/me` mirror role → 403 page) hosting the Users (block/unblock) island from `frontend/src/components/admin/` (012-admin-invites adds an Invites island; 010-admin-governance adds Feature flags and Rate limits islands, to the same shell); page composes only — no business rules or fetch orchestration in the page (constitution 1.3.0 Logic placement)

### Invite flow — moved to 012-admin-invites

  *(invite lifecycle tests, the invite service incl. the `app_metadata.invite_id` DR-011
  match marker, invite endpoints, the invite manager island, and the welcome landing
  `frontend/src/pages/welcome.astro` — were T040–T043, T045 — are specified in
  012-admin-invites, which depends on 007's T046 (Resend domain) and DR-004/DR-008)*

**Checkpoint**: Admin can govern users, features, and spend; every action audited

---

## Phase 6: User Story 4 - Social login (moved to 011-invited-social-login)

**Goal / tasks**: fully specified in 011-invited-social-login, which depends on T054's
DR-011 spike below and on 007's session contract + `authorize()`/`scope()` seam.
Tasks T033 (link/deny tests), T034 (connection + Action in `backend/infra/auth0/`)
and T035 (UI) move there; they are not built as part of 007.

**Checkpoint**: 007's stories (US1–US3) independently functional; 011-invited-social-login depends on this feature.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Hardening and gates before converge

- [ ] T036 [P] Document break-glass first-admin seeding + emergency dashboard-drift reconciliation in `backend/infra/auth0/README.md` (FR-017, FR-011)
- [ ] T037 [P] Compose + Railway env wiring in `docker-compose.yml` + Railway service variables docs (values via environment only): backend `AUTH0_DOMAIN`, `AUTH0_API_AUDIENCE`, `AUTH0_M2M_CLIENT_ID`, `AUTH0_M2M_CLIENT_SECRET`; frontend server runtime `AUTH0_DOMAIN`, `AUTH0_API_AUDIENCE`, `AUTH0_WEB_CLIENT_ID`, `AUTH0_WEB_CLIENT_SECRET`, `SESSION_ENCRYPTION_KEY`, `APP_BASE_URL`, `BACKEND_URL`
- [ ] T047 [P] CI: add `terraform` job to `.github/workflows/ci.yml` (`fmt -check`, `init -backend=false`, `validate`) + PR `make plan ENV=dev` (environment `auth0-dev`; same Makefile targets as local runs, T056)
- [ ] T048 Deploy ordering: add first job `auth0-apply` to `.github/workflows/deploy.yml` running `make apply ENV=dev` then `make apply ENV=prod` (T056; dev then prod, prod behind environment reviewers); `deploy-frontend` and `deploy-backend` get `needs: auth0-apply` (single workflow → deterministic ordering)
- [ ] T049 [P] Add scheduled drift-check workflow in `.github/workflows/auth0-drift.yml` (daily `terraform plan -detailed-exitcode` against prod; exit 2 fails — SC-006)
- [ ] T038 Run `specs/007-app-auth/quickstart.md` end-to-end and record results in the PR body, incl. anonymous catalog TTFC vs the T052 baseline (SC-005, ≤10%) and protected-call auth overhead p95 (<150 ms)
- [ ] T039 Full gates green: `pytest` in `backend/`, `npx vitest run` in `frontend/`, `ruff check` + `eslint` + format checks, `terraform fmt -check` + `terraform validate`, Agno test-scenarios for second-voice re-run (rate-limit/allowlist gates now precede inference, Principle IV), constitution layering review

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (T046 → T005 apply (email provider needs the SMTP secret); T005→T006 plan-clean and T007 round-trip spikes; T008→T009 mirror + verifier chain; T003→T011 SSR + Node runtime)
- **T005 needs** the `terraform_state` database + role and `TF_STATE_PG_CONN_STR` in each GitHub Environment first (DR-009)
- **T016 needs** the break-glass first admin seeded first: run T036's seeding step before T016 (its README can finish in Phase 7) (DR-010)
- **T057 spike gates T055 and the allowlist parts of T005** (DR-012 must reach Accepted); **T056 before T047/T048** (CI calls the Makefile)
- **T054 is 007's own spike**: it must move DR-011 to Accepted before 011-invited-social-login can plan its build (011's equivalents of the old T033/T034/T035)
- **T052 before T011** (baseline must be measured on the static build)
- **T003 spike gates T013/T015** (the OIDC library shapes both)
- **T053 before T021/T022** (islands must use the proxy before routes require Bearer)
- **User Stories (Phase 3+)**: Depend on Foundational; proceed P1 → P2 (US2 needs US1 mirror; US3 needs US1+US2 enforcement)
- **Polish (Phase 7)**: Depends on all desired stories complete; T047 after T005; T048 after T005 + T047; T049 after T048 (prod tenant applied)

### User Story Dependencies

- **US1 (P1)**: After Foundational — no story dependencies (MVP); T015 depends on T003 + T011
- **US2 (P2)**: After Foundational + US1 mirror (integrates, independently testable via swaps)
- **US3 (P2)**: After US1+US2 (minimal block on top of enforced identity); T044 depends on T014 + T015 + T032b (012-admin-invites and 010-admin-governance each add their own island to the T044 shell once planned — not a dependency of T044 itself)
- **US4 (P3)**: Moved to 011-invited-social-login (depends on 007 T054/DR-011 Accepted)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Mirror/tables before services; services before endpoints; endpoints before UI
- Story complete + independently validated before next priority

### Parallel Opportunities

- T002, T003, T004; T006, T007, T046; T010 with T011; T012, T013, T050; T018, T019, T020; T024, T040; T036, T037, T047, T049
- Post-Foundational, different stories parallelizable with staffing (priority order still P1→P2→P3 for review)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup + Phase 2 Foundational (tenant applied to dev, verification green)
2. Phase 3 US1 → STOP and VALIDATE per quickstart §1 → shippable hosted-login MVP

### Incremental Delivery

1. + US2 → adversarial swap suite green → credible multi-user posture (VII gate liftable)
2. + US3 (this feature) → minimal block; 012-admin-invites adds the invite growth path,
   010-admin-governance adds flags/rate limits → governed product with bounded AI spend
3. 011-invited-social-login → social connection → ideal UX (separate spec, depends on this one)

### Decision Points

- T003 spike picks the server-side OIDC client (Auth0 server SDK vs `openid-client`) → record in research.md before T015
- T006 no-go (plan unclean) → fix Terraform before any backend role/permission dependency
- T007 no-go (claims missing) → fix API RBAC toggles/Action before ownership work trusts roles
- Auth0 untenable → fall back to research R1–R4 self-hosted ladder with a new spec amendment; no silent substitution

---

## Notes

- Execution order is defined by phase and the dependency lines above, not by task ID (T044+ were appended later)
- `.env.example` (T001) is the canonical env-variable list; other docs reference it
- [P] tasks = different files, no dependencies
- [Story] label maps task to user story for traceability
- Backend tasks → `agno-backend`; frontend tasks → `astro-frontend`; Terraform (`backend/infra/auth0/`) agreed before parallel work; contracts first
- JWKS/Management API are always mocked in tests — never hit Auth0 from unit tests
- Commit after each task or logical group; stop at any checkpoint to validate
