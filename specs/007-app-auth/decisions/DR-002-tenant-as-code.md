# Decision: Auth0 tenant configuration and drift control

## Status
**Accepted**

## Context
Roles, API scopes, application clients, connections, the roles-claim Action, and attack protection are security-critical configuration that must be identical in shape across dev and prod and reviewable before change. The amendment mandates Terraform for the tenant (DR-001 picks the IdP).

**Question:** How is the Auth0 tenant configured and kept from drifting across environments?

**Constraints that matter:**
- FR-011 — all tenant configuration as Terraform, applied per environment, remote state never committed; dashboard edits emergency-only and reconciled back to code.
- SC-006 — `plan` clean before `apply`; drift after an emergency edit reconciled within one working cycle.
- Secrets only via environment/CI (spec Assumptions; plan Constraints).

## Options Considered
- **Option A — Terraform root `infra/auth0/` (`auth0` provider), per-env tfvars, remote state, plan on PR / apply on merge.** **(chosen)**
- **Option B — Dashboard-managed tenant.** Click-ops in the Auth0 UI. **(rejected)**
- **Option C — One Terraform codebase also managing Railway + Postgres.** **(rejected)**

## Assumptions
- [high risk] `terraform plan` against the dev tenant is clean with zero unmanaged role/scope drift — unverified until T006.
- [medium risk] A remote state backend and CI runner can be provisioned; the specific backend is not yet chosen.
- [low risk] The `auth0` provider covers every resource listed (resource server, roles, role permissions, clients, connections, actions, attack protection).

## Evidence
- `specs/007-app-auth/spec.md:9` — requester input: Auth0 "managed by Terraform".
- `specs/007-app-auth/spec.md:216-220` — FR-011 scope and remote-state rule.
- `specs/007-app-auth/spec.md:316-318` — SC-006 plan-clean and drift-reconcile criterion.
- `specs/007-app-auth/research.md:228-250` — R6: file layout, one `auth0_role_permissions` per role, alternatives rejected, spike requirement.
- `specs/007-app-auth/plan.md:205` — Terraform as third deploy plane; click-ops rejected; plan-on-PR/apply-on-merge mitigation.
- Glob `infra/**` — no matches: tenant-as-code does not exist yet (greenfield, no migration of existing Terraform).

## Decision
**Option A.** Terraform makes tenant changes reviewable in PRs, reproducible per environment, and drift visible via `plan`. Option B rejected: unreviewed, unreproducible, and exactly the drift FR-011/SC-006 guard against. Option C rejected: Railway stays dashboard/CLI and Postgres stays Compose/Railway-managed; widening Terraform scope adds a migration with no requirement behind it.

## Confidence
Medium — the approach is mandated and conventional, but T006 has not produced a clean plan and the remote state backend is still undecided.

## Consequences
**Easier:** Role/permission names are code the backend can trust (T009 depends on them); env parity by construction; emergency edits are detectable.
**Harder:** A third deploy plane beside Railway app deploys; Terraform provider credentials must live in CI secrets; contributors need Terraform tooling.
**Risks that remain:** Unmanaged dashboard edits — mitigated by drift check at plan review and the break-glass reconciliation doc (T036). Undecided state backend — must be settled before T005.

## Revisit Trigger
Reopen if: T006 cannot reach a clean plan, the remote state backend choice constrains the workflow (e.g. no locking), Railway or Postgres infra moves under Terraform, or a project ADR log is adopted (promote to ADR).
