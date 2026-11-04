# spec.md Decision records ledger

The **`decisions/` directory has no index**. The canonical index is a markdown
table in `spec.md` under the configured ledger heading (default
`### Decision records` — see `ledger_heading` in `deliberate-config.yml`).

## Locate or create the section

1. Grep `spec.md` for the ledger heading.
2. If missing, add it after the requirements/user-stories section (or wherever
   the project's spec template puts cross-cutting records):

```markdown
### Decision records

| Record | Settles | Status |
|---|---|---|
```

3. Optional: a one-line footnote when the feature adopted DRs mid-flight
   (e.g. "DR-004+ recorded after the analysis pass; earlier choices predate the ledger").

## Row format

Three columns: link text `DR-NNN`, one-sentence settles summary, status.

| Status text | When |
|---|---|
| `Accepted` | Evidence-backed, default for shipped decisions |
| `Proposed` | Draft; not yet approved |
| `**Superseded by DR-NNN** — one-line why` | Old row when a new DR replaces it |
| `Accepted — supersedes DR-00y` | New row that closes a prior record |
| `Rejected` | Considered and explicitly declined |

## Supersession edits

When DR-NEW supersedes DR-OLD:

1. Add row for DR-NEW with status noting supersession.
2. **Update DR-OLD's row** Status column — do not remove the row.
3. Edit `decisions/DR-OLD-*.md` status header (see the record command Step 3).
4. Optional: add `(supersedes DR-OLD)` in DR-NEW Context.

## Ordering

Keep rows in **numeric DR order** (DR-001, DR-002, …). Insert new rows in sequence.

## Verification

After edit:

```bash
rg 'DR-0[0-9]+' "$FEATURE_DIR/decisions/" -l | wc -l   # files
rg '\| \[DR-' "$FEATURE_DIR/spec.md" | wc -l            # ledger rows (approx)
```

Every `decisions/DR-*.md` except `Rejected` should appear in the ledger.
