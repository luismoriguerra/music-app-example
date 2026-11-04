# Feature Specification: Invited-Only Social Login

**Feature Branch**: `feat/app-auth-fa42`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "Split out of `specs/007-app-auth` (User Story 4). Let an invited or already-registered person sign in with an external provider (e.g. Google or GitHub) instead of a password. The first social sign-in is linked by verified email to that person's existing app account, so there is one identity and no duplicate record, and the person is recognized on return visits. Uninvited people and provider emails that are not verified are refused with a neutral message and get no app account. Logout and session replay follow 007's session rules. 007 remains the Auth foundation (identity, session, invite onboarding, ownership, infra); this spec carries only the social half of 007's invite-only admission."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Invited or registered person signs in with a provider as their one account (Priority: P1)

A person who has an admin invite, or who already has an app account, picks
"continue with provider" on the hosted login instead of typing a password. After
they approve at the provider, the app links that provider login to their existing
account by the provider's verified email. They land logged in as the same account:
same role, same saved sheets, history, and analyses. The app never creates a second
account or a second record for them.

**Why this priority**: This is the whole value of the feature: no extra password for
invitees and fewer password resets, without breaking 007's one-account-per-person
rule (007 FR-004, 007 FR-026). If linking fails, social login would create duplicate
identities and split a person's content across two accounts.

**Independent Test**: Invite an email, sign in with a provider account that has the
same verified email, and confirm the result is logged in as the invited account with
the invited role and one account record. Repeat for an already-registered password
account: sign in with the provider and confirm the same content and account are shown.

**Acceptance Scenarios**:

1. **Given** a pending invite for an email, **When** the invitee signs in with a
   provider account whose verified email matches, **Then** the provider login is
   linked to the invited account, the person is logged in with the invited role, the
   invite is consumed, and exactly one account exists for that email.
2. **Given** an already-registered account (password login), **When** its owner
   signs in with a provider account whose verified email matches, **Then** they are
   logged in as that same account and see exactly their existing content.
3. **Given** a successful link, **When** it completes, **Then** an account-link
   audit record exists naming the account, the provider, and the time.

---

### User Story 2 - Uninvited or unverified provider sign-ins are refused (Priority: P1)

Someone with no invite and no account, or whose provider does not vouch for their
email, tries "continue with provider". They see a neutral "an invite is required"
message that does not reveal whether the email is known. No app account and no
session are created, and the refusal is audited.

**Why this priority**: Social login must not reopen self-signup. 007 made accounts
invite-only (007 FR-026). Without this gate, any provider account could get in and
use the metered AI allowance. It is P1 because shipping Story 1 without it would
break 007's admission rule.

**Independent Test**: Sign in with a provider account whose email has no invite and
no account. Then sign in with a provider account whose email the provider reports
as unverified. Confirm both see the neutral message, get no session, create no app
account, and each leaves an `admission_denied` audit record.

**Acceptance Scenarios**:

1. **Given** an email with no pending invite and no account, **When** its owner
   signs in with a provider, **Then** they are refused with a neutral message, no app
   account or session is created, and an `admission_denied` audit record is written.
2. **Given** a provider that returns the person's email as unverified, **When** they
   sign in with it, **Then** they are refused the same way even if that email has an
   invite or an account, and nothing is linked.
3. **Given** any refusal, **When** the message is shown, **Then** its wording is the
   same whether or not the email is known to the app.

---

### User Story 3 - Recognized on return; logout and replay follow the session rules (Priority: P2)

A linked person comes back later, or on a new device, signs in with the same provider,
and is recognized as the same account with no new link and no duplicate. When they
log out, the session ends under 007's session rules, and a copied session stops
working within 007's replay window.

**Why this priority**: Return recognition is how people use social login day to day.
Logout and replay reuse 007's session contract (007 FR-002) instead of adding
provider-specific session handling. It depends on Story 1 having linked the account.

**Independent Test**: Sign in with a linked provider, log out, sign in again with
the same provider on another browser, and confirm the same account and content
return. Then replay a copy of the logged-out session and confirm protected calls are
denied within the 007 window.

**Acceptance Scenarios**:

1. **Given** an account already linked to a provider, **When** its owner signs in
   with that provider again (any device), **Then** they get the same account and the
   same owned content, and no new link or account is created (from 007 US4 scenario 3).
2. **Given** a user signed in through a provider who logs out, **When** a copy of
   that session is replayed, **Then** protected calls are denied within 24 hours, the
   access-token lifetime set in 007 FR-002 (from 007 US4 scenario 2).
