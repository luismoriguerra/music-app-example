# Decision record template — usage

## Canonical source (single copy)

**Always read and scaffold from:**

`.specify/extensions/deliberate/templates/decision-record-template.md`

Do **not** maintain a second full copy of the template anywhere else. The
record command reads the canonical file fresh every time — one edit updates
every workflow.

If the canonical file is missing, stop and tell the user to reinstall the
extension (`specify extension add deliberate`, a `--from <release-url>`
install, or a `--dev` checkout).

## Required sections (checklist)

Every DR file MUST include all of these headings, filled in:

| Section | Required content |
|---|---|
| `# Decision:` | Short title — the question in noun form |
| `## Status` | Accepted · Proposed · Superseded by DR-NNN · Rejected |
| `## Context` | Problem, constraints, **Question:** line, bullet constraints (FR/ADR) |
| `## Options Considered` | ≥2 options; mark chosen/rejected |
| `## Assumptions` | Tagged `[high|medium|low risk]` |
| `## Evidence` | ≥1 `file:line` or query/command result — no guesses |
| `## Decision` | Chosen option + why others rejected |
| `## Confidence` | High/Medium/Low + rationale |
| `## Consequences` | Easier / Harder / Risks that remain |
| `## Revisit Trigger` | Concrete conditions to reopen |

Hard fails (reject draft):

- Empty **Evidence** or **Revisit Trigger**
- **Question** missing or multi-question (one DR = one question)
- **Accepted** status without verified evidence
- Platform-scope decision written as DR instead of ADR

## DR vs ADR (from template comment block)

| Write here (DR) | Write to ADR log instead |
|---|---|
| Feature IA, verification method, feature sequencing | New rule or pattern constraining all features |
| This feature's product or access choice | New auth relation / platform data-lane rule |
| Superseding a feature assumption with measured data | Shared transport or contract for the platform |

See the routing reference for the full table.

## Scaffold command (optional)

From the project root after Step 2 allocates `DR-NNN-slug`:

```bash
FEATURE_DIR="<from check-prerequisites.sh>"
cp .specify/extensions/deliberate/templates/decision-record-template.md \
  "$FEATURE_DIR/decisions/DR-NNN-slug.md"
```

Then replace bracket placeholders and delete the HTML comment block at the top
once the DR is complete.
