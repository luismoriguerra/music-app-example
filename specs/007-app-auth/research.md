# Research: App Authentication & Authorization (007)

**Feature**: `specs/007-app-auth/spec.md` | **Date**: 2026-09-18
**Method**: live web search (2026-09-18) over FastAPI + Astro auth libraries with
database adapters; read-only codebase mapping of the current synthetic-owner posture.

## Context

Today every personal row (`song_sheets`, `history_entries`,
`second_voice_analyses`) is stamped with a synthetic single `owner_id`
(`OWNER_ID=owner`, env override) and validated in Python mapper events only.
There is no login, no session, no role check on any route; all prior specs
(001, 004, 006) defer JWT/RBAC with the written justification "single-owner,
no exposed deployment". Constitution VII requires auth enforced before any
network-exposed deployment. This research answers: which **adapter-backed
library** carries that enforcement, and what do simpler and more ideal
alternatives cost?

## R0 — Where auth must attach (codebase grounding)

- **Decision**: Backend enforcement lives in `backend/app/` composition
  (FastAPI dependencies/middleware) over new `users`/`sessions`/`roles` tables
  beside `db.py` + `db_models.py`; frontend enforcement lives in Astro
  middleware + `[...all]` auth route + React islands calling `better-auth`
  client or backend session endpoints. No second user store.
- **Rationale**: Matches Principle VIII layering (`app/` wires, domain owns
  rules, Postgres persists) and Principle II ownership (backend owns identity
  verification; frontend owns session UX; contract is cookie + bearer + session
  endpoints).
- **Alternatives considered**: Enforcing only in the frontend (rejected —
  bypassable); enforcing only per-route ad hoc without a library (see R1).

## R1 — SIMPLE: hand-rolled JWT + RBAC (PyJWT + argon2 + FastAPI dependencies)

- **Decision**: Viable fallback and the correct Phase-1 stepping stone, but NOT
  the end state for social login / session revocation (US3).
- **Rationale**: Smallest possible change that satisfies the constitution's
  "JWT with RBAC suggested" default: `PyJWT` (sign/verify) + `pwdlib[argon2]`
  (password hashing) + FastAPI `Depends(get_current_user)` / `require_role()`
  + HttpOnly session cookie (browser) and `Authorization: Bearer` (API/MCP).
  Zero new services; Postgres stays the only store; ~200 lines of owned code.
- **Alternatives considered**: `python-jose` (older, cryptography weight;
  PyJWT is lighter and actively maintained); raw `hashlib` (rejected —
  no slow-hash protection, violates FR-012).
- **Evidence**: Constitution VII names JWT/RBAC as the suggested default;
  `backend/pyproject.toml` already pins `fastapi>=0.115,<1`,
  `sqlalchemy>=2.0,<3`, `psycopg[binary]>=3.2,<4` — PyJWT/pwdlib drop in with
  no migration framework needed.
- **Limits**: Password reset, email verification, lockout/rate-limit, OAuth,
  refresh rotation, and passkeys must all be hand-built and hand-tested. That
  is exactly the surface a library buys back in R2/R3.

## R2 — ADAPTER LIBRARY (backend, SUPERSEDED): `fastapi-fullauth` with SQLAlchemy adapter (was recommended backend pick)

- **Decision**: When a backend-owned adapter library is wanted, choose
  **`fastapi-fullauth` with the SQLAlchemy adapter** over `fastapi-users`.
- **Rationale**:
  - Ships what the spec needs out of the box on this stack: JWT access/refresh
    with rotation, Argon2 hashing, email verification, OAuth2 social login
    (Google, GitHub), session management, and **RBAC** — the exact FR-001…FR-010
    surface — with a pluggable `SQLAlchemyAdapter(session_maker, user_model,
    refresh_token_model, role_model, …)` over the project's existing Postgres.
  - `pip install "fastapi-fullauth[sqlalchemy-standard]"` pulls one adapter
    plus Redis-optional backends (blacklist, lockout, rate limit), OAuth, and
    passkey extras; sync SQLAlchemy models coexist with the current
    `db_models.py` style (no forced async rewrite, no Alembic mandate at day
    one).
  - `fastapi-users` — the best-known FastAPI-native option with a documented
    `SQLAlchemyUserDatabase(session, User)` adapter, JWT/cookie transports, and
    database/Redis strategies — is **in maintenance mode** (upstream notice:
    security + dependency fixes only, no new features; a successor toolkit is
    unannounced). Adopting it today means adopting a frozen feature set for the
    feature (RBAC, passkeys) this spec grows into.