3. **Given** a user signed in through a provider, **When** they log out, **Then**
   protected pages and actions on that session require logging in again, exactly as
   for password logins (007 US1 scenario 4).

---

### Edge Cases

- **Invitee has not accepted the invite yet but tries social login first**: the
  provider sign-in counts as accepting the invite. It is linked to the invited
  account, the invite is consumed, the invited role applies, and the account is
  marked verified (the provider vouched for the email). The unused set-password link
  is then refused like any already-accepted invite (012 FR-002). The person can
  still set a password later through the hosted reset flow (007 FR-001).
- **Provider returns an unverified email**: the sign-in is refused with the neutral
  message and audited as `admission_denied`. Nothing is linked, even if the email
  matches an invite or an existing account. Otherwise anyone who can set that address
  at a provider could take over an account.
- **Email is already linked to this provider**: this is a return sign-in (Story 3).
  The person is recognized, and no new link, account, or `account_linked` record is
  created.
- **Email's account is already linked to a different provider** (e.g. Google
  linked, now GitHub): the new provider login is linked to the same single account
  by verified email and audited. The person keeps one account with several ways to
  sign in.
- **Admin revokes the invite before the first social login**: the invite is no
  longer pending, so the sign-in is treated as uninvited. It is refused with the
  neutral message, audited as `admission_denied`, and creates no account (012 FR-002).
- **Invite expired before the first social login**: treated the same as revoked.
- **Email differs only in letter case** between the invite and the provider: it
  still matches; emails are compared case-insensitively.
- **Blocked account signs in with a provider**: the link or recognition may complete
  at the identity layer, but every protected call is still denied by 007's
  local-account check (007 FR-006, 007 US3 block).
- **Identity provider or social provider unavailable**: the sign-in fails with a
  clear message and grants no access; password login and the public catalog are
  unaffected (007 Edge Cases).
- **A refused provider attempt leaves a record at the identity provider**: accepted
  per 007 DR-011 (low-volume orphan records, no cleanup job in v1). It never becomes
  an app account and can never reach a protected call.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST offer sign-in through at least one external provider
  connection on the hosted login, next to password login (from 007 FR-009).
- **FR-002**: The system MUST admit a provider sign-in only when the provider reports
  the email as verified AND that email has either a pending invite or an existing app
  account (from 007 FR-009, 007 FR-026).
- **FR-003**: On an admitted first provider sign-in, the system MUST link the
  provider login to the existing or invited account with that verified email, so the
  person keeps one identity and one account record, and MUST NOT create a second
  identity, account, or record (from 007 FR-009, 007 FR-004).
- **FR-004**: When a person's first sign-in with a pending invite is a provider
  sign-in, the system MUST treat it as accepting the invite: consume the invite,
  apply the invited role, and mark the account verified (from 012 FR-004, 007 FR-025,
  012 FR-002).
- **FR-005**: The system MUST refuse provider sign-ins for emails with no pending
  invite and no account, including invites that were revoked or expired, and for
  provider-unverified emails. It MUST create no app account and no session, and MUST
  show a neutral message that does not reveal whether the email is known (from 007
  FR-026, 007 FR-009, 007 Edge Cases: uninvited account creation).
- **FR-006**: The system MUST recognize a returning provider sign-in as the
  already-linked account on any device, without creating a new link or account (from
  007 FR-009, 007 US4 scenario 3).
- **FR-007**: A provider sign-in MUST give the same session as a password login under
  007's session contract: encrypted HttpOnly session cookie, logout clears it and
  revokes the refresh token, and a replayed copy stops working within 24 hours (from
  007 FR-002, 007 US4 scenario 2).
- **FR-008**: The system MUST authorize provider-signed-in users exactly like
  password users: roles and blocked status come from the local account record on
  every protected call, through the 007 FR-022 authorization decision point (from
  007 FR-006, 007 FR-022).
- **FR-009**: The system MUST write an `admission_denied` audit record for every
  refused provider sign-in (reason: not invited, or unverified email) and an
  `account_linked` audit record for every new provider link. Each record holds
  actor, action, target (account and provider), and timestamp, and never holds
  tokens (from 007 FR-008).
- **FR-010**: Provider connections and the admission-and-linking logic at the
  identity provider MUST be defined as Terraform tenant configuration, like all other
  tenant settings (from 007 FR-011).
