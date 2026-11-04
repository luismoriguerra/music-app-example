---
description: "Record, supersede, or batch-create feature decision records"
---

# Record

Single entry point for **feature Decision Records (DR)** in the Spec Kit tree.
One repeatable workflow for classifying, drafting, and indexing decisions —
instead of ad-hoc DR authoring scattered across clarify, plan, and analysis
remediation.

**Writes:** `specs/NNN-*/decisions/DR-*.md`, the **Decision records** ledger in
`spec.md`, optional rows in `tasks.md`, supersession status on prior DRs.

**Does not write:** application code, ADR log entries (delegates or reports),
or anything outside the active feature directory.

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

Parse optional arguments:

| Input | Default |
|---|---|
| Feature | Active Spec Kit feature (`check-prerequisites.sh`) |
| Mode | `create` · `supersede` · `batch` · `propose-only` |
| Question | From user message — the single question the DR settles |
| Chosen option | If user already decided; else draft options for confirmation |
| Supersedes | DR id when mode is `supersede` |
| Add task | From `task_enabled` in `deliberate-config.yml` (default `yes`) |

## Triggers

Follow this command when the user message matches **any** of these (case
insensitive; partial match is fine):

| Trigger | Example |
|---|---|
| `record` / `decision record` | "record a DR for where the detail view lives" |
| write / create a DR | "write a decision record superseding DR-007" |
| supersede DR-NNN | "supersede DR-007 with measured evidence" |
| route to a DR | "route this gap to a DR" |
| after analyze | "analyze found F1 — record it as DR-013" |
| batch | "create DRs from this punch-list" |

**Not a trigger** — delegate or redirect instead:

| User intent | Action |
|---|---|
| Platform-wide rule (constrains other features) | ADR path — see Step 1 |
| Read-only cross-artifact analysis | `__SPECKIT_COMMAND_ANALYZE__` — then **this command** to write DRs the user approves |
| Brainstorming without writing | `__SPECKIT_COMMAND_DELIBERATE_EXPLORE__` — then **this command** once decided |

## Step 0 — Resolve feature directory

From the project root, run the appropriate script for your platform:

```bash
.specify/scripts/bash/check-prerequisites.sh --json
```

```powershell
.specify/scripts/powershell/check-prerequisites.ps1 -Json
```

Parse `FEATURE_DIR` (absolute path).

**If no feature exists** (no `specs/NNN-*`, empty result): do **not** create
one — switch to **chat-only mode**:

- Draft the DR proposal in the thread: Question, candidate Options, what
  Evidence would settle it, and a suggested filename.
- End with: run `__SPECKIT_COMMAND_SPECIFY__` first — say the word and I'll
  re-run `__SPECKIT_COMMAND_DELIBERATE_RECORD__` to write it.
- Never write files outside an active feature directory.

**If a feature exists**, set:

- `SPEC = $FEATURE_DIR/spec.md`
- `TASKS = $FEATURE_DIR/tasks.md` (optional)
- `DECISIONS = $FEATURE_DIR/<decisions_dir>` (`decisions_dir` from
  `deliberate-config.yml`, default `decisions`)
- `TEMPLATE = .specify/extensions/deliberate/templates/decision-record-template.md`
  (**canonical — do not duplicate**)

Create `decisions/` if absent. Read `deliberate-config.yml` from
`.specify/extensions/deliberate/` when present (ledger heading, task default,
platform-routing overlay).

### Template policy

| Location | Role |
|---|---|
| `.specify/extensions/deliberate/templates/decision-record-template.md` | **Single source of truth** — read it fresh every time |
| `.specify/extensions/deliberate/docs/template-checklist.md` | Section rubric and hard-fail rules |

This command does **not** embed a second copy of the template. Step 3 always
**reads the canonical file** first; use the checklist to verify completeness
before apply.

## Step 1 — Classify: DR, ADR, or SKIP

Apply the routing table at
`.specify/extensions/deliberate/docs/routing.md`, plus the
`platform_routing` overlay from `deliberate-config.yml`. Summary:

| Scope | Action |
|---|---|
| Affects **only this feature** | **DR** — continue this command |
| Constrains **other features** or the shared platform model | **ADR** — stop; hand to the configured `adr_command`, or report the platform concern in chat when none is configured |
| Repo-local naming / already decided in spec with no open question | **SKIP** — say why |

If classification is ambiguous, present both paths with one-line rationale and
ask the user before writing.

## Step 2 — Allocate DR number and slug

Bash:

```bash
ls "$DECISIONS"/DR-*.md 2>/dev/null | sed 's/.*DR-0*\([0-9]*\).*/\1/' | sort -n | tail -1
```

PowerShell:

```powershell
Get-ChildItem "$DECISIONS/DR-*.md" -ErrorAction SilentlyContinue |
  ForEach-Object { if ($_.Name -match 'DR-0*([0-9]+)') { [int]$Matches[1] } } |
  Sort-Object | Select-Object -Last 1
```