- **Alternatives considered**:
  - `fastapi-users` + `Authlib` (OAuth2/OIDC client/server): credible if the
    team already knows it, but Authlib adds only protocol primitives — user
    management, RBAC, and reset flows stay hand-built, so the combination costs
    more owned code than `fastapi-fullauth` for the same FR coverage.
  - `fastapi-oauth-rbac` (NIST RBAC, SQLAlchemy, dashboard, released Feb 2026):
    promising on paper but too new/small-adoption to bet enforcement on without
    a spike; revisit if `fastapi-fullauth` fails its spike.
  - Managed verify-only (Clerk/WorkOS token verification in FastAPI):
    defers the user store off Postgres — conflicts with the single-Postgres
    assumption and Constitution VII unless the plan explicitly amends it.
- **Evidence**: Live search 2026-09-18 —
  `fastapi-users` repo maintenance notice; `fastapi-users` SQLAlchemy adapter
  docs (`SQLAlchemyUserDatabase`); `fastapi-fullauth` README (adapters,
  `sqlalchemy-standard` extra, RBAC + OAuth + passkeys); WorkOS "Top 5 auth
  solutions for FastAPI 2026"; `fastapi-oauth-rbac` PyPI 0.2.0 (2026-02-10).
- **Spike required (tasks.md)**: install the `sqlalchemy-standard` extra in a
  scratch venv, wire the adapter against a transient Postgres, and prove
  register → login → refresh rotation → RBAC deny → OAuth stub before
  committing the backend to it; fall back to R1 if the spike fails.

## R3 — IDEAL self-hosted full-stack (SUPERSEDED): `better-auth` (Astro first-class) + backend JWT verification

- **Decision**: The ideal end state for UX + ownership is **`better-auth`
  (TypeScript, Astro integration) backed by the same Postgres, with the FastAPI
  backend verifying `better-auth` sessions/JWTs and still enforcing RBAC**.
- **Rationale**:
  - Only evaluated option with **first-class Astro support** in the official
    Astro auth guide: mount `auth.handler(request)` at
    `frontend/src/pages/api/auth/[...all].ts`, use `createAuthClient()` in
    React islands (or vanilla), and protect routes in Astro `middleware.ts`
    via `auth.api.getSession({ headers })` → `context.locals.user/session`
    with typed `App.Locals`. That is precisely the frontend half of US1…US3
    (persistent sessions, social login, session list/revoke) without
    hand-building it.
  - Self-hosted with a Postgres adapter (drizzle/prisma adapters), so the
    single-Postgres assumption survives; plugin ecosystem covers email-password,
    OAuth providers, magic link, passkeys, admin/organization plugins for the
    `admin` role, and rate-limiting.
  - Keeps Constitution VI intact: no provider keys in the browser; hosted
    inference still flows through `backend/`; auth cookies are HttpOnly.
- **Alternatives considered**:
  - **Clerk (`@clerk/astro`)**: the fastest managed path (prebuilt sign-up /
    sign-in / profile components, `clerkMiddleware()`, `locals.auth()`,
    organizations + SSO; ~22.7k weekly downloads, Astro 4.15+). Rejected as
    default because it moves identity off Postgres into a vendor (cost,
    data-residency, offline-dev, and constitution-amendment overhead), but kept
    as the ideal-managed fallback if the team prefers buying over owning auth.
  - **Auth.js/NextAuth for Astro**: no official Astro adapter; community wiring
    only (own callbacks, routes, sessions, UI). Rejected — strictly more owned
    code than `better-auth` for fewer Astro guarantees.
- **Evidence**: Live search 2026-09-18 — Astro "Authentication" guide
  (`better-auth` + Clerk as the two documented options); `better-auth`
  Astro integration docs (`[...all].ts`, `createAuthClient`, middleware,
  `env.d.ts` locals); `@clerk/astro` npm page + Clerk Astro quickstart.
- **Contract consequence**: whichever side mints the session, the other side
  verifies it. Recommended split (plan.md contracts): `better-auth` mints the
  browser session; FastAPI verifies it (JWKS/shared secret) and enforces
  ownership + roles on every API/MCP call. If the R2 spike wins instead, the
  mirror applies (FastAPI mints, Astro middleware verifies).

## R4 — Ladder: simple → adapter → ideal (SUPERSEDED 2026-09-19)

> **Superseded**: the requester mandated Auth0 + Terraform (see R5/R6). The
> ladder below is retained as the evaluated self-hosted alternative, not the
> plan. R1 remains useful background for what Auth0 replaces (password
> storage, session tables, reset flows).

