# Decision: [SHORT TITLE — the question this record settles]

<!--
  A Decision Record (DR) captures a FEATURE-SCOPED decision. It lives at
  specs/NNN-feature-name/decisions/DR-00x-short-slug.md and is numbered sequentially per feature.

  DR vs ADR:
  - DR  — decision that only affects THIS feature. Author it here.
  - ADR — a cross-cutting platform decision (a rule, pattern, or model change that constrains
          other features). Those go in your project's ADR log — see the routing reference at
          .specify/extensions/deliberate/docs/routing.md instead of writing them here.

  Fill every section — the Evidence and Revisit Trigger sections are what make a DR trustworthy later.
-->

## Status
**[Accepted | Proposed | Superseded by DR-00y (DATE) | Rejected]**

<!-- If superseded, add a short blockquote here explaining WHY, and keep the body for history. -->

## Context
[The problem and the constraints that bind it. State the authoritative rule/requirement (cite the FR,
SC, ADR, or constitution principle). If this is an authorization/privacy decision, name the protected
**fact**, its **authority** (who/what grants access), and the **read path** in question.]

**Question:** [The single decision this record settles, phrased as a question.]

**Constraints that matter:**
- [e.g. FR-0xx — the constraint it imposes]
- [e.g. ADR-0007 — the platform rule this must respect]

## Options Considered
- **Option A — [name].** [What it does.] **(chosen / rejected)**
- **Option B — [name].** [What it does.]
- **Option C — [name].** [What it does.]

## Assumptions
- [high risk] [An assumption that, if wrong, breaks the decision.]
- [medium risk] [...]
- [low risk] [...]

## Evidence
<!-- What you actually verified, with file:line or query/command results — not what you assume. This is the
     difference between a decision and a guess. -->
- [file:line — what it shows]
- [command/query — result]

## Decision
**Option [X].** [The decision, stated plainly, with the reason each rejected option was rejected.]

## Confidence
[High | Medium | Low] — [why; what the confidence rests on.]

## Consequences
**Easier:** [what this makes simpler.]
**Harder:** [what this makes harder or what it depends on.]
**Risks that remain:** [residual risk + its mitigation.]

## Revisit Trigger
Reopen if: [the concrete conditions — a new writer/consumer appears, monitoring shows X, a constraint is
relaxed, a new capability becomes available — under which this decision should be re-examined.]