Next id = max + 1, zero-padded to three digits (`DR-016`).

Slug = 2–6 kebab-case words from the question (`detail-view-placement`).
Filename: `DR-NNN-<slug>.md`.

**Collision check:** if the file exists, increment NNN or change slug — never
overwrite an Accepted DR.

## Step 3 — Draft the record

1. Read **`TEMPLATE`** (the installed template path from Step 0).
2. Cross-check against the template-checklist reference.
3. Fill **every section** — empty Evidence or Revisit Trigger is a hard fail.
4. Status: `Accepted` only when evidence-backed; else `Proposed`.
5. For **supersede** mode:
   - New DR states which option replaces the old decision and **why**.
   - Edit the superseded file's `## Status` to
     `**Superseded by DR-NNN (YYYY-MM-DD)**` and add a one-line blockquote at
     the top explaining what changed — **do not delete** the old body.

Evidence rules (non-negotiable):

- At least one `file:line` or measured query/command result per DR
  (the `evidence_rule` from config; never weaker).
- For authorization/privacy DRs: name the protected fact, its authority
  (who/what grants access), and the read path in question.

## Step 4 — Present plan (confirm before write)

Unless the user said "just write it", or a prior approval covers this write,
show:

```markdown
## Decision record plan — <feature>

| Field | Value |
|---|---|
| Type | DR (feature-local) |
| Id | DR-NNN |
| File | specs/.../decisions/DR-NNN-slug.md |
| Question | … |
| Chosen | Option X — … |
| Supersedes | DR-00y (if any) |
| Spec ledger | add row |
| Task | T0xx (if requested) |

Proceed? (yes / edit / route-to-ADR)
```

Wait for confirmation when the decision is **Accepted** or supersedes an
existing **Accepted** DR. In `propose-only` mode, stop here — no writes.

## Step 5 — Apply

1. Write `DECISIONS/DR-NNN-<slug>.md`.
2. Update **`spec.md` Decision records ledger** — see the ledger reference at
   `.specify/extensions/deliberate/docs/ledger.md`.
   - Add or update the row: Record · Settles · Status.
   - If superseding, update the old row's Status column to point at DR-NNN.
3. **Cross-link** when obvious: one inline link in `plan.md` or the relevant
   FR/SC paragraph — do not spam every artifact.
4. **Optional task** (`Add task: yes`):

   ```markdown
   - [ ] T0xx **DR-NNN** — <one-line implement or verify action constrained by this decision>
   ```

   Append to the appropriate phase in `tasks.md`; follow existing id numbering.

## Step 6 — Batch mode (parallel subagents)

When the user passes multiple gaps (e.g. an analysis punch-list), split into
independent DR candidates:

1. Classify each item (DR / ADR / SKIP) in a table.
2. Launch one subagent per **DR** candidate in a single message — each drafts
   one full DR body (Step 3 fields only, no file writes).
3. Merge drafts, present **one combined plan** (Step 4), apply after confirm.

ADR candidates: collect into a separate list for the configured ADR path — do
not batch-write ADRs inside this command.

## Step 7 — Report

```markdown
## Decision record — complete

Feature: specs/NNN-…
Created: DR-NNN (<title>) — Accepted|Proposed
Superseded: DR-00y (if any)
Updated: spec.md ledger (+ tasks.md T0xx if added)
ADR routed: none | <where the platform concern went>

Next: link from plan/checklist as needed · run __SPECKIT_COMMAND_ANALYZE__ if artifacts drift
```

## Guardrails

- **DR ≠ ADR** — never append platform decisions to `decisions/`.
- **Immutable history** — supersede, never delete or rewrite Accepted DR bodies.
- **Ledger lives in spec.md** — `decisions/` has no index file.
- **No code changes** — requirement text in spec/tasks only; implementation is
  `__SPECKIT_COMMAND_IMPLEMENT__` or manual coding.
- **No commits** unless the user explicitly asks.
- Re-read the written file and grep the ledger row before reporting success.

## Related

- Routing reference: `.specify/extensions/deliberate/docs/routing.md` — DR vs ADR vs SKIP
- Ledger reference: `.specify/extensions/deliberate/docs/ledger.md` — spec.md table format
- Template checklist: `.specify/extensions/deliberate/docs/template-checklist.md` — required sections
- `__SPECKIT_COMMAND_DELIBERATE_EXPLORE__` — read-only brainstorming before a DR is chosen
- `__SPECKIT_COMMAND_ANALYZE__` — read-only; pair with this command to materialize DRs
- `__SPECKIT_COMMAND_DELIBERATE_RECAP__` — read-only status brief over the ledger and tasks
- `__SPECKIT_COMMAND_DELIBERATE_TRIAGE__` — read-only queue feeding this command one decision item at a time
