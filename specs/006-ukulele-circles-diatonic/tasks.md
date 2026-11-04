# Tasks: Ukulele Circles — Diatonic Harmony Focus View

**Input**: Design documents from `/specs/006-ukulele-circles-diatonic/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — Constitution Principle III mandates Vitest for every
component, island, and util (test-first: write tests, watch them FAIL,
then implement).

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `frontend/src/`, `frontend/tests/` (per plan.md structure)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline verification before any change

- [X] T001 Verify clean baseline: `cd frontend && npm install && npx vitest run` green and `npm run check-content` prints 24 chords on branch `006-ukulele-circles-diatonic`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared contracts that MUST be complete before ANY user story:
chord/progression schema extensions, 36-count constant, gate Rules 4/28/29,
and the 12 diminished entries (Rule 4's exact-36 count and the new rules
fail the gate until content + code land together, so they ship atomically
here; the Chords *explorer surface* for diminished lands in US3)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Add diminished schema fixtures in `frontend/tests/content.schemas.test.ts`: one valid diminished entry (`type: "diminished"`, flat-first combined name, `rootPitch` equals `ROOT_PITCH[root]`) plus invalid (bad type word, `rootPitch` mismatch, non-partner `rootAlias`) asserting Zod throws
- [X] T003 Extend `type` to `z.enum(["major", "minor", "diminished"])` in `chordSchema` in `frontend/src/lib/content/schemas.ts` (T002 green)
- [X] T004 [P] Add progression `type`-field fixtures in `frontend/tests/lesson.schemas.test.ts`: absent `type` parses to `"major"`, explicit `"minor"` accepted, invalid type rejected
- [X] T005 Extend `progressionSchema` with `type: z.enum(["major", "minor"]).default("major")` in `frontend/src/lib/content/schemas.ts` (T004 green; existing 12 progressions byte-unchanged)
- [X] T006 [P] Add gate tests in `frontend/tests/content.schemas.test.ts`: rebuild `fullChordSet` as 12 pitches × major/minor/diminished (36), count ≠ 36 errors, Rule 28 pitch-agreement failure naming the entry, Rule 29 non-diatonic progression chord naming circle + chord
- [X] T007 Rename `CHORD_COUNT_V1` → `CHORD_COUNT = 36` in `frontend/src/lib/notes.ts`, add reverse enharmonic lookup (sharp alias → flat root) for key display, and update the import in `frontend/src/lib/content/validate.ts`
- [X] T008 Implement amended Rule 4 (exactly `CHORD_COUNT` chords) plus new Rules 28 (triad pitch agreement: major {0,4,7}, minor {0,3,7}, diminished {0,3,6} above `rootPitch`, no other pitch classes) and 29 (every progression chord diatonic to key pitch + type) in `frontend/src/lib/content/validate.ts` (T006 green)
- [X] T009 Author 12 diminished chord entries `frontend/src/content/chords/*-diminished.json` (flat-first combined names, curated GCEA diagrams seeded from `generateChordDiagram` and hand-checked) and run `npm run check-content` to gate-green (Rules 4/28 pass, 36 chords)
- [X] T010 [P] Update stale 24-pins to 36 with zero behavior change in `frontend/src/lib/sheets.ts` (`matchCatalogChord` doc comment), `frontend/src/lib/chord-diagrams.ts` (module comment), and `frontend/src/components/SheetGenerator.tsx` (catalog prop comment)
- [X] T011 [P] Extend chord graphs in `frontend/tests/scale.schemas.test.ts` to the 36-entry set so non-scales rules stay green

**Checkpoint**: Foundation ready — `npx vitest run` + `npm run check-content` (36 chords) green; user story implementation can now begin

---

## Phase 3: User Story 1 - Study a circle's full diatonic harmony (Priority: P1) 🎯 MVP

**Goal**: Selecting a circle opens a full-width focus view with progression,
scale notes, seven-row diatonic table (degree, note, chord, diagram,
in-circle marking), and 12-fret neck; Back/Escape return with filter intact

**Independent Test**: Open `/courses/ukulele/topics/circles`, select any
circle → focus view lists exactly seven diatonic rows with diagrams, marks
the circle's chords, renders notes + neck, and Back/Escape restore the list
(quickstart V1)

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T012 [P] [US1] Derivation tests in `frontend/tests/circles.test.ts`: all 24 (pitch, type) keys yield exactly 7 rows with exact degrees (`I ii iii IV V vi vii°` / `i ii° III iv v VI VII`) and qualities (major vector M m m M M m dim; minor vector m dim M m m M M); Gb-major row 4 carries note `"Cb"` + catalog `"B major"`; `inCircle` marks exactly the progression chords; null-chord rows don't throw
- [X] T013 [P] [US1] Island tests in `frontend/tests/CircleList.test.tsx`: focus open on select, Back button + Escape return with filter preserved, diatonic table rows + in-circle markers, neck render, empty + error states (jsdom)
- [X] T014 [P] [US1] Container tests in `frontend/tests/CirclesTopic.test.ts`: circles route renders reworked explorer with focus view, 360px no-overflow with focus open (SC-007)

### Implementation for User Story 1

- [X] T015 [US1] Implement `DiatonicChord` row type + `diatonicChords(circle, catalog)` pure derivation in `frontend/src/lib/circles.ts` per R1 (spelling oracle + quality vectors + pitch-class resolution + `inCircle`, null-contract) (T012 green)
- [X] T016 [US1] Rework `frontend/src/components/CircleList.tsx` onto the `ScaleList` focus-view skeleton: Back/Escape + filter preservation, header with dual-spelling key + type, facts `<dl>` (progression + scale notes), seven-row diatonic table with `ChordDiagram` per row + in-circle markers, `ScaleNeck` with notes + rootPitch and no badges, stacked single-column at 360px (T013–T014 green; existing flat filter kept — grouped filter lands in US2)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently (quickstart V1 passes against 12 major circles)

---

## Phase 4: User Story 2 - Filter circles by type or note (Priority: P2)

**Goal**: Grouped All/by-type/by-note dropdown with enharmonic pitch
equivalence, mirroring the Scales view

**Independent Test**: Each dropdown option lists only matching circles;
"Gb"/"F#" (and every enharmonic pair) list identical results; All restores
pitch-ordered list (quickstart V2)

### Tests for User Story 2 ⚠️

- [X] T017 [P] [US2] Filter/sort tests in `frontend/tests/circles.test.ts`: grouped options (all/type/note), type match on `circle.type`, note match by `ROOT_PITCH` equality for all 17 spellings, sort order pitch → type major-first → name
- [X] T018 [P] [US2] Dropdown tests in `frontend/tests/CircleList.test.tsx`: grouped `<select>` renders All/Major/Minor/notes, selection filters, empty-filter reset path

### Implementation for User Story 2

- [X] T019 [US2] Implement `CIRCLE_FILTER_GROUPS` + pitch-matching `filterCircles` + type-tiebreak `sortCircles` in `frontend/src/lib/circles.ts` per R4 (T017 green)
- [X] T020 [US2] Swap the flat key dropdown for the grouped filter in `frontend/src/components/CircleList.tsx` reusing the `SCALE_FILTER_GROUPS` shape (T018 green)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently (quickstart V1–V2 pass)

---

## Phase 5: User Story 3 - Diminished chords in the Chords reference (Priority: P3)

**Goal**: Chords explorer lists 36 entries with a "Diminished" type filter
and major → minor → diminished per-pitch ordering (content + gate already
landed in Phase 2)

**Independent Test**: Chords view lists 36; "Diminished" shows exactly 12,
each with a diagram (quickstart V3)

### Tests for User Story 3 ⚠️

- [X] T021 [P] [US3] Filter/sort tests in `frontend/tests/chords.test.ts`: `"diminished"` type match, By-type group lists `["major", "minor", "diminished"]`, same-pitch tier major → minor → diminished
- [X] T022 [P] [US3] Explorer tests in `frontend/tests/ChordList.test.tsx`: diminished option renders, selects exactly the 12 diminished entries, count badge reads 36

### Implementation for User Story 3

- [X] T023 [US3] Extend `FilterOption` + `FILTER_GROUPS` + `filterChords` + `sortChords` third tier in `frontend/src/lib/chords.ts` per R6 (T021 green; `ChordList.tsx` needs no structural change — option flows from `chords.ts`)
- [X] T024 [US3] Verify `frontend/src/components/ChordList.tsx` renders the diminished option end to end with zero structural edits, fixing only option-plumbing if the T022 run exposes any (T022 green)

**Checkpoint**: All of US1–US3 independently functional (quickstart V1–V3 pass)

---

## Phase 6: User Story 4 - Minor-key circles (Priority: P4)

**Goal**: 12 canonical minor circles (i–VI–III–VII, one per minor scale key)
in the lesson source, explorable with natural-minor diatonic tables

**Independent Test**: "Minor" filter shows exactly 12; A-minor focus shows
i A minor, ii° B diminished, III C major, iv D minor, v E minor, VI F
major, VII G major (quickstart V4)

### Tests for User Story 4 ⚠️

- [X] T025 [P] [US4] Content tests in `frontend/tests/CirclesTopic.test.ts`: course holds exactly 24 circles (12 per type), "Minor" filter lists 12, A-minor diatonic rows exact, `check-content` gate-clean over real JSON

### Implementation for User Story 4

- [X] T026 [US4] Add three grouped minor-circle sections with 12 `type: "minor"` i–VI–III–VII progressions (conventional tonic spellings C C# D Eb E F F# G G# A Bb B, authored names) to `frontend/src/content/topics/harmonic-circles.json` per R8, keeping ≥1 prose paragraph per section (T025 green)

**Checkpoint**: All user stories independently functional (quickstart V1–V4 pass)

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation, gates, and converge handoff (no 001/003
spec edits here — FR-017/FR-018 amendments land via `/speckit-converge`)

- [X] T027 Run content-gate sabotage checks per quickstart V5 in scratch copies (non-diatonic chord → rule 29 names circle + chord; corrupt diagram fret → rule 28 names entry; deleted chord file → exact-36 failure), then restore
- [X] T028 [P] Run full validation per quickstart V6 + Done-when: `npx vitest run`, `npm run check-content`, `npm run check`, `npm run lint`, `npm run format:check` green; `pytest backend/` green; 2s list/focus (SC-006); regression over `/`, chords, harmonic-circles, scales, 404
- [X] T029 Record the SC-002 task-based check plan (5 first-time learners, "find the diminished chord in the key of G", ≥4 unaided) as a pre-release step in the converge request; do NOT run it as an automated task
- [X] T030 Prepare the `/speckit-converge` handoff note listing the FR-017 (001: 36-entry reference) and FR-018 (003: new explorer contract) amendments with exact superseded clauses, without editing 001/003 spec files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 (P1) first: delivers the MVP increment (focus + diatonic table)
  - US2 (P2) refines the US1 island's filter — implement after US1, or in parallel only if the island owner serializes the CircleList edits
  - US3 (P3) touches only `chords.ts`/`ChordList` + their tests — parallel-safe with US1/US2 once Foundational is done
  - US4 (P4) is content-only in the lesson JSON — parallel-safe with US1–US3 once Foundational is done
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories (diminished content it needs landed in Foundational)
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Edits the same `CircleList.tsx` US1 reworks: independently testable, but serialize the island edits
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent files; fully parallel-safe
- **User Story 4 (P4)**: Can start after Foundational (Phase 2) - Independent file (`harmonic-circles.json`); fully parallel-safe

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Derivation/helpers before island markup
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- Phase 2: T002+T003 chain, T004+T005 chain, and T006+T007+T008 chain are file-disjoint and can run in parallel; T009 (content) parallel-safe with all code chains; T010+T011 comment/fixture touch-ups parallel-safe
- Once Foundational completes: US3 and US4 can start in parallel with US1 (disjoint files); US2 parallel-safe for its `circles.ts` lib work (T017+T019), serialized only for the `CircleList.tsx` dropdown swap (T018+T020) after T016 lands
- All tests marked [P] within a story can run in parallel (different test files)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Derivation tests in frontend/tests/circles.test.ts" (T012)
Task: "Island tests in frontend/tests/CircleList.test.tsx" (T013)
Task: "Container tests in frontend/tests/CirclesTopic.test.ts" (T014)

# Then implementation in dependency order:
Task: "Implement diatonicChords derivation in frontend/src/lib/circles.ts" (T015)
Task: "Rework frontend/src/components/CircleList.tsx focus view" (T016)
```

## Parallel Example: Foundational

```bash
# Three file-disjoint chains + content can run together:
Chain A: "Diminished schema fixtures" (T002) → "chordSchema enum" (T003)
Chain B: "Progression type fixtures" (T004) → "progressionSchema type field" (T005)
Chain C: "Gate tests" (T006) → "CHORD_COUNT rename" (T007) → "Rules 4/28/29" (T008)
Content: "12 diminished entries" (T009)
Touch-ups: "Stale 24-pins" (T010), "scale.schemas chord graphs" (T011)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently (quickstart V1)
5. Deploy/demo if ready (12 major circles with full diatonic focus views)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (36 chords, gates green)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (grouped filter)
4. Add User Story 3 → Test independently → Deploy/Demo (diminished explorer)
5. Add User Story 4 → Test independently → Deploy/Demo (24 circles)
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (derivation + island rework), then User Story 2 (filter swap on the same island)
   - Developer B: User Story 3 (chords lib + explorer)
   - Developer C: User Story 4 (minor-circle lesson content)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- US2's island tasks (T018+T020) serialize after US1's T016 (same file); everything else cross-story is parallel-safe
- FR-017/FR-018 spec amendments are explicitly OUT of these tasks — they land via `/speckit-converge` (see T030)
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
