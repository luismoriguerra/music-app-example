# Capture routing — exit explore → formalize

Explore mode **never** writes. When the user is ready to capture, they must
**explicitly** name a command or say "exit explore and …". Offer one row from
this table — do not run multiple captures in one turn unless asked.

(Command names below use the canonical `speckit.*` dotted form; the agent
renders them in its own invocation syntax.)

## Insight → command mapping

| Insight type | Capture with | Writes to |
|---|---|---|
| New/changed requirement | `speckit.clarify` or `speckit.specify` | `spec.md` |
| Feature-local decision (chosen option) | `speckit.deliberate.record` | `decisions/DR-NNN-*.md` + spec ledger |
| Supersede existing DR | `speckit.deliberate.record` (supersede mode) | New DR + update old status |
| Technical approach / research | `speckit.plan` | `plan.md`, `research.md`, `data-model.md`, `contracts/` |
| Task breakdown | `speckit.tasks` | `tasks.md` |
| Cross-artifact consistency check | `speckit.analyze` | Report only (then DR/clarify if gaps) |
| Status brief (decided/open/next) | `speckit.deliberate.recap` | Report only (chat) |
| Uncertainty queue (impact/category/routes) | `speckit.deliberate.triage` | Report only (chat) |
| Platform-wide rule | Project ADR workflow (see `platform_routing` in `deliberate-config.yml`) | Project ADR log |
| Application code | `speckit.implement` | Source tree (never from explore directly) |

Projects MAY append their own rows (e.g. a privacy-audit command, an ADR-review
command) in a local overlay — do not fork this file for that.

## DR vs ADR (quick routing)

| If the insight… | Route to |
|---|---|
| Affects only this feature's UX, copy, verification method | DR via `speckit.deliberate.record` |
| Changes how any feature may behave or what the platform allows | ADR via the project ADR workflow |

## Offer phrasing (examples)

- "That sounds like a **DR-worthy** product choice. Exit explore and run the record command?"
- "This is a **new requirement** — clarify can encode it in spec.md."
- "This looks **platform-wide** — route it to your ADR workflow instead of a DR?"
- "Ready to **plan**? Run the plan command when you're done exploring."

## What explore must not offer as "capture"

- Auto-editing `spec.md`, `tasks.md`, or `decisions/` inline during explore
- `speckit.implement` without a completed spec/plan/tasks chain
- Commits or PR preparation — wrong phase

## Greenfield (no `specs/NNN-*` yet)

| Stage | Next command |
|---|---|
| Idea solid enough to name | `speckit.specify` (after branch setup, e.g. `speckit.git.feature` when installed) |
| Still fuzzy | Stay in explore |
