# Tasks: Ukulele Scales Topic

**Input**: Design documents from `/specs/005-ukulele-scales-topic/`
(plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — constitution Principle III (test-first, both apps,
NON-NEGOTIABLE) and the user's standing rule ("unit test for all code in
frontend and backend") require them. Within each phase, test tasks precede
their implementation. Backend has no tasks (research R5); its suite must
stay green (T023).

**Organization**: Grouped by user story (US1 P1, US2 P2, US3 P3) for
independent implementation and testing. US1 seeds the 24 entries so its
acceptance ("opens the explorer view showing the scale list") passes
standalone; US2 adds filtering; US3 adds inline detail + diagrams.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `frontend/`, `backend/` at repository root (per plan.md)
- Frontend tests: `frontend/tests/*.test.ts(x)`
- Single ScaleList island file grows across US1→US2→US3 (skeleton → filter → expansion); phases stay sequential on that file

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the existing scaffold is green before feature work

- [x] T001 Verify baseline gates in `frontend/` on a clean tree: `npx vitest run` green, `npm run check-content` green, `npm run check` + `npm run lint` + `npm run format:check` green (existing scaffold per plan.md; zero new deps for this feature)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Scale schemas, spelling table + helpers, collection validation, collection wiring — MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 [P] Scale schema + collection contract tests in `frontend/tests/scale.schemas.test.ts` targeting pure `frontend/src/lib/content/schemas.ts` + `frontend/src/lib/content/validate.ts` (zero Astro imports): one valid scale + invalid fixtures asserting Zod throws (`notes`/`degrees` length ≠ 8, wrong `intervals` for type — major MUST be `"W-W-H-W-W-W-H"`, minor MUST be `"W-H-W-W-H-W-W"` — `displaySpelling` neither `root` nor `rootAlias`, position `order` dup/gap, `fret` out of 0–12 range, `rootPitch` mismatch, bad `rootAlias` pair, `name` > 80 chars) + `validateCollections()` fixtures asserting naming errors (dangling scale `topicSlug`, scale count ≠ 24, dup scale name, dup (`rootPitch`,`type`) pair, `notes[]` diverging from `SPELLING_TABLE` row, double-accidental note, position pitch ≠ note pitch-class)
- [x] T003 [P] Scales helper tests in `frontend/tests/scales.test.ts` targeting pure `frontend/src/lib/scales.ts` (zero Astro imports): `SPELLING_TABLE` holds exactly 24 rows keyed by (`rootPitch`,`type`) transcribed from the spec Appendix — C#/F#/G# minor sharp-side, Eb-minor flat default, zero double-accidentals; `filterScales` (`"all"` identity, major/minor type match, note spelling matches `root` OR `rootAlias` incl. Bb and A# matching the same combined entry); `sortScales` (alphabetical by display name, major before minor per pitch)
- [x] T004 [P] Implement schema extensions in `frontend/src/lib/content/schemas.ts` per `contracts/content-schema.md` (`format` enum gains `"scales"` default `"reference"` — rule 19; `scalePositionSchema`/`scaleDiagramSchema`/`scaleSchema` with identity fields `name` 1–80 chars / `type` major|minor / `root` in `NOTE_ROOTS` / optional `rootAlias` in `NOTE_ALIASES` / `rootPitch` 0–11 / `topicSlug` non-empty — rule 20; content fields `notes`/`degrees` exactly 8 non-empty strings / type-expected `intervals` / `displaySpelling` is root-or-alias / `positionLabel` 1–40 chars — rule 21; diagram `strings: "GCEA"` / 8 positions with `string` 0–3, `fret` 0–12, `finger` 0–4, `order` exactly 1–8 each once / `baseFret` ≥ 1 — rule 22; plus `.refine` rules for rootPitch, alias-pair, intervals, displaySpelling, order-uniqueness) (depends on T002)
- [x] T005 [P] Implement `frontend/src/lib/scales.ts` per `contracts/content-schema.md` (`SPELLING_TABLE` 24 rows + `scaleSpelling()` lookup + `filterScales()`/`sortScales()` + `SCALE_FILTER_GROUPS` All scales / By type / By note; type-only `Scale` import from `./content/schemas`; zero Astro imports) (depends on T003)
- [x] T006 [P] Implement scales rules in `frontend/src/lib/content/validate.ts` per `contracts/content-schema.md` (`Collections` gains `scales: Scale[]`; rule 23: topicSlug resolves + exactly 24 + dup-name + dup-(rootPitch,type) errors; rule 24: every `NOTE_ROOTS`+`NOTE_ALIASES` spelling matches ≥1 scale; rule 25: `notes[]` exact-match vs `SPELLING_TABLE` + no double accidentals; rule 26: position pitch `(open-string pitch + fret) mod 12` equals note pitch-class; all errors name the entry) (depends on T002)
- [x] T007 Wire the `scales` collection in `frontend/src/content.config.ts` (`defineCollection({ loader: glob({ pattern: "**/*.json", base: "./src/content/scales" }), schema: scaleSchema })`, pure-schema import only) + extend `frontend/scripts/check-content.ts` to load `src/content/scales/*.json` through `scaleSchema` and pass entries to `validateCollections()` (depends on T004)

**Checkpoint**: Foundation ready — `npm run check-content` enforces rules 19–26; user story implementation can now begin

---

## Phase 3: User Story 1 - Discover and open the Scales topic (Priority: P1) 🎯 MVP

**Goal**: Ukulele course page shows the Scales card after Circles; selecting it opens the Scales view showing the scale list (FR-001, FR-002, FR-003).

**Independent Test**: Open `/courses/ukulele` directly — Scales card appears labeled Topic after the existing cards; select it — `/courses/ukulele/topics/scales` opens showing all 24 scale names (filter/detail arrive in US2/US3).

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T008 [P] [US1] Seed `frontend/src/content/topics/scales.json` (title `"Scales"`, slug `"scales"`, `kind: "topic"`, `courseSlug: "ukulele"`, `format: "scales"`, description 1–280 chars FR-001 card text, `order: 3` after Chords/Harmonic Circles/Circles)
- [x] T009 [P] [US1] Seed 24 scale entries in `frontend/src/content/scales/*.json` (SC-004: major + natural minor × 12 pitches; combined flat-first names e.g. `"Bb / A# major"`; `type` major/minor; `root` from 12-spelling enum + `rootAlias` enharmonic partner; `rootPitch` 0–11 matching `ROOT_PITCH[root]`; `topicSlug: "scales"`; `notes[8]`/`degrees[8]`/`intervals`/conventional `displaySpelling` per spec Appendix; `diagram` with `strings: "GCEA"`, 8 positions `{string 0–3, fret 0–12, order 1–8, finger 0–4}`, `baseFret` 1, `positionLabel` e.g. `"1st position"`; fingerings pitch-agree per rule 26)
- [x] T010 [P] [US1] Island skeleton tests in `frontend/tests/ScaleList.test.tsx` (renders every scale name from props with count badge; zero scales → friendly empty state; `error` prop → error state with retry affordance; no filter/expansion yet)

### Implementation for User Story 1

- [x] T011 [US1] Implement skeleton `frontend/src/components/ScaleList.tsx` (props in: scales list; heading + count badge + one card per scale name; FR-014 empty + error states via shared idioms; Tailwind utilities + shadcn theme tokens; expansion/filter land in US2/US3) (depends on T010)
- [x] T012 [US1] Extend `frontend/src/pages/courses/[course]/topics/[topic].astro` with the `format === "scales"` branch per `contracts/routes.md` (collect the topic's scales by `topicSlug`, render `ScaleList` island `client:load`; `reference`/`lesson`/`circles` branches byte-identical) (depends on T011)
- [x] T013 [US1] Validate quickstart V1 in `specs/005-ukulele-scales-topic/quickstart.md` (card order on `/courses/ukulele`, navigation to `/courses/ukulele/topics/scales`, list shows 24 names, SC-001 ≤3 selections)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Filter scales by type or note (Priority: P2)

**Goal**: Grouped dropdown filters the scale list (All/Major/Minor/per-note incl. flats+sharps); reset restores all (FR-004, FR-005, FR-010).

**Independent Test**: Open the Scales view directly, choose each dropdown option — list shows only matching scales (Bb/A# same entries); reselect All — full list restored in major-first alphabetical order.

### Tests for User Story 2 ⚠️

- [x] T014 [P] [US2] Filter tests extending `frontend/tests/ScaleList.test.tsx` (FR-004 grouped native select + optgroup All scales / By type / By note incl. Bb and A# options; FR-005 each option → visible list via `selectOptions`, reset restores all; FR-010 default order alphabetical major-first; synthetic zero-match case shows empty state + reset path; update <2s SC-002)

### Implementation for User Story 2

- [x] T015 [US2] Implement filtering in `frontend/src/components/ScaleList.tsx` (FR-004 grouped native `<select>` + `<optgroup>` from `SCALE_FILTER_GROUPS` via shadcn NativeSelect primitive or Tailwind-styled select + theme tokens; FR-005 live update + reset; FR-010 `sortScales(filterScales())` pipeline; filter change clears any future expansion state) (depends on T014)
- [x] T016 [US2] Validate quickstart V2 in `specs/005-ukulele-scales-topic/quickstart.md` (Major/Minor/note filters, Bb/A# same-entry match, All reset, count badge)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Study a scale's notes and fingering (Priority: P3)

**Goal**: Entries expand inline showing notes + degrees + interval pattern + numbered fretboard-chart diagram; keyboard-operable; 360px-clean (FR-006, FR-008, FR-011, FR-015).

**Independent Test**: Open the Scales view directly, expand any entry — notes/degrees/intervals/diagram render; expand another — first collapses; reselect — collapses; keyboard + AT expose state; 360px shows no horizontal scroll.

### Tests for User Story 3 ⚠️

- [x] T017 [P] [US3] Diagram tests in `frontend/tests/ScaleDiagram.test.tsx` (SVG grid 4 strings; exactly 8 numbered dots in playing `order` with matching note labels; open-string marks for fret-0 positions; position-label caption; null/invalid diagram → FR-015 placeholder path; responsive contract: `viewBox` present + `w-full h-auto` scaling for SC-008)
- [x] T018 [P] [US3] Expansion tests extending `frontend/tests/ScaleList.test.tsx` (entry expands in place single-open showing name/type/root/notes/degrees/intervals/diagram; collapses on reselect; expanding another collapses the first; keyboard-operable with `aria-expanded`/`aria-controls`; null diagram shows placeholder beside intact notes)

### Implementation for User Story 3

- [x] T019 [US3] Implement `frontend/src/components/ScaleDiagram.tsx` (prop-driven fretboard-chart SVG extending the `ChordDiagram` idiom: 4-string grid, numbered order dots, open marks, position label, accessible title/desc, null-safe placeholder path; `viewBox` + responsive sizing per SC-008) (depends on T017)
- [x] T020 [US3] Implement inline expansion in `frontend/src/components/ScaleList.tsx` (FR-006 single-open `string | null` state + toggle + reselect-collapse + keyboard/AT contract; expanded card shows type/root/notes+degrees/intervals + `ScaleDiagram`; FR-015 placeholder path for missing diagrams) (depends on T018, T019)
- [x] T021 [US3] Validate quickstart V3 in `specs/005-ukulele-scales-topic/quickstart.md` (expand/collapse incl. C major + Db/C# minor conventional spelling spot-check, `check-content` break-and-restore naming entry + degree, 360px resize, keyboard/AT pass)

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, full gates, release readiness

- [X] T022 [P] Accessibility pass on `frontend/src/components/ScaleList.tsx` + `frontend/src/components/ScaleDiagram.tsx` (semantic markup + keyboard operability + AT naming per spec Out-of-Scope boundary: label+select association, `aria-expanded`/`aria-controls` on expansion buttons, SVG title/desc; fix gaps in the same files)
- [X] T023 [P] Run full gates per `specs/005-ukulele-scales-topic/quickstart.md` V4: in `frontend/`, `npx vitest run` + `npm run check-content` (prebuild gate green on real JSON incl. 24 scales) + `npm run check` + `npm run lint` + `npm run format:check`; in repo root, `pytest backend/` green (no backend change); V4 regression (001/003 views unchanged, unknown slug → 404 with back-link, scales empty-state fixture)
- [X] T024 Final review in `specs/005-ukulele-scales-topic/`: constitution compliance I–VIII + gates (incl. layering + lint/format green), SC-003 task-based check scheduled/complete (5 first-time learners, ≥4 unaided successes), SC-005 spelling audit + rule-26 pitch audit evidence, and converge readiness across spec.md/plan.md/tasks.md (depends on T023)

---

## Phase 7: Detail-surface rework (DR-006)

**Purpose**: Record and converge the post-implementation user request (2026-09-16): full-width focus detail + landscape 12-fret neck reference

- [x] T025 [US3] Record DR-006 in `specs/005-ukulele-scales-topic/decisions/DR-006-scale-focus-view-neck-reference.md` (focus view + `ScaleNeck`; DR-002 stands, no supersession) + converge artifacts to focus-view: `spec.md` Clarifications entry + US3/FR-006/SC-003/SC-008 reword + ledger row; `quickstart.md` V3 focus-view steps; `plan.md` summary + tree (`ScaleNeck.tsx`); `contracts/routes.md` + `contracts/content-schema.md` + `data-model.md` detail-contract reword (code + tests already shipped in `frontend/src/components/ScaleList.tsx` + `frontend/src/components/ScaleNeck.tsx` + `frontend/tests/ScaleList.test.tsx` + `frontend/tests/ScaleNeck.test.tsx`) (depends on T024)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 → US2 → US3 sequential on `ScaleList.tsx` (skeleton → filter → expansion); otherwise additive
- **Polish (Final Phase)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependencies on other stories
- **User Story 2 (P2)**: Depends on US1's `ScaleList.tsx` skeleton + route (extends the same files); independently testable once US1 lands
- **User Story 3 (P3)**: Depends on US1/US2's island (extends the same file) + new `ScaleDiagram.tsx`; independently testable once US1/US2 land

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Seeding before wiring (content exists before the view consumes it)
- Components before route integration
- Story complete (validate task) before moving to next priority

### Parallel Opportunities

- T002 + T003 (different test files) can run in parallel
- T004 + T005 + T006 (schemas.ts, scales.ts, validate.ts — different files) can run in parallel after T002/T003
- T008 + T009 + T010 (topic seed, scales seed, island tests — different files) can run in parallel
- T017 + T018 (diagram tests, expansion tests — different files) can run in parallel
- T022 + T023 (a11y pass, full gates) can run in parallel

---

## Parallel Example: Foundational Phase

```bash
# Launch contract tests together:
Task: "Scale schema + collection contract tests in frontend/tests/scale.schemas.test.ts"
Task: "Scales helper tests in frontend/tests/scales.test.ts"

# After tests fail as expected, launch implementations together:
Task: "Implement schema extensions in frontend/src/lib/content/schemas.ts"
Task: "Implement frontend/src/lib/scales.ts"
Task: "Implement scales rules in frontend/src/lib/content/validate.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline green)
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (card → view with 24-name list)
4. **STOP and VALIDATE**: Test User Story 1 independently (quickstart V1)
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (filterable reference)
4. Add User Story 3 → Test independently → Deploy/Demo (playable scales)
5. Each story adds value without breaking previous stories

### Single-Agent Execution (this session)

Run T001 → T025 in ID order (respecting [P] batching where files differ),
validating each story checkpoint via its quickstart section before advancing.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Scale fingerings: author from first-position boxes (research R8), verify pitch agreement via rule 26 — never ship an unaudited fingering
