# Feature Specification: Admin Governance — Users, Feature Flags, Rate Limits

**Feature Branch**: `feat/app-auth-fa42`

**Created**: 2026-09-23

**Status**: Draft

**Input**: Split out of `specs/007-app-auth` (007 US3 acceptance scenarios 1–5, minus user block/unblock), which had grown too large. 007 remains the auth foundation (identity, session, invite onboarding, ownership, tenant infrastructure, user block/unblock as the mitigation for 007's accepted 24 h token risk, admin page shell with its Invites section). This feature carries the governance half of the original request — "Admins manage users, enable features, and set API-call and AI limits" — so an admin can find and add users and promote/demote them; turn product features on or off at runtime; and bound each user's API and AI usage with per-user rate limits, a usage ledger, and a full audit trail. All 2026-09-23 clarifications of 007 that concern governance (60 API calls/minute and 20 AI calls/day defaults with admin overrides, retry-after on over-limit, model allowlist refusal, roles authorized from the local account record, admin page) are kept unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin manages users and admin privilege (Priority: P1)

An admin opens the Users section of the admin page, finds a person by email or
name, adds a new user, and grants or revokes the `admin` role. Adding a user
always goes through 012-admin-invites' invite flow, since accounts exist only by invitation
(012 FR-001, 007 FR-026). A role change applies on the target's next call
without waiting for their login to expire, because roles are authorized from
the local account record (007 DR-007, 007 FR-006). The system never leaves the
deployment without an admin, and never reports a half-applied change as done.
Every role change is attributed in the audit log. Blocking and unblocking users
is provided by 007 and is only surfaced, not specified, here.

**Why this priority**: Delegating and withdrawing admin privilege is the core
governance capability and a security control: without it privilege can
neither be shared nor removed, and the single first admin is a bottleneck.

**Independent Test**: Can be fully tested with one admin and one invited test
user: search for the user (found), add a new user (an invite is issued via
007), grant `admin` to the test user (they can open the admin page on their
next call), revoke it (refused on their next call), attempt to demote the only
remaining admin (refused), and confirm each successful role change appears in
the audit log.

**Acceptance Scenarios**:

1. **Given** an admin, **When** they search users by email or name, **Then**
   matching accounts are listed page by page with their role and status.
2. **Given** an admin, **When** they add a new user with an email and role,
   **Then** an invite for that email and role is issued through 012's invite
   flow and no account is created any other way.
3. **Given** an admin, **When** they grant the `admin` role to a user, **Then**
   that user can perform admin actions on their next call; **When** they revoke
   it, **Then** those actions are denied again on the next call.
4. **Given** exactly one admin in the deployment, **When** anyone attempts to
   revoke that admin's role, **Then** the change is refused with a clear
   explanation and the admin keeps the role.
5. **Given** the identity provider (Auth0) is rate-limiting user-management
   requests, **When** an admin searches users or changes a role, **Then** the
   admin sees a clear, retryable message and no partial change is reported as
   success.
6. **Given** any completed role grant or revoke, **When** an auditor reviews
   the audit log, **Then** a record names the admin, the action, the target
   user, and the time.

---

### User Story 2 - Usage stays within per-user rate limits (Priority: P2)

Every user has an API rate limit (default 60 calls per minute) and an AI rate
limit (default 20 AI calls per day). An admin opens the Rate limits section,
sees a user's effective limits and recent usage, and sets or clears per-user
overrides, including which AI models that user may use. A user who hits a
limit gets a clear "limit reached" response that says when to retry, instead
of a silent failure or an unbounded bill; once the AI limit is reached, no
billable inference happens until the window resets or an admin raises the
limit. Every billable call is metered into a usage ledger that holds no
secrets.

**Why this priority**: The requester explicitly asked to bound metered usage
(AI inference, API calls) per user. Without enforcement, a single account can
run up unbounded hosted-inference cost.

**Independent Test**: Can be fully tested by lowering a test user's AI limit
to zero (next AI call returns the limit message, browsing still works),
exceeding the API limit within one minute (the over-limit call is refused with
a retry time), restricting the user to one AI model (a request for another
model is refused before inference), and confirming the ledger lists each
allowed billable call with no secrets.

**Acceptance Scenarios**:

1. **Given** a user who reached their AI rate limit, **When** they request an
   AI-powered analysis, **Then** they receive a clear limit-reached message
   saying when they may retry, and no billable inference is triggered.
2. **Given** a user who has made 60 API calls in the current minute under the
   default limit, **When** they make another call, **Then** it is refused with
   a machine-readable limit message stating when to retry.
3. **Given** an admin, **When** they set a per-user override (higher or lower)
   for API or AI calls, **Then** the user's next call is evaluated against the
   override; **When** they clear the override, **Then** the deployment default
   applies again.
4. **Given** a user whose permitted AI models are restricted by an admin,
   **When** they request inference with a model outside that list, **Then** the
   request is refused before any billable inference.
5. **Given** a user who hits a limit mid-session, **When** the limit is reached,
   **Then** requests already in flight finish, new billable calls are refused
   with the limit message, and browsing that does not count against the
   exhausted limit keeps working.
6. **Given** any completed limit change, **When** an auditor reviews the audit
   log, **Then** a record names the admin, the action, the target user, and the
   time.

---

### User Story 3 - Admin turns features on and off without a deploy (Priority: P3)

An admin opens the Feature flags section and switches a named product feature
off or on. Users stop seeing and invoking a disabled feature, and see it again
once re-enabled — without a redeploy or restart. Checking flags adds no
noticeable delay to requests. Every flag change is audited.

**Why this priority**: Runtime feature control enables safe rollout and quick
kill-switches for costly or broken features; valuable, but the product is
governable (access and cost) without it.

**Independent Test**: Can be fully tested by toggling a test feature's flag
off (the feature disappears for users and direct calls to it are refused),
toggling it on again (it returns), with no redeploy or restart, and confirming
both changes appear in the audit log.

**Acceptance Scenarios**:

1. **Given** an admin, **When** they disable a feature flag, **Then** users no
   longer see or invoke that feature until the flag is re-enabled — with no
   redeploy or restart.
2. **Given** a disabled feature, **When** a user calls it directly (bypassing
   the UI), **Then** the call is refused.
3. **Given** any completed flag change, **When** an auditor reviews the audit
   log, **Then** a record names the admin, the action, the flag, and the time.

---

### Edge Cases

- What happens when an admin demotes themselves or revokes the last admin? The
  system refuses any role change that would leave the deployment with zero
  admins.
- What happens when the identity provider's own admin API is rate-limited
  during user management? The admin page surfaces a clear retryable message
  and never applies or reports a partial user/role change silently.
- What happens when a user hits an API or AI limit mid-session? In-flight
  reads finish; new billable calls are denied with a limit message until the
  limit window resets or an admin raises it.
- What happens when an admin lowers a limit below what the user has already
  used in the current window? The next call is refused; past usage is not
  rewritten.
- What happens when the rate-limit state or entitlement cannot be read (e.g.
  storage unavailable)? Billable calls fail closed with a clear retryable
  error; no unmetered inference is triggered.
- What happens when a flag is checked for a feature that has no flag record?
  It is treated as off (fail closed) and the admin page lists it as unset.
- What happens when two admins change the same user's role, a flag, or a limit
  at the same moment? The last completed change wins, each change is audited
  separately, and the admin page shows the current value after saving.
- What happens when an admin revokes a role from a user who is currently
  mid-request? The in-flight request finishes; the user's next call is
  authorized with the new role.
- What happens when an admin adds a user whose email already has an account or
  a pending invite? 012's invite rules apply (012 FR-002, 012 FR-003): no
  duplicate account, neutral outcome.
- What happens when a user list is very large? Search and listing are paged
  with bounded page sizes so the identity provider's rate limits are respected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let an `admin` list and search users (paged,
  showing each user's role and 007 block status) and grant or revoke the
  `admin` role through the app's admin API, which relays changes to the
  identity provider (Auth0) with a server-held credential that never reaches
  the browser. Blocking and unblocking users are provided by 007 and are not
  specified here. (from 007 FR-012)
- **FR-002**: The system MUST let an `admin` create a user from the Users
  section by email and role; creation MUST go through 012's invite flow
  (012 FR-001, 007 FR-026 invite-only) and never create an account any other
  way. (from 007 FR-012)
- **FR-003**: Role grants and revokes MUST take effect on the target's next
  protected call, by updating the local account record that roles are
  authorized from on every call (007 DR-007). (from 007 FR-012, 007 FR-006)
- **FR-004**: The system MUST refuse any role revoke that would leave the
  deployment with zero admins, with a clear explanation. (from 007 FR-017)
- **FR-005**: Admin user-management flows MUST respect the identity provider's
  admin API rate limits (bounded paging, brief caching of lists, retryable
  errors) and MUST never apply or report a partial user/role change as
  success; a change either completes on both the provider and the local
  account record or is reported as failed and retryable. (from 007 FR-018)
- **FR-006**: The system MUST provide admin-managed feature flags that gate
  named product features at runtime; flag changes MUST take effect without a
  redeploy or restart, and a feature with no flag record MUST be treated as
  off. (from 007 FR-013)
- **FR-007**: Flag evaluation MUST add at most 5 ms p95 to each request.
  (from 007 FR-013)
- **FR-008**: When a flag is off, users MUST neither see the feature nor be
  able to invoke it; direct calls to a disabled feature MUST be refused
  server-side. (from 007 FR-013)
- **FR-009**: The system MUST enforce a per-user API rate limit (default 60
  calls per minute) with per-user admin overrides, and MUST refuse over-limit
  calls with a machine-readable limit message that states when to retry.
  (from 007 FR-014)
- **FR-010**: The system MUST enforce a per-user AI rate limit (default 20 AI
  calls per day) with per-user admin overrides, MUST refuse over-limit AI
  calls with a limit message that states when to retry, and MUST NOT trigger
  billable inference once the limit is reached until the window resets or an
  admin raises the limit. (from 007 FR-015)
- **FR-011**: The system MUST let an admin restrict the AI models a user may
  use, and MUST refuse a request for a model outside that user's permitted list
  before any billable inference. (from 007 FR-015)
- **FR-012**: Rate-limit checks MUST fail closed: if a user's limits or usage
  cannot be determined, billable calls MUST be refused with a retryable error
  rather than allowed unmetered (007 DR-003). (from 007 FR-014, 007 FR-015)
- **FR-013**: The system MUST meter every allowed billable call (API and AI)
  into a server-side usage ledger recording who, what kind, which model where
  applicable, and when — containing no secrets or raw tokens. (from 007 FR-016)
- **FR-014**: An admin MUST be able to view a user's effective limits (default
  or override), set or clear overrides, and see that user's usage in the
  current windows. (from 007 FR-014, 007 FR-015, 007 FR-016)
