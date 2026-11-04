# Tasks: Ukulele Harmonic Circles Topic

**Input**: Design documents from `/specs/003-ukulele-harmonic-circles/`
(plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: Included — constitution Principle III (test-first, both apps)
requires them. Within each phase, test tasks precede their implementation
(T002→T003, T004→T005, T006→T007, T011→T012, T014→T015); tests MUST fail
before the implementation makes them pass.

**Organization**: Grouped by user story (US1 P1, US2 P2, US3 P3).
Stories build sequentially (US1 → US2 → US3) because each extends the
same lesson reader + topic route; each phase ends with its quickstart
validation as the independent test.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Exact file paths in every description

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Pin the one new dependency; scaffold otherwise exists (001).

- [x] T001 Install + pin `marked` in `frontend/package.json` (`npm install -S marked@<exact>`,
  sync parse API; record exact version — R2)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Lesson schemas, chord-ref validation, and pure helpers
(resolver + Markdown renderer) every story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 [P] Lesson schema contract tests in `frontend/tests/lesson.schemas.test.ts`
  targeting pure `frontend/src/lib/content/schemas.ts` (one valid chapter fixture +
  invalid fixtures MUST assert Zod throws: missing `lesson` on `format: "lesson"`;
  `lesson` present on `format: "reference"`; raw-HTML prose (`<b>` tag-like text);
  `degrees`/`chords` length mismatch; invalid `key` spelling e.g. `"Hb"`)
- [x] T003 Extend `frontend/src/lib/content/schemas.ts` (`format` enum
  `"reference" | "lesson"` default `"reference"` + `lessonSchema`/`lessonSectionSchema`/
  `progressionSchema`: `intro` ≥1, `sections` ≥4, `summary` ≥1, `heading` 1–80 chars,
  `paragraphs` ≥1, prose strings min 1 with no tag-like `<...>` sequences, progression
  `name` 1–80 chars, `key` valid note spelling, `degrees` ≥3 and `chords` ≥3 with equal
  lengths, `lesson` present iff `format` is `"lesson"` — rules 10–14; export
  `Lesson`/`LessonSection`/`Progression` types via `z.infer`)
- [x] T004 [P] Resolver + renderer tests in `frontend/tests/lessons.test.ts`
  (`resolveLessonChords`: exact-name match incl. combined `"Bb / A# major"`,
  unresolved name → null, multi-progression map; `renderProse`: paragraphs,
  emphasis, lists → HTML string, sync return)
- [x] T005 Implement pure `frontend/src/lib/lessons.ts` (`resolveLessonChords(lesson,
  chords) → Map<string, Chord | null>` exact-matching `chords[].name`;
  `renderProse(markdown) → string` via `marked` sync parse; zero Astro imports)
- [x] T006 [P] Rule-15 tests in `frontend/tests/content.schemas.test.ts` (new describe:
  dangling lesson chord name → `validateCollections()` error naming topic +
  progression + chord; valid lesson graph → zero errors)
- [x] T007 Extend `frontend/src/lib/content/validate.ts` (rule 15: every
  `progression.chords[]` name in `format: "lesson"` topics MUST exactly match a
  `chords[].name`, else error naming topic + progression + chord)

**Checkpoint**: Foundation ready — schemas gate content, resolver/renderer are pure
and tested; user story work can begin.

---

## Phase 3: User Story 1 — Discover and open the topic (P1) 🎯 MVP

**Goal**: Course page shows the Harmonic Circles card after Chords; selecting it
opens the lesson route rendering the chapter shell (FR-001, FR-002).

**Independent Test**: Open `/courses/ukulele`, verify the Topic-labeled Harmonic
Circles card; select it → lands on the lesson route showing the lesson title
(quickstart V1).

- [x] T008 [P] [US1] Seed `frontend/src/content/topics/harmonic-circles.json` (title
  "Harmonic Circles", slug "harmonic-circles", `kind: "topic"`, `courseSlug: "ukulele"`,
  `format: "lesson"`, `order: 1`, description 1–280 chars, full `lesson` chapter per
  data-model.md outline: intro, 6 sections, summary, 3 progressions C/G/F I–vi–IV–V
  with canonical chord names incl. `"Bb / A# major"`)
- [x] T009 [US1] Format branch in `frontend/src/pages/courses/[course]/topics/[topic].astro`
  (`reference` → existing `ChordList` path unchanged; `lesson` → new
  `frontend/src/components/LessonReader.astro` skeleton rendering breadcrumb, title,
  description, intro/sections/summary prose via `renderProse` + `set:html`, empty
  state via `ViewStates` when zero sections; page loads the Chords reference
  collection and passes `resolveLessonChords()` output as props; data-driven on
  `topic.format`, no slug conditionals)
- [x] T010 [US1] Validate quickstart V1 in `specs/003-ukulele-harmonic-circles/quickstart.md`
  (card order/label, navigation, SC-001 ≤3 selections)

**Checkpoint**: At this point, User Story 1 is fully functional and testable
independently (discovery + lesson landing shell).

---

## Phase 4: User Story 2 — Read the lesson as book material (P2)

**Goal**: Chapter reads as method-book prose: intro + headed sections + summary in
order, semantic hierarchy, readable single column down to 360px (FR-003, FR-006, FR-009).

**Independent Test**: Open the lesson route directly, verify intro + ≥4 headed
sections + summary render in reading order as continuous prose; 360px viewport
shows no horizontal scrolling (quickstart V2).

- [x] T011 [P] [US2] Prose tests in `frontend/tests/LessonReader.test.ts` via
  `experimental_AstroContainer` from `astro/container` (intro/sections/summary render
  in order; Markdown emphasis + lists render; headings are `<h2>` in section order;
  zero-section fixture renders the friendly empty state)
- [x] T012 [US2] Readability implementation in `frontend/src/components/LessonReader.astro`
  (scoped book CSS: ~65ch measure, heading scale, paragraph rhythm with theme tokens;
  semantic `<h2>`/`<p>`/`<ul>` structure making T011 green; prose audit: ≥4 sections
  of continuous instructional text per FR-003/FR-006)
- [x] T013 [US2] Validate quickstart V2 in `specs/003-ukulele-harmonic-circles/quickstart.md`
  (reading order, 360px SC-005 check, SC-003 circle-count audit)

**Checkpoint**: At this point, User Stories 1 AND 2 are independently functional
(discovery + readable chapter).

---

## Phase 5: User Story 3 — Play along with progression diagrams (P3)

**Goal**: Every progression shows name/key/degrees plus each chord's name and
fingering diagram inline from the resolved reference entry (FR-004, FR-005, FR-008).

**Independent Test**: Open the lesson route directly, verify each of the 3
progressions shows every chord with name + diagram matching the Chords reference
(quickstart V3).

- [x] T014 [P] [US3] Progression tests extending `frontend/tests/LessonReader.test.ts`
  (progression name/key/degrees row renders; every chord shows name + static diagram;
  combined `"Bb / A# major"` chord resolves and renders; unresolved reference renders
  safely without crashing)
- [x] T015 [US3] Progression blocks in `frontend/src/components/LessonReader.astro`
  (name + key + degrees row + one inline static `ChordDiagram` per resolved chord —
  read-only, no hydration; null-safe on unresolved refs; styling with theme tokens)
- [x] T016 [US3] Validate quickstart V3 in `specs/003-ukulele-harmonic-circles/quickstart.md`
  (inline diagrams, cross-check vs Chords view, `check-content` break/restore drill
  proving FR-008 names topic + progression + chord)

**Checkpoint**: All user stories are now independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, full gates, regression, review readiness.

- [x] T017 [P] Accessibility pass on `frontend/src/components/LessonReader.astro`
  (heading order, page landmark/breadcrumb nav, diagram accessible names; static HTML —
  no keyboard traps possible)
- [x] T018 Full gates + regression per `specs/003-ukulele-harmonic-circles/quickstart.md`
  V4: in `frontend/`, `npx vitest run` + `npm run check-content` (green on real JSON
  incl. the new topic) + `npm run check` + `npm run lint` + `npm run format:check`;
  `pytest backend/` green (untouched); V4 regression (Chords view unchanged, unknown
  slug → 404 with back-link, lesson empty state); SC-002 timing note
- [x] T019 Final review in `specs/003-ukulele-harmonic-circles/`: constitution
  (`.specify/memory/constitution.md`) compliance I–VIII + gates (incl. layering +
  lint/format green), SC-006 task-based check scheduled/complete (5 first-time
  readers, ≥4 unaided successes), and converge readiness across
  spec.md/plan.md/tasks.md

---

## Phase 7: Content audit + chapter index (follow-up)

**Purpose**: Tighten the chapter per the content-revision bar and add the
in-chapter index (FR-011) with derived heading anchors.

- [x] T020 [US2] Content revision in
  `frontend/src/content/topics/harmonic-circles.json` (~1,520 → ~1,200
  words; keep all corrected fingering facts; add practice drills +
  ≥1 named play-along song per circle; keep colon lead-ins directly
  above their figures)
- [x] T021 [P] Anchor-slug helpers + tests: `slugifyHeading()`/
  `sectionSlugs()` in `frontend/src/lib/lessons.ts` (lowercase, NFKD
  diacritics stripped, dash-collapsed, `overview-2` dedup) with unit
  tests in `frontend/tests/lessons.test.ts`
- [x] T022 Chapter index in `frontend/src/components/LessonReader.astro`
  (`aside`-first DOM with `nav[aria-label="In this chapter"]` linking
  `#introduction`, every section id, `#summary`; sticky side block at
  ≥lg, stacked above article below; `scroll-mt` anchors) with container
  tests in `frontend/tests/LessonReader.test.ts` (links render, every
  href resolves, aside-before-article order, lg docking classes)
- [x] T023 Gates + build verification: `npx vitest run` (88/88) +
  `npm run check-content` + `npm run check` + `npm run lint` +
  `npm run format:check` in `frontend/`; build check that all 8 index
  anchors resolve and all 12 diagrams render

---

## Phase 8: Circles explorer (follow-up, US4)

**Purpose**: Chords-style browsable circles index deriving its entries
from the lesson progressions (FR-012, FR-013, SC-007).

- [x] T024 [P] [US4] Pure collector tests in `frontend/tests/circles.test.ts`
  (`collectLessonCircles`: multi-section order, multi-topic concat,
  lesson-less topics skipped; `resolveCircleChords`: names + degrees +
  `Chord | null` incl. combined `"Bb / A# major"`, unresolved → null;
  `filterCircles`: `all` identity, key exactness; `sortCircles`: key
  pitch then name)
- [x] T025 [US4] Implement pure `frontend/src/lib/circles.ts` (the four
  functions above; `ROOT_PITCH` lookup for sort; zero Astro imports)
- [x] T026 [P] [US4] Island tests in `frontend/tests/CircleList.test.tsx`
  (jsdom: dropdown offers All + one option per key present; filter shows
  exactly the chosen key and All restores; single-open expansion shows
  every chord with name + diagram; reselect collapses; filter change
  resets expansion; empty + reset path; error + retry; keyboard
  operability via Enter)
- [x] T027 [US4] `frontend/src/components/CircleList.tsx` island
  (`client:load`; mirrors `ChordList` markup/classes/testids:
  heading + `visible-count`, dropdown `circle-filter`, list
  `circle-list`, detail `circle-detail`, empty + error states; at most
  one circle open; `circles` + Chords reference via props, resolving
  inline; no fetching)
- [x] T028 [P] [US4] Schema tests: `format: "circles"` cases in
  `frontend/tests/lesson.schemas.test.ts` (parses without `lesson`;
  rejects `lesson` on `"circles"`) + rule-17 content-integrity in
  `frontend/tests/content.schemas.test.ts` (`circles` topic exists with
  no `lesson`; explorer entry count equals lesson progression count)
- [x] T029 [US4] Schema + content + route: extend the `format` enum in
  `frontend/src/lib/content/schemas.ts`; seed
  `frontend/src/content/topics/circles.json` (title "Circles", slug
  "circles", `kind: "topic"`, `courseSlug: "ukulele"`,
  `format: "circles"`, `order: 2`, description 1–280 chars); branch
  `topic.format === "circles"` in
  `frontend/src/pages/courses/[course]/topics/[topic].astro` collecting
  entries via `collectLessonCircles()` over same-course lessons,
  passing the Chords reference, and rendering `<CircleList
  client:load>`; update
  `frontend/tests/routing.test.ts` expected slugs
- [x] T030 [US4] Validate quickstart V5 in
  `specs/003-ukulele-harmonic-circles/quickstart.md` (list, filter,
  expand, 360px) + full gates: `npx vitest run` + `npm run
  check-content` (3 topics) + `npm run check` + `npm run lint` + `npm
  run format:check` in `frontend/`; `pytest backend/` green; V4
  regression (Chords view unchanged, 404, lesson empty state); SC-007
  count equality

**Checkpoint**: All user stories (US1–US4) are independently functional;
the explorer lists every lesson circle with its diagrams.

---

## Dependencies

- Phase 2 → Phase 1 (T004/T005 need `marked` pinned by T001)
- Phase 3 (US1) → Phase 2 (seed + branch need T003 schemas, T005 resolver/renderer,
  T007 rule 15)
- Phase 4 (US2) → Phase 3 (readability lands on the T009 reader skeleton + route)
- Phase 5 (US3) → Phase 4 (progression blocks extend the T012 reader)
- Phase 6 → Phase 5 (gates cover all routes incl. the lesson view)
- Phase 7 → Phase 6 (content audit + index land on the reviewed reader;
  T023 re-runs the full gates incl. the new tests)
- Phase 8 → Phase 7 (explorer builds on the reviewed lesson content;
  T030 re-runs the full gates incl. the new tests)
- Within Phase 8 (test-first): T024→T025, T026→T027, T028→T029
- Within phases (test-first): T002→T003, T004→T005, T006→T007, T011→T012, T014→T015
- T008 content-first: seed early so `check-content` + content-integrity tests exercise
  the real chapter from T009 on; T009 and T011+ all read it.

## Parallel execution examples

- Foundational: T002 + T004 + T006 parallel (independent test files); then T003 +
  T005 + T007 (independent implementation files, after their tests)
- US1: T008 parallel with nothing else pending (page branch T009 needs T008's file
  present for route tests only at validation, but same-increment sequential is safer)
- US2: T011 first, then T012; then T013
- US3: T014 first, then T015; then T016
- Polish: T017 + T018-prep parallel; then T018 full run; then T019
- US4: T024 + T026 + T028 parallel (independent test files); then T025 +
  T027 + T029; then T030
- Six-circle follow-up: T031, then T032, then T033
- Twelve-circle follow-up: T034, then T035, then T036

---

## Phase 9: Three more circles (follow-up)

**Purpose**: Add Bb, D, and A circles (six total) as a difficulty ladder
after F, reusing the existing lesson schema and explorer derivation.

- [x] T031 [US3] Author 3 new circle sections in
  `frontend/src/content/topics/harmonic-circles.json` (Bb–Gm–Eb–F,
  D–Bm–G–A, A–F#m–D–E, all I–vi–IV–V; colon lead-ins last; Songs-to-try
  per circle; verified pivots) + intro/summary count updates (3→6
  circles) and practice/hearing cross-references
- [x] T032 Gates + revalidation: `check-content`, vitest 114,
  `format:check`, quickstart V2/V5 (9 sections, 24 diagrams, 6 cards, 7
  dropdown options), production build green
- [x] T033 Spec sync: counts 3→6 / 6→9 / 12→24 / 8→14 across
  spec/plan/data-model/quickstart/contracts/research + Phase 9 tasks +
  checklist pass-3 note

---

## Phase 10: All twelve circles (follow-up)

**Purpose**: Add Eb, Ab, E, B, Db, and F# circles (twelve total, every
major key) completing the difficulty ladder; the chapter now uses all 24
reference entries. Reuses the existing lesson schema and explorer
derivation.

