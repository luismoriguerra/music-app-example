# Quickstart: 2nd-Voice Trainer validation

Run from the repository root unless noted. Frontend work is under `frontend/`.

## Prerequisites

- Node >= 22.12 (`frontend/package.json` engines).
- The trainer renders and plays without the backend. The analysis panel and its history need the API (see `run-app-locally`).

## 1. Targeted suites

```bash
cd frontend
npx vitest run tests/second-voice-exercises.test.ts tests/trainer-prefs.test.ts tests/trainer-sequence.test.ts tests/SecondVoiceExerciseCard.test.tsx tests/SecondVoiceHowTo.test.tsx tests/SecondVoiceTrainer.test.tsx tests/SecondVoiceView.test.tsx tests/second-voice.test.ts
```

Expected: every file passes.

## 2. Sibling suites (must pass unchanged)

```bash
cd frontend
npx vitest run tests/TrainerPanel.test.tsx tests/TrainerPanel.playback.test.tsx tests/TrainerTimingStrip.test.tsx tests/trainer-exercises.test.ts tests/trainer-scale.test.ts tests/SheetView.trainer.test.tsx tests/SheetView.tabs.test.tsx tests/SheetView.test.tsx tests/SecondVoicePanel.test.tsx
```

Expected: every file passes with the same test counts as the baseline.

## 3. Full gates

```bash
cd frontend
npx vitest run
npm run check
npm run lint
npx prettier --check <each touched file>
```

Expected: 0 failing tests, 0 `astro check` errors, 0 ESLint errors, Prettier clean on touched files.

## 4. Manual smoke: analyzer tab

1. Open a song with chords and select "AI 2nd voice analyzer".
2. Expect the 2nd-voice trainer first, with Basic selected. None of Key, Scale, Diatonic chords, Roman-numeral progression, Special chords, Important cadences, or Section-by-section feel appears anywhere on the tab.
3. Expect the scale label ("<tonic> <mode> · from AI analysis" when an analysis applies at this transpose, otherwise "· from song chords").
4. Press Play on "Parallel 3rds above" with "Both voices". Expect the step highlight to move through 9 steps, then return to idle. Press Stop mid-run and confirm it halts; press Escape mid-run and confirm it halts.
5. Choose "Lead only", then "Your part", and confirm the next Play sounds only that line.
6. Move the transpose stepper and confirm the scale label and step notes change without leaving the tab.
7. Switch to "1st-voice trainer" and back during a run; confirm the run stops when the tab changes.
8. Open "How to practice" under the scale label. Expect it collapsed by default; opened, it names every Reference-audio option and difficulty level as labelled on screen. Start an exercise, open and close the guide, and confirm the run keeps playing.
