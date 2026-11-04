# DR vs ADR vs SKIP — routing

Use this table before allocating a DR number. When in doubt, prefer **DR** for
anything that only changes *this feature's* spec/plan/tasks/UI copy, and **ADR**
for anything that would constrain *other features* or the shared platform model.

The `platform_routing` section of `deliberate-config.yml` extends this table:
`platform_signals` adds project-specific ADR signals and `adr_command` names the
command owning the ADR path. With both empty, platform-scoped findings are
reported in chat instead of delegated.

## Write a DR (feature-local)

| Signal | Example |
|---|---|
| Information architecture for this feature only | Dedicated view vs section on the page |
| How this feature verifies a success criterion | Manual observation vs test assertion |
| Sequencing gate for this feature only | Audit-before-implementation gate |
| Product choice among safe options | counts-only vs defer vs gate-on-viewer for **this** surface |
| Data/model choice scoped to this feature | Join strategy for this feature's models |
| Superseding an earlier **feature** assumption with new evidence | DR-015 supersedes DR-007 |
| Shared-code scope for this feature | Extend the shared helper; defer repo-wide migration |

## Route to ADR (platform)

| Signal | Action |
|---|---|
| New cross-feature access or data rule | ADR path |
| New shared transport/contract used by multiple services | ADR path |
| New relation or type in the shared authorization model | ADR path |
| A data lane may serve a class of data platform-wide | ADR path |
| Navigation or UX rule affecting all surfaces | ADR path |
| Any `platform_signals` entry from config | ADR path |

**Handoff shape:**

> This gap is platform-scoped, not feature-local. Stopping DR creation. Run
> `<adr_command>` on [change ref] for NEW/SUPERSEDE items — or record it in the
> project ADR log when no command is configured.

## SKIP

| Signal | Why skip |
|---|---|
| Pure implementation detail already in plan.md | No open question |
| Duplicate of an existing Accepted DR | Link existing DR instead |
| Typo / naming preference | Not a decision record |
| Unverified guess | Gather evidence first or mark DR `Proposed` with explicit unknowns |

## Inputs from other commands

| Source | Signal | This command action |
|---|---|---|
| `speckit.analyze` | Finding needing a decision | `create` DR + optional task |
| Project audit/review | Feature-local gap | `create` or `batch` DR |
| Project audit/review | Platform gap | ADR path |
| Project audit/review | Already resolved | Usually SKIP |