- [x] T034 [US3] Author 6 new circle sections in
  `frontend/src/content/topics/harmonic-circles.json` (Eb–Cm–Ab–Bb,
  Ab–Fm–Db–Eb, E–C#m–A–B, B–G#m–E–F#, Db–Bbm–Gb–Ab, F#–D#m–B–C#,
  all I–vi–IV–V; colon lead-ins last; Songs-to-try per circle; verified
  pivots) + intro/summary count updates (6→12 circles), practice/hearing
  cross-references, and two accuracy fixes (G circle newcomers, E-major
  hardest softened)
- [x] T035 Gates + revalidation: `check-content`, vitest 114,
  `format:check`, quickstart V2/V5 (15 sections, 48 diagrams, 12 cards,
  13 dropdown options), production build green
- [x] T036 Spec sync: counts 6→12 / 9→15 / 24→48 / 14→24 across
  spec/plan/data-model/quickstart/contracts/research + Phase 10 tasks +
  checklist pass-4 note

---

## Implementation strategy

- **MVP**: US1 (discovery + lesson landing shell) delivers a reachable topic first;
  US2 (readable chapter) is the book-material increment; US3 (playable progressions)
  is the practice-tool increment on top.
- **Increments**: each US phase merges independently green (its tests + quickstart
  scenario); backend untouched throughout; US4 (explorer) is the
  lookup-tool increment reusing US1–US3 content as its single source.
- **Ownership**: `frontend/**` only, following the astro-frontend workflow
  (spec-first, test-first, Principle VIII layering, gates green); no cross-app
  contract needed (`contracts/routes.md`).
- **Total**: 36 tasks (Setup 1, Foundational 6, US1 3, US2 3, US3 3, Polish 3, Content-audit+index 4, Explorer 7, Six-circle follow-up 3, Twelve-circle follow-up 3).

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable per its checkpoint
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
