# Decision: Admin invite flow without admin-handled passwords

## Status
**Accepted**

## Context
Admins invite new people by email with a role from the admin dashboard. The admin must never see, set, or transmit a password; invites need a bounded lifecycle and must not create duplicate accounts or enable enumeration.

Protected **fact**: the invitee's credential and the invited role. **Authority**: the invitee alone sets the password via the provider's hosted flow; the `admin` role authorizes issuing the invite. **Read path**: admin invite endpoints → provider user creation + set-password email; first login consumes the `invitations` row during mirror provisioning.

**Question:** How does an admin invite a person with a role without ever handling their password?

**Constraints that matter:**
- FR-019 — provider account created unverified with a random discarded password; hosted set-password email; admin never handles passwords.
- FR-020 — at most one pending invite per email; bounded expiry; resend; revoke; expired/revoked/accepted refused.
- FR-021 — existing email: no duplicate, neutral outcome, offer role grant or reset.
- SC-009 — invite-to-login under 10 minutes; 100% of expired/revoked/replayed links refused.

## Options Considered
- **Option A — Auth0 Change Password email + app-side `invitations` lifecycle.** Create provider user (`email_verified: false`, random discarded password, role pre-assigned), trigger Auth0's set-password email ("Welcome" template variant), track `pending → accepted/expired/revoked` app-side. **(chosen)**
- **Option B — Management API password-change ticket URL (`create:user_tickets`) with self-delivery.** App sends the link through its own sender. **(rejected — retained as fallback)**
- **Option C — Auth0 Organizations invitations.** **(rejected)**

## Assumptions
- [medium risk] Auth0's Change Password email can be customized into an acceptable invite ("Welcome") variant per environment via Terraform-managed templates — unverified.
- [medium risk] Auth0 ticket TTL can be mirrored reliably in `invitations.expires_at`.
- [low risk] Revoke by blocking/deleting the provider user reliably kills an unexpired link.

## Evidence
- `specs/012-admin-invites/spec.md:32-34,57-59` — invite and resend/revoke scenarios
  (2026-09-23 split: these scenarios moved from 007's US3 scenarios 6–7 to 012's own
  US1/US2 when the invite flow was carved into its own spec).
- `specs/012-admin-invites/spec.md:86-96` — invite, lifecycle, and duplicate-email requirements (012 FR-001…FR-003; erratum 2026-09-23 split: these were 007 FR-019…FR-021, now "Moved to 012" stubs in 007).
- `specs/007-app-auth/research.md:272-290` — R8: Auth0-documented invitation approach, ticket-URL fallback, Organizations rejected.
- `git show d4d3137:specs/007-app-auth/data-model.md` lines 72-84 — `invitations` table incl. `expires_at` mirroring Auth0 ticket TTL (erratum 2026-09-23 split: the table moved to 012-admin-invites, which has no data model yet; cited at the pre-split commit).
- `git show d4d3137:specs/007-app-auth/data-model.md` lines 118-121 — invite state transitions; expired/revoked/accepted links refused (erratum 2026-09-23 split: moved to 012; cited at the pre-split commit).

## Decision
**Option A.** Follows Auth0's documented invitation approach: only the invitee ever knows the password, no email infrastructure is built, and expiry/replay rides on the provider ticket TTL mirrored app-side. Option B rejected for v1: requires owned email delivery; kept as fallback if invites must route through a custom sender or in-app inbox. Option C rejected: the app has no organization model; tenant roles already cover `user`/`admin`.

## Confidence
Medium — lifecycle and data model are fully specified, but email-template customization and TTL mirroring have not been exercised against a dev tenant.

## Consequences
**Easier:** No password handling or email infrastructure; invite lifecycle is a plain table with audit; tests mock the Management API and email trigger (T040).
**Harder:** Invite-email branding is bounded by Auth0 template capabilities; pending invites create real (unverified) provider users that count toward tenant state.
**Risks that remain:** Mistyped addresses leave pending provider users until expiry — mitigated by revoke + re-issue and neutral lookups; template limits — mitigated by Option B fallback.

## Revisit Trigger
Reopen if: invite mail must come from a custom sender or in-app inbox (switch to ticket URLs), Auth0 template customization cannot meet the invite copy, an organization/tenant model is introduced, or SC-009 refusal checks fail.
