# Tasks: Music Course Catalog (Ukulele + Chords)

**Input**: Design documents from `/specs/001-music-course-catalog/`
(plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: Included — constitution Principle III (test-first, both apps) and
the user's standing rule ("unit test for all code in frontend and backend")
require them. Within each phase, test tasks precede their implementation.

**Organization**: Grouped by user story (US1 P1, US2 P2, US3 P3) for
independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths in every description

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization — both apps exist with pinned toolchains.

- [x] T001 Scaffold `frontend/` Astro 5 + `@astrojs/react` + TypeScript app per plan.md + research.md R9 (Tailwind CSS v4 latest via `@tailwindcss/vite`, `src/styles/global.css` with `@theme` tokens, shared `src/layouts/Layout.astro` importing it, `tsconfig` `@/*` alias, `shadcn@latest init` with rsc:false tsx:true + seed `ui` components button/native-select/dialog/card (native `<select>`+`<optgroup>` filter per R9; Radix `Select` only if custom option rendering needed later), `cn()` in `src/lib/utils.ts`); record pinned versions in `frontend/package.json` + `frontend/components.json`; pin ESLint + Prettier (`eslint-plugin-astro`, `prettier-plugin-astro`) with `lint`/`format` scripts + `tsx` devDep for the check-content runner; scaffold Principle VIII layering (pages → components → lib → content)
- [x] T002 [P] Scaffold `backend/` AgentOS app (`backend/app/main.py`, `backend/db.py`, `backend/pyproject.toml`, `backend/Dockerfile`, `backend/agents/`, `backend/evals/`, `backend/tests/`) per plan.md + Principle VIII layering (app → domain → db); pin Ruff with lint/format config
- [x] T003 [P] Create root `docker-compose.yml` (api + `pgvector/pgvector:pg17` db) and `.env.example` (DB_* vars, no secrets)
- [x] T004 [P] Configure Vitest + React Testing Library + jsdom in `frontend/` (`vitest.config.ts` built with `getViteConfig()` from `astro/config` + `test` script in `frontend/package.json`; `.astro` tests render via `experimental_AstroContainer` from `astro/container` per research.md R7)
- [x] T005 [P] Configure pytest in `backend/` (pytest config + `httpx` for app tests)
- [x] T006 Write `frontend/README.md` + `backend/README.md` dev/test/build/lint/format one-liners + short architecture overview (layers + dependency direction per Principle VIII / R10) (constitution workflow gate #5)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared libs, schemas, and backend scaffold every story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T007 [P] Content schema + collection contract tests in `frontend/tests/content.schemas.test.ts` targeting pure `frontend/src/lib/content/schemas.ts` + `frontend/src/lib/content/validate.ts` (+ `frontend/src/lib/notes.ts` constants; zero Astro imports) (one valid + one invalid fixture per collection per `contracts/content-schema.md`; per-entry invalid MUST assert Zod throws — chord fixtures MUST include a bad root spelling like "Hb", a mismatched rootPitch, and a wrong alias pair; referential/collection invalid fixtures (bad courseSlug/topicSlug, dup slug, chord count ≠24, dup chord name, unmatched filter spelling) MUST target `validateCollections()` and assert returned errors name the broken entry — plus a content-integrity test over the real `src/content/**/*.json` (parse with pure schemas + `validateCollections()`, expect zero errors; dangling-ref edge case))
- [x] T008 Implement pure modules `frontend/src/lib/notes.ts` (NOTE_ROOTS/NOTE_ALIASES + ROOT_PITCH/ENHARMONIC_PAIR, zero imports) + `frontend/src/lib/content/schemas.ts` (courses/topics/games/chords Zod schemas: titles 1–80 chars, descriptions 1–280 chars, slugs `^[a-z0-9]+(-[a-z0-9]+)*$` max 64 chars, `kind` literal topic/game, chord `type` major/minor, `root` enum of 12 primary spellings, `rootAlias` enum of 5 sharps, `rootPitch` + alias-pair `.refine` rules over `../notes.ts` lookups, `frets`/`fingers` int[4]) + `frontend/src/lib/content/validate.ts` (`validateCollections({courses,topics,games,chords}) → string[]` naming the broken entry: dangling courseSlug/topicSlug refs, slug uniqueness per scope, chords exactly 24 + unique names + one entry per (rootPitch,type) + every NOTE_ROOTS/ALIASES spelling matches via root/rootAlias; imports types + `../notes` only) and thin wiring in `frontend/src/content.config.ts` (`defineCollection({ loader, schema })` importing pure schemas only — per-entry validation at `astro sync`/build) + `frontend/scripts/check-content.ts` (reads `src/content/**/*.json`, parses with pure schemas, runs `validateCollections`, exits non-zero naming the broken entry) wired as `check-content` + `prebuild` scripts in `frontend/package.json` (`"check-content": "tsx scripts/check-content.ts"`, `"prebuild": "npm run check-content"`; `tsx` devDep pinned in T001)
- [x] T009 [P] Slug util tests in `frontend/tests/slug.test.ts` (FR-015: lowercase ASCII, single hyphens, ≤64 chars, `-2`/`-3` collision suffixes)
- [x] T010 Implement `frontend/src/lib/slug.ts` (FR-015: slugify + per-scope uniqueness helpers)
- [x] T011 [P] Filter tests in `frontend/tests/chords.test.ts` (`"all"` identity, major/minor type match, note spelling matches `root` OR `rootAlias` incl. Bb and A# matching the same combined entry, FR-017 default order)
- [x] T012 Implement `frontend/src/lib/chords.ts` (`Chord` via `z.infer` type-only import from `./content/schemas`, `FilterOption` type + `filterChords()` matching root or alias + flat-first display-name helper + FR-017 default sort; zero Astro imports, no runtime dependency on T008)
- [x] T013 [P] Backend health/config tests in `backend/tests/test_health.py` (GET /health → ok; env config loads; compose file parses with api+db services)
- [x] T014 Implement `GET /health` + env config in `backend/app/main.py` + `backend/db.py` (PostgresDb wiring, no SQLite)
- [x] T015 [P] View-state tests in `frontend/tests/ViewStates.test.ts` via `experimental_AstroContainer` from `astro/container` (loading indicator, friendly empty, error + retry render per `contracts/routes.md`)
- [x] T015b View-state partials in `frontend/src/components/ViewStates.astro` (loading indicator, friendly empty, error + retry per `contracts/routes.md`; styled with Tailwind utilities + shadcn theme tokens)

---

## Phase 3: User Story 1 — Browse the course catalog (P1)

**Goal**: Home page lists every course as a card; selecting a card opens the course page (FR-001, FR-002, FR-005).

**Independent Test**: Open `/`, verify course cards render with title +
description + entry action; select Ukulele → lands on course page. Empty
collection → friendly empty state (quickstart V1).

- [x] T016 [P] [US1] Seed `frontend/src/content/courses/ukulele.json` (title "Ukulele", slug "ukulele", description 1–280 chars)
- [x] T017 [P] [US1] Card component tests in `frontend/tests/CourseCard.test.ts` via `experimental_AstroContainer` from `astro/container` (title, description, entry action render)
- [x] T018 [US1] Implement `frontend/src/components/CourseCard.astro` (static card; Tailwind utilities + shadcn card/token styles)
- [x] T019 [US1] Implement `frontend/src/pages/index.astro` Home page (all course cards via `getCollection`, entry navigation, empty state, FR-016 view states)
- [x] T020 [US1] Validate quickstart V1 in `specs/001-music-course-catalog/quickstart.md` (browse catalog incl. empty-state check)

---

## Phase 4: User Story 2 — Explore a course's topics and games (P2)

**Goal**: Course page lists Topics/Games as kind-labeled cards; selecting a card opens the topic/game view (FR-003, FR-004, FR-006).

**Independent Test**: Open `/courses/ukulele` directly, verify title + "Topic — Chords" card; select it → Chords view opens (quickstart V2).

- [x] T021 [P] [US2] Seed `frontend/src/content/topics/chords.json` (title "Chords", slug "chords", `kind: "topic"`, `courseSlug: "ukulele"`, description 1–280 chars)
- [x] T022 [P] [US2] Card tests in `frontend/tests/TopicGameCard.test.ts` via `experimental_AstroContainer` from `astro/container` (kind label Topic vs Game, title, description)
- [x] T023 [US2] Implement `frontend/src/components/TopicGameCard.astro` (static card with declared-kind label; Tailwind utilities + shadcn card/token styles)
- [x] T024 [US2] Implement `frontend/src/pages/courses/[course].astro` (course title + topic/game cards via `getStaticPaths`, empty state, FR-016 view states)
- [x] T025 [US2] Validate quickstart V2 in `specs/001-music-course-catalog/quickstart.md` (course exploration)

---

## Phase 5: User Story 3 — Filter chords by type or note (P3)

**Goal**: Chords view lists ukulele chords with diagrams + dropdown filter (all/Major/minor/per-note incl. flats+sharps); selecting an entry opens detail display, no audio (FR-007–FR-011).

**Independent Test**: Open Chords view directly, exercise each dropdown option (incl. Bb vs A#), reset to all, open/close one detail display; each update <2s (quickstart V3).

- [x] T026 [P] [US3] Seed 24 chord entries in `frontend/src/content/chords/*.json` (SC-005: major+minor × 12 pitches; combined flat-first names e.g. "Bb / A# major"; `name` unique per topic, `type` major/minor, `root` from 12-spelling enum + `rootAlias` enharmonic partner, `rootPitch` 0–11 matching `ROOT_PITCH[root]`, `topicSlug: "chords"`, `diagram` with `strings: "GCEA"`, `frets`/`fingers` int[4], `baseFret` default 1)
- [x] T027 [P] [US3] Diagram tests in `frontend/tests/ChordDiagram.test.tsx` (SVG strings/frets/dots/finger numbers, baseFret label, barre rendering, placeholder path for invalid data)
- [x] T028 [US3] Implement `frontend/src/components/ChordDiagram.tsx` (inline SVG 4 strings × 5 frets + accessible title/desc + placeholder path)
- [x] T029 [P] [US3] Island tests in `frontend/tests/ChordList.test.tsx` (FR-008 grouped native select + optgroup; FR-009 each option via `selectOptions` → visible list; reset restores all; entry expands in place single-open showing name/type/root/diagram, collapses on reselect, keyboard-operable with aria-expanded; synthetic zero-match case shows empty state + reset path; update <2s SC-002)
- [x] T030 [US3] Implement `frontend/src/components/ChordList.tsx` filter island (FR-008 grouped native `<select>` + `<optgroup>` per `contracts/content-schema.md` via shadcn NativeSelect primitive or Tailwind-styled select + theme tokens — Radix `Select` only if custom option rendering needed, FR-009 live list update + reset, FR-017 default order, FR-010 inline-expansion detail, FR-013/FR-016 empty + error + retry states; Tailwind utilities + shadcn theme tokens throughout)
- [x] T031 [US3] Implement `frontend/src/pages/courses/[course]/topics/[topic].astro` Chords view (static shell + `client:load` ChordList island)
- [x] T032 [US3] Validate quickstart V3 in `specs/001-music-course-catalog/quickstart.md` (filter scenarios incl. Bb/A# same-entry match, inline detail expand/collapse, no-audio boundary; SC-001 reachability Home→Chords ≤3 selections)

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 404, reserved game route, accessibility, full gates.

- [x] T033 [P] Routing tests in `frontend/tests/routing.test.ts`: (a) pure `frontend/src/lib/routes.ts` helpers (`courseStaticPaths`/`topicStaticPaths`/`gameStaticPaths`) return exactly the seeded slugs — thin pages delegate their `getStaticPaths()` to them (Principle VIII); (b) `404.astro` container-renders via `experimental_AstroContainer` with a working back-link; (c) duplicate titles resolve to `-2` suffix and surface loudly. Route-level "unknown path → 404" is a build/preview property, verified by quickstart V4.
- [x] T034 Implement `frontend/src/pages/404.astro` (FR-014/SC-006 not-found page + working link back to `/`)
- [x] T035 Implement reserved `frontend/src/pages/courses/[course]/games/[game].astro` route pattern (unknown or absent game slug renders `frontend/src/pages/404.astro` per FR-014; no game content ships in v1)
- [x] T036 [P] Accessibility pass on `frontend/src/components/*.astro` + `frontend/src/components/Chord*.tsx` cards/dropdown/list/detail (semantic markup + keyboard operability per spec Out-of-Scope boundary)
- [x] T037 [P] Run full gates per `specs/001-music-course-catalog/quickstart.md` V4: in `frontend/`, `npm test` (53/53) + `npm run check-content` (prebuild gate green on real JSON; bad `rootPitch` fixture → `npm run build` exit 1 naming `chords/c-major.json [rootPitch]`) + `npm run check` (astro check, 0 errors — caught 4 `from "cn"` imports in unimported shadcn seeds) + `npm run lint`/`npm run format:check` + in `backend/`, `pytest` (5/5) + `ruff check`/`ruff format --check` + `docker compose up` smoke (db healthy, api `/health` → `{"status":"ok"}`) + SC-004 scale check (FR-012: throwaway 20 course / 50 topic-game fixtures → 21 course cards on `/`, 50 cards + 50 hrefs on the fixture course page, 74 pages built; fixtures removed) + SC-007 timing (deferred: needs browser Fast-4G throttling; static build + one island)
- [ ] T038 Final review in `specs/001-music-course-catalog/`: constitution (`.specify/memory/constitution.md`) compliance I–VIII + gates (incl. layering + lint/format green), SC-003 task-based check scheduled/complete (10 first-time users, ≥9 unaided successes), and converge readiness across spec.md/plan.md/tasks.md

---

## Dependencies

- Phase 2 → Phase 1 (scaffold before libs/schemas; T008 needs T001+T004; T014 needs T002+T005)
- Phase 3 (US1) → Phase 2 (needs T008 content.config wiring, T010 slug, T015b ViewStates)
- Phase 4 (US2) → Phase 3 (topic seed references `courseSlug: "ukulele"` from T016; US1 acceptance navigates to course page)
- Phase 5 (US3) → Phase 4 (chord seeds reference `topicSlug: "chords"` from T021; course page links to Chords view)
- Phase 6 → Phase 5 (404/routing tests cover all routes incl. Chords view)
- Within phases: test tasks → implementation (T007→T008, T009→T010, T011→T012, T013→T014, T015→T015b, T017→T018, T022→T023, T027→T028, T029→T030, T033→T034)
- T008 ↔ T012: no ordering edge (shared leaf `frontend/src/lib/notes.ts` is created in T008; `chords.ts` takes only a type-only `Chord` import from the schema module — both build against frozen `contracts/content-schema.md`)

## Parallel execution examples

- Setup: T002, T003, T004, T005 all parallel after T001 starts (different files; T004/T005 are tool configs, T002/T003 independent scaffolds)
- Foundational: T007 + T009 + T011 + T013 + T015 parallel (independent test files); then T008, T010, T012, T014, T015b (all independent implementations)
- US1: T016 + T017 parallel; then T018; then T019; then T020
- US2: T021 + T022 parallel; then T023; then T024; then T025
- US3: T026 + T027 + T029 parallel; then T028 + T030 (different files, parallel after their tests); then T031; then T032
- Polish: T033 + T036 + T037-prep parallel; then T034, T035; then T037 full run; then T038

## Implementation strategy

- **MVP**: US1 + US2 (navigation skeleton: catalog → course → topic shell) delivers a browsable catalog first; US3 (Chords explorer) is the flagship increment on top.
- **Increments**: each US phase merges independently green (its tests + quickstart scenario); backend scaffold (T002/T003/T005/T013/T014) can land in any increment as it carries no feature traffic.
- **Ownership**: `frontend/**` → `astro-frontend` subagent; `backend/**` + `docker-compose.yml` → `agno-backend` subagent; no cross-app contract needed in v1 (`contracts/routes.md`).
