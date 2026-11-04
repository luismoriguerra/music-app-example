# Quickstart: 1st-Voice Trainer Tab

**Feature**: `specs/008-first-voice-trainer/spec.md` | **Date**: 2026-09-18

## Prerequisites

- Frontend dev stack per `frontend/README.md` (Node pinned, deps installed).
- Any song sheet with chords (lyrics-only also works via fallback — see scenario 5).

## Scenario 1 — Trainer tab follows transpose (US1)

1. Open a song sheet with chords; note the transpose value (default `Tr. 0`).
2. Select the **1st-voice trainer** tab.
3. Expect: a Basic/Intermediate/Advanced/Master tablist, Basic active by default (32 exercises total, 8 per group), every card badged agility/tonality/flexibility, each showing ordered notes + a visible scale label. Tap any note chip to hear just that pitch.
4. Move transpose to `+2`; expect: every exercise sequence updates to the new key, scale label updates, no navigation.

## Scenario 2 — Play-all with progress + stop (US2)

1. On the trainer tab, press **Play** on any exercise.
2. Expect: full sequence sounds in order; current-note highlight advances; state reads playing (`aria-busy`).
3. Press **Stop** (or Escape) mid-run; expect: sound halts promptly, card returns to idle.
4. Press **Play** twice quickly; expect: single restart, never overlapping audio.

## Scenario 2b — Loop ×3 (US2 amendment, 2026-09-30)

1. On the trainer tab, press **Loop ×3** on any exercise.
2. Expect: the same sequence sounds three times back-to-back as one run; progress reads "Round N of 3 · Note …"; the Loop ×3 button shows Stop while Play stays untouched and clickable.
3. Press **Play** on the same exercise while Loop ×3 is running; expect: the loop stops and a single Play run starts (Loop ×3 reverts to idle, Play becomes Stop) — never overlapping.
4. Press **Stop**; expect: both buttons return to idle and progress clears.
5. (Amended 2026-10-01) Pick **×5** in the loop dropdown, press **Loop ×5**; expect "Round N of 5". Change the dropdown to ×6 mid-run; expect the running loop and its Stop unchanged.
6. Press **Show uke fretboard** under an exercise (collapsed by default); expect a GCEA neck, frets 0–12, marking every position of that exercise's notes with the tonic filled.

## Scenario 3 — Timing control (US3)

1. Set tempo **Slow**, Play an exercise; set tempo **Brisk**, Play again; then **Melisma** (200) and **Blaze** (240) — the slider now reaches 240 and fast runs stay note-distinct.
2. Expect: second run completes noticeably faster; readout shows `♩= N`; slider + presets stay in sync.

## Scenario 4 — Tab state + song change

1. Set a non-default tempo, start nothing, switch to Sheet and back; expect: tempo + exercise preserved.
2. Start playback, switch tabs mid-run; expect: playback stops cleanly.
3. Open a different song; expect: trainer resets to that song's scale (no stale exercises).

## Scenario 4b — Switching difficulty tabs (2026-09-30)

1. Start Play or Loop ×3 on an exercise, then select a different difficulty tab.
2. Expect: playback stops cleanly (within 250 ms) even though the running exercise's card is now hidden; arrow keys on the tablist also rove between groups and stop any running session.

## Scenario 5 — Lyrics-only fallback

1. Open a lyrics-only song; expect: Sheet + Trainer tabs (no analysis tab), fallback scale label with explanation, working Play.

## Validation commands

```bash
# from frontend/
npx vitest run tests/trainer-scale.test.ts tests/trainer-exercises.test.ts tests/trainer-sequence.test.ts
npx vitest run tests/TrainerPanel.test.tsx tests/TrainerTimingStrip.test.tsx
npm run lint && npm run format:check
```

Expected: all green, no new warnings. See `contracts/` for prop/lib details and `data-model.md` for state transitions under test.

## Validation notes (2026-09-18 implement run)

All scenarios verified via the Vitest harness (no browser E2E in repo):

- Scenario 1 (transpose-follows): PASS — `TrainerPanel.test.tsx` transpose
  update (C→D run) + `SheetView.trainer.test.tsx` 3-tab composition green.
- Scenario 2 (Play-all + progress + stop): PASS —
  `TrainerPanel.playback.test.tsx` (Play→highlight, Stop/Escape→idle,
  re-press restart, natural finish) + `trainer-sequence.test.ts` (upfront
  scheduling math, stop cancels future notes) green.
- Scenario 3 (timing): PASS — `TrainerTimingStrip.test.tsx` (slider,
  presets, octave) + tempo-freeze test (mid-run edit applies to next Play)
  green.
- Scenario 4 (tab state + song change): PASS — lazy-mount + `hidden`
  persistence, `active=false` hide→stop, unmount stops session green.
- Scenario 5 (lyrics-only): PASS — Sheet + Trainer tabs, picker fallback
  with no-chords explanation, working Play after pick green.

Gates: `npm run lint` ✓, `npm run format:check` ✓, full suite 609/609 (594 + 2 FR-004 analysis-key + 1 analysis-fallthrough + 2 degree-8 octave + 10 difficulty/note-preview/G-major-pitch tests) ✓
(60 files; baseline 528 + 66 new). Audio scheduling is covered by a
fake-AudioContext double (lib) and a mocked sequencer (component); a
single-owner real-browser sound check is still recommended before release
per SC-002/SC-005.

## Validation notes (2026-09-30 Loop ×3 / Master group / tabs run)

- Scenario 2b (Loop ×3): PASS — `TrainerPanel.playback.test.tsx` (schedules
  the 3×-concatenated run as one frozen session, round/note-wrap progress
  math, Stop-during-loop reverts cleanly, Play/Loop ×3 mutual exclusion) +
  a real-browser proof (direct module mount, real `AudioContext`, real
  clicks/timers) confirming the same behavior outside the test harness.
- Scenario 4b (difficulty-tab switching): PASS —
  `TrainerPanel.test.tsx` (tablist renders 4 tabs starting on Basic, each
  panel's own exercises show/hide via `hidden`, arrow-key roving moves
  focus and selection, switching tabs halts a running session).
- `trainer-exercises.test.ts`: 32 exercises (8 per difficulty, 11/10/11 per
  technique), master-group spot checks, all pre-existing pattern/degree/
  octave assertions unchanged (new patterns appended, not reordered).
- Full suite: 624/624 green; `npm run lint` ✓; `npm run check` (astro
  check) 0 errors; `npx tsc --noEmit --ignoreDeprecations 6.0` 0 errors in
  every touched file (remaining errors are pre-existing `.astro`-import
  limitations of bare `tsc`, unrelated to this change).
