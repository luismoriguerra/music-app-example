# Decision: Authorization engine for v1 (OpenFGA or owner filter + roles)

## Status
**Accepted**

## Context
Authorization in this feature has three parts: every personal record has one owner (FR-004), there are exactly two roles, `user` and `admin` (FR-005), and admin-managed feature flags gate features at runtime (FR-013). OpenFGA, a CNCF relationship-based authorization engine modeled on Google Zanzibar, was proposed as the engine behind those checks. This record decides whether v1 adopts it.

Protected **fact**: who may read, change, list, or delete a personal record, and who may perform admin actions. **Authority**: the verified access token (`sub`, roles claim) plus the record's `owner_id`. **Read path**: every protected REST route and MCP tool call in the FastAPI backend.

**Question:** Should v1 authorization use OpenFGA, or stay with owner-filter + role checks behind a single decision point?

**Constraints that matter:**
- FR-004 — single-owner scoping on read, write, list, and delete.
- FR-005 / FR-006 — two roles, carried in the access token.
- FR-022 — every authorization decision goes through one backend decision point (subject, action, resource).
- Plan performance goal — auth adds <150 ms p95 to protected API calls.
- Constitution VII — own Postgres for runtime data; "JWT with RBAC" is the suggested default.
- Spec Assumptions — sharing or collaboration on personal records is out of scope for v1.

## Options Considered
- **Option A — Defer OpenFGA; owner filter + role check behind one decision point.** v1 checks `owner_id == current user` and the `admin` role inside `backend/app/auth/`; routes call one `authorize(subject, action, resource)` seam, which a relationship engine can replace later. **(chosen)**
- **Option B — Self-hosted OpenFGA now.** OpenFGA server as a third Railway service, backed by our Postgres; owner and role tuples written on every create/delete; store and model managed by the community Terraform provider. **(rejected)**
- **Option C — Managed Auth0 FGA now.** Hosted FGA service; no server to run. **(rejected)**
- **Option D — Reject OpenFGA outright, with no decision point.** Checks stay inline in each route. **(rejected)**

## Assumptions
- [medium risk] Sharing or collaboration stays out of scope through v1; if it lands, this decision reopens.
- [medium risk] One decision point is enough of a seam that swapping in OpenFGA later changes the seam, not the routes.
- [low risk] Owner-filter queries stay the enforcement mechanism for list endpoints (an external engine would need a separate list-objects call per list).

## Evidence
- `https://openfga.dev/docs/fga` (read 2026-09-23) — CNCF-owned, Zanzibar-inspired ReBAC that also expresses RBAC; Postgres, MySQL, or SQLite datastore; SDKs incl. Python; model-test and deploy GitHub Actions.
- `curl -s https://api.github.com/repos/openfga/openfga/releases/latest` — `v1.21.0`, published 2026-09-20; repo licence `Apache-2.0`, last push 2026-09-22.
- `https://pypi.org/pypi/openfga-sdk/json` — version `0.10.4` (pre-1.0 Python SDK).
- `https://registry.terraform.io/v1/providers/openfga/openfga` — `0.5.1`, community tier; GitHub `docs/resources` lists `store.md`, `authorization_model.md`, `relationship_tuple.md`.
- `curl -sL https://api.github.com/repos/auth0/terraform-provider-auth0/contents/docs/resources` — 79 resource docs, none FGA-related: managed FGA could not live in the existing Auth0 Terraform root.
- `https://openfga.dev/docs/getting-started/setup-openfga/configure-openfga.md` — `postgres` storage engine supported (lines 26-37 of the page).
- `specs/007-app-auth/spec.md:193-196` — FR-004 single-owner scoping.
- `specs/007-app-auth/spec.md:197-200` — FR-005 exactly two roles.
- `specs/007-app-auth/spec.md:240-242` — FR-022 single authorization decision point.
- `specs/007-app-auth/spec.md:344-345` — sharing/collaboration out of scope for v1.
- `specs/007-app-auth/plan.md:74` — auth adds <150 ms p95 to protected calls.
- `.specify/memory/constitution.md:111` — "Auth (JWT with RBAC suggested)".
- `backend/db_models.py:242-243` — today's ownership check: validator raises unless `sheet.owner_id == owner_id()`.
- `backend/app/routes_sheets.py:309` — today's list scoping: `filter(HistoryEntry.owner_id == owner_id())`.

## Decision
**Option A.** v1 needs one ownership predicate and one role, and nothing is shared, so a relationship engine adds a service, a second pre-1.0 SDK on the authorization path, a second Terraform provider, and a dual write on every create/delete, with no requirement that uses its strengths. Routing every check through one decision point (FR-022) keeps the later switch cheap.
- Option B rejected for v1: a third Railway service to run and secure; tuple writes must stay consistent with Postgres rows (a lost write locks owners out, a stale tuple leaks access); an extra network hop per check against the 150 ms p95 budget; list endpoints need list-objects calls instead of one SQL filter.
- Option C rejected for v1: same tuple-sync and latency costs as B, plus a second vendor plane outside the Auth0 Terraform root (0 of 79 provider resources) with pricing unverified.
- Option D rejected: inline checks in each route would make a later OpenFGA adoption a rewrite of every route and would scatter the FR-004 enforcement that the adversarial ID-swap tests (SC-003) rely on.

## Confidence
High — rests on the spec's explicit single-owner, two-role, no-sharing scope, today's code already enforcing ownership as a single predicate, and measured OpenFGA SDK/provider maturity.

## Consequences
**Easier:** No new service, SDK, or Terraform provider in v1; ownership stays one SQL filter the ID-swap suite exercises directly; one seam to test for allow/deny.
**Harder:** Adding sharing later needs a migration: backfill owner tuples from `owner_id`, then switch the seam; the seam must stay the only decision point (no inline checks slipping into routes).
**Risks that remain:** Checks bypassing the seam — mitigated by T009's `get_current_user`/`require_role` living in `backend/app/auth/` and route tests (T018/T019) asserting deny paths.

## Revisit Trigger
Reopen if: the spec gains sharing, collaboration, teacher/student, classroom, or per-record access grants; a third role or per-resource permissions appear; the OpenFGA Python SDK reaches 1.0 and a relationship need exists; or authorization logic starts appearing outside the decision point.
