# Implementation Plan: 2nd-Voice Trainer

**Branch**: `013-second-voice-trainer` | **Date**: 2026-11-02 | **Spec**: `specs/013-second-voice-trainer/spec.md`

**Input**: Feature specification from `specs/013-second-voice-trainer/spec.md`

## Summary

Remove the harmony-theory sections from the "AI 2nd voice analyzer" tab (Key, Scale, Diatonic chords, Roman-numeral progression, Special chords, Important cadences, Section-by-section feel) and add a 2nd-voice trainer above the analysis content. The trainer mirrors the 1st-voice trainer (scale-aware exercises grouped by difficulty, Play / Loop / Stop, shared tempo and octave) with two voices per beat: a Lead line and the learner's Your-part line, both built from the song's scale at the current transpose. Frontend-only (`frontend/`); no backend, schema, or hosted-model change.

## Technical Context

**Language/Version**: TypeScript + Astro 7 islands (React components)

**Primary Dependencies**: React, Tailwind CSS v4 + shadcn/ui, Web Audio via `lib/sound.ts` and `lib/trainer-sequence.ts` (no new npm dependencies), existing Zod schemas only

**Storage**: `localStorage` keys `trainer.bpm` and `trainer.loops` (unchanged names, now owned by `lib/trainer-prefs.ts`); nothing else persisted

**Testing**: Vitest + Testing Library (jsdom). Every new lib module and component gets a test file; existing 1st-voice and analyzer suites must pass unchanged except removed-section assertions

**Target Platform**: Modern desktop and mobile browsers

**Project Type**: Web application, frontend-only increment

**Performance Goals**: Play starts within ~200 ms of press; tempo and octave changes apply to the next run; step highlight causes no layout shift

**Constraints**: `lib/` has zero UI or Astro imports; playback starts only from a user gesture; Stop, Escape, tab hide, and unmount halt within 250 ms; ESLint and Prettier green on touched files

**Scale/Scope**: 8 exercises (2 per difficulty), 3 reference mixes, 3 loop counts; 3 new components, 2 new lib modules (`second-voice-exercises.ts`, `trainer-prefs.ts`), 1 new sequencer entry point, 1 cut in `SecondVoiceView.tsx`

## Constitution Check

*GATE: checked before tasks; re-checked at the converge step.*

- [x] I. Spec-driven: spec and checklist written before this plan; clarify and analyze skipped with justification recorded in the spec's Assumptions.
- [x] II. Monorepo boundaries: all app code under `frontend/`; no `backend/` edits.
- [x] III. Test-first: each lib module and component has a test file (see tasks.md).
- [x] IV. Agent evals: no agent, prompt, or model change.
- [x] V. Model selection: no hosted LLM call and no model ID; no `openrouter-model-eval` record needed.
- [x] VI. Browser AI: Web Audio only; with audio unavailable, controls are disabled with an explanation.
- [x] VII. Backend/MCP: no backend, schema, or endpoint change.
- [x] VIII. Clean code: lib modules are pure; components take props and emit events; the persistence keys have one owner; the cut leaves no dead exports.

## Decisions

1. **Scale-step model.** A step is an integer in the key's scale: 0 = tonic, 1 = 2nd, ... 6 = 7th, 7 = tonic an octave up, negatives below the tonic. Pitch = tonic MIDI at the chosen octave + `mod(pitchClass(degree) - rootPitch, 12)` + 12 × octave index. This is the 008 tonic-anchored rule, reusing the key's spelled notes; no new interval table.
2. **Diatonic intervals.** Labels count scale steps ("3rd above", "6th below"). Major or minor quality follows from the key's notes, so no quality table is needed.
3. **Two voices per beat.** `startStepSequence(steps, opts)` in `lib/trainer-sequence.ts` schedules every pitch of a beat at the same instant. `startSequence(midis)` becomes a delegate that wraps each pitch as a one-pitch beat, so one scheduler serves both trainers.
4. **Shared settings, one owner.** Tempo and loop-count keys, defaults, parsing, and writes move from `TrainerPanel.tsx` to `lib/trainer-prefs.ts`. `TrainerPanel` imports them; its behavior and its test suite do not change.
5. **No component extraction.** `RunButton` and the difficulty tablist are written again in the new card and container. That is the second use, below the constitution's third-use extraction threshold, and it keeps the 1st-voice component untouched.
6. **Mount point.** `SheetView` renders `SecondVoiceTrainer` as a sibling above `SecondVoicePanel` inside the analysis tabpanel, passing `displaySheet`, `transpose`, `active`, and the existing `trainerAnalysisKey`. `SecondVoicePanel` is unchanged.
7. **Cut.** Seven sections are removed from `SecondVoiceView.tsx` with their state and helpers. `ANALYSIS_HEADINGS` and `analysisHeading` are deleted from `lib/second-voice.ts` because no consumer remains. `secondVoiceOutSchema` and the backend are unchanged, and the harmony table still reads `analysis.progression`.
8. **Catalog.** Eight exercises, two per difficulty:
   - Basic: parallel 3rds above, parallel 3rds below (technique: parallel)
   - Intermediate: parallel 6ths above, parallel 6ths below (technique: parallel)
   - Advanced: interval ladder over a held lead (intervals), hold your note (independence)
   - Master: lead leaps with a 3rd follow (intervals), crossing lines in contrary motion (independence)
9. **How-to guide (FR-017).** `SecondVoiceHowTo` is a stateless presentational component built on a native `<details>` (collapsed by default, keyboard-operable with no JavaScript state). `SecondVoiceTrainer` renders it under the scale label in the ready state and passes the Reference-audio options (label and hint) and the difficulty headings it already uses for its controls, so the guide cannot drift from the labels. It holds no playback state, so opening it cannot stop a run.

## Source layout

```text
frontend/src/
├── lib/
│   ├── second-voice-exercises.ts    # new: catalog, scale-step pitch, diatonic intervals, mix, rounds
│   ├── trainer-prefs.ts             # new: shared tempo and loop persistence (moved from TrainerPanel)
│   ├── trainer-sequence.ts          # edit: startStepSequence; startSequence delegates
│   └── second-voice.ts              # edit: drop ANALYSIS_HEADINGS, analysisHeading
├── components/
│   ├── SecondVoiceTrainer.tsx       # new: container (scale, tablist, mix, timing, playback)
│   ├── SecondVoiceExerciseCard.tsx  # new: presentational exercise card
│   ├── SecondVoiceHowTo.tsx         # new: stateless "How to practice" disclosure
│   ├── SecondVoiceView.tsx          # edit: remove seven theory sections
│   ├── SheetView.tsx                # edit: mount trainer in analysis tabpanel
│   └── TrainerPanel.tsx             # edit: import prefs from lib (behavior unchanged)
frontend/tests/
├── second-voice-exercises.test.ts   # new
├── trainer-prefs.test.ts            # new
├── trainer-sequence.test.ts         # edit: add startStepSequence cases
├── SecondVoiceExerciseCard.test.tsx # new
├── SecondVoiceHowTo.test.tsx        # new
├── SecondVoiceTrainer.test.tsx      # new
├── SecondVoiceView.test.tsx         # edit: delete removed-section assertions only
└── second-voice.test.ts             # edit: delete heading assertions only
```

## Complexity Tracking

> No constitution violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
