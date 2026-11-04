# Tasks: AI Second-Voice Recommender (Lyrics + Chords)

**Input**: Design documents from `/specs/006-second-voice-recommender/`
(plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, decisions/DR-001–DR-003)

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — constitution Principle III (test-first, both apps, NON-NEGOTIABLE) requires them. Within each phase, test tasks precede their implementation and MUST fail before it. Evals (Principle IV) are Phase 5 and MUST be green before merge.

**Organization**: Grouped by user story (US1 P1, US2 P2, US3 P3) for independent implementation and testing. US1 delivers analyze-at-transpose end to end (button → agent → persisted row → panel render); US2 adds history list/re-open/delete; US3 hardens deterministic rendering + the no-melody gate + evals. DR-linked tasks carry a **DR-00x** tag (deliberate `task_enabled`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `frontend/`, `backend/` at repository root (per plan.md)
- Frontend tests: `frontend/tests/*.test.ts(x)`; backend tests: `backend/tests/test_*.py`; evals: `backend/evals/test_*.py`
- Single-agent execution in ID order (spec Assumptions); [P] tasks may batch where files differ

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the existing scaffold is green before feature work; create the new domain package skeleton

- [x] T001 Verify baseline gates on a clean tree: `backend/` (`python -m pytest -q`, `ruff check .`, `ruff format --check .`) and `frontend/` (`npx vitest run`, `npm run lint`, `npm run format:check`) all green; zero new deps for this feature (plan.md Technical Context)
- [x] T002 [P] Create `backend/agents/second_voice/__init__.py` (docstring: theory-reasoning domain, pure — MUST NOT import `app/`; R9 layering note)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Contracts mirrors, persistence, pure helpers, and the MANDATORY gated model eval — MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete. T009 (Appendix A) gates T016 (agent wiring) — no model-ID code merges before the record is filled (Principle V).

- [x] T003 [P] Zod contract tests in `frontend/tests/second-voice.schemas.test.ts` targeting `frontend/src/lib/sheets/schemas.ts`: one valid + one invalid fixture per new shape (analyze request incl. transpose ±11 bounds + empty-chords lines; full analysis response incl. 7-diatic + length-parity + snippet ≤120 chars; summary list; error envelope); invalid asserts Zod throws
- [x] T004 [P] Implement Zod mirrors in `frontend/src/lib/sheets/schemas.ts` per `contracts/rest-api.md` + R1 (`secondVoiceSnapshotSchema`, `secondVoiceOutSchema` with `.superRefine` for diatonic-degree order, progression length parity, no-melody invariant, FR-013 symbols via `isChordSymbol`) (depends on T003)
- [x] T005 [P] Pure-helper tests in `frontend/tests/second-voice.test.ts` targeting `frontend/src/lib/second-voice.ts` (zero Astro imports): snapshot builder (`displaySheet` → `chords_by_line`: section/line indexes, offsets preserved, slash-bass symbols verbatim, lyric-only lines → `[]`); stale predicate (`open.transpose !== current`, null-safe); heading map (10 fields → English headings in FR-009 order)
- [x] T006 [P] Implement `frontend/src/lib/second-voice.ts` per R10 + DR-001 (snapshot builder, stale predicate, heading map; zero Astro imports) (depends on T005)
- [x] T007 [P] **DR-002** — Model tests in `backend/tests/test_db_models_second_voice.py` targeting `backend/db_models.py` (transient Postgres, no SQLite): valid insert; transpose ±12 rejected; blank model_id rejected; `SecondVoiceOut` violations rejected (6 diatonics, degree order, length parity, non-FR-013 symbol, snippet >120 chars, missing-status with pitched row); owner invariant; CASCADE on parent sheet delete; `(sheet_id, created_at DESC)` list order
- [x] T008 [P] **DR-002** — Implement `second_voice_analyses` in `backend/db_models.py` per data-model.md (table + validators + mapper events + CASCADE + index) (depends on T007)
- [x] T009 Run the gated `openrouter-model-eval` per R3/Principle V and fill `specs/006-second-voice-recommender/research.md` Appendix A (requirements, live catalog filter, 3+ fixtures incl. transposed/non-diatonic/no-melody, per-model schema-validity + SC-005 gates + latency via MCP client, $/analysis on longest fixture, winner + exact model ID + route + rationale, Agno configure block; agent-path budget evidence moves to T031, which runs the real agent — T009 cannot depend on T016's `build_agent`, which T009 itself blocks (F1 fix)). BLOCKS T016. — DECIDED 2026-09-17: winner `google/gemini-2.5-flash-lite` (3/3 REST gates green + agent-path smoke; Luna REST 0/3 was a strict-schema harness artifact — 3/3 via `build_agent()`; deepseek green but 4–5x latency). Direct REST used (no MCP client in session) + supplementary `build_agent()` parity runs; F1 intact (no ID merged — winner lands via env).

**Checkpoint**: Foundation ready — contracts mirrored both sides (tests green), table + validators green, pure helpers green, Appendix A DECIDED. User story implementation can now begin.

---

## Phase 3: User Story 1 - Generate analysis at current transpose (Priority: P1) 🎯 MVP

**Goal**: Learner sets the stepper and runs a persisted structured analysis of the transposed chords (FR-001–005, FR-008 trigger surface, FR-011 panel states, FR-012/FR-014).

**Independent Test**: Open any chord-bearing sheet, set `Tr. +5`, select the button → 9-section English analysis referencing transposed symbols (quickstart V1).

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T010 [P] [US1] **DR-001** — Snapshot-validation tests in `backend/tests/test_second_voice_validate.py` targeting `backend/agents/second_voice/validate.py` (recorded sheet fixtures): happy path; section/line count mismatch → error; offset past line width → error; non-FR-013 symbol → error; transpose ±12 → error; pitch tamper (valid-shape, wrong symbols) → PASSES (trust posture, FR-003)
- [x] T011 [P] [US1] **DR-003** — Agent unit tests in `backend/tests/test_second_voice_analyze.py` targeting `backend/agents/second_voice/analyze.py` with a stubbed Agent (no live calls): `SecondVoiceOut` parses a golden fixture; prompt input numbers transposed chords by line with section headings + lyric lines; schema-invalid agent output raises (fail closed); missing key raises unavailable (request-time degrade)
- [x] T012 [P] [US1] Analyze-route tests in `backend/tests/test_routes_second_voice_analyze.py` (TestClient, stubbed agent): 200 + row persisted (shape = contract); tampered snapshot → 422 + nothing stored; unknown sheet → 404; agent failure → 502 + nothing stored; second POST → second row (append-only)
- [x] T013 [P] [US1] Panel tests in `frontend/tests/SecondVoicePanel.test.tsx`: button beside stepper with `Tr. +N` context; hidden when `chord_source === "none"`; disabled + `aria-busy` in flight; loading → ready render; error + retry preserves props; stale badge + re-run when `open.transpose !== transpose` (quickstart V1/V3)

### Implementation for User Story 1

- [x] T014 [US1] **DR-001** — Implement `backend/agents/second_voice/validate.py` (transpose-range guard + snapshot-vs-stored validation per FR-003; raises typed errors the route maps to 422) (depends on T010)
- [x] T015 [US1] **DR-003** — Implement `SecondVoiceOut` + `INSTRUCTIONS` (19 steps, R2) in `backend/agents/second_voice/analyze.py` (Pydantic schemas per R1 incl. row rules; instructions pin English pedagogy, Anglo names, Roman conventions, no-melody gate, schema obedience) (depends on T011)
- [x] T016 [US1] Implement `build_agent` factory + `run_analysis` in `backend/agents/second_voice/analyze.py` per R9 (Agno `Agent(model=OpenRouter(id=<Appendix A winner>), output_schema=SecondVoiceOut)`, lazy per request, NOT in AgentOS; single attempt, 45 s timeout, explicit `max_tokens`; zips transposed chords + stored lyrics) (depends on T009, T015) — env-gated 2026-09-17 (blocker fix): model resolves from `SECOND_VOICE_MODEL_ID`, fails closed when unset; winner lands via env at T009, no code swap.
- [x] T017 [US1] Implement `POST /api/v1/sheets/{sheet_id}/second-voice` in `backend/app/routes_second_voice.py` + include the router in `backend/app/main.py` (validate → run → insert → 200 envelope; 422/404/502 taxonomy per contract; zero lyric echo) (depends on T012, T014, T016)
- [x] T018 [US1] Implement `frontend/src/components/SecondVoicePanel.tsx` container per `contracts/analysis-panel.md` (trigger + POST via `apiBaseUrl`, loading/error/empty states, provisional data-driven ready render of key/scale/@Tr badge, stale derivation via `lib/second-voice.ts`, history toggle wiring point for US2; US3 T029/T030 replaces the provisional render with SecondVoiceView — F2 fix) (depends on T013, T006)
- [x] T019 [US1] EDIT `frontend/src/components/SheetView.tsx` (render `SecondVoicePanel` beside `TransposeControl` with `displaySheet` + `transpose` + `apiBaseUrl`; hidden when chordsMissing) + thread `apiBaseUrl` from `SheetGenerator.tsx` if absent (depends on T018)
- [ ] T020 [US1] Validate quickstart V1 (analyze at `Tr. +5`: transposed symbols referenced, 9 sections, Anglo names, `@Tr. +5` badge, ≤60 s) — BLOCKED on T009/T031 (needs live inference; un-checked 2026-09-17: never exercised in the implement session).

**Checkpoint**: At this point, User Story 1 is fully functional and testable independently (analyze → persist → render; history list arrives in US2).

---

## Phase 4: User Story 2 - Review persisted history per song (Priority: P2)

**Goal**: Per-song newest-first history with free re-open + confirmed delete + re-run-inserts-new (FR-006, FR-007, FR-013).

**Independent Test**: Two analyses at different offsets → leave → return → both re-open instantly; re-run creates a third (quickstart V2).

### Tests for User Story 2 ⚠️

- [x] T021 [P] [US2] **DR-002** — History-route tests in `backend/tests/test_routes_second_voice_history.py` (TestClient, Postgres): list newest-first summaries (no full JSON) + `total`; unknown sheet → 404 (not `[]`); get-one serves stored row, zero providers; delete → 204 + row gone + sheet/siblings intact; second delete → 404; sheet delete cascades (rows gone)
- [x] T022 [P] [US2] History-list tests in `frontend/tests/AnalysisHistoryList.test.tsx`: newest-first rows with `@Tr.` badge + timestamp + model; empty state; open callback; delete → `ConfirmDialog` (names song + offset; Cancel/Escape aborts, confirm calls delete)

### Implementation for User Story 2

- [x] T023 [US2] **DR-002** — Implement list/get/delete in `backend/app/routes_second_voice.py` per contract (summary-only list, stored-row get, single-row delete; 404 taxonomy; Postgres only) (depends on T021)
- [x] T024 [US2] Implement `frontend/src/components/AnalysisHistoryList.tsx` per `contracts/analysis-panel.md` (presentational rows + badges + `ConfirmDialog` delete reuse; keyboard + `role=status` idioms) (depends on T022)
- [x] T025 [US2] Wire history into `SecondVoicePanel.tsx` (list fetch on open, entry select → get-one + zero-provider render, delete → 204 + refetch, re-run → POST → NEW entry prepended) + empty-history state (depends on T023, T024)
- [ ] T026 [US2] Validate quickstart V2 + V3 (persist across reload with zero-provider re-open; stale badge + re-run inserts third row) — BLOCKED on T009/T031 (re-run needs live inference; un-checked 2026-09-17: never exercised).

**Checkpoint**: At this point, User Stories 1 AND 2 both work independently (analyze + songbook).

---

## Phase 5: User Story 3 - Trust deterministic honestly-gated analysis (Priority: P3)

**Goal**: Stable data-driven 9-section rendering + missing-melody honesty + green eval gates + frozen SC-005 sample (FR-009, FR-010, SC-005/SC-007).

**Independent Test**: Re-open any analysis → identical render; no-melody run → notice + strategy-only + zero invented pitches (quickstart V4).

### Tests for User Story 3 ⚠️

- [x] T027 [P] [US3] **DR-003** — View tests in `frontend/tests/SecondVoiceView.test.tsx`: 9 headings in FR-009 order from JSON fields; `special_chords: []` → diatonic empty row (still rendered); missing-melody → notice + strategy + pitch cells "—" with gate footnote; symbols rendered verbatim (no re-spelling); Anglo names as stored
- [x] T028 [P] [US3] Eval suite in `backend/evals/test_second_voice.py` per R6 (live, skip without key; known-answer public-domain/synthetic fixtures incl. transposed + secondary-dominant + modal-borrowing + no-melody): `transpose_respected` (string compare), `degrees_consistent` (independent degree recompute), `non_diatonic_flagged`, `no_invented_melody` (critical), `english_format_complete`, `latency_within_budget` (≤45 s)

### Implementation for User Story 3

- [x] T029 [US3] Implement `frontend/src/components/SecondVoiceView.tsx` per `contracts/analysis-panel.md` heading map (data-driven sections + note table + tips; verbatim symbols; gate footnote) (depends on T027)
- [x] T030 [US3] Render `SecondVoiceView` inside `SecondVoicePanel.tsx` ready/stale states (replaces any US1 provisional render; stale keeps full readability + re-run action) (depends on T029)
- [x] T031 [US3] Run evals green: `python -m pytest backend/evals/test_second_voice.py -v -s` 6/6 (record model id, per-gate results, latency; on failure fix prompt/schema/fixture — never weaken `no_invented_melody`; fill research.md Appendix A "Budget evidence on the shipped path" from these real-agent runs: latency, input/output tokens (RunOutput.metrics `[budget]` lines), schema-validity, 2+ runs incl. the `full_length` (36-line) fixture — F1 fix) (depends on T016, T028) — GREEN 2026-09-17: 6/6 in 19.9 s on `google/gemini-2.5-flash-lite` (concise prompt + caps; full_length 6.1 s 1676/1430 + probe 7.7 s 1648/1629; $0.00074/longest). First run 5/6: `no_invented_melody` caught a non-null `recommendation` on full_length — fixed prompt (strategy-only when missing) + schema (null-proposal invariant Pydantic/Zod/DB), gate never weakened. Budget evidence in Appendix A.
- [ ] T032 [US3] Run the frozen SC-005 sample (5 analyses / ≥3 songs / varied offsets incl. diatonic + non-diatonic fixtures) + assert SC-007 (100% 9-section Anglo format); record point-in-time results in converge notes (depends on T031)

**Checkpoint**: All user stories independently functional (analyze + songbook + trusted render); evals green.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Degraded paths, contract drift check, docs, full gates

- [x] T033 [P] Validate quickstart V5 (lyrics-only hides button; stopped-backend/key-absent → error + retry, nothing stored; tampered payload → 422; delete-confirm flow) + V6 (curl: analyze/list/get/delete incl. second-delete 404)
- [x] T034 [P] Live JSON → Zod seam check (004 T053 precedent): run real `POST`/`GET`/`DELETE` responses through the exported Zod schemas with `.parse` (not `safeParse`) — no Pydantic/Zod drift
- [x] T035 [P] Extend `backend/README.md` (analysis routes, 45 s budget, eval one-liner) + record Appendix A winner reference; update converge notes with eval + SC-005 results (README routes/budget/eval one-liner done 2026-09-17; winner reference lands with T009, eval/SC-005 notes with T031/T032).
- [ ] T036 Full gates on a clean tree: `backend/` pytest + evals + ruff; `frontend/` vitest + check (astro check, per CI .github/workflows/ci.yml:28 — 006 dropped it relative to 005/CI, restored 2026-09-17) + lint + format:check; quickstart V1–V6 green — unit gates re-green 2026-09-18 (358 vitest incl. tabs, 68 backend-006 incl. clamp/invariant tests, ruff/eslint/prettier/astro-check clean); evals re-run pending (prompt changed); V1–V4 + T032 still need live quickstart validation (un-checked 2026-09-17: browser runs pending).
- [x] T037 [US2] Cascade-copy (F5): extend both 004 entry-delete `ConfirmDialog` descriptions (`SheetGenerator.tsx` open-sheet toolbar + `HistoryList.tsx` card) with "and any saved second-voice analyses"; add frontend tests asserting the copy on both surfaces; then re-run the T036 gates (FR-013). (New task rather than reopening T019: T019's SheetView render-site work is closed; this preserves the audit trail.)
- [x] T038 [US1] Tabbed layout (owner-directed 2026-09-18, post-implement): shared stepper + Sheet | AI 2nd voice tabs in `SheetView.tsx` (roving tabindex, lazy-mount panel, `hidden` preserves state); `SecondVoicePanel.tsx` auto-opens latest on mount; `SheetView.tabs.test.tsx` covers selection/keyboard/reset/lyrics-only; ratified spec amended in the same commit (spec.md Clarifications + FR-001/SC-001/SC-004, `contracts/analysis-panel.md` composition, `plan.md` SheetView line, `quickstart.md` V1/V2/V5). No behavior change to transpose/persistence/render contract.
- [x] T039 [US3] Receipt clamp + widened prose caps (2026-09-18, pre-T032 hardening): wire schema is structure-only so receipt caps are the only enforcement — `clamp_analysis_receipt` (analyze.py) cuts lists/strings before `SecondVoiceOut` validation (cosmetic overflow never 502s a paid call); string caps widened to ~2x prompt guidance (justification/function/voice ≤600, feeling/explanation ≤480, tips ≤320) in Pydantic/Zod/DB + `data-model.md`; prompt bounds `note_table` to 60 rows total; trust invariants still fail closed. Evals re-run required (prompt changed).
- [x] T040 [US3] Minor-key contract (2026-09-18, from the T039 live probe: Wonderwall/Em 502'd twice — `tonic: "Em"` rejected as a note name, then natural-minor degrees rejected by the major-only exact-set check): degree set keyed by `key.mode` (major `I ii iii IV V vi vii°`, natural minor `i ii° III iv v VI VII`) in Pydantic (`analyze.py`), the DB validator (`db_models.py`) and Zod (`schemas.ts`); `clamp_analysis_receipt` splits a mode suffix off the tonic (`Em`/`Bbm`/`F# min`/`A minor` → bare tonic + `mode: minor`, suffix wins over a conflicting mode; `EM`/`Cmaj` untouched); prompt: step 4 names both sets, `key.tonic` is bare, a major V/V7 in minor is out-of-key → `special_chords` as harmonic-minor dominant, and `note_table` keeps ≥1 phrase row (chord + snippet + target chord tones) when melody is missing; eval `minor` fixture (Am/Dm/E7/F/Am) with a mode-aware `_expected_degree` (E7 non-diatonic by construction, asserted in `special_chords`); unit tests for both sets + the tonic clamp table; `data-model.md` rule amended. Same commit: `SheetView` keyed by `sheet.id` (drops both reset effects; no stale frame / orphan history GET on song change) and auto-open prefers the newest analysis at the current transpose (spec Clarifications + SC-004 wording). Evals 6/6 green (5 fixtures); Wonderwall re-probe 2/2 valid `E minor`.
- [x] T041 [US3] Lyric-echoed symbol sanitization (2026-09-18, prod 502 on "Por Debajo De La Mesa": 9.6 s round trip, receipt failed `SecondVoiceOut` on `Edis7` — Spanish diminished shorthand from a `Bdis7 E7` lyric line the model promoted into `progression` x2 + `note_table`; reproduced locally with the chained `ValidationError`): new `_sanitize_echo_symbols` in the receipt clamp drops malformed symbols from song-echo fields (`progression` chords + same-index degrees via `strict=True` zip, `special_chords`, `cadences`, `note_table`; emptied rows/entries dropped; misaligned chords/degrees left to fail closed; `diatonic_chords` + `scale` stay strict); prompt verbatim rule now scopes symbols to the `chords:` lists and names `Bdis7`/`Edis7` as non-chords; analyze route logs `reason` + chained cause on 502 (Railway-observable). Unit: 5 new tests (aligned drop, empty-row drop vs all-junk fail-closed, misaligned fail-closed, stubbed end-to-end, prompt lock); live re-probe of the prod song 2/2 SUCCESS (spy run: `Edis7` in `special_chords` sanitized).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories; T009 (Appendix A) additionally blocks T016 (agent wiring)
- **User Stories (Phases 3–5)**: All depend on Foundational; run sequentially P1 → P2 → P3 (panel file grows across US1→US2→US3: trigger → history → view — sequential on that file)
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no story dependencies
- **US2 (P2)**: After Foundational + US1 panel exists (extends it with history)
- **US3 (P3)**: After Foundational + US1/US2 render path exists (hardens it + gates behavior)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Backend: validate → schemas → agent → routes; frontend: lib → container → view wiring
- Story checkpoint (quickstart section) MUST pass before advancing

### Parallel Opportunities

- T002 ∥ T001 (different areas); T003 ∥ T005 ∥ T007 ∥ T009-start (four files + skill run)
- T010 ∥ T011 ∥ T012 ∥ T013 (four test files); T014 ∥ T015-schemas (different files; T016 waits on T009+T015)
- T021 ∥ T022; T023 ∥ T024 (backend ∥ frontend); T027 ∥ T028; T033 ∥ T034 ∥ T035

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (baseline green)
2. Phase 2: Foundational incl. Appendix A gate (CRITICAL — blocks all stories)
3. Phase 3: User Story 1 (analyze → persist → render)
4. **STOP and VALIDATE**: quickstart V1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → V1 → Demo (analyzable sheets!)
3. US2 → V2/V3 → Demo (songbook!)
4. US3 → V4 + evals + SC-005 → Demo (trusted!)
5. Each story adds value without breaking previous stories

### Single-Agent Execution (this session)

Run T001 → T036 in ID order (respecting [P] batching where files differ), validating each story checkpoint via its quickstart section before advancing. Backend tasks → `agno-backend` ownership; frontend tasks → `astro-frontend` ownership; contracts were agreed first (plan.md).

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- **DR-00x** tags mark decision-implementing/verifying tasks (deliberate `task_enabled`): DR-001 → T005/T006/T010/T014; DR-002 → T007/T008/T021/T023; DR-003 → T011/T015/T027 (+ T016/T028/T031–T032 verify)
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same-file conflicts (panel grows US1→US2→US3 — keep sequential), cross-story dependencies that break independence
- Never weaken `no_invented_melody`: eval failure → fix prompt/schema/fixture, not the gate
