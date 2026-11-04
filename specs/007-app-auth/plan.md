# Implementation Plan: App Authentication & Authorization

**Branch**: `feat/app-auth-fa42` | **Date**: 2026-09-18 · **Amended**: 2026-09-19, 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-app-auth/spec.md`

## Summary

Replace the synthetic single-owner identity (`OWNER_ID`, no login) with Auth0
as the managed identity provider (Universal Login, RBAC roles `user`/`admin`
projected into access tokens), Terraform-managed tenant configuration
(`backend/infra/auth0/`, dev/prod, FR-011), invite-only onboarding, and a minimal
admin page (block/unblock) — invites are specified separately in
**012-admin-invites**; full governance (roles, feature flags,
API/AI rate limits, usage ledger) is specified separately in
**010-admin-governance**, which extends this admin API/page. The browser session
is a BFF: the Astro server runs the Authorization Code flow as the confidential
`music-app-example-web` client and keeps tokens in an encrypted HttpOnly
`__Host-session` cookie; the browser never holds a token (DR-007). Roles are
authorized from the local `users.role` mirror (token claims seed it and drive
UI only). Invite/verify/reset email goes through Resend SMTP configured as the
Auth0 email provider (DR-008). Authorization flows through one backend seam,
`authorize()` + `scope()` (DR-006). Research R5–R8 record the Auth0 +
Terraform decisions, now captured as
[DR-002…DR-011](spec.md#decision-records) (DR-005 supersedes DR-001); the earlier self-hosted ladder
(R1–R4) is retained as evaluated fallback only. Accounts come only from invites (012), the break-glass admin, or a per-environment
email allowlist (FR-026/FR-027, DR-012): a Pre-User-Registration Action refuses any email not on
the Terraform `admission_allowlist`, applied locally or by CI through `backend/infra/auth0/Makefile`. Social login (linking first logins to invited accounts,
DR-011) is specified separately in **011-invited-social-login**, which depends on T054
moving DR-011 to Accepted.

## Technical Context

**Language/Version**: Backend Python >=3.12 (pinned `pyproject.toml`); Frontend
TypeScript + Astro 7.3.2, React 19 islands, Node >=22.12.0

**Primary Dependencies**: Backend `auth0-fastapi-api` (Auth0 `Auth0FastAPI` +
`require_auth(scopes)`; `PyJWT`+`PyJWKClient` fallback), `sqlalchemy>=2.0,<3`,
`psycopg[binary]>=3.2,<4`. Frontend `@astrojs/node` (standalone SSR adapter) +
a server-side OIDC client (spike picks lib: Auth0 server SDK vs
`openid-client`) running the Authorization Code flow inside Astro endpoints; no
Auth0 SDK in the browser bundle (`@auth0/auth0-spa-js` removed, DR-007).
Infra: Terraform + `auth0` provider (tenant as code, `backend/infra/auth0/`), Resend as
SMTP email provider (DR-008). Superseded candidates (`fastapi-fullauth`,
`better-auth`, hand-rolled JWT) stay documented in research R1–R4 as fallback
only

**Storage**: Project PostgreSQL for domain rows, ownership (`owner_id →
users.id` keyed by Auth0 `sub`); `feature_flags` / `user_entitlements` / `usage_ledger`
are 010-admin-governance's own tables, not created here;
`audit_log` (Compose `db`, `pgvector/pg17`; Railway `DATABASE_URL` in deploy).
Identity (credentials, role grants) lives in Auth0 with a local mirror whose
`users.role` is authoritative for authorization; tenant config lives in
Terraform, not the DB. The browser session lives in the encrypted
`__Host-session` cookie — no server-side session store. No SQLite
(Constitution VII); no second runtime store

**Testing**: Backend `pytest` (unit + contract per route) + Agno
test-scenarios gate where agent behavior changes; Frontend `vitest run`
(islands, middleware, `/api/auth/*` endpoints, session-cookie
encrypt/chunk/refresh, `/api/backend` proxy, admin/welcome page guards).
Adversarial ID-swap tests for SC-003; rate-limit window tests

**Target Platform**: Web: Astro SSR is mandatory (`output: 'server'` +
`@astrojs/node` standalone) — the auth endpoints, session cookie, backend proxy,
and admin guard all run on the frontend server; the frontend Docker runtime is
the Node server (`node ./dist/server/entry.mjs`, not `serve dist`). Behind it
FastAPI/AgentOS; local dev via `docker compose up` plus an Auth0 dev tenant;
deploy via Railway (existing 002 pipeline) with Auth0 tenant per environment
(dev/prod)

**Project Type**: Web application (frontend + backend, shared Postgres)

**Performance Goals**: Auth adds <150 ms p95 to protected API calls;
anonymous public-catalog time-to-first-content within 10% of baseline (SC-005);
session verification cacheable per request

**Constraints**: Secrets exclusively from environment (`.env` never committed).
Env names (fixed): backend `AUTH0_DOMAIN`, `AUTH0_API_AUDIENCE`,
`AUTH0_M2M_CLIENT_ID`, `AUTH0_M2M_CLIENT_SECRET`; frontend server (runtime)
`AUTH0_DOMAIN`, `AUTH0_API_AUDIENCE`, `AUTH0_WEB_CLIENT_ID`,
`AUTH0_WEB_CLIENT_SECRET`, `SESSION_ENCRYPTION_KEY`, `APP_BASE_URL`,
`BACKEND_URL`; CI (GitHub Environments `auth0-dev`, `prod`) `AUTH0_DOMAIN`,
`AUTH0_CLIENT_ID`/`AUTH0_CLIENT_SECRET` (terraform-deployer M2M, never reused
by apps), `TF_VAR_resend_smtp_password`, `TF_VAR_google_client_secret`,
`TF_STATE_PG_CONN_STR` (Terraform `pg` state backend, dedicated `terraform_state` database, DR-009). No browser-exposed auth
config. The BFF cookie is the browser session, not optional: `__Host-session`
(HttpOnly, `Secure` always (required by `__Host-`), `SameSite=Lax`, chunked if >4 KB, encrypted with
`SESSION_ENCRYPTION_KEY`) holds access/ID/refresh tokens. Backend REST/MCP
stays `Authorization: Bearer` only: SSR pages call it server-side and browser
islands go through `/api/backend/[...path]`, which attaches the Bearer.
Access-token lifetime 24 h (`token_lifetime = 86400`); accepted risk: a copied
cookie can replay ≤24 h after logout. Rotating refresh tokens with
`refresh_token.leeway` on `music-app-example-web` and single-flight refresh per request
(avoids reuse-detection logouts). Logout clears the cookie, revokes the refresh
token (`/oauth/revoke`), and redirects via Auth0 `/v2/logout`. Neutral auth
errors (no user enumeration); Auth0-hosted brute-force/breached-password
protection; rate-limit + model-allowlist enforcement (`429 RATE_LIMITED`,
`403 MODEL_NOT_ALLOWED`) is 010-admin-governance's concern; GDPR-minimal audit log

**Scale/Scope**: Hundreds of users, thousands of owned rows (same order as
004/006 history); 2 roles (`user`/`admin`); 1 social connection in v1; Auth0
MAU + M2M-token pricing and Management API rate limits accepted as constraints
(FR-018, shared with 010's admin flows); Resend free tier (3,000/mo, 100/day) caps transactional email

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

*Checked against constitution **1.3.0** (2026-09-23 re-check after merging main; 1.3.0 expanded
Principle VIII with Component completeness, Standalone reusability, Logic placement and
Performance-first codegen — see row VIII).*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-driven (spec → plan → tasks → implement → converge) | PASS | This plan follows spec 007; no app code written in this phase |
| II. Monorepo boundaries (`frontend/` vs `backend/`, contracts) | PASS | Backend owns verification + ownership + role authorization (mirror); frontend server owns the session (Auth Code flow, tokens held server-side in the encrypted cookie) and the `/api/backend` proxy; contract in `contracts/` (BFF session cookie → Bearer + REST + `ui://` unchanged) |
| III. Test-first, both apps (Vitest + pytest, green before complete) | PASS | Tasks generate failing tests first per story; adversarial ownership tests required |
| IV. Agent behavior evaluated (Agno test-scenarios) | PASS | No agent-prompt changes in MVP; if model/tool wiring changes, eval gates re-run |
| V. Evidence-based model selection (OpenRouter) | PASS | No LLM choice in this feature; N/A recorded |
| VI. Browser AI on-device first; no provider keys in browser | PASS | Auth adds no browser LLM calls; no keys and no tokens in the bundle or browser JS (no Auth0 SDK, no `PUBLIC_*` auth vars); session cookie HttpOnly + encrypted |
| VII. Backend runtime (AgentOS/FastAPI) + own Postgres; auth enforced before exposed deploy | PASS with amendment | This feature IS the enforcement VII demanded. Amendment (explicit): identity (credentials/role grants) lives in Auth0 with a local Postgres mirror that is authoritative for role authorization (loaded on every protected call); browser session in an encrypted cookie, no session store; domain rows, ownership, audit stay in own Postgres (flags/rate-limits/ledger tables are 010's); no SQLite, no Redis; Compose + Railway paths kept; tenant config in Terraform, not the DB |
| VIII. Clean code & layering (frontend pages→components→lib→content; backend app→domain→persistence; lint green) | PASS | New `backend/app/auth/` (verify deps, `authorize()` + `scope()` seam, minimal block/unblock route) + `db_models` additions (`users`, `audit_log`; `feature_flags`/`user_entitlements`/`usage_ledger` are 010's); frontend `pages/api/auth/` (login/callback/logout), `pages/api/backend/[...path].ts` (proxy), `pages/admin/index.astro` (012 adds `pages/welcome.astro` to this tree), `lib/auth/` (pure helpers only: session encryption/chunking, claim parsing — zero `astro*` imports) + `middleware.ts` (Astro-bound cookie read/write, guards, `App.Locals`) + `components/auth/` + `components/admin/`; `backend/infra/auth0/` Terraform root inside `backend/` (owned by `agno-backend`, Principle II); ESLint+Prettier / Ruff / `terraform fmt+validate` green **1.3.0 re-check**: Logic placement — session crypto, refresh single-flight and the proxy's Bearer attachment live in pure `lib/auth/` (no framework imports); `pages/api/*` endpoints and `middleware.ts` only call them (thin); admin role decisions stay in `backend/` (`authorize()`). Component completeness — the Users island (T032b) and admin page (T044) handle loading/empty/error/ready through the shared `ViewStates`. Standalone reusability — admin islands are props-in/events-out. Performance-first — SC-005 baseline (T052) and no new frontend dependency beyond the OIDC client chosen by T003. |

## Project Structure

### Documentation (this feature)

```text
specs/007-app-auth/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── session-contract.md
│   └── rest-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── auth/                 # composition: Auth0 verify deps, authorize()/scope()
│   │                         # seam (DR-006), minimal block/unblock admin route
│   ├── routes_sheets.py      # protect + scope by account (US2)
│   └── routes_second_voice.py# protect + scope by account (US2)
├── agents/                   # unchanged (no prompt/tool changes in MVP)
├── db.py                     # unchanged (Postgres config)
├── db_models.py              # + User (auth0_sub), Invitation, AuditLog
│                             #   (FeatureFlag, UserEntitlement, UsageLedger: 010's)
└── tests/                    # pytest: auth unit + route contract + adversarial swaps
                              # (rate-limit tests live in 010's own test suite)

frontend/
├── src/
│   ├── pages/
│   │   ├── api/auth/         # login.ts, callback.ts, logout.ts (Auth Code flow, cookie)
│   │   ├── api/backend/
│   │   │   └── [...path].ts  # proxy: session cookie → Bearer to BACKEND_URL
│   │   └── admin/index.astro # SSR admin page; guard: login redirect / 403
│   ├── lib/auth/             # pure: session encrypt/chunk, claim parsing (no astro imports)
│   │                         #   (012 adds pages/welcome.astro, the invite landing)
│   ├── components/auth/      # login/logout buttons, session-aware UI (no tokens)
│   ├── components/admin/     # admin islands: users (block/unblock)
│   │                         #   (012 adds: invites; 010 adds: role grant/revoke, flags, rate limits)
│   └── middleware.ts         # session load + coarse route gating (enforcement stays backend)
└── tests/                    # vitest: auth endpoints, cookie, proxy, guards, admin components

backend/infra/auth0/                   # Terraform root: Auth0 tenant as code (FR-011)
├── versions.tf providers.tf variables.tf
├── tenant.tf api.tf roles.tf clients.tf connections.tf actions.tf
├── email.tf                  # Resend SMTP email provider + email templates (DR-008)
├── attack-protection.tf outputs.tf
├── Makefile                  # init/plan/apply ENV=dev|prod (DR-009 schema per env, DR-012)
└── envs/{dev,prod}.tfvars    # values only (dev admission_allowlist; prod list from TF_VAR secret); secrets via environment/CI
```

**CI/CD note** (`.github/workflows/`): `ci.yml` gains a `terraform` job
(`fmt -check`, `init -backend=false`, `validate`) plus a PR `plan` against dev
(environment `auth0-dev`). `deploy.yml` gains a first job `auth0-apply` (dev
then prod, prod behind reviewers); `deploy-frontend` and `deploy-backend` get
`needs: auth0-apply`, keeping ordering deterministic in one workflow. A new
scheduled workflow runs a daily `terraform plan -detailed-exitcode` against
prod; exit code 2 fails (SC-006 drift).

**Structure Decision**: Web-application layout (Option 2) plus an infra root.
Backend owns verification + ownership + role authorization; 010-admin-governance
owns feature flags/rate limits; frontend server owns the session (login/callback/logout,
encrypted cookie, backend proxy) and the minimal admin page shell UI; Auth0 owns identity; Terraform owns
tenant config. The four meet only at documented contracts (Bearer access token
and REST in `contracts/`; session cookie contract between browser and frontend
server).

## Complexity Tracking

> No constitution violations to justify. Deliberate complexity carried, not
> violations:

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Managed identity (Auth0) instead of self-hosted sessions | Requester mandate + eliminates owned password/session/reset crypto | Self-hosted ladder (R1–R4) rejected by mandate; retained as fallback because vendor lock-in, MAU/M2M pricing, and Management API rate limits are real costs |
| Terraform as a third deploy plane (tenant config) alongside Railway app deploys | Tenant roles/scopes/clients/actions must be reviewable + reproducible per env (FR-011, SC-006) | Dashboard click-ops rejected: unreviewed, unreproducible, drifts; mitigated with remote state + plan-on-PR/apply-on-merge |
| Entitlements/flags/ledger in Postgres, not Auth0 constructs (DR-003; implementation now in 010-admin-governance) | Auth0 has no product-rate-limit or feature-flag primitives; app audit needs one trail | `app_metadata`-carried flags rejected: couples product toggles to the IdP, bypasses audit |
| BFF encrypted session cookie (Astro SSR holds tokens) instead of a browser SPA client | FR-002 persistent session must work cross-browser, incl. browsers blocking third-party cookies (DR-007) | SPA client rejected: reliable silent re-auth needs an owned Auth0 custom domain plus a per-page-load iframe; a server-side session store rejected: adds a second runtime store |
