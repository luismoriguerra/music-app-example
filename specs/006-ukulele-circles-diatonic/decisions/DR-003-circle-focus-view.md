# Decision: Circle detail surface — full-width focus view + diatonic table + neck reference

> Scope note: decided pre-spec in explore session 2026-09-17 (user decision, recorded in spec Clarifications) as "works like Scales"; written as a DR in fast-follow converge because the `/speckit-deliberate-record` step was skipped at plan time.

## Status

**Accepted**

## Context

US1/FR-004/FR-007/FR-011 ship the circle detail as a full-width focus view (list + filter hidden) carrying the circle's progression, scale notes, a seven-row diatonic table with diagrams, and a landscape 12-fret neck reference — mirroring the Scales topic (005 DR-006). The 003 contract it replaces is single-open inline expansion (003 FR-013): one open card inside the list, progression chords only, no room for a diatonic table or landscape neck.

**Question:** How is a selected circle shown?

**Constraints that matter:**

- 006 FR-004 — full-width focus view with "Back to all circles" + Escape return, filter preserved; keyboard-operable and AT-exposed. Supersedes 003 FR-013.
- 006 FR-007/FR-010 — seven diatonic rows with degree, name, diagram; circle chords marked.
- 006 FR-011 — landscape 12-fret neck reference of the key's scale tones, reusing the Scales presentation unchanged.
- 006 SC-007/FR-015 — focus view renders at 360px with no horizontal scrolling; loading/empty/error states preserved.
- 005 DR-006 — the Scales focus-view + neck precedent this decision clones (its revisit trigger evaluated below; no supersession).

## Options Considered

- **Option A — Full-width focus view + diatonic table + neck.** (chosen) Selecting a circle hides list + filter and renders a full-width detail: name/key/degrees, scale notes, seven-row diatonic table (degree, note, chord, diagram, in-circle mark), and the reused `ScaleNeck`; Back button + Escape return to the list with filter intact.
- **Option B — Inline expansion extended with diatonic rows.** Keep 003's single-open cards and stack seven diagram rows + neck inside the open card. Rejected: the diatonic table (seven diagrams) plus a landscape neck collapses inside a list card and breaks the 360px no-scroll contract the focus view was chosen to satisfy.
- **Option C — Separate circle route per key.** One address per circle instead of list+detail in one view. Rejected: 24 new addresses for content that is list-browsed by key/type/note, breaks filter-preserved return, and diverges from the Scales pattern the owner asked to mirror.

## Assumptions

- [low risk] Hiding the list while a detail is open does not hurt browse-and-compare; Back/Escape return is discoverable (Back is the first focusable element).
- [low risk] `ScaleNeck` reuses unchanged — it derives tone dots from the circle's scale notes + tonic pitch, needing no new content fields.
- [medium risk] Seven diagrams + neck stay readable at 360px; verified by the SC-007 quickstart re-check and the 360px container test, not by a separate prototype.

## Evidence

- `frontend/src/components/CircleList.tsx:7,38,61,87,101,132,156,197` — focus-view branch (list/filter hidden), Escape return, `diatonicChords()` rows, Back button, `diatonic-table` + `diatonic-row` test ids, reused `ScaleNeck`.
- `frontend/src/components/ScaleList.tsx` + `005/.../DR-006-scale-focus-view-neck-reference.md` — the cloned precedent (focus view + neck, Back/Esc contract); DR-006's revisit trigger evaluated: neither the return-failure nor the inline-lesson condition fired — no supersession.
- `frontend/tests/CircleList.test.tsx` — focus-mode tests (Back/Escape return, seven rows, neck, empty/loading/error, 360px stacking); `frontend/tests/CirclesTopic.test.ts` — container 360px no-overflow + 24-circle/36-chord integrity.
- `specs/006-ukulele-circles-diatonic/contracts/circles-view.md` — reworked explorer contract (grouped filter + focus view + neck).
- `specs/006-ukulele-circles-diatonic/research.md` R5 — focus-view rework mechanics; R4 — grouped filter parity.
- `specs/006-ukulele-circles-diatonic/spec.md:17` — pre-spec owner decision this DR records.

## Decision

**Option A.** Ship the full-width focus view with the diatonic table and neck reference. Option B rejected: inline cards cannot host seven diagrams plus a landscape neck at 360px. Option C rejected: per-circle routes break list browsing and the Scales parity the owner asked for. 005 DR-006 stands (no supersession): its surface is reused, its trigger conditions evaluated, not met.

## Confidence

High — implemented, covered by island + container tests, and directly requested by the owner ("works like Scales"); the only unproven element is 360px readability of the stacked table + neck, covered by the SC-007 quickstart re-check.

## Consequences

**Easier:** Detail has room for all seven diagrams + neck; the neck reuses existing fields (zero schema/content migration); Back/Esc is a simpler AT contract than per-card `aria-expanded` grids; Scales/Circles share one browse idiom.
**Harder:** 003 must be converged (FR-012/FR-013, US4, assumptions, out-of-scope) to the new contract in the same increment (FR-018); list-compare now costs a Back navigation per circle.
**Risks that remain:** Learners mid-compare may find focus-view slower than scanning stacked inline cards — mitigated by keeping filter state across Back/Esc so the return lands on the same list.

## Revisit Trigger

Reopen if: the SC-002 task-based check shows learners failing to find the diminished row or return to the list (detail undiscoverable), or a lesson follow-up needs embedded inline circle diagrams and the focus-only surface cannot host them.
