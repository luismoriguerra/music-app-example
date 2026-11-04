# Research: Ukulele Scales Topic

**Feature**: `005-ukulele-scales-topic` | **Date**: 2026-09-16
**Spec**: [spec.md](./spec.md) | **Decisions**: [DR-001–DR-005](./decisions/DR-001-scales-topic-shape.md)

Phase 0 output. Every Technical Context unknown is resolved below as
Decision / Rationale / Alternatives considered. No NEEDS CLARIFICATION remains.
Pre-spec deliberation (DR-001–DR-005) settled shape, visual, identity, minor
scope, and spelling; this research validates the two plan-time gates the DRs
left open (R2 spelling-table validation, R4 360px prototype) and records the
mechanical design choices.

**Domain scope**: Major scales (W–W–H–W–W–W–H) and natural minor scales
(W–H–W–W–H–W–W) only (DR-004). Harmonic/melodic minor appear at most as
unnamed prose, never as diagrammed entries. All fingerings assume standard
ukulele tuning G–C–E–A, one octave, first position (FR-011).

---

## R1. Scale content model (new collection + schema)

- **Decision**: New `scales` Content Layer collection (`frontend/src/content/scales/*.json`,
  24 files) validated by a new `scaleSchema`: identity fields cloned from
  `chordSchema` (`name`, `type: "major" | "minor"`, `root`, `rootAlias?`,
  `rootPitch`, `topicSlug`) plus scale content fields — `notes: string[8]`
  (playing order incl. octave), `degrees: string[8]` (e.g.
  `["1","2","3","4","5","6","7","8"]`), `intervals: string` (the pattern,
  e.g. `"W-W-H-W-W-W-H"`), `displaySpelling: string` (the tonic the notes
  are spelled from, e.g. `"C#"` for the "Db / C# minor" entry), and
  `diagram: scaleDiagramSchema` (`strings: "GCEA"`, `positions: [{ string:
0-3, fret: int >= 0, order: 1-8 unique, finger: 0-4 }]`, `baseFret`
  default 1, `positionLabel` e.g. `"1st position"`).
- **Rationale**: A dedicated collection keeps scales queryable and
  validatable independently of chords (unlike 003's derived circles, scales
  are authored content with no lesson to derive from). Cloning the chord
  identity shape reuses the filter/sort/naming convention (DR-003) while
  the new content fields carry exactly what FR-006 renders. Eight notes
  (seven degrees + octave) is the standard taught sequence — corroborated
  by pedagogy references listing "seven notes (eight if you include the
  octave note)" (ukuleletricks.com C-major position guide).
