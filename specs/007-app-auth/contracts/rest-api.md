# REST API Contract (007)

**Spec**: [spec.md](../spec.md) | **Base**: `{BACKEND}/api/v1`

**Amended 2026-09-23**: Auth0 owns login/logout/reset/invite set-password (self-registration only for allowlisted emails, FR-026/FR-027) (no app
auth endpoints for those; the Astro BFF runs the login flow, DR-007); the app
exposes identity-mirror, ownership-scoped domain routes, and the admin console
(users, invites, flags, rate limits). Bearer = Auth0 access token throughout;
roles are authorized from the local `users.role` mirror (not token claims) via
`authorize()` / `scope()` (DR-006).

**Browser access**: the browser never calls `{BACKEND}` directly. SSR pages
call it server-side and browser islands go through the Astro proxy
`/api/backend/[...path]`, which attaches the Bearer from the `__Host-session`
cookie (see [session-contract.md](./session-contract.md)). MCP/API callers
send the Bearer themselves.

## Identity mirror

| Method + Path | Auth | Success | Errors |
|---------------|------|---------|--------|
| `GET /auth/me` | Bearer | `200 { user: { id, email, role } }` — `role` from the `users.role` mirror (010-admin-governance may extend this response with resolved rate limits) (first login provisions the mirror row only for a pending invite matched by verified email, an `admission: allowlist` claim (role `user`, FR-027), or the break-glass first admin; role from the invite) | `401`, `403 NOT_INVITED` (no invite or allowlist entry: nothing created, FR-026) |

## Admin: users — block/unblock only (FR-012; proxies the Management API, audited)

| Method + Path | Auth | Request | Success | Errors |
|---------------|------|---------|---------|--------|
| `PATCH /admin/users/{id}` | `admin` | `{ blocked: bool }` | `200 { user }` (provider block/unblock + `users.blocked` mirror written in the same request; mirror failure → request fails, no partial success; effective on the target's next call) | `401`, `403`, `404` |

List/search, direct user creation (redundant with invite-only, FR-026 — 010 creates
only via 007's invite), and `admin` role grant/revoke are specified in
**010-admin-governance**, which extends this same admin API namespace.

## Admin: invites — moved to 012-admin-invites (FR-019…FR-021)

`POST/GET /admin/invites`, `/admin/invites/{id}/resend`, `DELETE /admin/invites/{id}`
are specified in **012-admin-invites**, which extends this admin API namespace.

## Feature flags and rate limits + usage — moved to 010-admin-governance (FR-013…FR-016)

`GET/PATCH /flags`, `/admin/flags`, `/admin/entitlements/{user_id}`, `/admin/usage`
are specified in **010-admin-governance**, which extends this admin API namespace.

## Modified endpoints (ownership + rate-limit enforcement, US2/US3)

- `* /sheets*`, `* /history*`, `* /second-voice*`: require Bearer; ownership
  enforced through `scope()` (v1 SQL filter `owner_id = current user`) and
  `authorize()` in `backend/app/auth/` — no inline route checks (DR-006);
  cross-owner access → `404` (not `403`, to avoid ID oracle); `blocked`
  mirror users denied even with a valid token; role checks use the mirror.
- (Rate-limit and model-allowlist enforcement on these routes: see 010-admin-governance.)
- Unverified email (`users.email_verified = false`) → mutations and billable calls return `403 { error: { code: "EMAIL_UNVERIFIED" } }` (FR-025; defense-in-depth — invitees are verified on acceptance and allowlisted logins are refused by the admission Action until verified, DR-012, so this should not occur); reads of own data and the public catalog still work.
- Validation error shape stays `{ error: { code, message } }` (004 taxonomy).

## Audit events (FR-008)

`login, logout, password_reset, role_change, user_block, flag_change,
limit_change, invite_sent, invite_accepted, invite_revoked, legacy_claim, admission_denied,
access_denied` with `actor, action, target, at` — persisted
server-side in `audit_log`, never containing passwords or raw tokens.
