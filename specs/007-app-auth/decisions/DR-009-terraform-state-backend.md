# Decision: Terraform remote-state backend

## Status
**Accepted**

## Context
FR-011 requires every Auth0 tenant setting to be Terraform code, applied per environment, "with remote state that is never committed". DR-002 settled tenant-as-code but left the state backend open, which blocks T005 (scaffold) and T006 (clean plan). The state file holds secrets: the `music-app-example-web` and M2M client secrets and the Resend SMTP password.

Protected **fact**: the Terraform state for the dev and prod tenants, including those secrets. **Authority**: the CI deploy role (GitHub Environments `auth0-dev` / `prod`) and the operator. **Read path**: `terraform plan/apply` in GitHub Actions and on the operator's machine.

**Question:** Where does Terraform keep remote state for the dev and prod Auth0 tenants?

**Constraints that matter:**
- FR-011 — remote state, never committed; per-environment apply.
- SC-006 — plan clean before apply; daily drift check (T049) must read state.
- Constitution VII — own Postgres is the runtime store; secrets only from environment.
- Concurrent CI runs (PR plan, merge apply, nightly drift) must not corrupt state — locking required.

## Options Considered
- **Option A — Postgres `pg` backend in a dedicated database on the existing Railway Postgres server.** **(chosen)**
- **Option B — HCP Terraform (free tier).** **(rejected)**
- **Option C — S3-compatible bucket (e.g. Cloudflare R2) with `use_lockfile`.** **(rejected)**

## Assumptions
- [high risk] The Railway Postgres server can expose a TCP proxy that GitHub Actions reaches, restricted to a dedicated role.
- [medium risk] A separate `terraform_state` database and role keep state secrets out of the app's database and credentials.
- [low risk] State stays small (one tenant per environment), so storage and backups are negligible.

## Evidence
- `https://raw.githubusercontent.com/hashicorp/web-unified-docs/main/content/terraform/v1.13.x/docs/language/backend/pg.mdx` (read 2026-09-23) — line 3: "store state remotely in a Postgres database with locking"; line 105: locking via Postgres advisory locks, auto-released when the session ends.
- `.../backend/s3.mdx` (read 2026-09-23) — line 13: locking via `use_lockfile`; line 50: DynamoDB-based locking deprecated.
- `curl -s https://api.github.com/repos/hashicorp/terraform/releases/latest` — `v1.16.4`, 2026-09-23.
- `specs/007-app-auth/spec.md:216-220` — FR-011 remote-state requirement.

## Decision
**Option A.** Terraform state for each environment lives in a dedicated `terraform_state` database on the existing Railway Postgres server, reached through the `pg` backend with its own role; the connection string is a GitHub Environment secret (`TF_STATE_PG_CONN_STR`, one per `auth0-dev` / `prod`) and is never shared with the app. Native advisory-lock locking protects concurrent PR plans, merge applies, and the drift check. Dev and prod state are kept apart by a distinct `schema_name` per environment (`auth0_dev`, `auth0_prod`) passed with `terraform init -backend-config="schema_name=…"` (erratum 2026-09-23: without it both environments would share the default `terraform_remote_state` schema and `default` workspace, and a prod apply would read dev's state). No new vendor or account.
- Option B rejected: a new vendor account and API token for one small state file; free-tier limits could not be verified.
- Option C rejected: a new vendor account and two secrets; R2 support for the lockfile's conditional writes was not verified.

## Confidence
Medium — the backend and its locking are documented, and no new vendor is needed, but CI reachability through a Railway TCP proxy and the database-level separation are unproven until T005.

## Consequences
**Easier:** State, locking, and backups ride on infrastructure the project already runs; one secret per environment.
**Harder:** The state database must be reachable from GitHub Actions; the Postgres server now holds both app data and tenant secrets (separate database + role), so its compromise exposes both.
**Risks that remain:** A misconfigured role could let the app read state — mitigated by a dedicated role with access to `terraform_state` only; losing the Postgres server loses state — mitigated by Railway backups and `terraform import` recovery.

## Revisit Trigger
Reopen if: GitHub Actions cannot reach the Railway Postgres server securely; the project adopts HCP Terraform or object storage for other infrastructure; state secrets must be isolated from the app's server for compliance; or Railway Postgres backups prove insufficient.
