# Decision: Email provider for invite, verification, and reset emails

## Status
**Accepted**

## Context
DR-004 relies on a customized "Welcome" variant of Auth0's set-password email for invites. Auth0 does not allow template customization on its built-in email provider, which is also not supported for production. This record picks the provider and amends DR-004's template assumption; DR-004's invite flow is otherwise unchanged.

**Question:** Which email provider sends the tenant's invite, verification, and password-reset emails?

**Constraints that matter:**
- FR-019 / FR-020 — invites deliver a hosted set-password email; resend issues a fresh one.
- SC-009 — invite-to-first-login in under 10 minutes.
- FR-011 — all tenant configuration, including email, is Terraform code.
- Secrets only from environment/CI.

## Options Considered
- **Option A — Resend free tier, connected over SMTP, managed in Terraform.** **(chosen)**
- **Option B — Auth0 built-in provider.** **(rejected)**
- **Option C — App sends its own invite email using a password-change ticket URL.** **(rejected — retained as DR-004 fallback)**
- **Option D — Self-hosted open-source mail server (e.g. Postal) over SMTP.** **(rejected)**
- **Option E — Another natively supported provider (Mailgun, SendGrid, SES).** **(not evaluated — free tiers unverified)**

## Assumptions
- [high risk] The project controls a sending domain it can verify with Resend (SPF/DKIM) in each environment — none is visible in the repo today (T046).
- [medium risk] One `reset_email` template can be worded to work for both invites and password resets; otherwise fall back to Option C.
- [low risk] Auth email volume stays under the free tier's 100 emails/day.

## Evidence
- `https://auth0.com/docs/customize/email/email-templates.md` (read 2026-09-23, line 48) — "Email template customization is not available when using the built-in email provider."
- `https://auth0.com/docs/customize/email/smtp-email-providers` (read 2026-09-23) — built-in provider "does not support production use", fixed `no-reply@auth0user.net` sender, 10 emails/minute; Resend is a supported provider integration.
- `https://resend.com/pricing` (read 2026-09-23) — Free: 3,000 emails/month, 100/day, 3 domains; SMTP relay on all plans.
- `curl -sL https://raw.githubusercontent.com/auth0/terraform-provider-auth0/main/docs/resources/email_provider.md` — line 126: `name` options are `azure_cs`, `custom`, `mailgun`, `mandrill`, `ms365`, `sendgrid`, `ses`, `smtp`, `sparkpost`; no `resend`, so Terraform connects via `smtp`.
- `specs/007-app-auth/spec.md:20` — clarification: external free-tier provider (Resend) over SMTP.
- `specs/012-admin-invites/spec.md:86-89` — hosted set-password email (012 FR-001; erratum 2026-09-23 split: was 007 FR-019, now a "Moved to 012" stub).
- `specs/007-app-auth/spec.md:352-354` — assumption: verified sending domain, under 100 emails/day, SMTP credential from CI secrets.

## Decision
**Option A.** `auth0_email_provider` with `name = "smtp"` points at Resend's SMTP relay; the credential comes from `TF_VAR_resend_smtp_password` in the `auth0-dev`/`prod` GitHub Environments; `auth0_email_template` resources customize the `verify_email` and `reset_email` templates (erratum 2026-09-23: `change_password` is the legacy name; set `include_email_in_redirect = false` so invitee emails are not appended to the `/welcome` URL). The free tier covers this app's volume, and email stays reviewable tenant code.
- Option B rejected: not supported for production, no custom templates, generic sender.
- Option C rejected for v1: the app would own email delivery and still need a provider plus the `create:user_tickets` scope.
- Option D rejected: running a mail server means owning deliverability, IP reputation, and DNS for no gain at this scale.
- Option E not evaluated: current free tiers were not checked.

## Confidence
Medium — provider support, Terraform wiring, and free-tier limits are measured, but the sending domain does not exist yet and shared invite/reset template wording is unproven.

## Consequences
**Easier:** Branded, clearly worded auth emails; one provider for invites, verification, and resets; configuration versioned with the tenant.
**Harder:** A provider account and SMTP secret per environment; DNS records for SPF/DKIM before production invites.
**Risks that remain:** Exceeding 100 emails/day blocks auth emails until the next day — mitigated by monitoring volume and upgrading if needed; shared template wording — mitigated by the ticket-URL fallback.

## Revisit Trigger
Reopen if: daily auth email volume nears 100; Resend's free tier changes; the invite and reset emails need different wording than one template allows; or the Auth0 Terraform provider adds a native `resend` option.