- **FR-011**: The backend's first-login account creation MUST refuse any identity
  without a pending invite or an existing account, even if the identity-provider layer
  has admitted it. This keeps a second gate in place (from 007 FR-026, 007 DR-011).

### Key Entities *(include if feature involves data)*

- **Account (User)**: The single app account defined by 007 (local mirror with
  authoritative role and blocked flag). This feature adds no new account; provider
  sign-ins resolve to this account.
- **Provider link**: The association between an external provider login (provider
  name + provider's own user identifier) and one Account, created on the first
  admitted provider sign-in. An account may have several; a provider login belongs
  to at most one account.
- **Invitation**: 007's invitation record. A pending invitation admits a first
  provider sign-in and is consumed by it; revoked, expired, and accepted invitations
  admit nothing new.
- **Audit record**: 007's audit log entry. This feature writes the
  `admission_denied` and `account_linked` actions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of first provider sign-ins without an invite or account, or with
  a provider-unverified email, are refused and leave no app account in review (from
  007 SC-001, social case).
- **SC-002**: In review, 100% of admitted first provider sign-ins for invited or
  registered emails end with exactly one account for that email, with zero duplicate
  accounts or records.
- **SC-003**: An invited person completes invite-to-first-login through a provider
  in under 3 minutes, with no password to set.
- **SC-004**: 100% of return provider sign-ins, on the same or a new device, show the
  same account and the same owned content as before.
- **SC-005**: 100% of refused provider sign-ins show the same neutral message
  whether or not the email is known, and each has an `admission_denied` audit record
  visible within 1 minute. Every new link has an `account_linked` record visible
  within 1 minute.
- **SC-006**: After logout, 100% of replayed session copies are denied on protected
  calls within 24 hours, the same as for password sessions.

## Assumptions

- The identity provider is Auth0 and tenant configuration is Terraform, as
  mandated by 007 FR-001 and 007 FR-011. Which provider(s) ship first (Google,
  GitHub, or both) is a tenant-configuration choice made at planning. The spec
  requires at least one.
- **Linking mechanism**: provider sign-ins are admitted and linked by the mechanism
  in 007 DR-011 (Proposed). This spec does not re-decide it. **This feature cannot
  be planned for implementation until 007 task T054's spike moves 007 DR-011 to
  Accepted.** If the spike fails and DR-011 is reopened, this spec's requirements
  stay as written and only the mechanism changes.
- A provider-verified email counts as proof of mailbox ownership as strong as
  following an invite link. That is why a first provider sign-in can accept an invite
  and mark the account verified (the same basis as 007 FR-025).
- Emails are matched case-insensitively and exactly otherwise. There is no fuzzy
  matching and no matching on name or other profile fields.
- Letting users unlink a provider or manage linked providers themselves is out of
  scope. So are admin tools for viewing links, beyond the audit log.
- Password login, invites and their lifecycle, admin governance (users, roles,
  flags, limits), rate limits (007 defaults: 60 API calls/min, 20 AI calls/day with
  admin overrides), and ownership are out of scope here. They are unchanged, and
  provider-signed-in users are subject to all of them.
- Refused provider attempts may leave a low-volume orphan record at the identity
  provider, per 007 DR-011. There is no cleanup job in v1.

### Dependencies

- **Requires 007 (`specs/007-app-auth`) merged first**: identity via Auth0 hosted
  login; the `users` mirror with the authoritative role and blocked flag (007 FR-006);
  the `authorize()`/`scope()` seam (007 FR-022 authorization decision point); the
  session contract (007 FR-002, 007 DR-007); the audit log (007 FR-008); and the
  admin page shell (007 FR-023). **Also requires 012-admin-invites shipped**: invite
  matching reads its `Invitation` rows and lifecycle (012 FR-001/FR-002, 007 DR-004).
- **Requires 007 DR-011 Accepted** (gate: 007 task T054 spike) before
  `/speckit-plan` for this feature.

### Inherited decisions

- 007 DR-011 (Proposed, gated by T054): invite-only admission and social-login linking by verified email; this spec's only mechanism.
- 007 DR-007: backend-for-frontend session (encrypted HttpOnly cookie, 24 h tokens, roles from the local mirror); governs FR-007/FR-008.
- 007 DR-006: owner filter + `user`/`admin` role behind one decision point; governs FR-008.
- 007 DR-004: invite flow and app-side invitation lifecycle; governs FR-004/FR-005.
- 007 DR-002 / DR-005: tenant-as-code with Terraform on Auth0; governs FR-010.
