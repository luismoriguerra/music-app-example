# Contracts: Trainer lib (scale, exercises, sequencer)

## `trainer-scale.ts` (new, `frontend/src/lib/trainer-scale.ts`, pure, zero UI imports)

- `resolveTrainerScale(args: { displaySheet: Sheet; transpose: number; analysisKey?: { tonic: string; mode: "major"|"minor"; scale: string[] } | null; override?: { tonic: string; mode: "major"|"minor" } | null }): SelectedScaleAtTranspose`
  - Priority: override → analysis (when `transpose` matches its context) → transposed-tonic heuristic via most-frequent root.
  - Note names from `scaleSpelling(rootPitch, mode)`; an unspellable analysis key falls through to the heuristic (analysis is a hint, heuristic is the floor); throws only on bad override/transpose or an unresolvable sheet (callers map to error/empty states).

## `trainer-exercises.ts` (new, `frontend/src/lib/trainer-exercises.ts`, pure)

- `buildTrainerExercises(scaleNotes: readonly string[], opts?: { perCategory?: number }): TrainerExercise[]`
  - 12 deterministic patterns, 4 per `difficulty` (`basic | intermediate | advanced`) and 4 per `category` (agility/tonality/flexibility). Basic: Stepwise Run `1-2-3-4-5-4-3-2-1`, Sustained Drone `1-3-5-8`, Gentle Triad `1-3-5-3-1`, Descending Five `5-4-3-2-1-2-3-4-5`. Intermediate: Tonic Call & Response, Arpeggio Wave `1-3-5-8-5-3-1`, Octave Siren `1-8-1`, Full Octave Run `1..8..1`. Advanced: Thirds Ladder, Fourths Climb `1-4-2-5-3-6-4-7-5-8…`, Leap & Return `1-5-8-5-3-1`, Melisma Wave `1-3-5-7-8-7-5-3-1`.
  - Degrees derived from scale index; notes reference `scaleNotes` by degree (no pitch math here); `octaves` carries the per-note offset (`1` for degree 8, else `0`).
  - Pitch placement lives in the panel (`midiForNote`): the tonic sits at the base octave, every other note is its interval above the tonic, plus `12 × octaves[i]`. Absolute `noteToMidi(name, octave)` is NOT used for exercises — it drops any pitch class below the tonic's an octave (G major `C`/`D` would sag a seventh).
  - Pure + total: same input → same output; never throws on short scales (clamps/truncates).

## `trainer-sequence.ts` (new, `frontend/src/lib/trainer-sequence.ts`, thin orchestration over `sound.ts`)

- `startSequence(midis: readonly number[], opts: { bpm: number; noteDurationScale?: number }): { stop(): void; finished: Promise<void> }`
  - Upfront scheduling at `stepSeconds = 60 / bpm`; frozen snapshot; `stop()` prevents future notes (ringing notes decay).
  - SSR/test safe: no `AudioContext` → resolved `finished` with no-op `stop`.
- `sequenceProgress(total: number, startedAtMs: number, stepMs: number): number` (pure helper for highlight index; testable without audio).
