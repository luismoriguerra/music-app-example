# Decision: vii°/ii° diagram source — 36-entry curated Chords catalog

> Scope note: decided pre-spec in explore session 2026-09-17 (user decision, recorded in spec Clarifications); written as a DR in fast-follow converge because the `/speckit-deliberate-record` step was skipped at plan time.

## Status

**Accepted**

## Context

Every circle's diatonic table needs a seventh row (major) / second row (minor) that is a diminished triad — e.g. vii° B diminished in C major (FR-007), ii° B diminished in A minor (US4). The v1 Chords reference holds major/minor only (001: "Major and minor only" clarification, 24 entries), so the diminished diagram has no source.

**Question:** Where does the fingering diagram for the diminished (vii°/ii°) chord come from?

**Constraints that matter:**

- 006 FR-007/FR-012 — seven diatonic rows each with a fingering diagram; Chords reference covers diminished triads for all 12 pitches (36 entries, curated diagrams).
- 006 FR-014 — the content check fails when the Chords reference does not contain exactly 36 uniquely named entries or a diatonic row cannot resolve.
- 006 Edge Cases — a row MUST never be blank; a missing entry renders a placeholder AND fails the gate (missing is a ship-blocker, not a runtime state).
- 001 "Major and minor only" + SC-005 24-entry count — superseded by this decision (see 006 FR-017).

## Options Considered

- **Option A — Extend the Chords reference to 36 curated entries.** (chosen) One diminished entry per chromatic pitch (12 new JSON files, flat-first combined names, `type: "diminished"`), each with a curated fingering diagram held to the same standard as the existing 24. Diatonic rows resolve to these entries by pitch + quality.
- **Option B — Runtime-generated diagrams.** Render vii°/ii° via `generateChordDiagram("<root>dim")` without catalog entries. Rejected by the owner: the Chords topic is the course's single diagram authority, and generated-at-render shapes bypass curation, gate Rule 28, and the "same curated entries the Chords reference teaches" promise (US3).
- **Option C — Name-only diminished rows.** Show degree + name with no diagram (or a permanent placeholder). Rejected: breaks FR-007's every-row-has-a-diagram contract and teaches beginners a chord they cannot finger.

## Assumptions

- [low risk] Twelve new JSON entries (same shape as existing chords) need no schema migration beyond widening the `type` enum — validated by the existing collection wiring accepting the new files unchanged.
- [low risk] Generator seeds plus exhaustive-search hand review produce playable first-position shapes for all 12 roots — verified at authoring time (see R2 outcome); the gate (not eyeball) guarantees pitch correctness.
- [low risk] Flat-first combined naming ("Bb / A# diminished") extends the 001 convention without confusing the note filter — the filter already matches combined entries per spelling.

## Evidence

- `frontend/src/content/chords/*-diminished.json` (12 files: a, ab, b, bb, c, d, db, e, eb, f, g, gb) — curated entries, e.g. A diminished `[5,3,5,0]` and Ab diminished `[4,2,4,2]` after hand-review swaps.
- `frontend/src/lib/content/schemas.ts:105` — `chordSchema.type: z.enum(["major", "minor", "diminished"])`.
- `frontend/src/lib/notes.ts:80` — `CHORD_COUNT = 36` (single source of truth, renamed from `CHORD_COUNT_V1`).
- `frontend/src/lib/content/validate.ts:81-83` — Rule 4 (amended): exactly 36 uniquely named chords; `:93-98` — Rule 28 pitch-agreement gate with `diminished: [0, 3, 6]`; `:150-156` — Rule 29 diatonicity vectors including diminished.
- `frontend/tests/content.schemas.test.ts` — 36-entry fixtures + Rule 28/29 tests; `frontend/tests/chords.test.ts` + `frontend/tests/ChordList.test.tsx` — diminished filter/sort tier coverage.
- `specs/006-ukulele-circles-diatonic/research.md` R2 — seed + exhaustive-search hand-review outcome (10 seeds kept, A/Ab swapped; C/D/F are the unique span<=3 first-position voicings).
- `specs/006-ukulele-circles-diatonic/spec.md:15` — pre-spec owner decision this DR records.

## Decision

**Option A.** The Chords reference grows to 36 curated entries (major, minor, diminished × 12 pitches). Option B rejected: runtime generation dodges the catalog authority and its gates. Option C rejected: name-only rows break FR-007 and teach an unfingerable chord.

## Confidence

High — the owner chose the curated catalog pre-spec; all 12 entries ship with gate-verified diagrams (Rule 28), the 36-count is enforced by amended Rule 4, and US3 covers the Chords-explorer surfacing.

## Consequences

**Easier:** One diagram authority for the whole course (lesson progressions, circles, chords explorer all resolve to the same 36); the gate guarantees every vii°/ii° row renders a curated shape; US3 falls out as filter + sort tiers over the same data.
**Harder:** 001 must be converged (FR-007/FR-008/FR-017, Chord entity, SC-005, US3, clarifications) from 24 to 36 in the same increment (FR-017); every 24-pinning test/fixture needs the 36 update.
**Risks that remain:** Two diminished shapes (C, F) remain wide stretches — geometrically constrained (no muted strings per catalog precedent), mitigated by documenting the exhaustive-search result in R2.

## Revisit Trigger

Reopen if: the catalog adds a fourth triad quality (augmented/suspended) and the count contract needs re-basing, or learner feedback shows a diminished shape is unplayable despite the search-optimal claim.