- **FR-015**: The system MUST add Users, Feature flags, and Rate limits
  sections to 007's admin page shell, under the same access rules: anonymous
  visitors are sent to log in and non-admin accounts are refused. (from 007 FR-023)
- **FR-016**: Every admin governance action MUST go through 007's
  authorization decision point (007 FR-022, 007 DR-006) and MUST be denied to
  `user` accounts even with a valid session. (from 007 FR-005, 007 FR-022)
- **FR-017**: The system MUST write an audit record for every role change
  (`role_change`), flag change (`flag_change`), and limit change
  (`limit_change`), naming the actor, action, target, and timestamp, into
  007's audit log; `user_block` events remain 007's. (from 007 FR-008)
- **FR-018**: This feature MUST introduce and own the stored records for
  feature flags, rate-limit entitlements, and the usage ledger (007 does not
  create them), as app-owned data per 007 DR-003. (from 007 FR-013, 007 FR-014,
  007 FR-015, 007 FR-016)

### Key Entities *(include if feature involves data)*

Introduced and owned by this feature (007 does not create them):

- **Feature flag**: A named product toggle (key, on/off, updated-by, updated-at),
  owned by the app, not the identity tenant (007 DR-003); evaluated at runtime.
- **Entitlement (rate limit)**: A per-user allowance — API calls per minute, AI
  calls per day, permitted AI models — resolved as the deployment default
  (60/minute, 20/day, all app-approved models) overridden by explicit admin
  values; owned by the app. Belongs to one account (007 `users` mirror).
