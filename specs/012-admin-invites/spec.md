# Feature Specification: Admin Invites

**Feature Branch**: `feat/app-auth-fa42`

**Created**: 2026-09-23

**Status**: Draft

**Input**: Split out of `specs/007-app-auth` (007 US3 acceptance scenarios 3–4, FR-019…FR-021,
FR-024, SC-009, the `Invitation` entity). Accounts are invite-only (007 FR-026): this spec
is the only way a person other than the break-glass first admin (007 FR-017) gets into the
product.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin invites a person by email (Priority: P1)

An admin invites a new person by email with a role from the admin page. The invitee
receives a set-password email, sets their own password through the hosted flow, and logs
in with the invited role. The admin never sees, sets, or transmits a password.

**Why this priority**: With accounts invite-only (007 FR-026), this is the only route
anyone besides the break-glass first admin has into the product. Without it, 007's
foundation ships a single-user system.

**Independent Test**: Can be fully tested by an admin inviting a test email, following the
emailed link as that person, setting a password, and confirming login with the invited
role and exactly one account.

**Acceptance Scenarios**:

1. **Given** an admin, **When** they invite a new person by email with a role, **Then**
   the invitee receives a set-password email, sets their own password through the hosted
   flow, and logs in with the invited role — the admin never sees or sets the password.
2. **Given** an invitee who just set a password, **When** they follow the link, **Then**
   they land on a welcome page that leads to login (FR-004), and their first login
   applies the invited role and consumes the invite.

---

### User Story 2 - Admin manages the invite lifecycle (Priority: P2)

An admin resends a pending invite (a fresh email goes out) or revokes one (the link stops
working even if unexpired). At most one invite is pending per email. Inviting an email
that already has an account never creates a duplicate.

**Why this priority**: Invites go to real email addresses admins don't fully control
(typos, abandoned invites, a change of mind); without lifecycle management a stale or
mistaken invite is a standing risk.

**Independent Test**: Can be fully tested by resending a pending invite (new email, old
link dead), revoking a second invite before use (link refused), and inviting an email that
already has an account (no duplicate, neutral outcome).

**Acceptance Scenarios**:

1. **Given** an admin, **When** they resend a pending invite, **Then** a fresh set-password
   email goes out; **When** they revoke it, **Then** the invite link stops working even if
   unexpired.
2. **Given** an admin, **When** they invite an email that already has an account, **Then**
   no duplicate account is created and the outcome is neutral (no account enumeration).
3. **Given** an invite that has expired, been revoked, or already been accepted, **When**
   its link is used, **Then** it is refused in all three cases with a clear message and no
   account access is granted.

---

### Edge Cases

- What happens when an admin invites an email that already has an account? No duplicate
  account is created; the admin gets a neutral outcome (FR-003).
- What happens when an invite email address is mistyped? The invite stays pending until
  expiry; the admin can revoke and re-issue to the corrected address. Invite-lookup
  responses stay neutral to avoid account enumeration.
- What happens when an invite expires, is revoked, or is replayed after acceptance? The
  set-password link is refused in all three cases with a clear message, and no account
  access is granted.
- What happens when the identity provider's own admin API is rate-limited while sending or
  revoking an invite? The admin page surfaces a clear retryable message and never applies a
  partial change silently (007 FR-018).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let an `admin` invite a person by email with a role from the
  admin page: the system creates the provider account unverified with a random discarded
  password and triggers the hosted set-password email; the admin MUST never see, set, or
  transmit a password (from 007 FR-019).
- **FR-002**: The system MUST manage the invite lifecycle app-side: at most one pending
  invite per email; bounded expiry; resend issues a fresh email; revoke disables the invite
  even if unexpired; expired, revoked, or already accepted invites MUST be refused on use
  (from 007 FR-020).
- **FR-003**: Inviting an email that already has an account MUST NOT create a duplicate;
  the flow offers a neutral outcome that avoids account enumeration (from 007 FR-021; role
  grant for an existing account is 010-admin-governance's concern, not this flow's).
- **FR-004**: After an invitee sets a password, the system MUST land them on a welcome page
  that leads to login; their first login applies the invited role and consumes the invite
  (from 007 FR-024).
- **FR-005**: The system MUST add an Invites section to 007's admin page shell, reachable
  only by `admin` accounts (from 007 FR-023's Invites portion).
- **FR-006**: The system MUST record invite_sent, invite_accepted, and invite_revoked audit
  events with actor, action, target, and timestamp (from 007 FR-008).

### Key Entities *(include if feature involves data)*

- **Invitation**: An admin-issued grant for one email + role (`pending`, `accepted`,
  `expired`, `revoked`; invited-by, expiry, acceptance time); consumed when the invitee sets
  their password and first logs in (from 007's `Invitation` entity).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Invite-to-login completes end-to-end (invite to first login with the invited
  role) in under 10 minutes, and 100% of expired, revoked, or replayed invite links are
  refused without granting access (from 007 SC-009).
- **SC-002**: 100% of invites to an email with an existing account produce a neutral
  outcome and zero duplicate accounts.
- **SC-003**: Every invite_sent, invite_accepted, and invite_revoked event is visible in the
  audit log within 1 minute.

## Assumptions

- 007-app-auth is merged first: identity, the `users` mirror, the session contract, the
  `authorize()`/`scope()` seam, the audit log, and the admin page shell (Users section,
  block/unblock) all come from there.
- The invite email (Resend over SMTP, the `reset_email` template shared with password
  reset) is 007's own infrastructure (007 DR-008); this spec only triggers it, it does not
  configure the provider or the sending domain (007 T046).
- 007 FR-025 (the unverified-email gate) stays in 007; this spec's User Story 1 scenario 2
  is what satisfies it for an invitee — Management API `PATCH /users/{id}` marks the
  invitee verified on acceptance.
- 011-invited-social-login's first-story admission check reads the `Invitation` row this
  spec creates (by verified email) and consumes it the same way a password-flow acceptance
  does; that matching logic is 011's concern, not this spec's.
- Out of scope: role grant/revoke, feature flags, rate limits (010-admin-governance); social
  login admission (011-invited-social-login); the break-glass first admin path (007 FR-017,
  which predates any invite existing); block/unblock (stays in 007 as the pre-012 safety
  lever a deployment has even before this spec ships).
