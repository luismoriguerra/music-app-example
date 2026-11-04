---
description: "Recap decisions, open questions, and next steps for the active feature"
---

# Recap

**Status brief for Spec Kit** — read-only convergent summary. Same stance as
explore: **think deeply, change nothing**. You summarize what is decided, what
is open, and what is next — in bullet style, grounded in the feature tree, plus
a portable agnostic TL;DR. You do not decide, edit specs, or write code.

> **This is a report, not a workflow.** No mandatory steps beyond loading what
> the brief needs, no writes, no auto-capture. Converge: one state line, five
> sections, then stop.

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

Parse optional arguments:

| Input | Default |
|---|---|
| Feature | Active feature (`check-prerequisites.sh`) or named `specs/NNN-*` |
| Depth | `compact` · `full` (more bullets per section, same five sections) |
| Audience | `dev` · `github` · `slack` (tunes the agnostic TL;DR only) |

## Triggers

Follow this command when the user message matches **any** of these (case
insensitive; partial match is fine):

| Trigger | Example |
|---|---|
| `recap` / `status` / `where are we` | "recap this feature" |
| `what is next` / `what remains` | "what is next for the auth feature?" |
| `open questions` / `decisions made` | "list open questions with recommendations" |
| `epics` / `issues` / `PR plan` | "draft epics and PRs from the current spec" |
| `brief` / `summary` / `tl;dr` | "give me a compact brief I can paste in chat" |

**Not a trigger** — these **mutate**; offer them only as explicit exit paths:

| User intent | Command (exit recap first) |
|---|---|
| Write/update spec | `__SPECKIT_COMMAND_SPECIFY__` / `__SPECKIT_COMMAND_CLARIFY__` |
| Record a decision | `__SPECKIT_COMMAND_DELIBERATE_RECORD__` |
| Generate plan/tasks | `__SPECKIT_COMMAND_PLAN__` / `__SPECKIT_COMMAND_TASKS__` |
| Implement code | `__SPECKIT_COMMAND_IMPLEMENT__` |
| Brainstorm alternatives | `__SPECKIT_COMMAND_DELIBERATE_EXPLORE__` |

## Hard guardrails (non-negotiable)

- **Read-only** — do not edit, write, or delete any file. Do not run git
  commit, build, migration, or deploy commands that mutate state.
- **No delegation that writes** — do not invoke implement, record, clarify, or
  similar commands unless the user **explicitly** says to exit recap and run
  that command.
- **Grounded then agnostic** — sections 1–4 cite `DR-NNN` / `FR-xxx` / `Txxx`
  codes; section 5 (agnostic TL;DR) cites nothing. Never mix the layers.
- **Recommend, don't decide** — open questions get `Recommended:` plus 1–2
  alternatives with a one-line why. Never mark anything decided in chat.
- **Never invent** — `Decided` cites only ledger `Accepted` rows, `[x]` tasks,
  and locked requirements. If the ledger is missing, say so; do not infer
  decisions from plan prose alone.
- **Offer capture, never auto-capture** — end with capture offers, then wait.
  Do not create DRs, spec edits, or tasks on your own.

Allowed: `Read`, `Grep`, `Glob`, read-only shell (`check-prerequisites.sh`,
`git diff`, `git log`, `rg`), questions to the user.

---

## Step 0 — Resolve feature directory

From the project root, run the appropriate script for your platform:

```bash
.specify/scripts/bash/check-prerequisites.sh --json --paths-only
```

```powershell
.specify/scripts/powershell/check-prerequisites.ps1 -Json -PathsOnly
```

Parse `FEATURE_DIR`, `FEATURE_SPEC`, and paths if present. Also read
`.specify/feature.json` when the script is not enough, and
`.specify/extensions/deliberate/deliberate-config.yml` when present
(`decisions_dir`, `ledger_heading`).

**If no feature exists yet** (no `specs/NNN-*`, empty `feature.json`):

- List `specs/` and ask which feature to recap — or, for greenfield, offer
  `__SPECKIT_COMMAND_SPECIFY__`.
- Never invent a feature name or recap an empty tree.

**If a feature exists**, set:

- `SPEC = $FEATURE_DIR/spec.md`
- `TASKS = $FEATURE_DIR/tasks.md` (optional)
- `DECISIONS = $FEATURE_DIR/<decisions_dir>` (`decisions_dir` from
  `deliberate-config.yml`, default `decisions`)
- `LEDGER_HEADING = <ledger_heading>` from `deliberate-config.yml`
  (default `### Decision records`)

---

## Step 1 — Load (progressive, read-only)

Read only what the brief needs. Resolve `DECISIONS` and `LEDGER_HEADING`
from Step 0 — never assume `decisions/` or the default heading, or projects
that customized them will silently report zero DRs. Row statuses follow the
ledger reference at
`.specify/extensions/deliberate/docs/ledger.md`.

| Artifact | Extract |
|---|---|
| `spec.md` + ledger (`LEDGER_HEADING` from Step 0) | FR/SC, ledger rows grouped by Status |
| `$DECISIONS/DR-*.md` (`DECISIONS` from Step 0) | Question, Decision, Confidence, Revisit Trigger |
| `plan.md` / `research.md` | Approach, risks, known unknowns |
| `tasks.md` | `[x]` vs `[ ]` counts per phase |
| `checklists/` | Failing or unmet gates |

