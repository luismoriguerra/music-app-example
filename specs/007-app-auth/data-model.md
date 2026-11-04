# Data Model: App Authentication & Authorization (007)

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Amended 2026-09-19**: identity moved to Auth0; role grants are
provider-side with a local mirror; new app-side `audit_log`; tenant config is
Terraform code, not rows. **Amended 2026-09-23 (split)**: `feature_flags`,
`user_entitlements`, `usage_ledger` moved to 010-admin-governance's own data model.

**Amended 2026-09-23**: `users.role` mirror is authoritative for authorization
(DR-007); monthly quotas replaced by per-minute/per-day rate limits; browser
session is an encrypted cookie (no table); Resend email provider in tenant
config (DR-008).

## Entities

### User (local mirror of the Auth0 identity)

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | UUIDv7/UUIDv4 | yes | PK, never reused, never on the wire except self |
| `auth0_sub` | text | yes | Provider user ID (`sub` claim); unique per deployment; the ownership key |
| `email` | citext/text lowercased | yes | Mirrored from the provider; unique; verification state mirrored in `email_verified` |
| `role` | enum `user`/`admin` | yes | Authoritative for authorization: loaded on every protected call (with `blocked`); seeded from the token role claim at first login, then written only by the admin API; default `user`; `admin` explicit only; last-admin demotion refused |
| `email_verified` | boolean | yes | Mirrored from the provider; when false, mutations and billable calls return `403 EMAIL_UNVERIFIED` (FR-025); set true via the Management API when an invite is accepted; social logins linked by verified email arrive verified (DR-011). Allowlisted self-registrations (FR-027) never reach the backend unverified: the admission Post-Login Action refuses an allowlisted login until the provider reports `email_verified = true` (DR-012), so the only unverified accounts are invitees before acceptance and the gate stays defense-in-depth with no re-read path |
| `blocked` | boolean | yes | Default false; admin-set; blocked users denied even with a valid token |
| `created_at` / `updated_at` | timestamptz | yes | `created_at` immutable |

No `password_hash`, no session/token tables: credentials live in Auth0 and the
browser session lives in an encrypted cookie (see Session below). First login
auto-provisions the mirror row (`user`, unblocked; role seeded from the token
claim or a pending invitation).

### Role grant (provider-side + mirror, written together)

Granted in Auth0 (`auth0_user_roles`, Terraform-seeded role IDs) AND in
`users.role`, both written by the admin API in the same request (FR-012); if
the mirror write fails the request fails — never partial success (FR-018).
The backend authorizes from the mirror, so a revoke takes effect on the
target's next call (SC-007); token role claims only drive UI visibility.
Grant/revoke by an admin only; every change writes an `audit_log` row.
Zero-admin end state refused both provider-side (break-glass account excluded
from demotion) and app-side.

### Session (cookie, not a row)

The browser session is the `__Host-session` cookie set by the Astro server
(`music-app-example-web`): encrypted with `SESSION_ENCRYPTION_KEY`, HttpOnly, `Secure`
(prod), `SameSite=Lax`, chunked if >4 KB. Contents: access token (24 h), ID
token, rotating refresh token, and their expiry. No session table or
server-side session store exists; logout clears the cookie and revokes the
refresh token at Auth0 (DR-007).

### Ownership link (on every personal row)

`sheets.owner_id`, `history_entries.owner_id`, `second_voice_analyses.owner_id`
migrate from synthetic `OWNER_ID` text to `users.id` UUID:

- New rows: `owner_id = current_account.id`, enforced in domain service AND
  mapper-event/DB check (same double-enforcement pattern as today).
- Legacy rows: a one-time, audited operator migration re-points every `"owner"` row to the
  break-glass first admin (DR-010); nothing stays unclaimed, so `owner_id` is `NOT NULL` + FK.

### Feature flag, Entitlement (rate limit), Usage record — moved to 010-admin-governance

These three tables (`feature_flags`, `user_entitlements`, `usage_ledger`) are owned and
created by **010-admin-governance**, not here (007's `T008` no longer creates them). The
per-user rate limits (`api_calls_per_minute`, `ai_calls_per_day`, NULL = backend default,
admin override otherwise) and their `429 RATE_LIMITED` / `403 MODEL_NOT_ALLOWED` enforcement
are specified there.

### Invitation (`invitations`) — moved to 012-admin-invites

The `invitations` table and its fields are specified in **012-admin-invites** (moved
from this spec with FR-019/020/021/024, kept here only as a cross-reference). 007's own first-login provisioning (T014)
reads a pending row by verified email, per 012's contract.

### Tenant configuration (Terraform, not rows)

Roles (`user`/`admin`), API scopes (access-token lifetime 24 h), role↔permission
grants, the `music-app-example-web` regular_web client (replaces the old SPA client;
rotating refresh tokens with leeway) + M2M clients, connections, the
roles-claim login Action, the Pre-User-Registration allowlist Action with the
`admission_allowlist` variable per environment (DR-012), attack protection, and the email provider (Resend
via SMTP, `smtp.resend.com`) with `auth0_email_template` `verify_email` and
`reset_email` (shared by invite + reset; `include_email_in_redirect = false`; set-password `result_url` =
`{APP_BASE_URL}/welcome`) are `backend/infra/auth0/` Terraform resources (FR-011).
They are versioned, reviewed, and applied per environment — never hand-edited
rows.

## Relationships

```text
Auth0 tenant ──(sub, roles[], permissions[])──▶ backend verify ──▶ users (mirror)
users 1───* sheets / history / analyses (ownership scope, FR-004)
users 1───* audit_log (as actor or target)
```
(012-admin-invites adds: users 1───* invitations (as inviter; invitee matched by email).
010-admin-governance adds: users 1───1 user_entitlements; users 1───* usage_ledger;
feature_flags *───* app paths. Both in their own data models, not duplicated here.)

## State transitions

- First login: no local row → provision only if a pending invite matches the verified email
  (consumed; invited role), the token carries `admission: allowlist` (role `user`, FR-027, DR-012),
  or the account is the break-glass first admin; otherwise `403 NOT_INVITED`, nothing created
  (FR-026, DR-011) → enforce.
- `user → admin` / `admin → user`: explicit admin grant/revoke via admin API
  (provider + mirror in one request); effective on the target's next call;
  last-admin change refused.
- `active → blocked`: admin block; next protected call denied even with a
  valid token (backend checks mirror on each request).
- (Invite `pending → accepted`/`expired`/`revoked` transitions: see 012-admin-invites.
  Flag toggle and rate-limit-exhaustion transitions: see 010-admin-governance.)
- Legacy `owner` rows: `"owner" → first admin` once, via the operator migration (refuses to
  re-run or to run without exactly one designated first admin; writes a `legacy_claim` audit row).
- Tenant config: `code → plan → apply`; emergency dashboard edits reconciled
  back to code or reverted (drift check).

## Validation summary (mirrored in contracts + tasks)

- `auth0_sub` uniqueness is absolute; email uniqueness case-insensitive.
- Every protected read/write/list/delete filters by `owner_id = current user`
  via the `authorize()` + `scope()` seam (DR-006; no inline route checks);
  there is no admin cross-user read path in v1.
- (Rate-limit checks: see 010-admin-governance.)
- Admin-only paths require the `admin` role from the local mirror (loaded per
  request, authoritative); token role claims never grant access.
