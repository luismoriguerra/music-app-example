---
description: "Triage uncertainties by impact and category across the feature tree"
---

# Triage

**Uncertainty queue for Spec Kit** — read-only prioritizer. Same stance as
explore: **think deeply, change nothing**. You harvest every uncertainty
across the feature tree, rank it by impact, group it by category, and route
each head item to its owning capture command. You do not ask questions to
resolve items, edit specs, or write code.

> **This is a queue, not a loop.** No interactive Q&A, no writes, no
> auto-capture. Rank: board, categories, queue — then stop. Re-run with a
> scope filter to continue by category.

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

Parse optional arguments:

| Input | Default |
|---|---|
| Feature | Active feature (`check-prerequisites.sh`) or named `specs/NNN-*` |
| Scope | `all` · `category:<slug>` · `impact:P0|P1|P2` (narrows board + queue) |
| Depth | `compact` · `full` (more bullets, same three sections) |

## Triggers

Follow this command when the user message matches **any** of these (case
insensitive; partial match is fine):

| Trigger | Example |
|---|---|
| `triage` / `prioritize` | "triage the open questions by impact" |
| `uncertainties` / `unknowns` | "list all uncertainties in this feature" |
| `gaps` / `what is blocking` | "what is blocking the plan?" |
| `what needs clarification` | "what still needs clarification?" |
| `continue by category` | "continue by category nfr" |
| `impact` / `needs immediate` | "what needs immediate resolution?" |

**Not a trigger** — these **mutate**; offer them only as explicit exit paths:

| User intent | Command (exit triage first) |
|---|---|
| Write/update spec | `__SPECKIT_COMMAND_SPECIFY__` / `__SPECKIT_COMMAND_CLARIFY__` |
| Record a decision | `__SPECKIT_COMMAND_DELIBERATE_RECORD__` |
| Generate plan/tasks | `__SPECKIT_COMMAND_PLAN__` / `__SPECKIT_COMMAND_TASKS__` |
| Implement code | `__SPECKIT_COMMAND_IMPLEMENT__` |
| Brainstorm alternatives | `__SPECKIT_COMMAND_DELIBERATE_EXPLORE__` |
| Status brief | `__SPECKIT_COMMAND_DELIBERATE_RECAP__` |

## Hard guardrails (non-negotiable)

- **Read-only** — do not edit, write, or delete any file. Do not run git
  commit, build, migration, or deploy commands that mutate state.
- **No delegation that writes** — do not invoke implement, record, clarify, or
  similar commands unless the user **explicitly** says to exit triage and run
  that command.
- **Queue-only** — never run a one-question-at-a-time resolution loop. Rank
  and route; the owning command asks the questions.
- **Grounded** — every item cites a source (`DR-NNN`, `spec.md:line`, `Txxx`,
  checklist marker). Never invent gaps.
- **Impact must justify** — every rank carries a `blocks X` citation. A bare
  P0 with no blocker is a hard fail.
- **Categories are fixed** — the 10 taxonomy slugs plus 3 deliberate-only
  slugs in Step 4. Never invent ad-hoc categories.
- **Offer capture, never auto-capture** — end with capture routes, then wait.
  Do not create DRs, spec edits, or tasks on your own.

Allowed: `Read`, `Grep`, `Glob`, read-only shell (`check-prerequisites.sh`,
`git diff`, `git log`, `rg`), questions to the user about scope filter only.

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
(`decisions_dir`, `ledger_heading`, `platform_routing` overlay).

**If no feature exists yet** (no `specs/NNN-*`, empty `feature.json`):

- List `specs/` and ask which feature to triage — or, for greenfield, offer
  `__SPECKIT_COMMAND_SPECIFY__`.
- Never invent a feature name or triage an empty tree.

**If a feature exists**, set:

- `SPEC = $FEATURE_DIR/spec.md`
- `TASKS = $FEATURE_DIR/tasks.md` (optional)
- `CHECKLISTS = $FEATURE_DIR/checklists/` (optional)
- `DECISIONS = $FEATURE_DIR/<decisions_dir>` (`decisions_dir` from config,
  default `decisions`)
- `LEDGER_HEADING = <ledger_heading>` from `deliberate-config.yml`
  (default `### Decision records`)

---

## Step 1 — Load (progressive, read-only)

Read only what the queue needs. Resolve `DECISIONS` and `LEDGER_HEADING`
from Step 0 — never assume `decisions/` or the default heading, or projects
that customized them will silently report zero DRs. Row statuses follow the
ledger reference at
`.specify/extensions/deliberate/docs/ledger.md`. Scope firewall follows the
routing reference at
`.specify/extensions/deliberate/docs/routing.md`.

