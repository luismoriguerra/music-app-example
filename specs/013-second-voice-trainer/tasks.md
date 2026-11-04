# Tasks: 2nd-Voice Trainer

**Input**: `specs/013-second-voice-trainer/plan.md` and `spec.md`

**Tests**: included, because constitution III requires Vitest for every lib module and component.

**Organization**: grouped by user story (US1 to US4) after the shared foundation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task
- **[US#]**: user story from spec.md
- All paths are relative to the repository root

---

## Phase 1: Setup

- [X] T001 Baseline recorded before any edit in `frontend/`: `npx vitest run` 62 files / 643 tests passed; `npm run check` 0 errors; `npm run lint` clean; `npm run format:check` clean

---

## Phase 2: Foundational (blocking)

- [X] T002 [P] Create `frontend/src/lib/trainer-prefs.ts` with `DEFAULT_BPM`, `TRAINER_BPM_STORAGE_KEY` (`trainer.bpm`), `TRAINER_LOOPS_STORAGE_KEY` (`trainer.loops`), `LOOP_OPTIONS`, `LoopCount`, `DEFAULT_LOOP_COUNT`, `isLoopCount`, `readPersistedBpm`, `readPersistedLoopCount`, `persistBpm`, `persistLoopCount`. Remove the matching definitions from `frontend/src/components/TrainerPanel.tsx` and import them; the behavior must not change.
- [X] T003 [P] Add `startStepSequence(steps, opts)` to `frontend/src/lib/trainer-sequence.ts`: each beat is a list of pitches scheduled at the same instant; empty beats stay silent. `startSequence(midis, opts)` delegates with one-pitch beats.
- [X] T004 [P] Create `frontend/src/lib/second-voice-exercises.ts`: `SECOND_VOICE_EXERCISES` (8 entries), `scaleStepMidi`, `beatMidis`, `exerciseBeats`, `intervalLabel`, `describeSteps`, `repeatRounds`; zero UI imports.
- [X] T005 Tests: `frontend/tests/trainer-prefs.test.ts` (new), new `describe` block in `frontend/tests/trainer-sequence.test.ts`, `frontend/tests/second-voice-exercises.test.ts` (new). Run each file in full.

**Checkpoint**: lib layer green; `TrainerPanel` suites unchanged and green.

---

## Phase 3: User Story 1 - See only what to sing, not the theory (P1)

- [X] T006 [US1] Remove the Key, Scale, Diatonic chords, Roman-numeral progression, Special chords, Important cadences, and Section-by-section feel sections from `frontend/src/components/SecondVoiceView.tsx`, with the `scaleOctave` / `scaleMidis` / `scaleOctaveFor` / `playScaleNote` state and helpers and any imports left unused. Keep Recommended second voice, Possible Tones by Chord, Note-by-note table, and Singing tips unchanged.
- [X] T007 [US1] Remove `AnalysisHeading`, `ANALYSIS_HEADINGS`, `HEADING_BY_FIELD`, and `analysisHeading` from `frontend/src/lib/second-voice.ts`. Deviation: references were checked with repo-wide grep over `frontend/src` and `frontend/tests`, not `xd://lsp`; the only consumers were test files.
- [X] T008 [US1] Delete only assertions about the removed sections in `frontend/tests/SecondVoiceView.test.tsx` (scale octave, scale chips, diatonic chords, Roman-numeral, special chords, cadences, section feel, the heading-order list). Replaced the heading-order test with a practical-headings test and a removed-headings absence test; renamed the singing-tips test. In `frontend/tests/second-voice.test.ts`, deleted the heading tests and their imports.

**Checkpoint**: the analyzer tab drops the seven headings in jsdom (`SecondVoiceView.test.tsx`); `SecondVoiceView` and `second-voice` suites green.

---

## Phase 4: User Story 2 - Practice harmony exercises in the song's key (P1)

- [X] T009 [P] [US2] Create `frontend/src/components/SecondVoiceExerciseCard.tsx`: presentational card with props for the exercise, its step rows, the run state, the loop count, audio availability, and callbacks. Tests in `frontend/tests/SecondVoiceExerciseCard.test.tsx` cover rows (lead, your part, interval), Play/Stop, Loop/Stop, loop select, step preview, the progress line, and the disabled state.
- [X] T010 [US2] Create `frontend/src/components/SecondVoiceTrainer.tsx`: scale through `resolveTrainerScale`; scale label with source hint; empty state with a scale picker; error state with retry; difficulty tablist with arrow-key roving and Basic selected by default. Tests in `frontend/tests/SecondVoiceTrainer.test.tsx` cover the label for analysis and heuristic sources, the picker, and the tablist.
- [X] T011 [US2] Mount in `frontend/src/components/SheetView.tsx`: inside the `hasVisitedAnalysis` branch, render `SecondVoiceTrainer` (with `displaySheet`, `transpose`, `analysisKey={trainerAnalysisKey}`, `active={tab === "analysis"}`) before `SecondVoicePanel`. Deviation: no SheetView unit test was added; the existing SheetView suites pass, and the mount is verified only by the browser smoke (T019).

**Checkpoint**: the trainer renders in every analysis state (verified in jsdom and in the browser on the ready state); exercises follow transpose.

---

## Phase 5: User Story 3 - Hear the exercise and choose what you hear (P1)

- [X] T012 [US3] Play and Loop ×3/×5/×6 via `startStepSequence` with the beats computed at press time; progress via `sequenceProgress`; at most one session. Tests cover beat counts for Play and Loop, Stop, and a round-count change mid-loop. Gap: a mix or tempo change mid-run is not tested; the code captures both at press time.
- [X] T013 [US3] Reference-mix radiogroup (Both voices default, Your part, Lead only) applied at press time for Play, Loop, and preview. Tests cover each mix's beats.
- [X] T014 [US3] Step preview via `playMidiChord(midis, { mode: "block" })`; it halts any running session first. Tests cover the mix and the halt.
- [X] T015 [US3] Halts on Escape, difficulty-tab switch, and `active` going false. Tests cover each. Gap: unmount halt is not tested explicitly.

---

## Phase 6: User Story 4 - Tempo, octave, remembered settings (P2)

- [X] T016 [US4] Reuse `TrainerTimingStrip` for tempo and octave; persist tempo and loop count through `lib/trainer-prefs.ts` on user change only (not on mount). Tests read the shared keys back. Gap: a running session keeping its tempo after a change is not tested.

---

## Phase N: Polish & gates

- [X] T017 Prettier on touched files; `npm run lint`; `npm run check` — ESLint clean on the full repo; `astro check` 0 errors (5 hints, same as baseline); Prettier clean repo-wide.
- [X] T018 Full `npx vitest run` in `frontend/`: 66 files, 698 tests passing.
- [X] T019 Smoke per `quickstart.md` section 4: partial, see Status.
- [X] T020 Three checks (consistency, scope, verification): done, see Status.

---

## Status (2026-11-02)

- Tests: 736 in 68 files (baseline 643 in 62). Five tests removed: four `SecondVoiceView` assertions on removed sections and one heading test in `second-voice.test.ts`. Ninety-eight tests added.
- Browser checks (Chromium, throwaway harness page and throwaway mock API, both removed afterwards): the trainer mounts in the analyzer tab; Play shows Stop and highlights one step; switching to the 1st-voice tab halts playback. With a rendered analysis, the analyzer panel shows only Recommended second voice, Note-by-note table, and Singing tips, and none of the seven removed headings appears (SC-001). Scheduled pitches for G major: Lead only 9, Your part 9, Both voices 18 in pairs. The +3 stepper moves the label to Bb major and the analysis falls back to the heuristic. Pitches were read from the audio parameter schedule, not heard.
- Hydration mismatch (resolved 2026-11-02): the throwaway harness page had no `<meta charset>`, so the browser decoded the server HTML's `−` (U+2212, `TransposeControl.tsx:47`) as `âˆ’` and React reported a mismatch. It reproduces on baseline `main` in a detached worktree and disappears with `<meta charset="UTF-8" />`. `Layout.astro:16` already declares it, so real pages are unaffected; no app change.
- Browser floor: resolved by reverting `Promise.withResolvers` to the stored-resolver form (T021). No ES2023+ built-ins remain in `frontend/src`.
- Convergence (2026-11-02): findings F1–F7 appended as Phase 7 and completed (T021–T027). A full `/speckit-converge` pass then found four partial gaps, appended as Phase 8 and completed (T028–T031): the shared tempo and loop count sync when a trainer is shown again, an all-keys sweep test backs SC-003, unison steps sound one pitch, and two stale comments are fixed. Mutation check (fix removed in memory, then restored): the unison test, the 24-key sweep, and the two-trainer sync test fail without their fix, and the sync test fails with either trainer's effect removed on its own. Not mutated: the two prefs-fallback tests (they would fail by construction, because the argument would be ignored) and the octave-apart test (a guard against over-collapsing that passes either way). Browser run (Chromium, throwaway page and server removed afterwards): tempo and loop count sync in both directions through real `localStorage`, and "Hold your note" schedules 17 oscillators with one on the unison beat. Gates: ESLint clean, `astro check` 0 errors and 0 warnings (5 hints, same as baseline), Prettier clean. Checked and not raised: the empty and error markup mirrors `TrainerPanel` (no React `ViewStates` exists), and the three-line tempo clamp exists in three places, but the trainers clamp the lowest tempo differently (`TrainerPanel.tsx` uses 40; `TRAINER_MIN_BPM` and the slider use 60), so one shared clamp would change one trainer's behavior for tempos from 40 to 59 (FR-016).
- How-to guide (2026-11-02, owner request after trying the running app; US5, FR-017, T032–T035): a collapsed "How to practice" disclosure under the scale caption. Mutation check (each change applied in memory, then restored): a bubbling handler that halts on toggle fails the trainer test; a guide that starts open fails both the component and trainer tests; hardcoding a displayed option label or the level names fails the labels test. Real app (Chromium, light theme, the running dev server and API): collapsed by default, opens with Enter, every Reference-audio and level label on screen appears in it, a running exercise keeps playing while it is toggled, and at 390 px there is no horizontal overflow. Gates: ESLint clean, `astro check` 0 errors and 0 warnings (5 hints, same as baseline), Prettier clean.

## Phase 7: Convergence

Appended by `/speckit-converge` (2026-11-02). Ordered by severity; completion is recorded per task.

- [X] T021 Restore the stored-resolver `new Promise` form in `frontend/src/lib/trainer-sequence.ts` so Play works on Safari below 17.4, Chrome below 119, and Firefox below 121, per FR-016 (contradicts, CRITICAL)
- [X] T022 Amend spec 006 with a dated owner-directed session entry and the FR-009, US3 scenario 1, SC-007, `contracts/analysis-panel.md`, `plan.md` (SecondVoiceView line), and `quickstart.md` V1 amendments: the rendered UI shows Recommended second voice, Note-by-note table, and Singing tips, while the stored 9-section analysis and the backend eval stay unchanged, per 006 FR-009 and Constitution I (contradicts, CRITICAL)
- [X] T023 Generate the `TrainerTimingStrip` octave-label id with `useId()` so two mounted trainers do not duplicate `trainer-octave-label`, per FR-011 (partial, MEDIUM)
- [X] T024 Add tests that a mix or tempo change mid-run leaves the session running, that Play on another exercise halts the first, and that unmount halts playback, per FR-008, FR-009, FR-011 and US3 scenario 3 (partial, MEDIUM)
- [X] T025 Verify SC-001 in a browser against a rendered analysis (route fixture or live backend), per SC-001 (partial, MEDIUM)
- [X] T026 Run quickstart section 4 steps 5 and 6 in a browser, per `quickstart.md` (partial, LOW)
- [X] T027 Add a SheetView test that the 2nd-voice trainer mounts in the analysis tab, per plan decision 6 and T011 (partial, LOW)

## Phase 8: Convergence

Appended by `/speckit-converge` (2026-11-02, full pass after Phase 7). Ordered by severity; completion is recorded per task.

- [X] T028 Re-read the shared tempo and loop count when each trainer is shown again (`SecondVoiceTrainer.tsx`, `TrainerPanel.tsx`; `readPersistedLoopCount` takes an optional fallback in `trainer-prefs.ts`), leave a running session untouched, and test both directions through `SheetView` with both trainers mounted, per US4/AC2 and FR-011 (partial, MEDIUM)
- [X] T029 Add a sweep test in `frontend/tests/second-voice-exercises.test.ts` over the 24 picker scales, all eight exercises, and octaves 3 to 5: the tonic sounds at the chosen octave, the intervals above the tonic match the reference key of the same mode, and no voice is dropped, per SC-003 and FR-010 (partial, MEDIUM)
- [X] T030 Collapse equal pitches in `beatMidis` so a unison step sounds one pitch, with tests for a unison and for lines an octave apart, per the Edge Cases entry that unison steps sound a single pitch (partial, LOW)
- [X] T031 Fix the stale comments: the harmony-octave comment in `SecondVoiceView.tsx` no longer mentions Diatonics, and the `SheetView.tsx` header says the analyzer tab opens with the 2nd-voice trainer, per T006 and plan decision 7 (partial, LOW)

## Phase 9: How-to guide (US5, owner request 2026-11-02)

- [X] T032 [US5] Create `frontend/src/components/SecondVoiceHowTo.tsx`: a stateless `<details>` disclosure ("How to practice", collapsed by default) that takes the Reference-audio options (label, hint) and the difficulty headings as props and explains the practice flow per FR-017
- [X] T033 [US5] Render it in `frontend/src/components/SecondVoiceTrainer.tsx` under the scale label in the ready state, passing its `MIX_OPTIONS` and difficulty headings
- [X] T034 [US5] Tests: `frontend/tests/SecondVoiceHowTo.test.tsx` (collapsed by default, opens and closes on activation) and a `SecondVoiceTrainer` test that opening and closing the guide mid-run leaves the session untouched; run both files in full
- [X] T035 [US5] Add the guide to `quickstart.md`, run the full gates, and check the guide in a browser on the running app (collapsed by default, opens, a run is unaffected)
