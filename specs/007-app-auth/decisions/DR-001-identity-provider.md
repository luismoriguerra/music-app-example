# Decision: Identity provider replacing the synthetic single owner

## Status
**Superseded by DR-005 (2026-09-23)**

> Superseded because the option set was re-evaluated against every provider in Astro's authentication guide (Better Auth, Clerk, Lucia, Scalekit, Supabase, Firebase, Entra ID) with measured evidence. The choice is unchanged (Auth0); DR-005 adds the backend SDK's pre-release risk and the missing Astro-native SDK. Body kept for history.

## Context
Every personal row is stamped with a synthetic `OWNER_ID` (no login), which Constitution VII says must be replaced by enforced auth before any network-exposed deployment. The 2026-09-19 amendment mandates Auth0 as the identity provider. This record settles which IdP owns credentials, sessions, and roles, and how roles reach the backend.

Protected **fact**: per-user ownership of sheets, history, and analyses, plus the `admin` capability. **Authority**: the IdP-issued access token (`sub`, `permissions[]`, namespaced roles claim), verified by the backend via JWKS. **Read path**: `Authorization: Bearer` on every protected REST route and MCP tool call.

**Question:** Which identity provider replaces the synthetic `OWNER_ID`, and how do roles reach the backend?

**Constraints that matter:**
- FR-001 — signup/login/logout/reset delegated to the mandated provider's hosted flows; the app stores no passwords.
- FR-005 / FR-006 — exactly `user`/`admin`, projected into the access token (role + permission claims).
- FR-003 — identical denial across browser, `fetch`, and MCP transports.
- Constitution VI — only public values in the browser bundle; VII — own Postgres stays source of truth for domain rows.

## Options Considered
- **Option A — Auth0 (Universal Login + API Authorization Core RBAC).** Hosted flows; backend verifies RS256 via `auth0-fastapi-api`; `permissions` claim via API RBAC toggles; roles copied into a namespaced claim by a Post-Login Action. **(chosen)**
- **Option B — Self-hosted ladder (R1 hand-rolled JWT → R2 `fastapi-fullauth` → R3 `better-auth`).** App owns password hashing, sessions, reset, social login. **(rejected — retained as fallback)**
- **Option C — Clerk.** Managed IdP with the same vendor tradeoff. **(rejected)**

## Assumptions
- [high risk] The dev-tenant round trip (login → `require_auth` accept → `permissions` + namespaced roles present → forged/expired denied) works as documented — unverified until T007.
- [medium risk] MAU + M2M-token pricing stays acceptable at hundreds of users.
- [medium risk] Access-token size growth from the permissions claim stays within header limits for two roles.
- [low risk] The ownership/contract design stays IdP-agnostic, keeping Option B a viable fallback.

## Evidence
- `specs/007-app-auth/spec.md:9` — requester input mandates Auth0 as identity provider with `user`/`admin` roles.
- `specs/007-app-auth/spec.md:184-186` — FR-001 delegates identity to hosted flows; no app-held passwords or reset tokens.
- `specs/007-app-auth/spec.md:197-203` — FR-005/FR-006 role set and token projection.
- `specs/007-app-auth/research.md:191-226` — R5: SDK verification path, RBAC toggles, reserved `roles` claim → namespaced Action claim, accepted costs, Clerk rejected.
- `specs/007-app-auth/research.md:135-154` — R4: self-hosted ladder marked superseded, retained as fallback.
- `specs/007-app-auth/contracts/session-contract.md:37` — verified token claims incl. `https://music-app.example.com/roles`.
- `backend/README.md:45` — `OWNER_ID=owner` synthetic single-owner identity (the posture being replaced).
- `backend/db_models.py:100-102` — `owner_id()` returns `os.getenv("OWNER_ID", OWNER_ID_DEFAULT)`: the single enforcement identity every personal row is scoped to today.

## Decision
**Option A.** Auth0 satisfies the explicit requester mandate and removes owned password/session/reset crypto; backend verification is ~15 lines of SDK wiring, and roles reach the token via two API toggles plus one Action. Option B rejected by mandate (and costs an owned auth subsystem), but kept documented as the fallback because the ownership design does not depend on the IdP. Option C rejected: same lock-in as Auth0 without the mandate or the Terraform story (DR-002).

## Confidence
Medium — the choice itself is fixed by requester mandate and documented SDK behavior, but the end-to-end claim round trip (T007) has not been run against a real dev tenant.

## Consequences
**Easier:** US1/US4 collapse to configuration (hosted signup/reset, breached-password and brute-force protection, social login, session revocation); no token tables.
**Harder:** Vendor lock-in for identity; local dev depends on a network-reachable dev tenant; admin flows must respect Management API rate limits (FR-018).
**Risks that remain:** Claims missing or mis-namespaced — mitigated by the T007 go/no-go gate before ownership work trusts roles (`tasks.md:211-213`).

## Revisit Trigger
Reopen if: T007 fails (claims missing or forged tokens accepted), Auth0 pricing or rate limits become untenable (fall back to the R1–R4 ladder via a new spec amendment — no silent substitution), or a project ADR log is adopted (promote this platform-wide identity choice to an ADR).
