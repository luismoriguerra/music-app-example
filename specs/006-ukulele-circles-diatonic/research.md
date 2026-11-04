# Research: Ukulele Circles — Diatonic Harmony Focus View

**Feature**: `006-ukulele-circles-diatonic` | **Date**: 2026-09-17
**Spec**: [spec.md](./spec.md)

Phase 0 output. Every Technical Context unknown is resolved below as
Decision / Rationale / Alternatives considered. No NEEDS CLARIFICATION remains.
Pre-spec deliberation settled the four scope questions (36-entry catalog,
spelling-table derivation, focus view + neck, major + minor); this research
records the mechanical design choices that make those decisions buildable.

**Domain scope**: Diatonic triads of the major scale (I ii iii IV V vi vii°)
and the natural minor scale (i ii° III iv v VI VII) only. Seventh chords,
harmonic/melodic minor, and non-diatonic harmony are out of scope. All
fingerings assume standard ukulele tuning G–C–E–A (open pitch classes 7, 0,
4, 9 with C = 0).

---

## R1. Diatonic derivation contract (pure function, no new collection)

- **Decision**: New pure `diatonicChords(circle, catalog)` in
  `frontend/src/lib/circles.ts` (importing the `SPELLING_TABLE` oracle from
  `lib/scales.ts` and `SPELLING_PITCH` from `lib/notes.ts`):
  1. Pitch = `ROOT_PITCH[circle.key]`; spelling row =
     `scaleSpelling(pitch, circle.type)`; notes = row's first 7 entries.
  2. Quality vector: major → `[major, minor, minor, major, major, minor,
     diminished]`; minor → `[minor, diminished, major, minor, minor, major,
     major]`. Degree labels: major → `I ii iii IV V vi vii°`; minor →
     `i ii° III iv v VI VII`.
  3. Each row resolves to the catalog entry with the same **pitch class**
     (`SPELLING_PITCH[note]`) and quality — never by name string. The row
     carries both the scale spelling (note label, e.g. "Cb") and the catalog
     entry (chord name + diagram, e.g. "B major") per FR-009.
  4. `inCircle` = whether the resolved catalog name appears in
     `circle.chords` (exact-name match, same semantics as
     `resolveCircleChords`).
  5. Unresolvable rows map to `chord: null` and render the
     diagram-unavailable placeholder without crashing (same null-contract as
     `resolveCircleChords`); the content gate (Rule 29) forbids shipping
     that state.
- **Rationale**: Pitch-class resolution is the only lookup that survives the
  Cb case: Gb major's IV spells "Cb" (DR-005 table, pitch 11) while the
  catalog names that pitch "B". Name-based matching would need a special
  case; pitch matching needs none. Verified during explore: name-based
  matching hits 83/84 cells across all 12 major keys with Cb the sole miss;
  pitch-based matching hits 84/84. Importing the oracle (rather than copying
  the table) keeps one spelling source of truth; the import is pure→pure
  with no cycle (`scales.ts` never imports `circles.ts`).
- **Alternatives considered**:
  - Hand-author a `diatonic[]` array per progression in lesson JSON —
    rejected: 24 × 7 hand-typed strings invite typos for zero benefit when
    the spelling oracle already exists and is gate-validated.
  - New `circles` collection mirroring `scales/` — rejected: breaks 003's
    single-source assumption (lesson progressions) and needs a drift gate;
    derivation keeps circles derived, not stored.
  - Resolve via `matchCatalogChord` symbol parsing — rejected: it matches
    root *spellings* (`entry.root === root`), so "Cb" misses; pitch lookup
    is exact.

## R2. Diminished fingerings (curated, generator-seeded, gate-verified)

- **Decision**: Author the 12 diminished entries as curated JSON (same shape
  as existing chords, `type: "diminished"`, flat-first combined names, e.g.
  "Bb / A# diminished"), seeded from the repo's own
  `generateChordDiagram("<root>dim")` voicings (verified during explore to
  return a playable diagram for all 12 roots) and hand-checked by
  exhaustive voicing search at authoring time (see outcome below); every
  diagram MUST
  pass the new pitch-agreement gate (Rule 28: fretted pitch classes include
  {root, +3, +6} and nothing outside the triad except doublings).
