# Tasks: 1st-Voice Trainer Tab

**Input**: Design documents from `specs/008-first-voice-trainer/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included per constitution Principle III (Vitest for every util/component/island, red-green). Write test tasks FIRST and ensure they FAIL before implementation.

**Organization**: Grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline verification before new code

- [X] T001 Verify frontend baseline (`npm run lint`, `format:check`, `vitest run`) in `frontend/` and record status in PR body — baseline 2026-09-18 (after `npm ci`): lint ✓, format:check ✓, vitest 528/528 ✓
- [X] T002 [P] Confirm `SheetView.tsx` tab structure + `sound.ts`/`scales.ts` reuse points in `frontend/src/components/SheetView.tsx`, `frontend/src/lib/sound.ts`, `frontend/src/lib/scales.ts` — confirmed: `SheetTab` union + `hasVisitedAnalysis` lazy-mount + `hidden` idiom, `scaleSpelling`/`SPELLING_TABLE`, `playNote` triangle envelope + `arpeggioMidis` octave-wrap, `parseChordSymbol` rootPitch, `transposeSheet` display-only

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure scale-at-transpose resolver all stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Write failing resolver tests (override → analysis → heuristic priority, spelling, ±11 validation, lyrics-only fallback) in `frontend/tests/trainer-scale.test.ts`
- [X] T004 Implement pure scale resolver (zero UI imports; depends on T003 green) in `frontend/src/lib/trainer-scale.ts`
- [X] T005 [P] Write failing pattern-builder tests (3 categories, degree labels, short-scale clamp, determinism) in `frontend/tests/trainer-exercises.test.ts`
- [X] T006 Implement pure exercise pattern builder (depends on T005 green) in `frontend/src/lib/trainer-exercises.ts`

**Checkpoint**: Foundation ready — `trainer-scale` + `trainer-exercises` green; stories can proceed

---

## Phase 3: User Story 1 - Scale-aware exercises in the song key (Priority: P1) 🎯 MVP

**Goal**: Trainer tab with agility/tonality/flexibility exercises following the shared transpose

**Independent Test**: Open any song with chords → trainer tab shows all 3 categories in the transposed key; moving transpose updates all sequences (quickstart Scenario 1)

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T007 [P] [US1] Component tests for TrainerPanel states (loading/ready/empty/error, 3 groups, scale label with source, transpose update) in `frontend/tests/TrainerPanel.test.tsx`
- [X] T008 [P] [US1] Tab-composition tests (3 tabs, 3-way roving, lazy-mount + hidden, lyrics-only Sheet+Trainer) in `frontend/tests/SheetView.trainer.test.tsx`

### Implementation for User Story 1

- [X] T009 [P] [US1] Create standalone TrainerPanel (exercises + scale label + picker fallback, props in/events out) in `frontend/src/components/TrainerPanel.tsx`
- [X] T010 [US1] Extend SheetView with 3rd trainer tab (union, tabpanel, roving, lyrics-only composition, hasVisitedTrainer lazy-mount + hidden, active={tab === "trainer"} wiring) in `frontend/src/components/SheetView.tsx` — also updated superseded lyrics-only test in `frontend/tests/SheetView.tabs.test.tsx` to 008 behavior; FR-004 analysis-key path added post-review (SecondVoicePanel `onOpenAnalysisChange` → SheetView state → TrainerPanel `analysisKey`, guarded by `open.transpose === transpose`)

**Checkpoint**: US1 fully functional and independently testable (quickstart Scenario 1 + 4 + 5)

---

## Phase 4: User Story 2 - Play-all reference audio (Priority: P2)

**Goal**: One-press full-sequence playback with progress + stop, never overlapping

**Independent Test**: Play any exercise → full ordered sequence sounds with visible progress; Stop/Escape halts; double-Press restarts without overlap (quickstart Scenario 2)

### Tests for User Story 2 ⚠️

- [X] T011 [P] [US2] Sequencer unit tests (stepSeconds = 60/bpm, frozen snapshot, stop prevents future notes within 250 ms, SSR/audio-absent no-op, sequenceProgress pure helper) in `frontend/tests/trainer-sequence.test.ts`
- [X] T012 [P] [US2] Playback interaction tests (Play→playing+highlight, Stop/Escape→idle within 250 ms, re-Press→single restart, unmount/song-change stops, active=false tab-hide stops within 250 ms, audio-unavailable degrade) in `frontend/tests/TrainerPanel.playback.test.tsx`

### Implementation for User Story 2

- [X] T013 [US2] Implement cancellable upfront scheduler over sound.ts (depends on T011 green) in `frontend/src/lib/trainer-sequence.ts`
- [X] T014 [US2] Wire Play/Stop + progress (aria-busy, aria-live position, current-note highlight; depends on T012–T013) in `frontend/src/components/TrainerPanel.tsx` — Escape via document listener (jsx-a11y clean)

**Checkpoint**: US1 + US2 work independently (quickstart Scenarios 1–2 + 4)

---

## Phase 5: User Story 3 - Reproduction timing control (Priority: P3)

**Goal**: Trainer-level tempo strip (slider + presets) applying to subsequent Play runs

**Independent Test**: Slow run vs fast run of the same exercise — fast finishes measurably faster; readout + presets in sync (quickstart Scenario 3)

### Tests for User Story 3 ⚠️

- [X] T015 [P] [US3] Timing-strip tests (slider 60–140 + readout + aria-valuetext, presets set slider + aria-pressed, octave 3/4/5, standalone render) in `frontend/tests/TrainerTimingStrip.test.tsx`
- [X] T016 [US3] Tempo-freeze test (mid-run tempo edit applies to next Play, running snapshot unchanged; same file as T012 — sequential) in `frontend/tests/TrainerPanel.playback.test.tsx` — plus octave-applies-to-next-Play composition test

### Implementation for User Story 3

- [X] T017 [P] [US3] Create standalone TrainerTimingStrip (BPM slider + Slow 60/Steady 90/Brisk 120 presets + octave) in `frontend/src/components/TrainerTimingStrip.tsx`
- [X] T018 [US3] Compose timing strip above exercise list with frozen-per-session wiring (depends on T017) in `frontend/src/components/TrainerPanel.tsx`

**Checkpoint**: All stories independently functional (quickstart Scenarios 1–5)

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Gates + docs, no behavior change

- [X] T019 [P] Run quickstart.md end-to-end validation (Scenarios 1–5) and record results in `specs/008-first-voice-trainer/quickstart.md` notes — all 5 PASS, 81/81 trainer tests green (66 + 2 FR-004 analysis-key + 1 analysis-fallthrough + 2 degree-8 octave + 10 difficulty-grouping/note-preview/G-major-pitch tests)
- [X] T020 [P] Lint/format/tests green (`npm run lint`, `npm run format:check`, `npx vitest run`) in `frontend/` — lint ✓, format ✓, 609/609 ✓ (post-review: unspellable-analysis fallthrough; degree-8 octave offset; difficulty grouping + 6 new exercises; per-note preview buttons; tonic-relative pitch placement fixing the non-C-key octave drop)
- [X] T021 Verify layering (lib has zero UI/Astro imports) + a11y pass (tab roving, slider valuetext, live region, focus) across `frontend/src/components/TrainerPanel.tsx`, `frontend/src/components/TrainerTimingStrip.tsx`, `frontend/src/lib/trainer-*.ts` — layering clean; added focus-visible rings to trainer buttons (tab idiom)
- [X] T022 (Optional) Persist last BPM to localStorage mirroring chordMode in `frontend/src/components/TrainerPanel.tsx` — done with remount test + storage isolation in playback suite

---

## Phase 7: Amendment 2026-09-30 (Loop ×3, Master group, difficulty tabs)

**Purpose**: Owner request — loop playback, a 4th exercise group, and tabbed navigation

- [X] T023 Add Loop ×3 action: `handlePlay(exercise, loops)` concatenates the frozen MIDI run `loops` times as one scheduled session; `RunButton` toggle per action (Play / Loop ×3 each show Stop while they are the running one) in `frontend/src/components/TrainerPanel.tsx`
- [X] T024 Add 20 new patterns to `frontend/src/lib/trainer-exercises.ts`: 4 more each for basic/intermediate/advanced (8 per group) plus a new `master` difficulty (8 patterns) — 32 total, 11/10/11 per technique
- [X] T025 Replace the 3 stacked difficulty `<section>`s with a `role="tablist"` (arrow-key roving, default Basic) + 4 `role="tabpanel"` groups (`hidden` when inactive); switching tabs halts any running session, in `frontend/src/components/TrainerPanel.tsx`
- [X] T026 Update tests: `trainer-exercises.test.ts` (32-exercise counts, master spot-check), `TrainerPanel.test.tsx` (tablist + tab-switch halts session), `TrainerPanel.playback.test.tsx` (Loop ×3 scheduling/progress/stop/mutual exclusion, tab switch before intermediate-only exercises)
- [X] T027 Update spec.md (FR-002/005/006, SC-001, Key Entities, US1), data-model.md (`master` difficulty, `PlaybackSession.loops`, re-Press semantics), contracts/trainer-panel.md (tablist + Loop ×3 test hooks), quickstart.md (Scenarios 2b/4b)

## Phase 8: Amendment 2026-10-01 (loop count, uke fretboard)

- [X] T028 Loop round-count dropdown (3/5/6, persisted `trainer.loops`); `PlaybackSession` gains `mode: play | loop` so Stop ownership is independent of the selected count, in `frontend/src/components/TrainerPanel.tsx`
- [X] T029 Collapsed-by-default "Show uke fretboard" toggle per exercise card reusing `NeckFrame` + `ScaleNeck` with the exercise's distinct notes
- [X] T030 Tests in `TrainerPanel.playback.test.tsx` (×5 schedules 5 rounds, mid-run change keeps loop, persistence; fretboard tone dots, notes past index 7); spec FR-005a, contract hooks
- [X] T031 Tempo range 60–240 (sequencer cap 208 → 240) with Fast 160 / Melisma 200 / Blaze 240 presets; note ring capped at `min(1.1 s, 2 steps)` in `trainer-sequence.ts`; tests in `trainer-sequence.test.ts`, `TrainerTimingStrip.test.tsx`
- [X] T032 Per-preset practice tips (`data-testid="trainer-tempo-tips"`, `aria-live="polite"`) shown under the presets while one is selected, hidden on custom tempos, in `TrainerTimingStrip.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**: Depend on Foundational; then proceed in priority order P1 → P2 → P3 (P2 reuses US1 panel; P3 reuses US2 session)
- **Polish (Phase 6)**: Depends on all desired stories being complete

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Lib before components; components before wiring
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T002, T007, T008, T009 (different files) can run in parallel once scope is fixed
- T011 + T012, T015 + T017 (new files) can run in parallel; T016 extends T012's file and runs after it
- T019 + T020 can run in parallel in Polish

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: quickstart Scenario 1 + 5 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → resolver + patterns green
2. + US1 → exercises follow transpose (MVP)
3. + US2 → Play-all practice loop
4. + US3 → timing instrument
5. Each increment adds value without breaking prior stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to user story for traceability
- Frontend-only: no backend tasks, no migrations, no OpenRouter record (no hosted LLM per research R2)
- Commit after each task or logical group; stop at any checkpoint to validate independently
