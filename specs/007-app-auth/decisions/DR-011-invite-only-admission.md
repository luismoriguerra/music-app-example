# Decision: Invite-only admission and social-login linking

## Status
**Proposed**

## Context
Clarifications on 2026-09-23 made accounts invite-only (FR-026) while keeping social login for invited or registered emails (FR-009). Two mechanics are needed: stop self-signup on the password connection, and stop a first social login from creating a new account. Auth0 creates a new user, with a new `sub`, the first time someone signs in with a social connection. Without linking, an invited person who uses Google would get a second identity and a duplicate local record keyed by the new `sub`.

Protected **fact**: who may hold an account. **Authority**: an admin invite (DR-004) or the break-glass first admin (FR-017). **Read path**: Auth0 Universal Login → Post-Login Action → Astro callback → backend first-login provisioning.

**Question:** How does the system refuse uninvited accounts while letting invited people sign in with a social provider as the same account?

**Constraints that matter:**
- FR-026 — no self-created accounts; uninvited first logins refused without an app account.
- FR-009 — social sign-in only for invited or registered emails, linked by verified email, no duplicates.
- FR-011 — tenant behaviour (connections, Actions, clients) is Terraform code.
- FR-018 — Management API rate limits respected.

## Options Considered
- **Option A — `disable_signup` on the password connection + a Post-Login Action that links or denies first social logins by verified email.** On a first social login, the Action searches the tenant for a password user with the same verified email and an invite (or an existing account). The match is the Auth0 user carrying `app_metadata.invite_id` (stamped by the backend's invite service through the Management API, since the Action cannot read Postgres and pending invitees are still `email_verified: false`) or an existing account, compared with the social identity's IdP-verified email. On a match it links the social identity to that user and calls `api.authentication.setPrimaryUser(invitedUserId)` so this very first login's tokens carry the invited `sub`; otherwise it calls `api.access.deny`. A denied first social login still leaves an Auth0 user record (the Action runs after creation); that orphan record is an accepted cost in v1 (no app account, no session). The backend additionally refuses provisioning without an invite or an existing record (`403 NOT_INVITED`). **(chosen, pending spike)**
- **Option B — Backend-only gate.** Let Auth0 create any user and have the backend refuse provisioning unless invited. **(rejected)**
- **Option C — Drop social login in v1.** **(rejected by clarification)**

## Assumptions
- [high risk] A Post-Login Action can search users by email, link identities with a dedicated M2M client from Action secrets, and switch the current login to the invited user with `api.authentication.setPrimaryUser`; not yet verified against Auth0 docs (spike T054).
- [medium risk] Orphan Auth0 records from denied first social logins stay low-volume; no cleanup job in v1.
- [medium risk] Social providers return `email_verified = true` for the addresses used; unverified social emails are denied, not linked.
- [low risk] First-social-login volume stays far below Management API limits.

## Evidence
- `specs/007-app-auth/spec.md:25-26` — clarifications: invite-only accounts; social login only for invited or registered emails, linked by verified email.
- `specs/007-app-auth/spec.md:211-213` — FR-009 as clarified (erratum 2026-09-23 split: this line
  is now a "Moved to 011-invited-social-login" stub — see 011's own FR-001…FR-003
  for the current requirement text this decision governs).
- `specs/007-app-auth/spec.md:253-260` — FR-026 no self-created accounts (erratum 2026-09-23: FR-026 now also admits allowlisted self-registration, FR-027/DR-012).

## Decision
**Option A, pending the T054 spike.** Terraform sets `disable_signup = true` on the password connection (amended by DR-012, 2026-09-23: signup is enabled and gated by an allowlist Action). It also manages an admission-and-linking Post-Login Action, backed by a dedicated `music-app-example-actions` M2M client with only `read:users` and `update:users`; its secret is wired into the Action's secrets by Terraform, so no human handles it. The backend's first-login provisioning accepts only a pending invite (consumed) or an existing record (amended by DR-012: also an `admission: allowlist` claim), and otherwise returns `403 NOT_INVITED` and creates nothing. Both layers are needed: the Action keeps one `sub` per person, and the backend gate holds even if the Action is misconfigured.
- Option B rejected: an uninvited social user would still get a live Auth0 account, and invited people using social login would get a second `sub` and a duplicate record.
- Option C rejected by the clarification answer.

## Confidence
Low — the approach is the standard Auth0 pattern, but no Auth0 source has been read for Action-side search-and-link yet; T054 turns this into Accepted or reopens it.

## Consequences
**Easier:** One account per person across password and social logins; no open signup surface to abuse the AI rate limit.
**Harder:** One more M2M client and an Action with Management API calls to test; social login depends on providers returning verified emails.
**Risks that remain:** A linking bug could attach a social identity to the wrong account — mitigated by requiring a verified email match and a test that mismatched or unverified emails are denied (T033).

## Revisit Trigger
Reopen if: the T054 spike shows Actions cannot search or link reliably; Auth0 ships native invite-only social admission; self-signup is re-allowed; or a provider returns unverified emails for real users.
