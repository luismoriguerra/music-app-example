# Feature Specification: App Authentication & Authorization

**Feature Branch**: `feat/app-auth-fa42`

**Created**: 2026-09-18 · **Amended**: 2026-09-19 (Auth0 + Terraform + admin controls) · 2026-09-23 (clarifications: BFF session, rate limits, admin page, email, authorization seam)

**Status**: Draft — clarified 2026-09-23, ready for implementation once CRITICAL analysis items are closed

**Input**: User description: "Introduce authentication and authorization for this app with Auth0 as the identity provider managed by Terraform. Define `user` and `admin` roles. Admins manage users, enable features, and set API-call and AI limits. Admins invite new users from the admin dashboard."

## Clarifications

### Session 2026-09-23

- Q: Should v1 authorization use OpenFGA (relationship-based authorization), or stay with owner-filter + role checks? → A: Defer OpenFGA. v1 enforces per-row ownership plus the `user`/`admin` role behind one backend authorization decision point; relationship-based authorization is adopted only when sharing or collaboration is specified (DR-006).
- Q: How should a returning user stay logged in across page loads and browser restarts, given tokens held in memory, full-page navigations, and blocked third-party cookies? → A: Backend-for-frontend — the web app's server completes login and holds the session in an HttpOnly cookie on the app's own host; no tokens in browser storage, no identity-provider round trip per page, no owned domain required.
- Q: Where does the web app keep each user's provider tokens between requests? → A: In an encrypted, HttpOnly session cookie on the app's own host (no server-side session store). Logout clears the cookie and revokes the refresh token, so a copied cookie stops working once its access token expires.
- Q: Should list queries ("only my rows") go through the single authorization decision point too? → A: Yes. The decision point exposes two operations: a single-record check and a list scope that returns the filter to apply (v1: owner = current user), so lists stay one paginated query and a future policy engine needs no route changes.
- Q: How long may a copied session cookie keep working after logout? → A: Up to 24 hours (the identity provider's default access-token lifetime); accepted risk, since blocked users are still denied on their next call via the local account check.
- Q: Which email provider sends invite, verification, and reset emails? → A: An external transactional provider on a free tier (Resend: 3,000/month, 100/day), connected to the identity provider over SMTP and managed as tenant code; the built-in provider is not production-supported and cannot use custom templates.
- Q: With 24-hour access tokens, how do role revokes take effect on the next call (SC-007)? → A: The backend authorizes roles from the local account record it loads on every protected call; token role claims only seed that record at first login and drive what the UI shows.
- Q: What are the default API and AI limits? → A: A simple per-user rate limit: 60 API calls per minute and 20 AI calls per day by default, with per-user admin overrides; over-limit calls get a retry-after response.
- Q: Where do admins manage the product, and where does an invitee land after setting a password? → A: A dedicated admin page (users, invites, feature flags, limits) reachable only by `admin` accounts; after setting a password, invitees land on a welcome page that sends them to log in.
- Q: Should unverified self-signups be able to create content or use AI? → A: No. Unverified accounts are refused mutations and billable calls; accepting an invite marks the invitee verified.
- Q: May people create accounts themselves? → A: No. Accounts exist only through an admin invite (plus the break-glass first admin); the hosted login offers log in only, and any first login by an uninvited identity is refused.
- Q: With invite-only accounts, what happens to social login? → A: It stays, but only for invited or already-registered emails: a first social login is linked to the matching invited account by verified email, and refused otherwise.
- Q: Without invites in this feature, how does 007 get the second test account its own two-user tests need? → A: A Terraform-managed email allowlist per environment, enforced by a simple identity-provider Action: allowlisted emails may self-register, everyone else is refused; the list is changed and applied through CI or locally with a Makefile, with no app deploy.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Accept invite, log in, stay logged in (Priority: P1)

An invited person sets their password through the emailed invite link (no
self-signup exists), logs in through the hosted login, stays logged in
across visits, and logs out. A returning user who forgot their password resets
it through the hosted reset flow without losing saved sheets, analyses, and
progress. The app never implements its own password storage or reset tokens and
never mints identity; it only carries the provider-issued login in an encrypted cookie (FR-002).

**Why this priority**: Nothing else is trustworthy without identity. Today every
row is owned by the synthetic single `owner` identity (`OWNER_ID`, no login);
any login/multi-user work, any per-user history, and the constitution's
"enforced before any network-exposed deployment" gate (Principle VII) all
depend on this story first.

**Independent Test**: Can be fully tested by allowlisting two test emails (FR-027), registering and logging in
as each on separate sessions, creating content under each, logging out, closing
and reopening the browser, and confirming each account still sees only its own
content.

**Acceptance Scenarios**:

1. **Given** a visitor whose email is neither allowlisted nor invited, **When** they try
   to register, **Then** registration is refused and no account is created; **Given** an
   allowlisted email, **When** they register and log in, **Then** they are in.
2. **Given** a signed-up user, **When** they log out and log back in with the
   same credentials, **Then** they regain access to exactly their own saved
   content.
3. **Given** a user who forgot their password, **When** they complete the
   hosted reset flow, **Then** they can log in with the new password and the old
   password stops working.
4. **Given** a logged-in user, **When** their session expires or they log out
   on one device, **Then** protected pages and actions on that session require
   logging in again instead of silently succeeding.

---

### User Story 2 - My content is mine, curated content is everyone's (Priority: P2)

A logged-in user can only read and change their own saved sheets, history,
and second-voice analyses. Anonymous visitors and users can still browse the
public course catalog (courses, chords, scales, circles, games). Administrative
actions are restricted to the `admin` role, which a normal `user` never gains
by default. Roles are defined centrally in the identity tenant and enforced by
the backend on every call.

**Why this priority**: This is the authorization half: identity without
boundaries still leaks data. It converts the current "single-owner trust
posture" (006 DR-001) into enforced per-user ownership plus RBAC, which is the
minimum credible posture for any shared or network-exposed deployment.

**Independent Test**: Can be fully tested by having user A and user B each
create a sheet and an analysis, then swapping IDs in URLs/API calls and
confirming each gets a "not found / not allowed" response and never sees the
other's data, while both still browse the public catalog anonymously.

**Acceptance Scenarios**:

1. **Given** user A owns a sheet, **When** user B requests that sheet by
   ID (page or API), **Then** the system denies access without revealing whether
   the ID exists beyond "not found or not allowed".
2. **Given** a normal user, **When** they attempt an admin-only action
   (e.g. list users, change a feature flag, raise a limit), **Then** the action
   is denied even with a valid login session.
3. **Given** an anonymous visitor, **When** they browse courses, chords, scales,
   or circles, **Then** public content loads normally, but saving a sheet or
   running an analysis requires logging in first.
4. **Given** a logged-in user, **When** they list their history or analyses,
   **Then** the list contains only rows they own, newest-first, with no IDs
   from other accounts.

---

### User Story 3 - Admin blocks a bad actor; minimal safety control (Priority: P2)

An admin can find and block/unblock a user as a minimal safety control — the only
lever a 007-only deployment has, before 010-admin-governance's fuller role
management and 012-admin-invites' invite system exist. A blocked user loses
access on next use. Every admin action is attributed and auditable. (Inviting
people and the invite lifecycle are specified in **012-admin-invites**; role
management, feature flags, and usage limits extend this admin page in
**010-admin-governance**.)

**Why this priority**: Without a block lever, an account created by the
break-glass path (FR-017) or by 012's invite flow has no safety valve at all
until 010 ships; this is the minimum credible admin capability 007 must ship
with identity itself.

**Independent Test**: Can be fully tested by an admin blocking a test user
(next call denied) and unblocking them (access restored on the next call).

**Acceptance Scenarios**:

1. **Given** an admin, **When** they block a user, **Then** that user's next
   protected call is denied while other users are unaffected; **When** they unblock,
   **Then** access returns on the next call.
2. **Given** any admin action, **When** it completes, **Then** an audit record
   exists naming the admin, the action, the target, and the time.

---

### User Story 4 - Social login (moved to 011-invited-social-login)

Social login is fully specified in **011-invited-social-login** (from 007 FR-009,
FR-026's social half): an invited or registered user links an external provider
(e.g. Google/GitHub) to their one account by verified email; an uninvited email
is refused. This story is kept only as a pointer — its scenarios, edge cases and
acceptance criteria live in 011-invited-social-login, which depends on 007's session contract and
`authorize()`/`scope()` seam, and on 007 DR-011 reaching Accepted (007 T054 spike).

**Independent Test**: See 011-invited-social-login.

---

### Edge Cases

- What happens when someone without an invite or allowlist entry tries to create an account
  (password signup or first social login)? It is refused with a neutral message that does not
  reveal whether the email is known; no provider account or app account remains usable.
- What happens when an email is removed from the allowlist after its account exists? Only
  new registrations are affected; the existing account keeps working until an admin blocks it
  (FR-012).
- How does the system handle login with wrong password, unknown email, or
  unconfirmed email? Responses are neutral (no user-enumeration), rate-limited,
  and distinguishable only where needed for usability.
- What happens when a token is expired, tampered with, revoked, or used
  from the API vs the browser? Every protected path denies it identically;
  browser users are redirected to login, API callers get a machine-readable
  denial.
- How are migrated legacy rows (today's synthetic `owner` rows) attributed
  after login ships? They remain readable only through an explicit,
  one-time operator migration to the break-glass first admin (DR-010) — never silently merged into the first account
  that logs in.
- What happens when an admin demotes themselves or removes the last admin? The
  system refuses to leave the deployment with zero admins.
- How does the app behave when the identity provider or its store is
  unreachable? Public catalog still renders where possible; any login or
  protected action fails with a clear message instead of granting access.
- What happens when tenant configuration drifts from the Terraform definition
  (dashboard click-ops)? Drift is detected at the next plan review and
  reconciled back to code — dashboard edits are emergency-only and must be
  imported or reverted.
- What happens when the identity provider's own admin API is rate-limited
  during user management? The admin console surfaces a clear retryable message
  and never applies a partial user/role change silently.
- (Rate-limit mid-session behavior: see 010-admin-governance.)
- (Invite lifecycle edge cases — expiry, revoke-and-replay, duplicate email, mistyped
  address: see 012-admin-invites.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST delegate login, logout, invite set-password, and password
  reset to the mandated external identity provider's hosted flows; the app MUST
  NOT store passwords or mint its own reset tokens.
- **FR-002**: The system MUST keep an account holder logged in across page loads, visits, and
  browser restarts on current major browsers (last two versions of Chrome, Edge, Firefox, Safari) via an encrypted HttpOnly session cookie (no tokens in
  script-readable storage); logout MUST clear it and revoke the refresh token; copies expire ≤24 h.
- **FR-003**: The system MUST deny every protected page, API route, and MCP
  tool call that arrives without a valid provider-issued token or valid session cookie,
  and MUST do so identically for browser navigation, `fetch`, and MCP transports.
- **FR-004**: The system MUST scope every user-created record (sheets, history
  entries, second-voice analyses, and successors) to exactly one owning account
  (keyed by the provider's user identifier) and MUST enforce that scope on
  read, write, list, and delete.
- **FR-005**: The system MUST define exactly two roles — `user` (default,
  assigned automatically) and `admin` (explicit grant only) — in the identity
  tenant's role system, and MUST deny admin-only capabilities to `user` accounts
  even when authenticated.
- **FR-006**: The system MUST project each login's roles and permissions into
  the access token for first-login provisioning and UI visibility, but MUST authorize roles
  from the local account record loaded on each protected call, so revokes apply on the next call.
- **FR-007**: The system MUST keep the public course catalog (courses, chords,
  scales, circles, games content) readable without login while requiring login
  for any mutation or personal data.
- **FR-008**: The system MUST record security-relevant events (invite acceptance, login,
  refused account creation, logout, password reset, role change, user block, flag change, limit change,
  account linked, denial of protected access) with actor, action, target, and timestamp for
  later review; events originate across 007/010/011/012 but the log itself is owned here.
- **FR-009**: Moved to **011-invited-social-login** (social sign-in, linked to one
  account for invited/registered emails only; uninvited first social logins refused, FR-026).
- **FR-010**: The system MUST migrate or claim rows created under the legacy
  synthetic single-owner identity through an explicit path that never assigns
  legacy rows to the wrong account.
- **FR-011**: All identity-tenant configuration (API resource server + scopes,
  roles + role-permission grants, application clients, connections, login
  actions, attack protection) MUST be defined as Terraform code, applied per
  environment (dev/prod), with remote state that is never committed; dashboard
  edits are emergency-only and MUST be reconciled back to code.
- **FR-012**: The system MUST let an `admin` find and block/unblock a user (minimal
  safety control) through the app's admin API, proxying the provider's management API
  with a server-held credential that never reaches the browser; list/search, admin-role
  grant/revoke, and user creation beyond invites are specified in **010-admin-governance**.
- **FR-013**: Moved to **010-admin-governance** (runtime feature flags).
- **FR-014**: Moved to **010-admin-governance** (per-user API rate limit).
- **FR-015**: Moved to **010-admin-governance** (per-user AI rate limit + model allowlist).
- **FR-016**: Moved to **010-admin-governance** (usage ledger).
- **FR-017**: The system MUST refuse any change that would leave the deployment
  with zero admins, and MUST seed the first admin through an explicit,
  documented break-glass path (not self-registration).
- **FR-018**: The system MUST respect the provider management API's rate
  limits in admin flows (bounded paging, brief caching, retryable errors) and
  MUST never report a partial user/role mutation as success. Applies to 007's own
  block/unblock and invite endpoints; 010-admin-governance states its own copy
  for list/search/role-grant endpoints.
- **FR-019**: Moved to **012-admin-invites** (admin invites a person by email with a role).
- **FR-020**: Moved to **012-admin-invites** (invite lifecycle: pending/expired/revoked/accepted).
- **FR-021**: Moved to **012-admin-invites** (inviting an existing email — no duplicate, neutral outcome).
- **FR-022**: The system MUST route every authorization decision through a single backend decision
  point with two operations: a single-record check (subject, action, resource) and a list scope that
  returns the filter for list queries, so the policy engine can change without route changes.
- **FR-023**: The system MUST provide an admin page (shell + a Users section limited to
  find/block/unblock) that anonymous visitors are sent to log in from and non-admin
  accounts are refused; 012-admin-invites adds an Invites section, and
  010-admin-governance adds Feature flags and Rate limits sections and extends Users to
  list/search/create/role-grant, to the same shell.
- **FR-024**: Moved to **012-admin-invites** (welcome landing after an invitee sets a password).
- **FR-025**: The system MUST refuse content creation and billable calls from accounts whose email
  is unverified, and MUST mark an invitee verified when their invite is accepted (the emailed link
  proved the mailbox), so invitees are never blocked by this rule. (The gate is 007's; the
  accept-and-verify mechanism is implemented by 012-admin-invites.)
- **FR-026**: The system MUST NOT let anyone create an account themselves: accounts come only
  from an admin invite (012-admin-invites), the break-glass first admin (FR-017), or the
  per-environment email allowlist (FR-027); any other registration or first login MUST be
  refused without creating an app account. (This policy is 007's.)
- **FR-027**: The system MUST admit self-registration only for emails on a per-environment
  allowlist defined as tenant code (FR-011) and enforced by the identity provider at
  registration and first login; the list MUST be changeable and applied through CI or a local
  one-command target without an app deploy; allowlisted accounts start with the `user` role and are admitted only once their email is verified.

### Key Entities *(include if feature involves data)*

- **Account (User)**: A person identity owned by the identity provider,
  mirrored locally by provider user ID (unique), email, role mirror
  (`user`/`admin`), timestamps. Owns all personal records.
- **Role grant**: The provider-side assignment of `user` or `admin` to an
  account, mirrored locally for queries; `admin` is explicit and audited.
  Least-privilege by default.
- **Ownership link**: The `owner → account` attribution on every personal row
  (sheet, history entry, analysis); the enforcement point for FR-004 and the
  migration target for FR-010.
- **Feature flag**, **Entitlement (rate limit)**, **Usage record**: owned by
  **010-admin-governance** (moved from this spec with FR-013/014/015/016).
- **Invitation**: owned by **012-admin-invites** (moved from this spec with FR-019/020/021/024).
- **Tenant configuration**: The identity tenant's roles, scopes, clients,
  connections, and login actions — Terraform-managed code (FR-011), not
  database rows.

### Decision records

Recorded after planning from research R5–R8 (the `/speckit-deliberate-record` step was skipped at plan time; these decisions predate the ledger).

| Record | Settles | Status |
|---|---|---|
| [DR-001](decisions/DR-001-identity-provider.md) | Auth0 (Universal Login + Core RBAC) replaces the synthetic `OWNER_ID`; roles reach the backend via `permissions[]` + a namespaced roles claim | **Superseded by DR-005** — Astro-guide alternatives evaluated; SDK beta risk added |
| [DR-002](decisions/DR-002-tenant-as-code.md) | Tenant configuration lives in Terraform (`backend/infra/auth0/`, per-env values, remote state, plan-on-PR/apply-on-merge); dashboard click-ops rejected | Accepted — Terraform root moved to `backend/infra/auth0/` (Principle II, 2026-09-23); state backend settled by DR-009 |
| [DR-003](decisions/DR-003-governance-app-side.md) | Governance is app-side: Management API proxied via server-held M2M; flags, entitlements, usage ledger and audit are Postgres tables | Accepted — implementation moved to 010-admin-governance (audit_log stays in 007) |
| [DR-004](decisions/DR-004-invite-flow.md) | Admin invites create an unverified provider user and trigger Auth0's set-password email; lifecycle tracked in app-side `invitations` rows | Accepted — template assumption amended by DR-008; implementation moved to 012-admin-invites |
| [DR-005](decisions/DR-005-identity-provider-alternatives.md) | Auth0 remains the IdP after evaluating every Astro-guide provider: the only option meeting the mandate + Terraform (FR-011); `auth0-fastapi-api` beta risk, PyJWT fallback | Accepted — supersedes DR-001; frontend SPA assumption amended by DR-007 |
| [DR-006](decisions/DR-006-authorization-engine.md) | v1 authorization = owner filter + `user`/`admin` role behind one decision point; OpenFGA deferred until sharing/collaboration is specified | Accepted — decision point gains a list-scope operation (FR-022, clarification 2026-09-23) |
| [DR-007](decisions/DR-007-session-model.md) | Backend-for-frontend: Astro server holds Auth0 tokens in an encrypted HttpOnly cookie (no store), 24 h tokens, roles authorized from the local mirror | Accepted |
| [DR-008](decisions/DR-008-email-provider.md) | Resend free tier over SMTP, managed in Terraform, sends invite/verify/reset emails; built-in provider rejected | Accepted — template names erratum (`reset_email`, `include_email_in_redirect = false`) |
| [DR-009](decisions/DR-009-terraform-state-backend.md) | Terraform state in a dedicated `terraform_state` database on the Railway Postgres server via the `pg` backend (advisory-lock locking); `TF_STATE_PG_CONN_STR` per environment | Accepted |
| [DR-010](decisions/DR-010-legacy-row-attribution.md) | Legacy `"owner"` rows move once, by an audited operator migration, to the break-glass first admin; `owner_id` becomes `NOT NULL` UUID FK, nothing unclaimed | Accepted |
| [DR-011](decisions/DR-011-invite-only-admission.md) | Invite-only accounts: password signup disabled; Post-Login Action links first social logins to invited accounts by verified email or denies them; backend refuses provisioning without an invite | Proposed — pending T054 spike (007); `disable_signup` amended by DR-012 (allowlist); social login implementation moved to 011-invited-social-login |
| [DR-012](decisions/DR-012-allowlist-admission.md) | Per-environment email allowlist as a Terraform variable, enforced by a Pre-User-Registration Action; applied via CI or `make apply ENV=…`; lets 007 create its own test accounts without invites | Proposed — pending T057 spike |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of account-creation attempts without an invite or allowlist entry
  (password signup or first social login) are refused and leave no app account in review;
  100% of allowlisted registrations succeed.
- **SC-002**: 95% of login attempts with correct credentials succeed on the
  first try, and 100% of attempts with wrong credentials or expired sessions
  are denied.
- **SC-003**: Zero cross-account data leaks in adversarial review: 100 crafted
  ID-swap requests across two test accounts are all denied without disclosing
  the other account's content.
- **SC-004**: Password-reset completes end-to-end (request to new login) in
  under 5 minutes, and the old password fails on next use in 100% of trials.
- **SC-005**: Public catalog pages keep anonymous time-to-first-content within
  10% of the pre-auth baseline (auth adds no visible cost to browsing).
- **SC-006**: Identity-tenant changes ship exclusively via Terraform: `plan`
  is clean before `apply`, and a drift check after any emergency dashboard
  edit reconciles within one working cycle.
- **SC-007**: A block or unblock takes effect on the target's next protected call
  in 100% of trials, and is visible in the audit log within 1 minute (the role
  grant/revoke half of this criterion moved to 010-admin-governance SC-001).
- **SC-008**: Moved to **010-admin-governance** SC-002 (rate-limit enforcement exactness).
- **SC-009**: Moved to **012-admin-invites** SC-001 (invite-to-login end-to-end timing and refusal).

## Assumptions

- Users have a stable internet connection and a modern browser with cookies
  enabled; passkeys are an enhancement, not the v1 login path.
- The mandated identity provider (Auth0) hosts verification/reset emails;
  local dev uses a dev tenant, never the production tenant.
- One tenant per environment (dev/prod), configured by the same Terraform code
  with per-environment values; provider credentials for Terraform and for the
  backend's admin operations come exclusively from environment/CI secrets.
- The existing PostgreSQL database remains the source of truth for domain
  rows, ownership, feature flags, entitlements, usage, and audit; identity
  (credentials, sessions, roles) lives in the provider with a local mirror.
- The synthetic `OWNER_ID` single-owner posture is the migration source, not
  the end state; multi-user enforcement replaces it once this spec ships.
- Provider pricing (monthly active users, machine-to-machine tokens) and
  management-API rate limits are accepted constraints; admin flows are designed
  around them (FR-018).
- Secrets (tenant secrets, management credentials, Terraform provider
  credentials) come exclusively from environment; none are committed.
- Sharing or collaboration on personal records (sheets, history, analyses) is
  out of scope for v1; every personal record has exactly one owner (FR-004).
- The web app runs server-side (not as static files) so it can complete the
  login callback and hold the session; its session secret and identity-provider
  client secret come from environment only.
- The session cookie is encrypted with a key held only in the web app server's
  environment; it may carry the user's email (inside the ID token) and may be split
  across several cookies to stay under browser size limits.
- A sending domain the project controls is verified with the email provider
  (SPF/DKIM) before invites go to real users; auth email volume stays under the
  free tier's 100 emails/day, and its SMTP credential comes from CI secrets only.
- Accounts exist only by invitation, the per-environment allowlist, or the break-glass first
  admin; the password connection allows self-registration, but an Action refuses every email
  not on the allowlist (invite-created accounts are made through the management API, not by
  self-registration). The dev allowlist holds the test accounts; the prod list may be empty.
