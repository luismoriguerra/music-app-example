# Decision: Diatonic derivation from the Scales spelling table — no circles collection

> Scope note: decided pre-spec in explore session 2026-09-17 (user decision, recorded in spec Clarifications); written as a DR in fast-follow converge because the `/speckit-deliberate-record` step was skipped at plan time.

## Status

**Accepted**

## Context

Each circle's focus view must show all seven diatonic chords of its key in scale order (FR-007), with theory-correct spellings (FR-006/FR-009: Gb major's IV labels "Cb" while the diagram comes from "B major"). The lesson progressions remain the single source of which circles exist (FR-001, 003 single-source assumption), so the seven rows need a source that is not a second authoring surface.

**Question:** Where do a circle's seven diatonic chords come from?

**Constraints that matter:**

- 006 FR-008 — derived from the key's scale notes + fixed triad-quality pattern, never hand-authored per circle, never stored as a separate collection; each row resolves to the Chords-reference entry with the same pitch and quality.
- 006 FR-001 — lesson progressions stay the single source of which circles exist.
- 006 Edge Cases — the Cb case MUST render (spelling "Cb", chord "B major"), never a blank row; non-diatonic progression chords MUST fail the gate (Rule 29).
- 005 DR-005 — the Scales `SPELLING_TABLE` (24 rows) is the course's conventional-spelling oracle; this decision reuses it as-is.

## Options Considered

- **Option A — Pure derivation from the spelling oracle + quality vectors.** (chosen) `diatonicChords(circle, catalog)`: pitch from `ROOT_PITCH[circle.key]`; notes from `SPELLING_TABLE[pitch/type]`; qualities major `[M m m M M m dim]` / minor `[m dim M m m M M]`; each row resolves by pitch class (`SPELLING_PITCH[note]`) + quality to the catalog entry. `inCircle` by exact-name membership in `circle.chords`.
- **Option B — Hand-authored `diatonic[]` per progression.** 24 × 7 hand-typed strings in lesson JSON. Rejected: typo-prone for zero benefit when a gate-validated spelling oracle already exists; every spelling fix would need 2+ edits.
- **Option C — New `circles` collection mirroring `scales/`.** Rejected: breaks 003's single-source assumption (lesson progressions), adds a drift gate for content that is computable, and duplicates the key-type/mode discriminator.
- **Option D — Resolve via `matchCatalogChord` name matching.** Rejected: it matches root spellings (`entry.root === root`), so "Cb" misses "B" — the Cb case needs a special case under name matching and none under pitch matching (83/84 vs 84/84 across all major keys during explore verification).

## Assumptions

- [low risk] Pitch-class resolution is exact for all 24 keys — verified 84/84 major-key cells at explore time; minor keys reuse the same oracle rows the Scales topic ships.
- [low risk] Importing `SPELLING_TABLE` from `lib/scales.ts` creates no cycle — `scales.ts` never imports `circles.ts` (pure→pure import).
- [low risk] Unresolvable rows (`chord: null` → placeholder) never ship — forbidden by gate Rule 29, so the null path is crash-safety only.

## Evidence

- `frontend/src/lib/circles.ts:124-147` — `diatonicChords()` (oracle import `:9`, pitch lookup `:139`, pitch+quality resolution `:147`); `:63` — `CIRCLE_FILTER_GROUPS` stays separate from derivation.
- `frontend/src/lib/scales.ts:24` — `SPELLING_TABLE` oracle (24 rows, reused as-is); `frontend/src/lib/notes.ts:53` — `SPELLING_PITCH` pitch-class map.
- `frontend/src/lib/content/validate.ts:150-156` — Rule 29 diatonicity vectors (major/minor quality patterns).
- `frontend/tests/circles.test.ts` — derivation tests (C-major seven rows, A-minor seven rows, Cb→B resolution, `inCircle` marking).
- `specs/006-ukulele-circles-diatonic/research.md` R1 — pitch-vs-name verification (83/84 → 84/84), import-direction check, rejected-options analysis.
- `specs/006-ukulele-circles-diatonic/spec.md:16` — pre-spec owner decision this DR records.

## Decision

**Option A.** Derive every diatonic row from the Scales spelling oracle plus the fixed quality/degree vectors, resolving by pitch class + quality. Options B/C rejected: hand-authoring and a new collection both duplicate computable truth and break the single-source contract. Option D rejected: name matching cannot survive the Cb case without special-casing.

## Confidence

High — derivation is implemented, unit-tested per key type, and gate-enforced (Rule 29); the Cb edge is covered by both a unit test and the FR-009 contract.

## Consequences

**Easier:** Zero new content fields or collections; spelling fixes land once in `scales.ts` and propagate to circles; the gate (Rule 29) proves every progression chord is diatonic at build time.
**Harder:** Circles now depend on the Scales module's oracle — a Scales spelling change can move circle rows (mitigated: that is the intent — one spelling truth — and Rule 29 + unit tests catch regressions).
**Risks that remain:** Enharmonic display ("Cb" label vs "B major" chord) may confuse beginners — mitigated by FR-009's dual display (spelling as note label, catalog name with diagram).

## Revisit Trigger

Reopen if: the course teaches harmonic/melodic minor diatonic sets (new quality vectors + spelling rows), or a non-derived circle (borrowed chords, secondary dominants) needs rows the oracle cannot produce.