| Step | Shape | Covers | Cost |
|------|-------|--------|------|
| 1. Simple (R1) | PyJWT + argon2 + FastAPI deps + `users`/`sessions` tables; Astro middleware + login islands | US1 + US2 (email/password, ownership, `learner`/`admin`) | Least code, most hand-built flows |
| 2. Adapter (R2) | + `fastapi-fullauth` SQLAlchemy adapter (or retreat to R1 if spike fails) | US1 + US2 with reset/verify/lockout/rotation for free | One dependency + adapter models |
| 3. Ideal (R3) | + `better-auth` Astro integration against same Postgres; backend verifies | US3 (social login, multi-session revoke, polished UX) | Second auth surface + session-verify contract |

- **Decision**: Plan tasks in exactly this order so each step is independently
  shippable and testable; never start R3 before R1's ownership enforcement is
  green, and never adopt R2/R3 without their spikes passing.
- **Rationale**: The user asked for "simple to ideal" analysis — the ladder is
  the answer, and the task phases (MVP = R1, then adapter, then ideal) make it
  executable without rework: tables and enforcement points designed in R1 are
  reused by R2/R3.

## Sources (accessed 2026-09-18, extended 2026-09-19)

- `fastapi-users` GitHub — maintenance-mode notice, feature list.
- `fastapi-users` docs — SQLAlchemy adapter (`SQLAlchemyUserDatabase`).
- WorkOS blog — "Top 5 authentication solutions for secure FastAPI apps in 2026"
  (FastAPI Users vs Authlib framing).
- `mdfarhankc/fastapi-fullauth` GitHub — SQLAlchemy/SQLModel adapters,
  `sqlalchemy-standard` extra, RBAC/OAuth/passkeys.
- PyPI `fastapi-oauth-rbac` 0.2.0 (2026-02-10) — NIST RBAC + SQLAlchemy.
- Astro docs "Authentication" — `better-auth` + Clerk as documented options.
- `better-auth` docs + repo — Astro integration (`[...all].ts`,
  `createAuthClient`, middleware, locals typing).
- npm `@clerk/astro` + Clerk Astro quickstart — managed alternative.
- Auth0 quickstart "Backend/FastAPI" + `auth0/auth0-fastapi-api` repo —
  `Auth0FastAPI(domain, audience)`, `require_auth(scopes)` (Bearer + DPoP).
- Auth0 RBAC docs — `enforce_policies`, `token_dialect access_token_authz`,
  Add Permissions in Access Token; Post-Login Action roles claim
  (`event.authorization.roles` → namespaced custom claim; `roles`/`permissions`
  reserved).
- Auth0 Management API v2 (`POST /api/v2/users`, `POST
  /api/v2/users/{id}/roles`, scopes `create:users update:users
  create:role_members`) + Node SDK `createManagementAuth` pattern.
- Terraform Registry `auth0` provider — `auth0_resource_server`,
  `auth0_role` (+ `organization` type), `auth0_role_permissions` (one per role),
  `auth0_organization_member_roles`.
- `@auth0/auth0-spa-js` docs/EXAMPLES — PKCE SPA flow (`createAuth0Client`,
  `loginWithRedirect`, `handleRedirectCallback`, `getTokenSilently`,
  `logout`); no official Astro SDK.
- Auth0 Support "Email Invitations for Application Signup" + B2B provisioning
  docs — admin creates user (`email_verified: false`, random discarded
  password) then triggers the Authentication API Change Password email; setting
  the password flips `email_verified` to `true`. Ticket API
  (`POST /api/v2/tickets/password-change`, scope `create:user_tickets`)
  returns a URL but sends no email (self-delivery).

## R5 — DECISION (2026-09-19): Auth0 as the managed identity provider

- **Decision**: Adopt **Auth0** (Universal Login + API Authorization Core RBAC)
  as the identity provider, replacing the R1–R3 self-hosted ladder. The app
  stores no passwords, mints no sessions, and builds no reset flows.
- **Rationale**:
  - Directly satisfies the requester's mandate and collapses US1/US4 scope:
    hosted signup/login/reset, breached-password + brute-force protection, one
    social connection on day one, and session revocation all arrive without
    owned crypto or token tables.
  - Backend verification is a solved integration: official
    `auth0-fastapi-api` SDK (`Auth0FastAPI(domain, audience)` +
    `Depends(auth0.require_auth(scopes=...))`) validates RS256 via JWKS with
    `iss`/`aud`/`exp` checks — ~15 lines of wiring instead of the R1/R2 auth
    subsystem. Manual `PyJWT` + `PyJWKClient` remains the documented fallback.
  - Frontend has a supported (if not Astro-specific) path: `@auth0/auth0-spa-js`
    PKCE flow in React islands; only public values (`domain`, `clientId`,
    `audience`) in the browser, satisfying Constitution VI.
  - Roles land in tokens with two toggles + one Action: API RBAC
    (`enforce_policies`, `access_token_authz` dialect, Add Permissions in
    Access Token) for the `permissions` claim, plus a Post-Login Action copying
    `event.authorization.roles` into a **namespaced** claim (`roles` itself is
    reserved and cannot be set).