- **Hand-review outcome (authoring time)**: every seed was verified by
  exhaustive search over all 4-string voicings (frets 0-7, no mutes). Ten
  seeds kept: C/D/F diminished are the *unique* span<=3 first-position
  voicings for their roots (only easier options use muted strings, which
  would break the catalog's all-4-strings-sounding precedent), and the Db,
  Eb, E, Gb, G, Bb, B seeds are jointly optimal on (span, max fret, opens).
  Two seeds swapped for strictly easier fingerings the generator's
  pass-order/cost missed: A diminished `[2,3,5,3]` -> `[5,3,5,0]` (span 3->2,
  4 fingers->3, gains open A, root still doubled) and Ab diminished
  `[1,2,4,2]` -> `[4,2,4,2]` (span 3->2, same max fret 4). Both swaps pass
  Rule 28 and render in the baseFret-1 5-fret window.
- **Rationale**: The spec mandates curated — not generated — diagrams, but
  nothing forbids using the generator as a starting point: its voicings are
  already pitch-correct by construction, and the gate (not reviewer eyeball)
  is what guarantees correctness. Human review then only judges
  playability/idiom (open strings preferred, no impossible stretches).
- **Alternatives considered**:
  - Pure hand-authoring from charts without seeds — rejected: slower, same
    gate either way; seeds reduce transcription error.
  - Generate at runtime via `generateChordDiagram` (explore option D4) —
    rejected by the user decision: catalog grows to 36 curated entries.
  - Name-only vii° rows — rejected by the user decision.

## R3. Progression key-type field (defaulted, backward compatible)

- **Decision**: Extend `progressionSchema` with `type: z.enum(["major",
  "minor"]).default("major")`. The 12 existing major progressions parse
  unchanged; the 12 new minor progressions set `"type": "minor"`. The field
  name `type` matches `chordSchema.type` / `scaleSchema.type` and the spec's
  "key type" wording (FR-005).
- **Rationale**: Key spelling alone cannot determine major vs minor (A major
  and A minor share a tonic pitch). A defaulted field is the smallest
  backward-compatible discriminator: zero edits to existing lesson content,
  and the filter/focus view/derivation read one explicit field instead of
  inferring from degree casing.
- **Alternatives considered**:
  - Infer mode from degree labels (`I` vs `i`) — rejected: fragile (a typo
    flips the key), and derivation should not depend on display strings.
  - Separate minor lesson topic as the discriminator — rejected: the topic
    is not a mode (a lesson could mix), and the explorer collects circles
    across topics without tracking origin.
  - Required (non-defaulted) field — rejected: forces 12 gratuitous edits
    to existing content for no validation gain.

## R4. Grouped circle filter + sort (Scales parity, pitch matching)

- **Decision**: `CircleFilter = "all" | "major" | "minor" | <spelling>`,
  with `CIRCLE_FILTER_GROUPS` mirroring `SCALE_FILTER_GROUPS` (All circles /
  By type / By note over the 17 `NOTE_ROOTS` + `NOTE_ALIASES` spellings).
  Type options match `circle.type`; note options match by **pitch**:
  `ROOT_PITCH[circle.key] === ROOT_PITCH[option]`, so "Gb" and "F#" list
  identical circles. Sort: key pitch, then type major-first, then name —
  deterministic for the 24-circle list and consistent with FR-003's
  pitch-then-name order (the type tiebreak only separates same-pitch pairs).
- **Rationale**: Pitch matching removes today's spelling lottery (the
  dropdown can only offer spellings that happen to appear as keys: "F#" but
  not "Gb"). The 17-option note list is identical to Scales/Chords, so all
  three explorers share one filter vocabulary.
- **Alternatives considered**:
  - Exact-string key matching (status quo) — rejected: cannot satisfy
    FR-002's enharmonic equivalence.
  - `SPELLING_PITCH` (with Cb) for option matching — rejected: filter
    options are the 17 canonical spellings, all in `ROOT_PITCH`; Cb never
    appears as an option.

## R5. Focus-view rework (ScaleList skeleton, neck reused, table new)