Summarize in one line what you loaded — do not dump file contents.

---

## Step 2 — Classify state

Emit one state line at the top of the brief, with a one-line why:

| State | Signals |
|---|---|
| `exploration` | No `specs/NNN-*`, or spec exists with 0 Accepted DRs and open questions outnumber decided items |
| `in-progress` | `tasks.md` has both `[x]` and `[ ]`, or Proposed DRs / `[NEEDS CLARIFICATION]` markers remain |
| `done` | All tasks `[x]`, no Proposed DRs, no `[NEEDS CLARIFICATION]`, checklists pass |

When signals conflict, pick the earlier state and say what is holding it back.

---

## Step 3 — Report (the brief)

Emit exactly these five sections, bullet style. `compact` (default): cap each
section at ~7 bullets. `full`: no cap, same sections.

### 1. Decided

One bullet per Accepted DR / locked requirement / completed milestone:

```markdown
- **DR-007** section-on-page for the detail view (Accepted, High) — one URL, less spec churn.
- **FR-012** audit gate before implementation — locked in spec.
```

### 2. Open — needs clarification or decision

One bullet per Proposed DR, `[NEEDS CLARIFICATION]`, ambiguity, or failing
gate. Every bullet carries a recommendation plus alternatives:

```markdown
- **Q:** Where does the export control live? · **Recommended:** toolbar (matches
  two sibling surfaces — DR-009, Proposed) · **Alt:** settings page (calmer UI, buries the action).
```

Never leave an open item without a `Recommended:` line. Never present a
recommendation as a decision.

### 3. Draft epics / issues / PRs

Titles only, grouped from tasks and decisions. No bodies, no labels, no
estimates:

```markdown
- **Epic:** Detail surface parity
  - **Issue:** Render section on page
  - **Issue:** Audit-before-implementation gate
  - **PR:** Section markup + ledger backlink
```

Keep titles portable — no `DR-NNN` / `Txxx` codes here; the mapping lives in
sections 1–2.

### 4. What is next

1–3 ordered steps. Each step names its owning command so the user can act:

```markdown
1. Decide the export-control placement, then run `__SPECKIT_COMMAND_DELIBERATE_RECORD__` to close DR-009.
2. Run `__SPECKIT_COMMAND_PLAN__` to turn the accepted approach into tasks.
```

### 5. Agnostic TL;DR

3–5 lines, concise and compacted. Copy-pasteable to Slack, GitHub, or a
commit message — no `DR-` / `FR-` / `SC-` / `T0` codes, no file paths, no
backticked spec references:

```markdown
- Detail placement is settled; export-control placement is the only open product call.
- Three work chunks remain: list, detail, audit gate. Ship list first.
```

Self-check before emitting: if this section contains a code or a path, rewrite
it. Audience tunes tone only (`github`: slightly fuller sentences; `slack`:
terse; `dev`: default).

---

## Step 4 — Offer capture (never auto-capture)

End with one capture row per open thread from the capture-routing reference
at `.specify/extensions/deliberate/docs/capture-routing.md` — do not run
multiple captures in one turn unless asked:

- Open question now decided → `__SPECKIT_COMMAND_DELIBERATE_RECORD__`
- New/changed requirement → `__SPECKIT_COMMAND_CLARIFY__`
- Ready to plan or re-plan → `__SPECKIT_COMMAND_PLAN__`
- Want alternatives first → `__SPECKIT_COMMAND_DELIBERATE_EXPLORE__`

---

## Relationship to other commands

| Command | Difference |
|---|---|
| `__SPECKIT_COMMAND_DELIBERATE_EXPLORE__` | **Divergent** brainstorming with ≥2 options — use to open up; recap converges |
| `__SPECKIT_COMMAND_DELIBERATE_RECORD__` | **Writes** DR files — use after an open question is decided |
| `__SPECKIT_COMMAND_ANALYZE__` | **Read-only** formal cross-artifact QA audit — use for consistency; recap is a status brief |
| `__SPECKIT_COMMAND_CLARIFY__` | **Writes** answers into `spec.md` — use to close requirement gaps recap surfaces |
| `__SPECKIT_COMMAND_DELIBERATE_TRIAGE__` | **Read-only** uncertainty queue — use to rank recap open items by impact/category |

**Typical flow:**

```
__SPECKIT_COMMAND_DELIBERATE_EXPLORE__  →  (user decides)  →  clarify / record / plan  →  …  →  __SPECKIT_COMMAND_DELIBERATE_RECAP__
```

---

## Related

- Capture-routing reference: `.specify/extensions/deliberate/docs/capture-routing.md` — where open items go when the user exits recap
- Ledger reference: `.specify/extensions/deliberate/docs/ledger.md` — ledger row statuses recap groups by
- `__SPECKIT_COMMAND_DELIBERATE_RECORD__` — after an open question is decided
- `__SPECKIT_COMMAND_DELIBERATE_EXPLORE__` — to diverge again on an open question
- `__SPECKIT_COMMAND_DELIBERATE_TRIAGE__` — to rank open items before capturing them
