# Decision: Where admin governance (users, flags, limits) lives

## Status
**Accepted**

## Context
Admins must manage users and roles, toggle product features without a redeploy, and set per-user API-call and AI-use limits with metering. Auth0 (DR-001) owns identity, but has no product-quota or feature-flag primitives, and its Management API needs a privileged credential.

Protected **fact**: the admin capability and the per-user allowance. **Authority**: `admin` role in the verified token (FR-005) for admin routes; resolved entitlement (explicit → default) for billable calls. **Read path**: admin REST routes proxying the Management API with a server-held M2M credential; quota middleware before every billable call.

**Question:** Where do user/role administration, feature flags, and API/AI limits live?

**Constraints that matter:**
- FR-012 — admin API proxies the provider's Management API; credential never reaches the browser.
- FR-013 — flags checked per request, effective without restart.
- FR-014 / FR-015 / FR-016 — per-user allowances (defaults + overrides), fail-closed, metered into a server-side ledger without secrets.
- FR-008 — one audit trail for security-relevant events.
- Constitution VI — no secrets in the browser; VII — own Postgres for domain data.

## Options Considered
- **Option A — App-side governance.** Backend proxies Management API via M2M; `feature_flags`, `user_entitlements`, `usage_ledger`, `audit_log` are Postgres tables. **(chosen)**
- **Option B — Flags/limits in Auth0 `app_metadata`.** Toggles and allowances carried on the IdP user profile. **(rejected)**
- **Option C — Third-party flag/quota service.** **(rejected)**

## Assumptions
- [medium risk] Per-request flag and entitlement reads from Postgres stay within the <150 ms p95 auth budget (plan Performance Goals).
- [medium risk] Deployment-default limit values are chosen before quota enforcement ships (NULL = default; numbers not yet specified).
- [low risk] Management API scopes `create:users update:users create:role_members` cover the admin console surface.

## Evidence
- `specs/007-app-auth/spec.md:221-228` — FR-012…FR-016 requirements (erratum 2026-09-23 split:
  FR-012 now covers only block/unblock in 007; FR-013…FR-016 are "Moved to
  010-admin-governance" stubs at these same lines — see 010's own FR-001…FR-018
  for the current requirement text this decision still governs).
- `specs/007-app-auth/research.md:252-270` — R7: Management API mapping, `app_metadata` flags rejected, no Auth0 quota primitive.
- `specs/007-app-auth/plan.md:206` — entitlements/flags/ledger in Postgres; `app_metadata` rejected (couples toggles to IdP, bypasses audit).
- `specs/007-app-auth/data-model.md:64` — `feature_flags`/`user_entitlements`/`usage_ledger` (2026-09-23: monthly columns were replaced by `api_calls_per_minute`/`ai_calls_per_day` rate limits, FR-014/FR-015; 2026-09-23 split: these tables and their endpoints moved to 010-admin-governance's own data model and contract, not duplicated in 007).
- `specs/007-app-auth/contracts/rest-api.md:39` — feature flags and rate limits + usage endpoints moved to 010-admin-governance.

## Decision
**Option A.** Auth0 owns identity; the app owns governance. It is the only shape that bounds AI spend (SC-008) with a single audit trail, and keeps product toggles independent of the IdP. Option B rejected: couples product rollout to the identity vendor, bypasses the app audit log, and cannot gate non-login paths cleanly. Option C rejected: a second external runtime for a hundreds-of-users app, with no requirement demanding it.

## Confidence
High — rests on the absence of Auth0 quota/flag primitives, the explicit FR set, and a data model that already defines the tables and resolution order.

## Consequences
**Easier:** Flags and limits are ordinary tables with audit; enforcement is local and testable with mocked Management API; IdP swap (DR-001 fallback) leaves governance intact.
**Harder:** The app must implement last-admin guard, neutral errors, bounded paging and caching for Management API rate limits (FR-017, FR-018); M2M credential is a backend secret to manage.
**Risks that remain:** Undefined default allowances could ship as unlimited — mitigated by choosing defaults before T031; partial Management API mutations — mitigated by never reporting partial success (FR-018).

## Revisit Trigger
Reopen if: Auth0 gains product quota or feature-flag primitives, a second app needs the same governance, per-request flag/entitlement reads breach the latency budget, or a project ADR log is adopted (promote to ADR).