- **Decision**: Rework `CircleList` onto the `ScaleList` focus-view skeleton:
  list + grouped filter; selecting a circle hides both and renders a
  full-width detail with "← Back to all circles" + Escape return and
  preserved filter state (same a11y contract: focusable Back button first,
  `aria-labelledby` detail heading). Detail contents: header (name, key with
  both spellings where the pitch has two, type), `<dl>` facts (progression,
  scale notes from the spelling row), the seven-row diatonic table (degree +
  note label + chord name + `ChordDiagram` + in-circle marker), and
  `ScaleNeck` with `{notes, rootPitch}` and **no** `firstPositions` badges
  (badges link to a portrait playing-order chart, which circles have no
  analogue of — tones only). The diatonic table stacks to one column at
  360px; diagrams reuse `ChordDiagram` unchanged.
- **Rationale**: Cloning the proven skeleton (rather than inventing a new
  detail pattern) gives the "works like Scales" parity the feature is named
  for, including the tested Back/Esc contract. `ScaleNeck` needs zero
  changes: its props already accept bare notes + root pitch, and its tonic
  fill + spelling-from-notes behavior is exactly what a key reference wants.
- **Alternatives considered**:
  - Keep inline single-open expansion, widened to 7 chords — rejected by
    the user decision (focus view) and by geometry: 7 diagrams + neck cannot
    fit a list card at 360px (the same finding as 005 DR-006).
  - New bespoke neck component for circles — rejected: identical rendering
    need, pure duplication.

## R6. Chords explorer diminished extension (filter + sort tier)

- **Decision**: `FilterOption` gains `"diminished"`; `FILTER_GROUPS` "By
  type" gains `{ value: "diminished", label: "Diminished" }`;
  `filterChords` type-matches all three; `sortChords` orders same-pitch
  entries major → minor → diminished, else alphabetical by display name
  (FR-013). `ChordList` needs no structural change — the new option flows
  from `chords.ts`; `chordDisplayName` already interpolates the type word,
  so "Bb / A# diminished" falls out. `SheetGenerator`'s catalog comment and
  any count text update to 36 (no behavior change).
- **Rationale**: The diminished entries are ordinary catalog rows; the
  explorer logic is already type-generic except for the two-value filter and
  the two-tier tiebreak. Extending both keeps one code path for all 36.
- **Alternatives considered**:
  - Separate diminished section/view — rejected: FR-013 mandates the unified
    list with a type filter.

## R7. Count constant + stale 24-pins (rename, bump, re-comment)

- **Decision**: Rename `CHORD_COUNT_V1` → `CHORD_COUNT = 36` in `lib/notes.ts`
  (the "V1" suffix now lies) and update its import + Rule 4 message in
  `validate.ts`. Update the three stale "24-entry"/"24" prose pins without
  behavior change: `sheets.ts` `matchCatalogChord` doc comment, the
  `chord-diagrams.ts` module comment, and `SheetGenerator.tsx`'s catalog
  prop comment. `matchCatalogChord` keeps major/minor-only matching
  semantics (see R9). Test fixtures that build the full chord set by hand
  (`content.schemas.test.ts` `fullChordSet`, `scale.schemas.test.ts` chord
  graphs) gain the diminished loop (12 pitches × 3 types).
- **Rationale**: A rename now is cheaper than a lying name forever; the
  blast radius is small (one constant, two code refs, three comments, two
  fixture builders — all found by one grep). Bumping the value in place
  under the old name would fossilize confusion.
- **Alternatives considered**:
  - Keep the `V1` name with value 36 — rejected: actively misleading.
  - Leave stale comments — rejected: the spec's analyze commitment exists
    precisely for this drift class.

## R8. Minor-circle content (12 canonical progressions in the lesson)

