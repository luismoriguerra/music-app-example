# Decision: Allowlist admission so 007 can create its own accounts

## Status
**Proposed**

## Context
Invites moved to 012-admin-invites. Without them, 007's own rules (FR-026) left it able to hold only the break-glass first admin, so its two-user tests (US1, US2, SC-003, quickstart §2) could not run and block/unblock had nobody to block. The clarification on 2026-09-23 chose a per-environment email allowlist, kept as tenant code and enforced by a simple identity-provider Action, and applied through CI or locally with a Makefile. This amends DR-011's `disable_signup = true`: the password connection now allows self-registration, and the Action refuses every email not on the list.

Protected **fact**: who may create an account without an invite. **Authority**: the allowlist Terraform variable for that environment, reviewed like any tenant change (FR-011). **Read path**: Universal Login registration → Pre-User-Registration Action; first login → the admission Post-Login Action and backend provisioning.

**Question:** How does 007 admit its own accounts (test users in dev, a small set in prod) without the invite feature?

**Constraints that matter:**
- FR-026 — no uncontrolled self-created accounts.
- FR-027 — allowlist as tenant code, enforced by the identity provider, changeable without an app deploy.
- FR-011 — all tenant configuration is Terraform code, per environment.
- FR-017 — the break-glass first admin remains the only way to get an `admin`.

## Options Considered
- **Option A — Terraform allowlist variable + Pre-User-Registration Action; applied with `make apply ENV=…` locally or by the CI apply job.** **(chosen, pending spike)**
- **Option B — Keep invites in 007.** **(rejected by clarification: invites stay in 012)**
- **Option C — Dev-only seeding script outside Terraform.** **(rejected)**
- **Option D — Terraform-created `auth0_user` resources for test accounts.** **(rejected)**

## Assumptions
- [high risk] A Pre-User-Registration Action can read the allowlist (from Action secrets or configuration set by Terraform) and deny registration for other emails; not yet verified against Auth0 docs (spike T057).
- [high risk] Users created through the Management API by 012's invite flow do not pass through the Pre-User-Registration trigger, so invites keep working with the allowlist in place; unverified (T057).
- [medium risk] The backend learns that a first login is allowlisted from an Action-set namespaced claim, so the allowlist is not duplicated in backend configuration.
- [low risk] The allowlist stays small (test accounts in dev, a handful in prod), so an Action configuration value is enough.

## Evidence
- `specs/007-app-auth/spec.md:27` — clarification: allowlist in Terraform, enforced by an Action, applied via CI or Makefile.
- `specs/007-app-auth/spec.md:46` — US1's independent test now registers two allowlisted test emails.
- `specs/007-app-auth/spec.md:253-256` — FR-026 admission sources: invite, break-glass admin, allowlist.
- `specs/007-app-auth/spec.md:257-260` — FR-027 allowlist requirement.
- `specs/007-app-auth/spec.md:216-220` — FR-011 tenant configuration as Terraform code.

## Decision
**Option A, pending the T057 spike.** `backend/infra/auth0/` gets a `admission_allowlist` variable (list of emails: dev in the committed `envs/dev.tfvars` with non-sensitive test addresses; prod only from the `TF_VAR_admission_allowlist` secret in the `prod` GitHub Environment, never committed); the password connection sets `disable_signup = false`; a Terraform-managed Pre-User-Registration Action denies registration for any email not on the list, and the existing admission Post-Login Action refuses an allowlisted login until `event.user.email_verified` is true, then stamps a namespaced `admission` claim (`allowlist`) that backend provisioning accepts alongside a pending invite or the break-glass admin. A `backend/infra/auth0/Makefile` wraps `terraform init/plan/apply` per environment (`make plan ENV=dev`, `make apply ENV=dev`) with the per-environment `schema_name` backend config (DR-009); the CI apply job calls the same targets, so local and CI runs are identical; `make apply ENV=prod` refuses to run outside CI (prod applies stay on DR-002's reviewed path).
- Option B rejected by the clarification answer.
- Option C rejected: accounts created outside tenant code drift from the reviewed configuration and would need their own secrets handling.
- Option D rejected: Terraform would hold user passwords or reset flows in state.

## Confidence
Low — the approach is standard Auth0 extensibility, but neither the registration-trigger behavior nor its interaction with Management-API-created invite users has been checked against Auth0 sources yet.

## Consequences
**Easier:** 007 can create exactly the accounts its tests need in dev; prod admission beyond the first admin works before 012 ships; one Makefile path for local and CI applies.
**Harder:** The password connection is no longer signup-disabled, so the Action is a security boundary that must be tested (T055, T057); allowlist changes need a Terraform apply.
**Risks that remain:** A misconfigured Action would open registration — mitigated by the backend's independent provisioning gate (FR-026) and T055's negative test; allowlisted emails are visible in tfvars — keep them non-sensitive test addresses in dev.

## Revisit Trigger
Reopen if: T057 shows the registration trigger cannot enforce the list or also blocks Management-API invite users; the allowlist grows beyond a handful of entries; 012 ships and the allowlist becomes unnecessary in prod; or Auth0 ships native signup allowlists.