- **Alternatives considered**:
  - Embed scales in the topic JSON (like 003's lesson) — rejected: 24
    entries × notes + positions would make one unreviewable file; per-entry
    files match the chords precedent and keep diffs/audits local.
  - Derive scales from a generator (intervals + tonic at build) — rejected:
    note _names_ need the conventional-spelling table anyway and fingerings
    are hand-authored; generation would hide content behind code.
  - Reuse `chords` collection with a kind flag — rejected: different
    content shape (notes/positions vs frets/fingers tuple); mixing breaks
    the Rule-4 exact-count gate and every chord query.

## R2. Spelling-table validation (REQUIRED gate — resolved)

- **Decision**: The spec Appendix table is VALIDATED — all 24 rows confirmed
  against music references on 2026-09-16. Eb minor keeps the flat spelling
  (Eb F Gb Ab Bb Cb Db, 6 flats, relative Gb major) — no overturn. The
  table ships as a normative `SPELLING_TABLE` constant in pure
  `lib/scales.ts`, keyed by `(rootPitch, type)` → `{ displaySpelling,
notes[8] }`, and validate rule 25 gates every entry's `notes[]` against
  it (exact match), plus a never-double-accidental rule.
- **Rationale**: Validation method was relative-major key-signature
  cross-check plus direct reference lookup. Results:
  - C# natural minor = C# D# E F# G# A B (4 sharps, relative E major) —
    confirmed by theorypractice.app (C# minor key-signature degree table),
    interactivechordfinder.com, and piano-keyboard-guide.com (all three
    give identical 8-note sequences incl. octave).
  - F# natural minor = F# G# A B C# D E (3 sharps, relative A major) —
    confirmed by en.wikipedia.org/wiki/F-sharp_minor (component pitches)
    and muted.io (degree table); muted.io explicitly lists the Gb-minor
    enharmonic (Gb Ab Bbb Cb Db Ebb Fb) with double-flats, confirming the
    theoretical-key defect DR-005 avoids.
  - G# natural minor = G# A# B C# D# E F# (5 sharps, relative B major) —
    confirmed by the key-signature circle (B major row) and search
    synthesis; Wikipedia's key table places g# minor at 5 sharps.
  - Db minor and Gb minor as flat keys are theoretical (8-double-flat /
    double-flat rows on Wikipedia's key table) — confirms respelling to
    C#/F# is required, not stylistic.
  - All 12 major rows are standard key spellings (Db 5b, Eb 3b, Gb 6b
    with diatonic Cb 4th, Ab 4b, Bb 2b + naturals/sharps) — no row
    contains a double accidental; Gb major's Cb is the correct diatonic
    4th, not a defect.
  - Eb minor (6 flats) vs D# minor (6 sharps): no reference prefers D#;
    flat-side default stands for display-name consistency.
- **Alternatives considered**:
  - Flat-first-everywhere spelling — rejected (DR-005 Option B): ships
    theoretical keys with double-flats.
  - Defer validation to content authoring — rejected: the table is the
    gate's oracle; validating now (before tasks) means authoring starts
    from a locked table.

## R3. Topic view dispatch (new format value + route branch)

- **Decision**: Extend the topic `format` discriminator with `"scales"`
  (`z.enum(["reference", "lesson", "circles", "scales"])`, default still
  `"reference"`). The topic route gains a fourth branch: `format: "scales"`
  collects the topic's scales (`topicSlug` match, like chords) plus the
  normative spelling table and renders the `ScaleList` island. The Scales
  topic entry is `{ title: "Scales", slug: "scales", kind: "topic",
courseSlug: "ukulele", format: "scales", order: 3 }`.
- **Rationale**: This is the corrected DR-001 sizing: the route's default
  branch renders `ChordList` over chords-by-topicSlug (else the "No chords"
  empty state), so a scales explorer needs its own format value and branch
  — the honest precedent is 003's `circles` addition (R9 there), not a
  file-for-file Chords clone. Data-driven dispatch keeps the rule: future
  reference topics need only content + format, no view conditionals.
- **Alternatives considered**:
  - Default `format: "reference"` with scale entries in `chords/`
    — rejected: would render `ChordList` (wrong island) and corrupt the
    Rule-4 24-chord gate; the original DR-001 error, corrected pre-push.
  - Slug-conditional dispatch (`if slug === "scales"`) — rejected (same as
    003 R3): magic string in view code, breaks content-only extensibility.

## R4. Scale diagram component + 360px prototype (gate — resolved as plan)

- **Decision**: New `ScaleDiagram` React component (SVG, prop-driven like
  `ChordDiagram`): 4-string × N-fret grid, one numbered dot per position in
  playing order (`order` 1–8 rendered inside the dot), open-string marks
  for fret-0 positions, position label caption, null-safe guard rendering
  the FR-015 placeholder when `diagram` is absent. The DR-002 360px
  prototype gate is satisfied by construction + test: the SVG uses a
  `viewBox` that scales down like `ChordDiagram` (fixed 96×120 units), and
  the container test renders an expanded entry at 360px viewport width
  asserting no horizontal overflow (SC-008) — this runs in implement as the
  first component task, before the 24 entries are authored, so a failure
  still blocks authoring.
- **Rationale**: Grounded in the standard first-position C-major fingering
  (ukulelesunanimous.com + liveukulele.com reference charts, mutually
  consistent tab: A|--0--2--3--, E|--0--1--3-- (or E open for the 3rd),
  C|--0--2--): 8 ordered positions across strings 1–3, frets 0–3, one
  finger per fret (fret→finger 1:1, open→0) — exactly the
  `{string, fret, order, finger}` shape R1 defines. Numbered dots extend
  the shipped `ChordDiagram` idiom (4-string grid, null-safe `isValid`)
  to sequences without inventing a new visual language.
- **Alternatives considered**:
  - Tab/ASCII text rendering — rejected (DR-002 Option B): no visual
    parity with the Chords/Circles cards beside it.
  - Per-note chord-shape diagrams — rejected (DR-002 Option C): 8 shapes
    per entry destroys the sense of sequence.
  - Standalone prototype page before tasks — rejected: the component +
    overflow assertion IS the prototype; a throwaway page adds process
    without evidence.

## R5. Backend role

- **Decision**: No backend involvement — zero feature traffic, no
  `backend/` changes, no migration, no new endpoint. Same posture as
  001/003.
- **Rationale**: Scales are static curated content with anonymous reading;
  no dynamic state exists to justify backend work.

## R6. LLM / model selection

- **Decision**: No hosted inference in this feature — no agents, chat,
  search, tagging, or recommendations ship. No model is chosen and no
  `openrouter-model-eval` run is required; this section is the decision
  record Principle V requires ("no model selected, nothing to evaluate").
- **Rationale**: Reading a static scale reference needs no LLM; adding one
  would be scope creep. Consistent with 001/003 R6.

## R7. Testing strategy

- **Decision**:
  - Frontend (Vitest, existing setup): scale schema fixtures (one valid
    entry + invalid: missing `notes`, notes/degrees length mismatch,
    invalid `displaySpelling`, positions order dup/gap, fret out of range,
    unknown topicSlug); spelling-table tests (24 rows present, no
    double-accidentals, C#/F#/G# minor sharp-side, Eb-minor flat default);
    filter/sort tests (clone of the chords contract: all/type/note,
    enharmonic match, major-first); `validateCollections` tests (dangling
    scale topicSlug, count ≠ 24, dup name, dup (rootPitch,type), unmatched
    spelling, spelling-table mismatch naming the entry); jsdom island
    tests (grouped dropdown, single-open expansion, empty + error states);
    diagram tests (8 numbered dots in order, open marks, placeholder on
    null); container tests (route branch renders ScaleList for the scales
    topic, reference/lesson/circles topics unchanged, 360px no-overflow
    assertion, content-integrity over the real JSON: scales topic exists,
    24 entries, all spellings gate-clean).
  - Backend (pytest): untouched — no backend change, existing suite must
    stay green.
  - Validation: `quickstart.md` scenarios map 1:1 to user stories and run
    via `npm run dev` + Vitest + `npm run check-content`.
- **Rationale**: Satisfies Principle III (test-first) with the idiomatic
  runner; schema + table + resolver + container tests give the scales
  explorer the same contract safety the Chords/Circles explorers have.
- **Alternatives considered**:
  - Playwright E2E — deferred (same as 001/003): unit + schema +
    quickstart covers the static-content risk surface without flake/CI cost.

## R8. Fingering authoring (first-position one-octave)

- **Decision**: Author all 24 fingerings in `{string, fret, order, finger}`
  form at implement time, seeded from standard first-position ukulele scale
  boxes (C-major ground truth above; remaining keys follow the same
  one-finger-per-fret open-position convention), then hand-verify each
  against the note sequence (string+fret pitch MUST equal the spelled note
  pitch-class) in the pre-release content audit (SC-005 covers spelling;
  the audit covers fingering pitch agreement).
- **Rationale**: Fingerings are content, not code — but pitch agreement is
  machine-checkable: open strings G=7, C=0, E=4, A=9 (pitch classes, C=0)
  plus fret offset, mod 12, MUST equal `ROOT_PITCH[note]` per position.
  Encoding this as validate rule 26 (or a content-integrity test if
  validate stays name-level) turns "wrong fingerings ship as
  confident-looking charts" (DR-002 residual risk) into a build failure.
- **Alternatives considered**:
  - Tab-only content without pitch check — rejected: leaves the DR-002
    residual risk unmitigated.
  - Multi-position boxes in v1 — rejected (DR-001/FR-011): first-position
    one-octave is the smallest auditable increment.

## R9. Reuse map (what clones, what is new)

- **Decision**: Clone interaction logic, build content plumbing new —
  - CLONE (logic): grouped filter groups + `filterChords`/`sortChords`
    semantics → `lib/scales.ts` (`FILTER_GROUPS` labels differ: "All
    scales"); single-open expansion + `aria-expanded`/`aria-controls` +
    count badge + empty/error states → `ScaleList` (same a11y contract);
    SVG grid + null-safe guard → `ScaleDiagram`.
  - NEW (plumbing): `scaleSchema` + `scaleDiagramSchema`, `scales`
    collection wiring, `[topic].astro` scales branch, validate rules
    19–26, `check-content.ts` scales loading, 24 JSON entries, spelling
    table constant.
- **Rationale**: This is the corrected DR-001/DR-003 sizing in one place:
  the 003 circles precedent (new format + branch + island + rules) is the
  work shape; only the _interaction semantics_ port unchanged.
- **Alternatives considered**:
  - Genericize ChordList/ChordDiagram with type params — rejected: chords
    and scales differ in content shape (static shape vs ordered sequence)
    and detail content (notes/degrees/intervals vs name/type/root);
    parameterization would couple two references for no consumer benefit.

## Toolchain pins (verified 2026-09-16)

- Reuse the 001/003 scaffold: Node 22, Astro 7.x, React 19 islands,
  Tailwind CSS v4, Vitest 5 + Testing Library, ESLint 9 + Prettier,
  `tsx` check-content runner. Zero new dependencies for this feature.
