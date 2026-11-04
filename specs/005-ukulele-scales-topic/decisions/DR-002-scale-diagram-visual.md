# Decision: Scale diagram visual

> Scope note: decided pre-spec under `004-lyrics-chords-generator` (active feature at the time); moved to `005-ukulele-scales-topic` on 2026-09-16 when the Scales spec was created.

## Status

**Accepted**

## Context

Every Chords/Circles entry renders a fingering diagram, and DR-001 commits Scales to the same explorer pattern — but chord diagrams show one static hand shape while a scale is an ordered note sequence across strings and frets. No scale visual exists in the repo, so the format decision blocks both content authoring (what fields each entry carries) and component design.

**Question:** How should a scale's ukulele fingering be visualized?

**Constraints that matter:**

- `001` FR-007/FR-010 — every entry shows its diagram; inline expansion is the detail surface (adapted from chords to scales).
- `001` FR-016 — empty/error states apply to the diagram slot too (an undiagrammable scale must degrade, never break the list).
- Principle VIII (layering) — pure `lib/` helpers plus a React island; no Astro imports in the diagram logic (see existing `zero Astro imports` precedent in `004` tasks).

## Options Considered

- **Option A — Fretboard-chart SVG.** (chosen) New `ScaleDiagram` component: 4 strings × N frets grid, numbered dots in playing order, open/muted string marks, position label — the `ChordDiagram` SVG idiom extended to sequences.
- **Option B — Tab/ASCII text.** One-line-per-string fret numbers rendered as text.
- **Option C — Per-note chord-shape diagrams.** One mini chord shape per scale degree (7–8 shapes per entry).

## Assumptions

- [medium risk] First-position one-octave fingerings suffice for v1; movable multi-position charts are a later increment.
- [low risk] The SVG approach scales down to the 360px viewport like `ChordDiagram` does.
- [low risk] Numbered playing order reads clearly to beginners without a legend beyond the entry's degree labels.

## Evidence

- `frontend/src/components/ChordDiagram.tsx:1-23` — shipped SVG precedent: 4-string grid, null-safe `isValid` guard, prop-driven (`name`, `diagram`) — the exact idiom Option A extends.
- `frontend/src/components/ChordList.tsx:100-172` — list + single-open inline expansion with empty state; the diagram slot this decision fills.
- `specs/001-music-course-catalog/spec.md:124-126` — entries with missing diagrams still render with a placeholder rather than breaking the list (the degradation rule Option A inherits).

## Decision

**Option A.** Build the fretboard-chart SVG. Option B rejected: text tab has no visual parity with the Chords/Circles cards beside it and tests weaker with beginners who navigate by shape, not numbers. Option C rejected: 7–8 shapes per entry is visual noise and destroys the sense of sequence a scale exists to teach.

## Confidence

Medium — the SVG precedent is strong and the degradation rule is settled, but a sequenced chart is still a new component that needs a plan-time prototype to prove readability at 360px.

## Consequences

**Easier:** Visual parity across Chords/Circles/Scales; the component is reusable inline when the lesson follow-up lands; content fields (positions array) are validatable by schema + content gate.
**Harder:** New component + tests + entry fields to author for all 24 entries (see DR-003); fingering correctness needs a content audit.
**Risks that remain:** Wrong fingerings ship as confident-looking charts — mitigated by a pre-release audit mirroring `003` SC-004/SC-005 (zero dangling references, every diagram verified).

## Revisit Trigger

Reopen if: the plan-time prototype fails the 360px render or the owner walkthrough prefers tab, or multi-position/movable shapes enter scope and outgrow the single-chart format.
