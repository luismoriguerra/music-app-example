# Quickstart Validation: App Authentication & Authorization (007)

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Amended 2026-09-19**: Auth0 dev tenant + Terraform. No local password store.

**Amended 2026-09-23**: BFF session cookie (DR-007), rate limits, Resend email
(DR-008), admin page + invite landing.

## Prerequisites

- `docker compose up` (Postgres + API) and `npm run dev --workspace frontend`
  (Astro SSR server) with frontend server env set: `AUTH0_DOMAIN`,
  `AUTH0_API_AUDIENCE`, `AUTH0_WEB_CLIENT_ID`, `AUTH0_WEB_CLIENT_SECRET`,
  `SESSION_ENCRYPTION_KEY`, `APP_BASE_URL`, `BACKEND_URL`.
- Auth0 **dev** tenant applied from `backend/infra/auth0/` with `make plan ENV=dev` clean and
  `make apply ENV=dev` done (T056), `admission_allowlist` in `envs/dev.tfvars` listing the A and B
  test emails; `music-app-example-web` callback URL is
  `{APP_BASE_URL}/api/auth/callback` and its logout URL points at the local
  frontend (`{APP_BASE_URL}/`).
- Resend SMTP configured as the tenant email provider
  (`TF_VAR_resend_smtp_password` set) with a sending domain verified in Resend
  (SPF/DKIM) for this environment.
- Two allowlisted test emails (A and B) plus one break-glass admin in the dev tenant.

## 1. Allowlisted registration → login → persistent session (US1)

1. A registers `a@example.com` (allowlisted) through Universal Login → logs in; expect redirect
   through `/api/auth/callback` into the app, logged in. Registering an email that is neither
   allowlisted nor invited is refused and creates no account (FR-026, FR-027); the browser holds only
   the HttpOnly `__Host-session` cookie (no token visible to page JS).
2. Use the app (session cookie), then `GET /api/backend/auth/me` (proxy
   attaches the Bearer to `GET /auth/me`) → `200` with matching email (mirror
   row provisioned).
3. Close and reopen the browser → still logged in (encrypted session cookie;
   refresh handled server-side).
4. Logout (`POST /api/auth/logout`) → cookie cleared, refresh token revoked;
   protected pages redirect to login; `/api/backend/*` without a session →
   `401 UNAUTHENTICATED`. Replaying a copied pre-logout cookie is denied once
   its access token expires (≤24 h, accepted risk), not instantly; it cannot
   refresh.

5. Password reset (SC-004): from Universal Login choose "Forgot password" → the `reset_email` (Resend sender) arrives → set a new password → log in; the old password is refused.

## 2. Ownership isolation + roles (US2, SC-003)

1. As A, create a sheet (record its `id_a`). As B, create a sheet (`id_b`).
2. As B, `GET /api/v1/sheets/{id_a}` → `404` (never B's data, never confirms
   existence). As A, `GET /api/v1/sheets/{id_b}` → `404`. Swap for history and
   second-voice analyses identically.
3. As B (`user`), `GET /api/v1/admin/users` → `403 FORBIDDEN`.
4. Anonymous: open catalog pages (courses/chords/scales/circles) → render;
   `POST` a sheet without a token → `401`.

## 3. Minimal admin: block/unblock (US3, SC-007)

1. As admin, block B → B's next protected call denied; other users unaffected.
   Unblock → restored on the next call. Appears in `audit_log`.
2. Admin page guard: as B (`user`), visit `/admin` → 403 page; anonymous →
   redirect to `/api/auth/login?next=/admin`; as admin → the Users (block/unblock)
   section renders (012-admin-invites adds an Invites section; 010-admin-governance
   adds Feature flags, Rate limits sections, and role grant/revoke to Users — each
   with its own quickstart steps).
3. Invite flow (inviting a person, resend/revoke, the welcome landing): validated
   in 012-admin-invites's own quickstart; it depends on 007's admin page shell,
   `audit_log`, and Resend email infrastructure (007 T046).

## 4. Social login — see 011-invited-social-login

US4 (linking an invited email's social sign-in, logout/replay behavior) is
validated in 011's own quickstart; it depends on this feature's session
contract and on DR-011 reaching Accepted via T054.

## 5. Terraform drift (SC-006)

1. `terraform plan` on a clean tree → no changes; the scheduled daily prod
   `terraform plan -detailed-exitcode` passes (exit 2 fails the workflow).
2. (Review only) any emergency dashboard edit is followed by import-or-revert
   so the next `plan` is clean again.

## 6. Regression gates

- `pytest` in `backend/` and `npx vitest run` in `frontend/` green.
- `ruff check` + `eslint` + format checks green; `terraform fmt -check` +
  `terraform validate` green.
- Legacy `OWNER_ID` rows: moved to the first admin only by the one-time operator migration (DR-010), never
  auto-merged (FR-010 spot-check).
