# Tasks: Ukulele Lyrics + Chords Generator

**Input**: Design documents from `/specs/004-lyrics-chords-generator/`
(plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — constitution Principle III (test-first, both apps) and
the user's standing rule ("unit test for all code in frontend and backend")
require them. Within each phase, test tasks precede their implementation.
Evals (Principle IV) cover the model fallback path; the model pick itself is
gated on a live `openrouter-model-eval` run per Principle V (T029).

**Organization**: Grouped by user story (US1 P1, US2 P2, US3 P3) for
independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/`, `frontend/` at repository root (per plan.md)
- Frontend tests: `frontend/tests/*.test.ts(x)` (+ `frontend/tests/fixtures/`)
- Backend tests: `backend/tests/test_*.py` (+ `backend/tests/fixtures/`)
- Evals: `backend/evals/test_*.py` (Agno test-scenarios)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies, env placeholders, and package scaffolds both apps need.

- [X] T001 Promote `httpx` to main deps and add `openai>=1,<2` (runtime for Agno's OpenRouter provider behind the R6 fallback Agent; no bare SDK calls) in `backend/pyproject.toml` per plan.md Technical Context + research.md Toolchain pins + add "db_models" to py-modules in the same edit (packaging honesty; container runs from source)
- [X] T002 [P] Add `OPENROUTER_API_KEY` / `YOUTUBE_API_KEY` / `GENIUS_ACCESS_TOKEN` / `CORS_ORIGINS` / `OWNER_ID` placeholders to `.env.example` (all optional at runtime with graceful degradation per research.md R10; placeholders only, never secrets) + propagate the provider keys + `OWNER_ID` into the container via `docker-compose.yml` `api.environment` (`${VAR:-}` entries — compose has no `env_file`, so root `.env` values never reach the container otherwise)
- [X] T003 [P] Scaffold `backend/agents/sheets/__init__.py` domain package shell (no logic; Principle VIII: domain MUST NOT import the web layer) + `backend/evals/` + `backend/tests/fixtures/` directories

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared persistence, contracts, pure helpers, and test harnesses every story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 [P] SQLAlchemy model tests in `backend/tests/test_db_models_sheets.py` against transient Postgres via Compose `db` service (no SQLite anywhere, Principle VII): `owner_id` MUST equal `OWNER_ID`, `query` "1–200 chars, trimmed", `matched_title`/`matched_performer` "1–200 chars", `provider_refs` "at least the lyric ref present", `lyric_source` enum-ish "`chart` | `lrclib` | `lyrics_ovh`", `lyric_source_url` "https link-back" always present, `chord_source` "`chart` | `model-generated` | `none`" three-way rule 2 (model-generated ⟺ `model_id` present AND URL NULL; chart ⟺ URL present AND `model_id` NULL; `none` ⟺ BOTH NULL + `degraded` chords entry), `body` "≥1 section, ≥1 lyric line", `source_links` "≤8 items" all https deduped, `degraded` "`[]` or `[{part, reason}]` enums" persisted, history FK resolves + list order `created_at DESC`, append-only (no UPDATE/DELETE paths)
- [X] T005 Implement `backend/db_models.py` (`SongSheet` + `HistoryEntry` SQLAlchemy models on the existing Postgres beside `db.py`, `OWNER_ID = "owner"` domain constant with env override permitted, all constraints from T004; table creation wired for app startup and tests)
- [X] T006 [P] Record provider fixtures in `backend/tests/fixtures/` (chart search `js-store` JSON + tab `wiki_tab.content` Riptide 5295-char sample, LRCLIB search/get JSON, lyrics.ovh JSON, Genius search JSON, YouTube search JSON) from the research.md verified probes — CI hermetic, no live provider calls (research.md R12)
- [X] T007 [P] REST Zod contract tests in `frontend/tests/sheets.schemas.test.ts` targeting `frontend/src/lib/sheets/schemas.ts` (one valid + one invalid fixture per `contracts/rest-api.md` shape: song-search req/res, sheets req/res incl three shapes (chart-hit / fallback / lyrics-only with `chord_source: none`, BOTH NULL, `degraded` chords entry per data-model rule 2) + "`source_links` ≤ 8", history list/get/regenerate envelopes, error shape codes `VALIDATION_ERROR`/`NO_MATCH`/`NOT_FOUND`/`PROVIDER_ERROR` (no 429 in v1) + `degraded` array fixtures (`part` `video`/`chords`, `reason` `quota`/`timeout`/`unavailable`))
- [X] T008 Implement `frontend/src/lib/sheets/schemas.ts` (Zod mirrors of `contracts/rest-api.md`: candidate with nullable `album`/`artwork_url` + `provider_refs` at least one present, sheet body sections/lines/chords with `offset` UTF-16 code-unit index + `symbol` Western notation, `source_links` kind `lyrics`|`chords`|`video`, `degraded` array (`part`/`reason` enums), `chord_source` `chart`|`model-generated`|`none` with `none` ⟹ `degraded` chords entry, error taxonomy; zero Astro imports per Principle VIII)
- [X] T009 [P] Pure helper tests in `frontend/tests/sheets.test.ts` (candidate dedup by normalized `title + artist` lowercase/punctuation-folded, chord-position normalization, catalog cross-link matching against the 24-entry Chords reference, `source_links` dedup against attribution URLs)
- [X] T010 Implement `frontend/src/lib/sheets.ts` (pure sheet helpers per research.md R11; zero Astro imports, zero UI imports)
- [X] T011 [P] Backend test harness in `backend/tests/conftest.py` (FastAPI `TestClient` + transient Postgres session fixtures + `OWNER_ID` env handling; no SQLite)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Discover and open the generator (Priority: P1) 🎯 MVP

**Goal**: Ukulele course page shows the "Lyrics + Chords" Game card; selecting it opens the generator view with a song-name input (FR-001, FR-002, FR-003 input part, FR-015 game-slug branch).

**Independent Test**: Open `/courses/ukulele` directly, verify the Game-labeled generator card with title + description + entry action; select it → `/courses/ukulele/games/lyrics-chords` shows the song-name input + search-and-generate action (quickstart V1).

- [X] T012 [P] [US1] Seed `frontend/src/content/games/lyrics-chords.json` (title `"Lyrics + Chords"`, slug `"lyrics-chords"`, kind `"game"` explicitly declared, `courseSlug: "ukulele"`, description 1–280 chars FR-001 card text, `rules` usage text REQUIRED before any game ships, `order: 10` after the Chords/Harmonic Circles topics)
- [X] T013 [P] [US1] Game-entry contract tests in `frontend/tests/game-entry.test.ts` (one valid + one invalid fixture per `contracts/game-route.md`: `kind` literal, slug shape max 64 chars, per-course uniqueness rule 2, `courseSlug` resolves to ukulele rule 3; invalid asserts Zod throws / `validateCollections()` names the broken entry; real-JSON integrity via the existing `check-content.ts` prebuild gate — no new content tooling per data-model rule 8)
- [X] T014 [P] [US1] Island input-state tests in `frontend/tests/SheetGenerator.input.test.tsx` (song-name input 1–200 chars trimmed + single search-and-generate action render per FR-003; empty submit blocked with inline guidance, no search runs; unreachable backend surfaces the `error` state, never a blank page, per game-route.md)
- [X] T015 [US1] Implement input skeleton in `frontend/src/components/SheetGenerator.tsx` (React island, `client:load`: input + action + FR-003 empty guidance + FR-014 error-state shell; candidates/sheet/history wiring lands in US2/US3; runtime fetch only via `PUBLIC_API_URL` default `http://localhost:8000`, no SSR fetch)
- [X] T016 [US1] Edit `frontend/src/pages/courses/[course]/games/[game].astro` (thin shell: breadcrumb + title + description, render `SheetGenerator` island for `lyrics-chords`, keep coming-soon empty state for other games; static output preserved, route created by `gameStaticPaths()` enumerating the games collection)
- [X] T017 [US1] Validate quickstart V1 in `specs/004-lyrics-chords-generator/quickstart.md` (card alongside Chords/Harmonic Circles, navigation ≤3 selections SC-001, unknown slug → 404 + link to `/` FR-015/SC-007)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Search a song and generate lyrics with chords (Priority: P2)

**Goal**: Song-name submit → candidate disambiguation → generated song sheet (lyrics + aligned chords, per-part attribution, sources list incl. video) persisted to history (FR-003–FR-008, FR-012, FR-013, FR-016; SC-002, SC-005).

**Independent Test**: Open the generator view directly, enter "Riptide", verify loading → sheet with matched identity + aligned chords + `lyrics:`/`chords:` attribution + sources list within 30 s; ambiguous name → candidate list → pick generates; gibberish → no-match + retry; empty → inline guidance; failure → error + retry with input preserved (quickstart V2).

### Tests for User Story 2 (constitution Principle III — write FIRST, FAIL before implementation) ⚠️

- [X] T018 [P] [US2] Normalize tests in `backend/tests/test_sheets_normalize.py` (chart/lyrics text → body `sections`/`lines`/`chords` with `offset` UTF-16 code-unit index into `text` + `symbol` standard Western notation incl. full FR-013 vocabulary; `heading` nullable preserved as-is; zero-chord lines legal; out-of-range offsets / unparsable symbols rejected per data-model rule 1)
- [X] T019 [P] [US2] Chart client tests in `backend/tests/test_sheets_charts.py` with fixtures (search `js-store` parse incl. ukulele `?type=800` form → pick top `Chords`/`Ukulele Chords` by rating × votes; fetch `tab_url` → `wiki_tab.content` with `[ch]`/`[tab]` tags stripped; exact-artist → title-only fallback on empty/error; 10 s per-call timeout; polite sequential 1–2 s gaps)
- [X] T020 [P] [US2] Lyrics client tests in `backend/tests/test_sheets_lyrics.py` with fixtures (LRCLIB `GET /api/search?q=` max 20 no pagination → `GET /api/get?track_name=&artist_name=` both required or `GET /api/get/{id}`; long→short query fallback REQUIRED; lyrics.ovh `GET /v1/{artist}/{title}` fallback; `User-Agent` identification + 200–500 ms throttle + honor `429`/`Retry-After`)
- [X] T021 [P] [US2] Candidates tests in `backend/tests/test_sheets_candidates.py` with fixtures (Genius rank order first + LRCLIB-only extras deduped by normalized `title + artist`; `GENIUS_ACCESS_TOKEN` absent → LRCLIB-only mode with no artwork, flow still satisfies FR-006; zero results → empty list for the no-match state)
- [X] T022 [P] [US2] Sources tests in `backend/tests/test_sheets_sources.py` with fixtures (composition lyric pages → chord/tab pages → video, cap 8 links, dedup against FR-012 attribution URLs, `kind` in `lyrics`|`chords`|`video`; `YOUTUBE_API_KEY` absent → page links only + video empty state; quota exhausted → video empty + notice + `degraded [{part: video, reason: quota}]`, pages intact (M4); no per-keystroke search anywhere)
- [X] T023 [P] [US2] Pipeline tests in `backend/tests/test_sheets_pipeline.py` with fixtures (R0 strict order, no cross-source merging: chart hit → whole sheet from the chart with single per-part attribution; chart miss → fetched lyrics + model fallback attributed `lyrics: <provider>` / `chords: model-generated`; lyrics miss everywhere → `NO_MATCH` with no rows written; never a sheet with neither lyrics nor chords; lyrics-without-chords → ready sheet persisted as `chord_source: none` (BOTH NULL) + `degraded {part: chords}` per reason + chords-missing notice (counts as failing SC-005); pipeline deadline 25 s propagated with skip-vs-fail (skip video → sheet w/o video (`degraded {part: video, reason: timeout}`); skip model → lyrics-only (`none` + `degraded {part: chords, reason: timeout}`) + notice; lyrics timeout → PROVIDER_ERROR, no rows, each skip records a `degraded` entry per reason); every completed search inserts one `song_sheets` row + one `history_entries` row FR-008)
- [X] T024 [P] [US2] Search/generate route tests in `backend/tests/test_routes_sheets_search.py` via `TestClient` (POST `/api/v1/song-search`: query 1–200 chars trimmed, empty → `VALIDATION_ERROR` 422, merge order, `[]` legal → no-match; POST `/api/v1/sheets`: candidate echo re-validated tampered/empty → 422, exactly one of chart-hit/fallback/lyrics-only shapes (lyrics-only = `chord_source: none`, BOTH NULL, `degraded` chords entry per data-model rule 2), `source_links` ≤ 8, inserts sheet + entry, lyrics miss → `NO_MATCH` no rows; error taxonomy mapping (4 codes, no 429) + `degraded` assertions on 200; CORS preflight (OPTIONS on the search route returns the configured `Access-Control-Allow-Origin`); backend budget 25 s)
- [X] T025 [P] [US2] CandidateList tests in `frontend/tests/CandidateList.test.tsx` (rows render title/artist/album/artwork; pick → generate; loading indicator; error message + retry with input preserved FR-007; empty merges into no-match)
- [X] T026 [P] [US2] SheetView + chord-diagram generator tests in `frontend/tests/SheetView.test.tsx` + `frontend/tests/chord-diagrams.test.ts` (matched identity title + performer as found; sections in order with lyrics + chords above `offset`; per-part `lyrics:`/`chords:` attribution block atop sheet with link-backs; `chords: model-generated` label path; chords-missing notice path keyed off `chord_source: none` + `degraded` chords reason; catalog cross-links for the 24-entry reference + generated GCEA diagrams for resolvable off-catalog symbols + "Chords in this song" reference rail stacking every unique chord (M2 as amended 2026-09-16); diagram-unavailable tag only for unvoiceable symbols; transpose stepper (Tr. 0/±N display, ±11 bounds, reset, inline + rail update, reset on new sheet; transpose amendment 2026-09-16); `capo`/`tuning_note` informational display)
- [X] T027 [P] [US2] SourceLinks tests in `frontend/tests/SourceLinks.test.tsx` (≤8 links with provider/label, `target="_blank"` + `rel="noopener"`, dead links MUST NOT break the sheet, empty state explaining no other sources found FR-016; video-part empty + notice keyed off `degraded {part: video}` quota/timeout/unavailable)
- [X] T028 [P] [US2] Island generate-flow tests in `frontend/tests/SheetGenerator.generate.test.tsx` (submit → loading → sheet/candidates/no-match; ambiguous → candidate pick generates that song; gibberish → no-match + retry spelling; failure → error + retry input preserved; sources list alongside sheet; backend stopped → error state)

### Model gate (Principle V — BLOCKS T036–T037)

- [X] T029 [US2] Run the `openrouter-model-eval` skill with live MCP and record the decision in `specs/004-lyrics-chords-generator/research.md` Appendix A (requirements per R6: structured chord alignment over provided lyrics JSON out, quality bar ≥80% of lyric lines carry plausible chords SC-005 + full FR-013 vocabulary incl. 7ths/sus/dim/aug, latency ≤20 s within SC-002, hobby-trivial cost, one-song context, OpenRouter via `backend/` only; candidates table + test prompts/results on a fixture song + winner/rationale + runner-up trigger + exact model ID + provider route) — NO model ID in code before this record merges

### Implementation for User Story 2

- [X] T030 [US2] Implement `backend/agents/sheets/normalize.py` (chart/lyrics → shared body shape per data-model.md; headings preserved as-is; offsets UTF-16; symbols Western notation FR-013; zero-chord lines legal; no web imports)
- [X] T031 [P] [US2] Implement `backend/agents/sheets/charts.py` (httpx chart client per research.md R5: `search(title, artist[, category])` ukulele-preferring, rating × votes pick, `fetch(tab_url)` → plain-text chart, `[ch]`/`[tab]` strip, exact-artist → title-only fallback, 10 s timeouts, polite 1–2 s gaps; no web imports)
- [X] T032 [P] [US2] Implement `backend/agents/sheets/lyrics.py` (LRCLIB primary + lyrics.ovh fallback per R1/R2 with long→short fallback, UA + throttle + `429` honor; no web imports)
- [X] T033 [P] [US2] Implement `backend/agents/sheets/candidates.py` (Genius-primary merge per R3 + LRCLIB-only no-token mode; no web imports)
- [X] T034 [P] [US2] Implement `backend/agents/sheets/sources.py` (FR-016 assembly per R7: order, cap 8, dedup vs attribution, key-absent degradation; no web imports)
- [X] T035 [US2] Implement `backend/agents/sheets/pipeline.py` (R0 orchestration: resolve → chart-hit whole sheet / miss → lyrics + fallback / lyrics-miss → no-match; persists immutable `song_sheets` row; 25 s pipeline deadline propagated with skip-vs-fail per R10; depends on T030–T034; seam: pipeline calls fallback.align(lyrics); T035 lands with a SkipModel→lyrics-only stub behind that interface; T036 implements it post-gate; no web imports)
- [X] T036 [US2] Implement `backend/agents/sheets/fallback.py` (R6 chord alignment as an Agno `Agent(model=OpenRouter(id=<Appendix A>), output_schema=<body-shape Pydantic>)` built by a factory — no bare SDK calls so T037 evals target a real Agent; chart-miss path ONLY, never rewrites/generates lyrics, emits the shared body shape with full FR-013 vocabulary, stores exact model ID for `chords: model-generated` provenance; missing key → lyrics-only sheet (`chord_source: none`, BOTH NULL, `degraded {part: chords, reason: unavailable}`) + chords-missing notice, never a hard error; BLOCKED on T029; no web imports)
- [X] T037 [US2] Create Agno eval scenarios in `backend/evals/test_sheets_fallback.py` targeting the factory-built T036 Agent (`chord_coverage` ≥80% of lyric lines carry chords on fixture songs, `attribution_present` model-generated + model ID stored, `vocabulary_valid` every symbol parses incl. 7ths/sus/dim/aug, `lyrics_untouched` output lyric text == input exactly; gates MUST be green before merge per Principle IV, re-run on any prompt/tool/model change; BLOCKED on T029)
- [X] T038 [US2] Implement POST `/api/v1/song-search` + POST `/api/v1/sheets` + shared error taxonomy (`NO_MATCH`/`PROVIDER_ERROR`/`VALIDATION_ERROR`/`NOT_FOUND`, never stack traces; no 429 — quota/timeout degrade to 200 `degraded` entries per contracts/rest-api.md) with Pydantic mirrors of `contracts/rest-api.md` in `backend/app/routes_sheets.py` (`OWNER_ID` stamped server-side, 25 s pipeline deadline propagated per R10) and wire the router in `backend/app/main.py` (health + AgentOS mount unchanged) + wire `CORSMiddleware` in `backend/app/main.py` from the `CORS_ORIGINS` env (comma-separated, default `http://localhost:4321` for the Astro dev island — without it every browser POST fails preflight and the island sits in the FR-007 error state)
- [X] T039 [P] [US2] Implement `frontend/src/components/CandidateList.tsx` (presentational candidate rows; props in, events out; Tailwind + shadcn tokens)
- [X] T040 [P] [US2] Implement `frontend/src/components/SheetView.tsx` + `frontend/src/components/TransposeControl.tsx` + pure `frontend/src/lib/chord-diagrams.ts` (transpose helpers `transposeChordSymbol`/`transposeSheet`) (presentational sheet: sections, chords-above-lyrics, attribution block atop, "Chords in this song" reference rail stacking every unique chord with its diagram — catalog first, generated GCEA fingerings for off-catalog + display-only transpose stepper (±11 semitones, reset + Reset/±3 helpers; transpose amendment 2026-09-16); Tailwind + shadcn tokens; zero Astro imports in lib per Principle VIII). Amendment 2026-09-16 (inline diagrams): `frontend/src/components/ChordPopover.tsx` + `frontend/tests/ChordPopover.test.tsx` — inline symbols disclose their diagram (mouse hover transient; click/tap/Enter pin; second activation/Escape/outside tap close; touch hover ignored) and no longer link to the Chords topic
- [X] T041 [P] [US2] Implement `frontend/src/components/SourceLinks.tsx` (presentational FR-016 outbound links; Tailwind + shadcn tokens)
- [X] T042 [US2] Extend `frontend/src/components/SheetGenerator.tsx` (search → candidates → sheet flow per game-route.md view states; runtime fetch of `PUBLIC_API_URL`, no SSR fetch; depends on T039–T041)
- [X] T043 [US2] Validate quickstart V2 in `specs/004-lyrics-chords-generator/quickstart.md` (Riptide sheet ≤30 s SC-002, ambiguous candidates FR-006, gibberish no-match, empty guidance FR-003, backend-stopped error FR-007, 10-song SC-005 sample: every sheet identity + per-part attribution + ≥80% of lyric lines carry chords (chord-bearing = ≥1 valid FR-013 symbol; lyrics-only counts as fail per H1/M1) using the frozen 10-song list in quickstart.md)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Review history and re-open or regenerate sheets (Priority: P3)

**Goal**: Server-side single-owner history lists newest-first, re-opens stored sheets with zero re-query, regenerates fresh sheets as new entries, and deep-links via `?entry=` with a not-found view (FR-009, FR-010, FR-011, FR-015 history-address branch; SC-004, SC-006, SC-007).

**Independent Test**: Generate sheets for two songs, leave, return to history, verify both entries re-open their full sheets and regenerate produces a fresh sheet; fresh DB shows the friendly empty state (quickstart V3).

**Dependency note**: History writes land in US2 (T023/T035/T038); US3 adds the read/regenerate endpoints in the same `backend/app/routes_sheets.py` file plus history UI — T047 sequentially extends T038, T049 sequentially extends T042.

- [X] T044 [P] [US3] History route tests in `backend/tests/test_routes_sheets_history.py` via `TestClient` (GET `/api/v1/history`: `limit` default 20 max 100 + `offset` default 0, order ALWAYS `created_at DESC`, Postgres-only; GET `/api/v1/history/{entry_id}`: same envelope as generate, ZERO provider re-querying, missing/dangling sheet_id → `NOT_FOUND` (dangling = DB corruption only; frontend maps to entry-unavailable); POST `/api/v1/history/{entry_id}/regenerate`: NEW sheet + NEW entry, ONLY history op querying providers, unknown → `NOT_FOUND`, upstream failure → `PROVIDER_ERROR` with prior entry untouched)
- [X] T045 [P] [US3] HistoryList tests in `frontend/tests/HistoryList.test.tsx` (newest-first rows with query + matched song; select → sheet; regenerate affordance; friendly "no searches yet" empty state; error + retry; one unrestorable entry → unavailable while list intact)
- [X] T046 [P] [US3] Island history tests in `frontend/tests/SheetGenerator.history.test.tsx` (history open; re-open within 2 selections SC-004 rendering the stored response verbatim; regenerate from sheet AND entry → fresh sheet + NEW entry append-only; `?entry=<uuid>` deep link renders stored sheet with zero provider calls; unknown/malformed id → island-rendered not-found view with links to `/` + back to generator FR-015/SC-007, malformed validated client-side without fetching; row select updates URL without reload)
- [X] T047 [US3] Implement GET `/api/v1/history` + GET `/api/v1/history/{entry_id}` + POST `/api/v1/history/{entry_id}/regenerate` in `backend/app/routes_sheets.py` (append-only per data-model rule 7; regenerate = full pipeline re-run per H4; re-open zero re-query per R7; sequentially extends T038 in the same file)
- [X] T048 [US3] Implement `frontend/src/components/HistoryList.tsx` (presentational newest-first rows + regenerate affordance; Tailwind + shadcn tokens)
- [X] T049 [US3] Extend `frontend/src/components/SheetGenerator.tsx` (`?entry=` deep-link handling, history section, re-open/regenerate wiring, URL update on select per game-route.md; sequentially extends T042)
- [X] T050 [US3] Validate quickstart V3 in `specs/004-lyrics-chords-generator/quickstart.md` (newest-first FR-009, re-open ≤2 selections SC-004 + zero provider calls in backend log, regenerate NEW entries data-model rule 7, persistence across visits SC-006, fresh-DB empty state, `?entry=` valid + all-zero-UUID not-found FR-015/SC-007)

- [X] T056 [US3] `DELETE /api/v1/history/{entry_id}` in `backend/app/routes_sheets.py` + tests in `backend/tests/test_routes_sheets_history.py` (tests FIRST per Principle III: 204 empty body deletes entry + orphaned sheet with sibling intact, re-delete/unknown → `NOT_FOUND`, zero providers; entry-first delete order satisfies FK RESTRICT)
- [X] T057 [US3] History carousel + delete confirm in `frontend/src/components/HistoryList.tsx` + wiring in `frontend/src/components/SheetGenerator.tsx` + tests in `frontend/tests/HistoryList.test.tsx` + `frontend/tests/SheetGenerator.history.test.tsx` (tests FIRST: horizontal snap strip with prev/next paging newest-first, per-card delete behind an alertdialog confirm with Cancel/Escape abort, deleting progress state, island DELETE call removes the card in place + inline error on failure, deleting the open entry returns to idle). Amendment 2026-09-16 (sheet actions): shared `frontend/src/components/ConfirmDialog.tsx`; regenerate also behind the confirm on card + sheet; card title opens; sheet header gets a regenerate + delete icon pair (delete-current → idle, `?entry=` cleared; cancel/Escape fire no request)

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Docs, accessibility, live verification, full gates, release readiness.

- [X] T051 [P] Extend `frontend/README.md` (`PUBLIC_API_URL`, game route, island architecture) + `backend/README.md` (new `OPENROUTER_API_KEY`/`YOUTUBE_API_KEY`/`GENIUS_ACCESS_TOKEN` env vars, eval one-liner, `app/` → `agents/sheets/` → `db_models.py` layering) with working dev/test/build/lint/format one-liners (constitution workflow gate #5) + document that Astro inlines `PUBLIC_API_URL` at build time, so `frontend/Dockerfile` needs it as a build ARG (`ARG PUBLIC_API_URL` + `--build-arg`) or the prod bundle bakes `http://localhost:8000` (deploy note, no code change in this feature)
- [X] T052 [P] Accessibility pass on `frontend/src/components/SheetGenerator.tsx` + `frontend/src/components/SheetView.tsx` + `frontend/src/components/CandidateList.tsx` + `frontend/src/components/HistoryList.tsx` + `frontend/src/components/SourceLinks.tsx` (semantic markup + keyboard operability of input, cards, lists, and history per spec Out-of-Scope boundary)
- [X] T053 Run quickstart V4 live re-probe (manual, NOT CI) and record the outcome as a dated addendum in `specs/004-lyrics-chords-generator/research.md` probe section (chart title-only fallback on artist-misspelled query + LRCLIB long→short fallback MUST both return results; if the Python chart client is persistently Cloudflare-blocked, evaluate the `tablatures-api` sidecar; if the sidecar is unviable, trigger the R0 standing fallback via `/speckit-converge` — never silently ship chordless)
- [X] T054 Run full gates + sampling validation per `specs/004-lyrics-chords-generator/quickstart.md` Done-when: in `frontend/` `npx vitest run` + `npm run check-content` + `npm run check` + `npm run lint` + `npm run format:check`; in `backend/` `pytest` incl. `backend/evals/` + `ruff check` + `ruff format --check`; `docker compose ps` api + db healthy; V2 step 1 within 30 s SC-002; 10-song SC-005 sample green; `.env` untracked + `.env.example` placeholders only
- [X] T055 Final review in `specs/004-lyrics-chords-generator/`: constitution I–VIII compliance + gates (spec/plan/task compliance, layering, lint/format green), SC-003 single-owner walkthrough scheduled/complete (10-user panel waived per H2), SC-008 sources-list sample using the frozen 10-song list in quickstart.md (≥2 working outbound links; video spanning required only when provisioned per M3), and `/speckit-converge` readiness across spec.md/plan.md/tasks.md — DONE 2026-09-16: I–VIII compliance, layering, lint/format, SC-008 10/10, eval gates (T037 5/5 live); owner SC-003 walkthrough PASSED on production (frontend.example.com, post #6/#7/#8/#9 + Railway PUBLIC_API_URL/CORS_ORIGINS/OPENROUTER_API_KEY): playable sheet on first attempt, no guidance; model path confirmed live (Lily tree / Mili: chords model-generated openai/gpt-5.6-luna, 42/42 lines, 7.4 s)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 (P1) after Foundational; US2 (P2) after Foundational; US3 (P3) after Foundational AND US2 (history reads/regenerates what US2 writes; T047/T049 sequentially extend T038/T042 in the same files)
  - US1 and US2 can proceed in parallel once Foundational completes (different files except `SheetGenerator.tsx`: T015 skeleton → T042 extension is a sequential edge, so coordinate or order US1 before US2 on that file)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Extends the US1 island skeleton (T015 → T042 edge); independently testable via quickstart V2 once complete
- **User Story 3 (P3)**: Requires US2 complete (reads/regenerates US2-persisted sheets; same-file extensions T038 → T047 and T042 → T049) - Independently testable via quickstart V3 once complete

### Within Each User Story

- Tests MUST be written and FAIL before implementation (T004→T005, T007→T008, T009→T010, T014→T015, T018–T028→T030–T042 with T029 gating T036–T037, T044–T046→T047–T049)
- Models (Foundational) before domain services before routes before island integration
- T029 model gate MUST merge before T036 `fallback.py`, T037 evals, and any code carrying a model ID (Principle V)
- Story complete (incl. quickstart validation task) before moving to next priority

### Parallel Opportunities

- Setup: T001 + T002 + T003 parallel (independent files)
- Foundational: T004 + T006 + T007 + T009 + T011 parallel (independent test/fixture/harness files); then T005, T008, T010 (independent implementations after their tests)
- US1: T012 + T013 + T014 parallel; then T015; then T016; then T017
- US2 tests: T018–T028 all parallel (11 independent test files); then T030; then T031–T034 parallel (independent domain modules); T039–T041 parallel (independent components); then T035 → T038 → T042 → T043; T036–T037 together once T029 unblocks
- US3: T044 + T045 + T046 parallel; then T047 + T048 parallel (different files); then T049; then T050
- Polish: T051 + T052 parallel; then T053; then T054; then T055
- Cross-story: US1 + US2 test tasks can run concurrently after Foundational (coordinate the shared `SheetGenerator.tsx` / `routes_sheets.py` edit order)

---

## Parallel Example: User Story 2

```bash
# Launch all US2 domain + route + component tests together (independent files):
Task: "Normalize tests in backend/tests/test_sheets_normalize.py"
Task: "Chart client tests in backend/tests/test_sheets_charts.py"
Task: "Lyrics client tests in backend/tests/test_sheets_lyrics.py"
Task: "Candidates tests in backend/tests/test_sheets_candidates.py"
Task: "Sources tests in backend/tests/test_sheets_sources.py"
Task: "Pipeline tests in backend/tests/test_sheets_pipeline.py"
Task: "Search/generate route tests in backend/tests/test_routes_sheets_search.py"
Task: "CandidateList tests in frontend/tests/CandidateList.test.tsx"
Task: "SheetView tests in frontend/tests/SheetView.test.tsx"
Task: "SourceLinks tests in frontend/tests/SourceLinks.test.tsx"
Task: "Island generate-flow tests in frontend/tests/SheetGenerator.generate.test.tsx"

# After tests fail + T030 normalize lands, launch independent domain modules together:
Task: "Implement backend/agents/sheets/charts.py"
Task: "Implement backend/agents/sheets/lyrics.py"
Task: "Implement backend/agents/sheets/candidates.py"
Task: "Implement backend/agents/sheets/sources.py"

# After the T029 model gate merges, launch fallback + evals together:
Task: "Implement backend/agents/sheets/fallback.py"
Task: "Create Agno eval scenarios in backend/evals/test_sheets_fallback.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently (quickstart V1)
5. Deploy/demo if ready (card + generator shell with input; generation not yet wired)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP shell!)
3. Add User Story 2 → Test independently → Deploy/Demo (core value: searchable, playable sheets!)
4. Add User Story 3 → Test independently → Deploy/Demo (retention: songbook history!)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers (respecting constitution II ownership):

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - `astro-frontend`: US1 (game entry + shell + input skeleton), then US2/US3 island + components
   - `agno-backend`: US2 domain + routes (T018–T038), then US3 history endpoints (T044/T047)
3. Cross-app contract (`contracts/rest-api.md`) is frozen before parallel implementation
4. Stories complete and integrate independently; shared-file edits (`SheetGenerator.tsx`, `routes_sheets.py`) serialize in phase order

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Blocking gates: T029 (model decision per Principle V) before T036/T037; T053 live re-probe before release (R0 fallback trigger check)
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence (the two documented same-file extensions T015→T042→T049 and T038→T047 are intentional and ordered)

## Phase 7: Convergence

**Source**: `/speckit-converge` run 2026-09-16 against `main` @ bcb5d5b (post #6/#7/#8/#9; prod live on Railway). 57/57 prior tasks `[X]`; 28 constitution MUSTs checked (1 violation); 56 FR/SC/AC items + 41 plan decisions/tree entries checked. Findings ordered CRITICAL → HIGH → LOW.

- [ ] T058 CRITICAL — Enforce authentication (or a recorded, controlled acceptance) on the network-exposed backend per Constitution VII (contradicts). `research.md` R10 deferred JWT/RBAC on the premise "no network-exposed deployment in this feature"; the backend is now public on Railway with `OPENROUTER_API_KEY` set and `backend/app/*.py` has no auth dependency, so unauthenticated `POST /api/v1/sheets` + `POST /history/{id}/regenerate` (paid model calls) and `DELETE /api/v1/history/{id}` are reachable by anyone with the URL. NOTE: a shared bearer token attached by the browser is NOT an option — the client is a static bundle, so any secret it holds (inlined, runtime-fetched, or via a same-origin proxy the browser calls) is readable by whoever loads the page; a proxy only relocates the unauthenticated surface. Real options, decided at plan level and recorded in `research.md` R10: (a) owner login — password → httpOnly cookie session, server-side check on every `/api/v1/*` route; REQUIRES an FR-011 "no login" amendment via `/speckit-clarify`; (b) edge identity in front of BOTH services — Cloudflare Access / Zero Trust (or a Railway-side IP allowlist), no app code; (c) formal risk acceptance — amend R10 with compensating controls: OpenRouter key spend cap (owner action, do now regardless), per-IP rate limit on `/sheets` + `/regenerate`, delete already behind confirm, private single-owner data. Whichever is chosen: tests FIRST for any app-code path, update `contracts/rest-api.md` (401/429 taxonomy as applicable) and both READMEs
- [X] T059 (closed by T071: numbered pagination, Session 2026-10-01) Make the full newest-first history reachable per FR-009 / US3-AC1 (partial). `frontend/src/components/SheetGenerator.tsx:118` fetches `/api/v1/history?limit=20&offset=0` and `:122` discards the contract `total`; `HistoryList.tsx:99-105` prev/next only scroll already-fetched cards and its props expose no total/hasMore/onLoadMore, so entries beyond 20 are unreachable. PREREQUISITE: run `/speckit-clarify` to pick the affordance (load-more button vs infinite scroll at the carousel end) and amend FR-009/US3 scenario 1 + `contracts/game-route.md`; then thread `offset`/`total` through the island, add the affordance to `HistoryList`, tests FIRST in `frontend/tests/HistoryList.test.tsx` + `SheetGenerator.history.test.tsx` (page 2 appends, total reached hides affordance, error on page 2 keeps page 1)
- [ ] T060 Add the `POST /api/v1/sheets` request schema to `frontend/src/lib/sheets/schemas.ts` per T007/T008 and `plan: Zod mirrors of rest-api.md` (missing). `contracts/rest-api.md:62-66` defines `{query, candidate}`; only response schemas exist. Export `generateSheetRequestSchema` (+ history list params), use it in `SheetGenerator` before the fetch, one valid + one invalid fixture in `frontend/tests/sheets.schemas.test.ts`
- [ ] T061 Name the game kind in the not-found copy per FR-015 (partial). `frontend/src/pages/404.astro:16-19` says "The course or topic you asked for doesn't exist" — an unknown `/courses/<c>/games/<g>` address misidentifies the content kind. Reword to cover course, topic, or game; update `frontend/tests/404*.test.ts` if it pins the copy
- [ ] T062 Add `DELETE /api/v1/history/{id}` (204; removes entry + orphaned sheet) to the route list in `backend/README.md:3-6` per T056 / `plan: backend README EXTEND` (partial); route implemented at `backend/app/routes_sheets.py:348`
- [ ] T063 Update the 004 section of `frontend/README.md` per T051 / `plan: frontend README EXTEND` (partial): island children list (`:50-55`) lacks `ChordPopover`, `TransposeControl`, `ConfirmDialog`; lib tree (`:28-38`) lacks `sheets.ts`, `chord-diagrams.ts`, `sheets/schemas.ts`
- [ ] T064 Reword `specs/004-lyrics-chords-generator/data-model.md:106-108` render-model bullet per the FR-013 inline-diagrams clarification (contradicts): it still says catalog-matching symbols "link to the Chords topic"; code already follows the amended FR (in-place popover on hover/tap; rail). Same file, `:34`: `capo`/`tuning_note` row says "(informational; no transposition ships)" — predates FR-017; reword to "informational; the FR-017 transpose is display-only and never persisted". Docs-only
- [ ] T065 Acknowledge `backend/tests/test_sheets_fallback.py` (hermetic unit tests for the R6 alignment zip/number/clamp) in `plan.md` tree / a T036 note (unrequested, LOW): no task or plan entry names it — T036 names only the impl, T037 only `backend/evals/test_sheets_fallback.py`. No code change

## Phase 8: Dedicated sheet page, history pagination, favorites (Session 2026-10-01)

- [X] T066 [backend] Add `history_entries.favorite boolean NOT NULL DEFAULT false` (`db_models.py` model + idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS` in `init_db`); `_wire_entry` emits `favorite`
- [X] T067 [backend] `GET /api/v1/history` gains `q` (accent/case-insensitive over query/title/performer) + `favorite` filters, `total` counts the filtered set; `PATCH /api/v1/history/{id}` `{favorite}` → updated entry (rest-api.md); tests in `backend/tests/test_routes_sheets_history.py`
- [X] T068 [frontend] `historyEntrySchema` + `historyGetResponseSchema` gain `favorite` (GET envelope `{entry_id, favorite, sheet}`); `sheetEntryPath()` + `sheetEntryShellStaticPaths()` in `lib/routes.ts`; shared client `lib/sheets/history-api.ts`
- [X] T069 [frontend] Sheet page: `pages/courses/[course]/games/lyrics-chords/entry.astro` shell + `SheetEntry` island (breadcrumb with title, favorite/regenerate/delete, not-found); rewrites in `public/serve.json` (prod) + dev middleware in `astro.config.mjs` (game-route.md)
- [X] T070 [frontend] `SheetGenerator`: generate/open/regenerate navigate to the sheet page; legacy `?entry=` redirects; embedded sheet view removed
- [X] T071 [frontend] `HistoryList`/`SheetGenerator`: 10-per-page pagination over server `total` (closes T059), favorite star, favorites-only + name filters; tests in `HistoryList.test.tsx` + `SheetGenerator.history.test.tsx`
- [X] T072 [frontend] History view state survives Back: `SheetGenerator` restores `?page=&q=&fav=1` on mount before the first fetch and mirrors it via `replaceState` (defaults omitted); tests in `SheetGenerator.history.test.tsx`
- [X] T073 [frontend] Home "Quick access" section with the Lyrics + Chords game card (FR-001a) in `src/pages/index.astro`