| Artifact | Extract |
|---|---|
| `spec.md` + ledger (`LEDGER_HEADING` from Step 0) | FR/SC, markers, ledger rows by Status |
| `$DECISIONS/DR-*.md` (`DECISIONS` from Step 0) | Status, Confidence, Assumptions, Revisit Trigger |
| `plan.md` / `research.md` | Unknowns, open questions, unmitigated risks |
| `tasks.md` | Blocked tasks, dependency notes, `[ ]` without owner |
| `checklists/` | Failing gates, unchecked requirement items |
| Prior `## Clarifications` session bullets | Already resolved — exclude, never re-ask |

Summarize in one line what you loaded — do not dump file contents.

---

## Step 2 — Harvest uncertainties

Collect every open item from Step 1. Each item needs a source before it
enters the queue:

| Source | What counts |
|---|---|
| Spec markers | `[NEEDS CLARIFICATION]`, TODO, placeholders, vague adjectives without metric |
| DRs | `Proposed` status, `Confidence: Low`, `[high risk]` assumptions, Revisit Trigger now true |
| Plan / research | Open questions, unknowns, risks without mitigation |
| Tasks | Blocked-by notes, dependencies on unresolved items, unscoped work |
| Checklists | Failing gates, unchecked requirement items |
| Prior session leftovers | Deferred / Outstanding items from an earlier pass |

Exclude: `Accepted` DRs, `[x]` tasks, session-resolved bullets, and SKIP per
the routing reference (naming, typo, duplicate of an Accepted DR,
no-open-question). When unsure whether an item is open, include it at P2
with a one-line why rather than dropping it silently.

---

## Step 3 — Score by impact

Assign one rank per item. Every rank justifies itself with a `blocks X`
citation — spec phase, FR/SC id, task id, or downstream artifact:

| Rank | Signals |
|---|---|
| `P0 immediate` | Blocks spec/plan/tasks/implement, or auth/privacy with unknown authority or read path |
| `P1 soon` | Touches 2+ FR/SC, carries a `[high risk]` assumption, or a Revisit Trigger now true |
| `P2 later` | Single-surface, reversible, low blast radius |

Rules:

- Vague adjectives alone (`fast`, `intuitive`) cap at P1 — no `blocks X`,
  no P0.
- Auth/privacy items name the protected fact, its authority, and the read
  path — or stay P0 until they can.
- When signals conflict, pick the higher rank and say what holds it there.
- Tie-break: blocks implement > blocks plan > blocks tasks > isolated.

---

## Step 4 — Group by category

Use these fixed slugs so both this queue and the core taxonomy scan speak
the same language. The first ten map onto the core taxonomy; the last three
are deliberate-only:

| Triage slug | Covers |
|---|---|
| `scope` | Goals, out-of-scope, roles, personas |
| `data-model` | Entities, identity, lifecycle, scale |
| `product-ux` | Journeys, states, accessibility, localization |
| `nfr` | Performance, scalability, reliability, observability, security/privacy, compliance |
| `integration` | External services, formats, protocols, versions |
| `edge-cases` | Negative paths, throttling, conflicts |
| `constraints` | Technical constraints, tradeoffs, rejected alternatives |
| `terminology` | Glossary, synonyms, consistency |
| `completion` | Acceptance testability, measurable done signals |
| `placeholders` | TODO markers, unresolved stubs |
| `decisions` | Proposed / low-confidence DRs, triggered revisits |
| `execution` | Blocked `Txxx` tasks (dependency or owner missing) |
| `platform-signal` | Cross-feature scope — listed separately, ADR path, never scored as DR |

Notes:

- Tag auth/privacy items `[nfr/auth-privacy]` but count them under `nfr`.
- Failing checklist gates are requirements-quality items — categorize by
  their underlying taxonomy slug (not `execution`) and route to
  `__SPECKIT_COMMAND_CLARIFY__`, which re-validates
  `checklists/requirements.md` after every write.
- An item takes exactly one slug — the one matching its blocker, not every
  topic it touches.
- `platform-signal` items appear in their own sub-list with the ADR handoff
  shape from the routing reference; they take no P-rank.

---

## Step 5 — Report (the queue)

Emit exactly these three sections, bullet style. `compact` (default): cap
the board at ~7 bullets per rank. `full`: no cap, same sections.

### 1. Triage board

One line per item: rank id, slug, question, blocker, source, route.

```markdown
## Triage board — 7 open (2 P0 · 3 P1 · 2 P2)

- **P0-1** [nfr/auth-privacy] Who may read export rows? — blocks FR-012 + T020 (DR-009 Proposed, spec.md:44) → `__SPECKIT_COMMAND_DELIBERATE_RECORD__`
- **P0-2** [scope] Export in MVP or deferred? — blocks plan scope (spec.md:12, [NEEDS CLARIFICATION]) → `__SPECKIT_COMMAND_CLARIFY__`
```

P0 first, then P1, then P2. `platform-signal` items follow in a separate
sub-list with no P-rank. Never emit a rank without its `blocks X`.

### 2. By category

One bullet per non-empty category, referencing board ids:

```markdown
## By category

- **nfr (1):** P0-1 · **scope (2):** P0-2, P2-4 · **decisions (2):** P1-1, P1-3
```

Keep slugs exact — downstream passes match on them.

### 3. Resolution queue

Ordered head-first. Each step names its owning command plus a paste-ready
focus hint for that command's `$ARGUMENTS` — triage picks the category,
the owning command asks the questions. One item, one route — never
batch-capture:

```markdown
## Resolution queue

1. P0-1 → `__SPECKIT_COMMAND_DELIBERATE_RECORD__` — focus: `close DR-009, nfr/auth-privacy (P0-1, spec.md:44)`
2. P0-2 → `__SPECKIT_COMMAND_CLARIFY__` — focus: `scope, MVP boundary (P0-2, spec.md:12)`
```

Focus-hint shape: `<slug>[ /<sub-area>], <short question> (<board-id>, <source>)`.
`__SPECKIT_COMMAND_CLARIFY__` honors its input as prioritization context,
so pasting the hint continues clarifying by category without triage owning
a question loop.

Scope filters (`category:<slug>`, `impact:P0`) narrow all three sections to
the filter and add one line with the remaining totals
(e.g. `+ 4 more outside scope (1 P0 · 2 P1 · 1 P2) — re-run unfiltered for the full board`).

---

## Step 6 — Offer capture (never auto-capture)

End with one route per head item from the capture-routing reference at
`.specify/extensions/deliberate/docs/capture-routing.md` — do not run
multiple captures in one turn unless asked:

- Spec gap / marker / vague requirement → `__SPECKIT_COMMAND_CLARIFY__`
- Failing checklist gate → `__SPECKIT_COMMAND_CLARIFY__` (requirements-quality; clarify re-validates after every write)
- Proposed / low-confidence DR → `__SPECKIT_COMMAND_DELIBERATE_RECORD__`
- Platform-signal → ADR path from `platform_routing`, or chat report when unconfigured
- Blocked `Txxx` → `__SPECKIT_COMMAND_PLAN__` / `__SPECKIT_COMMAND_TASKS__`
- Want alternatives first → `__SPECKIT_COMMAND_DELIBERATE_EXPLORE__`
- Want the full brief → `__SPECKIT_COMMAND_DELIBERATE_RECAP__`

---

## Relationship to other commands

| Command | Difference |
|---|---|
| `__SPECKIT_COMMAND_CLARIFY__` | **Writes** answers into `spec.md`, max 5, hidden queue, spec-only — triage is the **visible cross-artifact queue** that routes *into* clarify; never asks its questions |
| `__SPECKIT_COMMAND_DELIBERATE_RECAP__` | **Flat** status brief — triage consumes its open items and adds impact rank + category + route |
| `__SPECKIT_COMMAND_DELIBERATE_EXPLORE__` | **Divergent** brainstorming with ≥2 options — use to open up; triage converges to a queue |
| `__SPECKIT_COMMAND_DELIBERATE_RECORD__` | **Writes** DR files — use after a queued decision item is answered |
| `__SPECKIT_COMMAND_ANALYZE__` | **Read-only** formal consistency audit — triage ranks actionability, not correctness |

**Typical flow:**

```
__SPECKIT_COMMAND_DELIBERATE_TRIAGE__  →  clarify / record (capture one)  →  __SPECKIT_COMMAND_DELIBERATE_TRIAGE__ (re-queue)  →  __SPECKIT_COMMAND_DELIBERATE_RECAP__
```

---

## Related

- Capture-routing reference: `.specify/extensions/deliberate/docs/capture-routing.md` — where head items go when the user exits triage
- Ledger reference: `.specify/extensions/deliberate/docs/ledger.md` — ledger row statuses triage groups by
- Routing reference: `.specify/extensions/deliberate/docs/routing.md` — DR vs ADR vs SKIP plus the platform firewall
- `__SPECKIT_COMMAND_CLARIFY__` — to close spec gaps triage surfaces
- `__SPECKIT_COMMAND_DELIBERATE_RECORD__` — to close queued decision items
- `__SPECKIT_COMMAND_DELIBERATE_RECAP__` — to brief the tree after the queue drains