- **Usage record**: One ledger row per allowed billable call (who, kind, model
  where applicable, when); the basis for rate-limit enforcement and admin
  review. Contains no secrets or raw tokens.

Reused from 007 (not redefined here): **Account (User)** local mirror with
authoritative role and block status, **Role grant**, **Audit record**,
**Invitation**.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin role grants and revokes take effect on the target's next
  protected call in 100% of trials, and each is visible in the audit log within
  1 minute. (from 007 SC-007, role grant/revoke half; block/unblock stays in 007)
- **SC-002**: Rate-limit enforcement is exact in review: 50 over-limit AI calls
  across test accounts produce 50 limit messages and zero billable inference
  calls. (from 007 SC-008)
- **SC-003**: At the API limit boundary, 100% of calls within the limit succeed
  and 100% of calls beyond it are refused with a retry time, for both default
  and overridden limits.
- **SC-004**: A flag toggle is reflected for all users within 1 minute in 100%
  of trials with no redeploy or restart, and flag checks add at most 5 ms p95
  to request time.
- **SC-005**: 100% of attempts to revoke the last admin's role are refused.
- **SC-006**: Under simulated identity-provider rate limiting, zero role
  changes are reported as successful while only partially applied.
- **SC-007**: In review, every allowed billable call has exactly one usage
  record, and zero usage records contain secrets or raw tokens.