- **Decision**: Add grouped minor-circle sections to the existing
  `harmonic-circles.json` lesson (the spec's Key Entities forbid a new
  topic): three new sections (e.g. "Minor circles, natural keys",
  "Minor circles, flat keys", "Minor circles, sharp keys"), each with four
  `progressions` using the canonical i–VI–III–VII pattern
  (degrees `["i","VI","III","VII"]`), one per minor scale key. Minor keys
  use the conventional tonic spelling from the spelling table (C, C#, D,
  Eb, E, F, F#, G, G#, A, Bb, B — sharp-side where the flat minor would be
  theoretical, mirroring DR-005). Each progression gets an authored name in
  the existing voice ("Circle in A minor — …"). All four chords of every
  minor progression are diatonic by construction (i, VI, III, VII ∈ natural
  minor) and resolve to existing catalog entries (no diminished needed in
  the progressions themselves), so Rules 15/29 pass without new vocabulary.
  Lesson prose stays short per section (the table, not prose, teaches the
  harmony) but each section keeps ≥1 paragraph per the lesson schema.
- **Rationale**: i–VI–III–VII is the minor analogue of the major I–vi–IV–V
  loop (same four chord *functions* rotated: Am–F–C–G is C's vi–IV–I–V),
  uses only major/minor triads every learner already knows, and is the
  progression the spec's own FR-016 example names. Grouped sections (rather
  than 12 per-circle sections) keep the chapter navigable: the explorer —
  not the lesson TOC — is the per-key index.
- **Alternatives considered**:
  - 12 per-circle minor sections mirroring the majors — rejected: doubles
    the chapter's TOC for content the explorer already indexes; prose
    burden 3× for no teaching gain.
  - New "Minor Circles" lesson topic — rejected: spec Key Entities state no
    new topic is added.
  - Progressions using ii° (e.g. i–ii°–v–i) — rejected: forces diminished
    shapes into the first minor loop learners meet; the diatonic table
    already surfaces ii°.

## R9. Gate rules (Rule 4 amend + Rules 28–29 new; sheets untouched)

- **Decision**:
  - Rule 4 (amended): exactly `CHORD_COUNT` (36) uniquely named chords; the
    existing no-duplicate-`(rootPitch,type)` check now guarantees full
    12×3 coverage automatically (36 unique pairs over a 36-cell domain).
  - Rule 28 (new): every chord diagram's pitch classes MUST include its
    type's triad intervals above `rootPitch` — major {0,4,7}, minor
    {0,3,7}, diminished {0,3,6} (mod 12, open GCEA + frets) — and MUST NOT
    include any other pitch class (doublings allowed). Failures name the
    entry. This gates all 36, hardening the existing 24 as a side effect.
  - Rule 29 (new): every lesson progression chord MUST be diatonic to the
    circle's (key pitch, type): resolve the chord name to its catalog
    entry, then require (`rootPitch`,`type`) ∈ the derived diatonic set
    from R1. Failures name the circle + chord. Rule 15 (names resolve) and
    Rule 18 (names unique per course) are unchanged and still hold.
  - `matchCatalogChord` keeps major/minor-only semantics: sheet symbols
    like "Bdim"/"B°" continue to fall through to generated diagrams. Wiring
    diminished symbols to the curated catalog would change 004 sheet
    rendering — unrequested by this spec — and is recorded as a follow-up,
    not done here.
