# Data Model: First-Voice Trainer Tab

**Feature**: `specs/008-first-voice-trainer/spec.md` | **Date**: 2026-09-18

Pure frontend state (display-scoped unless noted). No backend tables, no migrations.

## TrainerExercise

A practicable vocal pattern in the resolved scale at the current transpose.

- `id`: stable slug per pattern slot, e.g. `agility-run-1`, `tonality-drone-1`, `flexibility-arpeggio-1` (required, unique within the tab).
- `category`: enum `agility | tonality | flexibility` (required; rendered as a badge).
- `difficulty`: enum `basic | intermediate | advanced | master` (required; the panel's grouping axis, rendered as a tab, 8 exercises per level — 32 total. Amended 2026-09-30: added `master`, doubled per-level count from 4).
- `title`: short learner-facing name, 1–80 chars (required).
- `notes`: ordered note names, 1–32 entries, each matching `^[A-G](?:#{1,2}|b{1,2})?$` after trim (required; unparseable names never sound — skipped, never substituted).
- `degrees`: parallel scale-degree labels, same length as `notes` (required for display).
- `octaves`: parallel octave offsets, same length as `notes` (`0` for degrees 1–7, `1` for degree 8 — the octave duplicate of the tonic; required for playback so `1-8-1` sounds the leap, not three unisons).
- `description`: 1–240 chars practice cue (required).

Relationships: derived from exactly one `SelectedScaleAtTranspose`; sounded by at most one `PlaybackSession` at a time.

## SelectedScaleAtTranspose

The source of truth for all exercise sequences on the tab.

- `tonic`: note name per `NOTE_NAME_RE` (required).
- `mode`: enum `major | minor` (required).
- `notes`: conventional spellings from the spelling table, 7 pitch classes + octave duplicate (required).
- `transpose`: integer −11..11, the stepper value it was derived at (required).
- `source`: enum `analysis | heuristic | picker` (required, displayed in the scale label).
- `rootPitch`: 0–11 (required, internal).

Validation: `transpose` outside ±11 is rejected (clamped at the stepper, never in the trainer); `notes` MUST be the conventional spelling for `(rootPitch, mode)`.

## TimingSetting

Applies to subsequent Play runs; display-scoped.

- `bpm`: integer 40–240 practice range, UI slider bounded 60–240 (required, default 84; amended 2026-10-01 from 208/140 for melisma practice).
- `preset`: enum `slow | steady | brisk | fast | melisma | blaze | custom` (derived: 60/90/120/160/200/240 map to named presets, anything else `custom`).
- `stepSeconds`: derived `60 / bpm` (never stored, computed at Play time).

## PlaybackSession

At most one active per trainer tab; frozen at Play or Loop ×3 press.

- `exerciseId`: references `TrainerExercise.id` (required).
- `midis`: frozen MIDI numbers in play order, repeated `loops` times back-to-back as one snapshot (required, non-empty).
- `bpm`: frozen tempo for this run (required).
- `mode`: enum `play | loop` — which action started this session; decides which button shows Stop (required, amended 2026-10-01).
- `loops`: integer `1` (Play) or the Loop round count `3 | 5 | 6` frozen at press time — how many times its `midis` (pre-repeat) round repeats; changing the dropdown mid-run does not alter it (required, amended 2026-10-01).
- Note ring: each note sounds for `min(1.1 s, 2 × stepSeconds)` so fast runs stay distinct (amended 2026-10-01).
- `position`: 0-based index into the repeated snapshot; display derives the current repeat as `floor(position / len) + 1` and the note-within-repeat as `position % len`, where `len` is the un-repeated exercise length (required, resets to 0 on stop/finish).
- `state`: enum `playing | stopped | finished` (required).

State transitions: `idle → playing` (Play or Loop ×3) → `finished` (natural end) or `→ stopped` (Stop/Escape/re-Press/tab-switch/song-change/unmount). Re-Press semantics (amended 2026-09-30): pressing Play or Loop ×3 on a _different_ exercise, or pressing the _other_ action (Play vs Loop ×3) on the _same_ exercise, or switching the difficulty tab, is stop-then-restart (never overlap) — this is what "re-Press" covers. The button currently showing "Stop" is the Stop control for its own session, not a Play/Loop ×3 toggle; an explicit Stop (or Escape) is required to halt a session without immediately starting another. Transpose/scale edits during `playing` do not mutate the frozen `midis`; they apply to the next session.