## Assumptions

- Only hosted (billable) AI calls routed through the backend count toward the
  AI limit; on-device browser inference (constitution VI) is not metered.
- "API calls" counted by the API limit are a logged-in user's protected API and
  tool calls; anonymous public-catalog browsing is not counted.
- The minute and day windows reset on fixed boundaries; the day resets at
  00:00 UTC. The retry time in a limit message is the next window reset.
- Overrides are non-negative whole numbers; an override of 0 disables that kind
  of call for the user; there is no "unlimited" value; clearing an override
  restores the deployment default.
- The default permitted-model list is every model the app has approved through
  its model-selection decision records (constitution V); a per-user override can
  only narrow it.
- Denied (over-limit or disallowed-model) calls are not billable and are not
  written to the usage ledger; they remain subject to 007's denial auditing
  (007 FR-008).
- Flag changes may be served from a short-lived cache to meet the 5 ms p95
  budget, provided changes reach all users within 1 minute (SC-004).
- Admins are subject to the same rate limits as users and may override their
  own limits; that override is audited like any other.
- Out of scope: invites and invite lifecycle (012-admin-invites; 010 only starts an
  invite from the Users section), user block/unblock (stays in 007 as the
  mitigation for its accepted 24 h token risk, 007 DR-007), break-glass first
  admin seeding (007 FR-017), social login (011-invited-social-login), usage-based billing or
  invoicing, and per-feature flag targeting (flags are global on/off in v1).

### Inherited decisions

- 007 DR-003 — governance lives app-side: the provider's admin API is relayed
  with a server-held credential; flags, entitlements, usage ledger, and audit
  are app-owned data (this feature creates the first three; 007 owns audit).
- 007 DR-006 / 007 FR-022 — all authorization goes through the single decision
  point (single-record check + list scope); no new policy engine.
- 007 DR-007 — roles are authorized from the local account record on every
  protected call; token role claims only seed that record.

### Dependencies

- Requires 007 merged first: identity via the identity provider (Auth0) with
  tenant configuration in Terraform (007 FR-001, 007 FR-011), the `users`
  mirror holding the authoritative role and block status, the
  `authorize()`/`scope()` decision point (007 FR-022), the session contract
  (007 FR-002, 007 DR-007), the audit log (007 FR-008), and the admin page shell (007 FR-023). **Also requires
  012-admin-invites shipped**: user creation goes through its invite flow (012 FR-001–FR-003),
  and its Invites section sits beside this spec's sections in the same shell (012 FR-005).
