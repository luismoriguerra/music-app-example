# Decision: Attribution of legacy single-owner rows

## Status
**Accepted**

## Context
Before this feature, every personal row (sheets, history entries, second-voice analyses) was stamped with the synthetic owner `"owner"`; there was no login. This feature changes `owner_id` to a UUID foreign key to `users.id` (data model). FR-010 requires legacy rows to move through "an explicit path that never assigns legacy rows to the wrong account", and T016 was blocked on how that path proves ownership and where unclaimed rows live.

Protected **fact**: who owns each legacy row. **Authority**: the operator who ran the app in single-owner mode, identified by the break-glass first admin (FR-017). **Read path**: the one-time migration that sets `owner_id` on legacy rows.

**Question:** Who gets the rows owned by the synthetic `owner` identity, and does anything stay unclaimed?

**Constraints that matter:**
- FR-010 — explicit migration path; never assigns legacy rows to the wrong account; never auto-merges into the first account that logs in.
- FR-017 — the first admin is seeded through a documented break-glass path, not self-registration.
- FR-004 — every personal record ends with exactly one owner.
- FR-008 — security-relevant changes are audited.

## Options Considered
- **Option A — One-time, audited admin migration assigns every legacy row to the break-glass first admin.** **(chosen)**
- **Option B — Operator-issued claim code; unclaimed rows keep a nullable `owner_id`.** **(rejected)**
- **Option C — Export legacy rows to a file, then delete them.** **(rejected)**

## Assumptions
- [medium risk] Only the operator created rows in single-owner mode — there was no login, so any other visitor's rows would also carry `"owner"` and would move to the admin.
- [low risk] The legacy row count is small enough for one transactional migration.

## Evidence
- `backend/db_models.py:42` — `OWNER_ID_DEFAULT = "owner"`: one synthetic identity for every legacy row.
- `backend/db_models.py:100-102` — `owner_id()` returns that identity from the environment.
- `specs/007-app-auth/spec.md:213-215` — FR-010 explicit path, never the wrong account.
- `specs/007-app-auth/spec.md:229-231` — FR-017 break-glass first admin.

## Decision
**Option A.** After the break-glass first admin exists (FR-017), an operator-run, one-time migration command re-points every row whose `owner_id` is `"owner"` to that admin's `users.id` in one transaction and writes one `legacy_claim` audit row with the row counts. Nothing stays unclaimed, so `owner_id` becomes `NOT NULL` with a foreign key. The migration refuses to run twice and refuses to run without exactly one designated first admin. Rows are never assigned to whoever logs in first.
- Option B rejected: a claim-code flow, a nullable ownership column, and an unclaimed state in every ownership query, for rows only the operator created.
- Option C rejected: loses the operator's existing history for no requirement.

## Confidence
Medium — rests on the single-owner code path and FR-010/FR-017, but assumes no one other than the operator created legacy rows.

## Consequences
**Easier:** No user-facing claim UI or claim-proof mechanism; `owner_id` is `NOT NULL` from the start, so `scope()` and the ID-swap tests never meet an unowned row.
**Harder:** The operator must seed the first admin before running the migration; any legacy rows made by other visitors now belong to the admin.
**Risks that remain:** A misidentified first admin would receive rows — mitigated by requiring exactly one designated admin and auditing the run.

## Revisit Trigger
Reopen if: evidence shows other people created rows in single-owner mode; more than one person needs a share of legacy data; or the first admin is not the operator who used single-owner mode.