- **Alternatives considered**:
  - R1–R3 self-hosted ladder (rejected by requester decision; retained above
    as fallback if Auth0 becomes untenable — the ownership/contract design is
    IdP-agnostic).
  - Clerk (rejected: same vendor tradeoff as Auth0 but without the explicit
    requester mandate or the Terraform story).
- **Costs accepted**: vendor lock-in for identity; MAU + M2M-token pricing;
  Management API rate limits (drives FR-018 caching/paging design); dev tenant
  + network dependency in local dev; token size growth from the permissions
  claim.
- **Spike required (tasks.md)**: dev-tenant round trip — login → `require_auth`
  accept → `permissions` claim present → namespaced roles claim present →
  forged/expired token denied — before any ownership migration.

## R6 — DECISION (2026-09-19): Terraform manages the Auth0 tenant (FR-011)

- **Decision**: All tenant configuration lives in `infra/auth0/` (Terraform
  `auth0` provider), one codebase with per-environment values (dev/prod),
  remote state never committed, `plan` on PRs and `apply` on merge.
- **Rationale**: Roles, scopes, clients, connections, and Action code are
  security-critical configuration that must be reviewable and reproducible
  across dev/prod. Click-ops drift is the failure mode FR-011 and SC-006 guard
  against; Terraform makes drift visible (`plan`) and reversible.
- **Shape** (full layout in plan.md): `tenant.tf`, `api.tf`
  (`auth0_resource_server` + scopes, `enforce_policies = true`),
  `roles.tf` (`auth0_role` `user`/`admin` + exactly one
  `auth0_role_permissions` per role), `clients.tf` (SPA + M2M), `connections.tf`,
  `actions.tf` (roles-claim Action, TF-managed source), `attack-protection.tf`,
  `envs/{dev,prod}.tfvars`. Provider and backend admin M2M credentials come
  from environment/CI secrets only.
- **Alternatives considered**: Dashboard-managed tenant (rejected — unreviewed,
  unreproducible, drifts); managing Railway/Postgres in the same Terraform
  (rejected — Railway stays dashboard/CLI, Postgres stays Compose/Railway
  managed; Terraform scope is the Auth0 tenant only).
- **Spike required (tasks.md)**: `terraform plan` against the dev tenant green
  with zero unmanaged-role/scope drift before backend work depends on role or
  permission names.

## R7 — Admin powers live app-side, behind Auth0 (FR-012…FR-016)

- **Decision**: Auth0 owns identity; the app owns governance. User management
  proxies the Management API through a server-held M2M credential (never the
  browser); feature flags, entitlements, and the usage ledger are Postgres
  tables, not Auth0 constructs.
- **Rationale**:
  - Management API surface (`POST /api/v2/users`, `PATCH /users/{id}`,
    `POST /users/{id}/roles`, required scopes `create:users update:users
    create:role_members`) maps 1:1 onto the admin user console; the backend
    adds what Auth0 cannot: audit rows, last-admin guard, and neutral errors.
  - Feature flags in `app_metadata` were considered and rejected: product
    toggles coupled to the identity vendor bypass the app audit trail and
    cannot gate non-login paths cleanly. A local `feature_flags` table checked
    per request is simpler and IdP-independent.
  - Quotas/AI limits have no Auth0 primitive (Auth0 rate-limits its own
    Management API, not product usage). Per-user allowances (defaults +
    overrides) with a server-side `usage_ledger` and fail-closed `429`
    enforcement is the only shape that bounds AI spend (SC-008).

## R8 — Invite flow: Auth0-sent set-password email + app-side lifecycle (FR-019…FR-021)

- **Decision**: Admin invite = create provider user (`email_verified: false`,
  random discarded password, pre-assigned invited role) + trigger Auth0's
  Change Password email (customizable "Welcome" template variant) + track an
  app-side `invitations` row (`pending → accepted/expired/revoked`). First
  login of an invited user marks the invite accepted during mirror
  provisioning. Resend re-triggers the email; revoke blocks/deletes the
  provider user and marks the row revoked.
- **Rationale**: Follows Auth0's documented invitation approach exactly — the
  admin never handles a password (OIDC principle: only the user ever knows
  it), no email infrastructure is built, and expiry/replay handling rides on
  Auth0 ticket TTL mirrored in `invitations.expires_at`.
- **Alternatives considered**:
  - Management API password-change ticket URL (`create:user_tickets`) with
    self-delivery (kept as fallback if invite emails must route through a
    custom sender or in-app inbox; costs owned email delivery).
  - Organizations invitations (rejected — no organization model in this app;
    tenant roles cover `user`/`admin`).