- **Rationale**: Rule 28 turns "wrong diagrams ship as confident-looking
  charts" (the R2 residual risk) into a build failure, following the 005
  Rule 26 precedent (pitch agreement as a validate rule, not a Zod refine —
  keeps all cross-field pitch math in one tested module). Rule 29 is the
  machine form of FR-010/FR-014 ("every progression chord appears in the
  table"). Leaving sheets behavior alone keeps the 24→36 change from
  leaking into 004's rendering contract.
- **Alternatives considered**:
  - Zod refine for pitch agreement instead of a validate rule — rejected:
    splits pitch math across two modules; validate keeps the 005 precedent.
  - Extending `matchCatalogChord` to diminished — rejected (see above):
    unrequested 004 behavior change.

## R10. Backend role

- **Decision**: No backend involvement — zero feature traffic, no
  `backend/` changes, no migration, no new endpoint. Same posture as
  001/003/005.
- **Rationale**: Circles remain static curated content with anonymous
  reading; no dynamic state exists to justify backend work.

## R11. LLM / model selection

- **Decision**: No hosted inference in this feature — no agents, chat,
  search, tagging, or recommendations ship. No model is chosen and no
  `openrouter-model-eval` run is required; this section is the decision
  record Principle V requires ("no model selected, nothing to evaluate").
- **Rationale**: Reading a static harmony reference needs no LLM; adding one
  would be scope creep. Consistent with 001/003/005 R6/R11.

## R12. Testing strategy

- **Decision**:
  - Frontend (Vitest, existing setup): chord schema fixtures (valid
    diminished entry + invalid: bad type word, `rootPitch` mismatch, bad
    `rootAlias`); progression fixtures (`type` default major, explicit
    minor, invalid type rejected); derivation tests (all 24 keys yield 7
    rows with exact degrees/qualities; Cb row carries note "Cb" + catalog
    "B major"; `inCircle` marks exactly the progression chords; null-chord
    rows don't throw); filter/sort tests (grouped options, enharmonic
    pitch equivalence for all 17 spellings, major-first type tiebreak);
    `validateCollections` tests (count ≠ 36, Rule 28 pitch-agreement
    failure naming the entry, Rule 29 non-diatonic progression chord
    naming circle + chord); diminished `filterChords`/`sortChords` tests
    (third tier); jsdom island tests (`CircleList`: grouped dropdown,
    focus open/Back/Escape with filter preserved, diatonic table rows +
    markers, neck render, empty + error states; `ChordList`: diminished
    option); container tests (circles route renders reworked explorer,
    chords route lists 36, 360px no-overflow with focus open,
    content-integrity over real JSON: 36 chords, 24 circles, gate-clean).
  - Backend (pytest): untouched — no backend change, existing suite must
    stay green.
  - Validation: `quickstart.md` scenarios map 1:1 to user stories and run
    via `npm run dev` + Vitest + `npm run check-content`.
- **Rationale**: Satisfies Principle III (test-first) with the idiomatic
  runner; derivation + gate + island + container tests give the reworked
  explorer the same contract safety the Scales explorer has.
- **Alternatives considered**:
  - Playwright E2E — deferred (same as 001/003/005): unit + schema +
    quickstart covers the static-content risk surface without flake/CI cost.

## R13. Reuse map (what clones, what extends, what is new)

- **Decision**:
  - CLONE (interaction): `ScaleList` focus-view skeleton (Back/Esc,
    filter preservation, `aria-labelledby` detail, count badge, empty/error
    states) → `CircleList`; `SCALE_FILTER_GROUPS` shape → circle groups.
  - EXTEND (logic): `filterChords`/`sortChords` (+ third type),
    `filterCircles`/`sortCircles` (+ type/pitch semantics),
    `chordSchema` (+ enum value), `progressionSchema` (+ defaulted field),
    Rule 4 (24→36), `fullChordSet`-style fixtures (+ diminished loop).
  - NEW (plumbing): `diatonicChords` derivation + row type, Rules 28–29,
    12 chord JSON files, 3 lesson sections + 12 progressions, diatonic
    table markup in `CircleList`, reverse enharmonic lookup for key display.
  - REUSE AS-IS: `SPELLING_TABLE` + `scaleSpelling`, `ScaleNeck`,
    `ChordDiagram`, topic route, `check-content.ts`, `matchCatalogChord`
    semantics.
- **Rationale**: Names every touch point so implementers never guess and
  reviewers can verify completeness by grep.
- **Alternatives considered**: None — this is an inventory, not a choice.

## R14. Spec amendments (001 + 003 via converge, not implement)

- **Decision**: FR-017 (001: 36-entry reference) and FR-018 (003: new
  explorer contract) are satisfied by `/speckit-converge` amendments to the
  001/003 specs after implementation, recorded as converge tasks — not by
  editing 001/003 spec files during implement. Until amended, 001/003 remain
    governing text for their clauses (spec Assumptions).
- **Rationale**: Constitution I routes spec changes through converge review;
  editing other features' specs mid-implement would bypass that gate and
  tangle the diff.
- **Alternatives considered**:
  - Amend 001/003 inside this feature's implement tasks — rejected:
    violates the spec-wins-until-amended rule and the converge workflow.

## Toolchain pins (verified 2026-09-17)

- Reuse the 001/003/005 scaffold: Node 22, Astro 7.x, React 19 islands,
  Tailwind CSS v4, Vitest 5 + Testing Library, ESLint 9 + Prettier,
  `tsx` check-content runner. Zero new dependencies for this feature.
