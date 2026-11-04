# Decision: Scale detail surface — focus view + neck reference

## Status

**Accepted**

## Context

US3/FR-006 shipped the Scales detail as single-open inline expansion (one
portrait `ScaleDiagram` per open card). After implementation, the owner
asked (2026-09-16) for two changes: opening a scale hides the other entries
and shows the selected scale full-width, and the detail gains a landscape
12-fret neck reference for more context. Inline cards cannot host a
landscape neck map without cramping the 360px layout, so the detail surface
needs re-deciding while FR-011's first-position chart stays untouched.

**Question:** How should the Scales detail surface present the fingering chart and the 12-fret neck reference?

**Constraints that matter:**

- FR-006 (as amended) — full-width focus view with Back/Esc return; keyboard-operable and AT-exposed.
- FR-011 — each entry's fingering diagram stays a one-octave first-position fretboard chart (unchanged by this decision).
- SC-008 — detail renders at 360px with no horizontal scrolling.
- DR-002 — fretboard-chart visual stands; its revisit trigger was evaluated (see Decision) and did not fire as a supersession.

## Options Considered

- **Option A — Full-width focus view + neck reference.** (chosen) Selecting a scale hides list + filter and renders a full-width detail: notes/degrees/pattern, portrait `ScaleDiagram`, and a landscape `ScaleNeck` (frets 0–12, tonic filled, 1st-position badges); "Back to all scales" + Escape return to the list.
- **Option B — Inline expansion with stacked neck.** Keep single-open inline cards and stack the neck map under the portrait chart inside the open card. Rejected: the neck's landscape geometry collapses inside a list card and crowds the 360px layout the owner asked to open up.
- **Option C — Neck replaces the portrait chart.** One visual only (neck map), dropping `ScaleDiagram`. Rejected: the neck shows tones, not fingering order — beginners lose the numbered playing sequence FR-011 requires, and DR-002's chart work is discarded for no gain.

## Assumptions

- [low risk] Hiding the list while a detail is open does not hurt browse-and-compare; Back/Esc return is discoverable (the Back button is the first focusable element of the detail).
- [low risk] The neck map's tone dots (spelled from the entry's conventional notes) stay correct without new content fields — it derives from `notes` + `rootPitch` + 1st-position `order`.
- [medium risk] Two visuals per detail (chart + neck) stay readable at 360px; verified by the SC-008 quickstart re-check, not by a separate prototype.

## Evidence

- `frontend/src/components/ScaleList.tsx:67-147` — focus-view branch: list/filter hidden, `scale-detail` article with notes/degrees/pattern + `ScaleDiagram` + `ScaleNeck` + `scale-back` button.
- `frontend/src/components/ScaleList.tsx:39-46` — Escape key returns to the list; `ScaleList.tsx:76-83` — "Back to all scales" button.
- `frontend/src/components/ScaleNeck.tsx:39-51` — landscape 12-fret reference; tones spelled from the entry's conventional notes, tonic filled, 1st-position order badges.
- `frontend/tests/ScaleList.test.tsx:163-197` — focus-mode tests: detail renders with neck, Back returns to list, Enter opens / Escape closes.
- `frontend/tests/ScaleNeck.test.tsx:10-14` — neck renders one tone per scale note across frets 0–12.
- `specs/005-ukulele-scales-topic/decisions/DR-002-scale-diagram-visual.md:53-55` — revisit trigger evaluated: the neck is an additive tone map, not multi-position/movable fingering, and neither the 360px-failure nor the walkthrough-preference condition fired.

## Decision

**Option A.** Ship the full-width focus view with the portrait chart plus the 12-fret neck reference. Option B rejected: inline cards cannot host a landscape neck map at 360px without the cramping the owner asked to remove. Option C rejected: the neck teaches position, not playing order — dropping the numbered chart would break FR-011. DR-002 stands (no supersession): its chart is unchanged and its revisit trigger conditions were evaluated, not met.

## Confidence

High — the change is implemented, covered by island + neck tests, and directly requested by the owner; the only unproven element is 360px readability of the stacked chart + neck, covered by the SC-008 quickstart re-check.

## Consequences

**Easier:** Detail has room for both visuals; the neck reuses existing content fields (zero schema/content migration); Back/Esc is a simpler AT contract than per-card `aria-expanded` grids.
**Harder:** Spec/plan/quickstart/contracts each describe inline expansion and must be converged to focus-view in the same PR (spec.md Clarifications 2026-09-16, FR-006, US3, V3, plan summary/tree, routes + content-schema contracts, data-model UI state); list-compare now costs a Back navigation per scale.
**Risks that remain:** Learners mid-compare may find focus-view slower than scanning stacked inline cards — mitigated by keeping filter state across Back/Esc so the return lands on the same list.

## Revisit Trigger

Reopen if: the SC-003 task-based check shows learners failing to return to the list (Back/Esc undiscovered), or a lesson follow-up needs embedded inline diagrams and the focus-only surface cannot host them.
