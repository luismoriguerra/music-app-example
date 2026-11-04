# Tasks: Free Search Enrichment

**Input**: Design documents from `/specs/009-free-search-enrichment/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included per Constitution III + IV (pytest + Vitest + Agno eval gates).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Keyless deps + enrichment package scaffold

- [x] T001 Add keyless enrichment deps (`ddgs`, `beautifulsoup4`) to `backend/pyproject.toml` (`youtube-transcript-api` dropped per DR-008, `wikipedia` per DR-010)
- [x] T002 [P] Create enrichment package scaffold `backend/agents/sheets/enrich/__init__.py` with deadline + degraded helpers
- [x] T003 [P] Record enrichment fixtures dir `backend/tests/fixtures/enrich/` with DDG/Wikipedia/Website/YouTube samples

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared ranking/dedup/deadline core all stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Implement folded-identity dedup + ranked-append helper in `backend/agents/sheets/enrich/__init__.py`
- [x] T005 **DR-005** Implement deadline short-circuit (≤3.0 s per stage, ≤6.0 s total) + `degraded {part: "enrichment", reason: "timeout"|"unavailable"}` helper in `backend/agents/sheets/enrich/__init__.py`
- [x] T006 [P] Unit tests for dedup/ranking/degraded helpers in `backend/tests/test_sheets_enrich_core.py`
- [x] T007 **DR-006** Extend sheet wire with nullable `context {text≤600, source, source_url}` and enum extensions (`part: "enrichment"` in `DEGRADED_PARTS` / `degradedPartSchema`) via idempotent `ALTER TABLE song_sheets ADD COLUMN IF NOT EXISTS context JSONB` in `backend/db_models.py:init_db` + `backend/app/routes_sheets.py` + `frontend/src/lib/sheets/schemas.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Weak-metadata candidates (Priority: P1) 🎯 MVP

**Goal**: Keyless DDG candidate fallback ranked below configured providers, never auto-generated

**Independent Test**: With paid keys disabled, misspelled query returns enriched pickable list where no-match appeared before; picking generates normally.

- [x] T008 [P] [US1] Fixture tests for DDG candidate mapping/dedup in `backend/tests/test_sheets_enrich_candidates.py`
- [x] T009 [US1] **DR-007** Implement keyless candidate fallback in `backend/agents/sheets/enrich/candidates_free.py` (bounded `WebSearchTools(backend="brave,yahoo").web_search`, capture `ddgs` exceptions, never raise)
- [x] T010 [US1] Wire fallback into `backend/agents/sheets/candidates.py` (append-ranked-last, deduped) + accept `duckduckgo`-origin picks in `backend/app/routes_sheets.py` CandidateIn validator (accept-only; fetch by title + artist unchanged)
- [x] T011 [US1] Eval gate for fallback ranking + never-auto-generate + timeout-degrades-to-today in `backend/evals/test_sheets_enrich.py`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Keyless source links (Priority: P2)

**Goal**: DDG + Website + YouTube link discovery filling video empty state without keys

**Independent Test**: Keyless generate shows page + video links where page-links-only appeared before; re-open performs zero lookups.

- [x] T012 [P] [US2] Fixture tests for link discovery/validation in `backend/tests/test_sheets_enrich_links.py`
- [x] T013 [US2] **DR-003** **DR-008** Implement link discovery in `backend/agents/sheets/enrich/links_free.py` (keyless search + direct `httpx` validation + canonical YouTube URLs with bounded oEmbed metadata, never raise)
- [x] T014 [US2] Wire into `backend/agents/sheets/pipeline.py` sources stage (fill remaining MAX_LINKS cap only, hybrid with Data API) + eval gate for quota-absent + timeout degradation in `backend/evals/test_sheets_enrich.py`
- [x] T015 [US2] Presentational render of enriched kinds in `frontend/src/components/SourceLinks.tsx` (props in, events out; loading/empty/error via shared ViewStates)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Song context (Priority: P3)

**Goal**: Wikipedia context block separate from sheet body with source label

**Independent Test**: Well-known song sheet shows short context block with source; unknown song shows none; sheet otherwise unchanged.

- [x] T016 [P] [US3] Fixture tests for Wikipedia context mapping/truncation in `backend/tests/test_sheets_enrich_context.py`
- [x] T017 [US3] **DR-010** Implement context fetch in `backend/agents/sheets/enrich/context_free.py` (bounded MediaWiki API search + batched extract read over `httpx`, text ≤600 chars + `source_url`, None on miss/disambiguation/timeout, never raise) + eval gate for miss-shape + no-lyric-text in `backend/evals/test_sheets_enrich.py`
- [x] T018 [US3] Persist + wire stored context through `backend/agents/sheets/pipeline.py` + `backend/app/routes_sheets.py` (generate/regenerate only)
- [x] T019 [US3] Presentational context block in `frontend/src/components/SheetView.tsx` (standalone, mock-props test incl. absent-context, zero business logic; loading/empty/error via shared ViewStates)

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Gates + docs that affect all stories

- [x] T020 [P] Ruff + pytest + Vitest green (`ruff check backend`, `pytest` in `backend/`, `npx vitest run` in `frontend/`)
- [x] T021 Run `quickstart.md` live validation (keyless mode, 10-song sample for SC-002)
- [x] T022 Update `specs/009-free-search-enrichment/research.md` with live timing + quota observations
- [x] T023 [P] Extend `backend/tests/test_routes_sheets_history.py` verifying FR-009/SC-004 zero outbound re-query on history re-open (add enrichers to `_no_providers` fixture, assert stored context served verbatim)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - May integrate with US1 but should be independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - May integrate with US1/US2 but should be independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Mappers before wiring
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- T006 + T007 can run in parallel (within Phase 2)
- Once Foundational completes, US1/US2/US3 can start in parallel
- T008/T012/T016 fixture tests can run in parallel

---

## Parallel Example: User Story 1

```bash
# Fixture test + implementation touch different files:
Task: "Fixture tests for DDG candidate mapping in backend/tests/test_sheets_enrich_candidates.py"
Task: "Implement DDG candidate fallback in backend/agents/sheets/enrich/candidates_free.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test US1 independently (keyless misspelled query)
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories
