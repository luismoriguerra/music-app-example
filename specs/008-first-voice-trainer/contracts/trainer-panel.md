# Contracts: TrainerPanel + TimingStrip

## `TrainerPanel` (new, `frontend/src/components/TrainerPanel.tsx`)

Presentational container mounted in the third `tabpanel` of `SheetView`.

Props (all required unless noted):

- `displaySheet: Sheet` — already-transposed sheet; read-only (never transposes itself).
- `transpose: number` — shared stepper value (−11..11); drives scale resolution + stale marking.
- `active: boolean` — true while the trainer tab is selected; `false` (hidden) MUST stop playback within 250 ms (FR-010).
- `analysisKey?: { tonic: string; mode: "major" | "minor"; scale: readonly string[] } | null` — open AI analysis key; SheetView passes null unless its transpose matches the stepper (008 FR-004).
- `scaleOverride?: { tonic: string; mode: "major" | "minor" } | null` — initial picker selection; null = auto. Panel-owned after mount.
- `bpm?: number` — initial tempo (default 84); panel owns tempo state.
- `octave?: number` — initial vocal reference octave, 3 | 4 | 5 (default 4); panel-owned.
- `onScaleOverrideChange?: (next | null) => void` — picker callback (optional).
- `isLoading?: boolean` — renders the loading skeleton with reserved space (default false).

State ownership: the panel owns tempo/octave/override state internally
(uncontrolled; props are initial values), so `SheetView` only passes
`displaySheet` + `transpose` + `active` + `analysisKey`. This keeps timing-strip composition
(T018) and BPM persistence (T022) inside `TrainerPanel.tsx`.

Behavior contract:

- Resolves `SelectedScaleAtTranspose` via `trainer-scale.ts`; shows scale label with source (`analysis | heuristic | picker`).
- Renders 4 difficulty groups (Basic/Intermediate/Advanced/Master) as a `role="tablist"` (`data-testid="trainer-difficulty-tablist"`, arrow-key roving, one active tab, default Basic); each tab's panel (`data-testid="trainer-group-<difficulty>"`, `role="tabpanel"`, `hidden` when inactive) lists that group's exercises from `trainer-exercises.ts` (32 total, 8 per group). Each card shows a technique badge (`data-testid="trainer-category"`), note buttons + degrees, and Play + Loop ×3 (amended 2026-09-30).
- Every note chip is a `<button data-testid="trainer-note" aria-label="Play note <N> (degree <d>)">`: click stops any running session, then sounds only that pitch via `playNote`, placed tonic-relative (same math as Play-all: `midiForNote`). Disabled when audio is unavailable.
- At most one active `PlaybackSession`. Play and Loop ×3 are independent per-exercise controls: whichever one is running shows "Stop" (`data-testid="trainer-stop"`); the other stays in its own idle label and, if pressed, stops the running session and starts its own (stop-then-restart). Pressing either control on a different exercise, or switching the difficulty tab, also stops-then-replaces the running session. Stop/Escape/`active=false`/unmount stops cleanly (no new notes later than 250 ms) without restarting.
- Amended 2026-10-01: a `<select data-testid="trainer-loop-count-<exerciseId>">` (options 3/5/6, default 3, persisted as `localStorage["trainer.loops"]`) sets the Loop round count (`Loop ×N`); running state is tracked by action mode, not count, so changing it mid-run keeps the running loop. A `data-testid="trainer-fretboard-toggle-<exerciseId>"` button (`aria-expanded`, default false) reveals `data-testid="trainer-fretboard-<exerciseId>"` containing `ScaleNeck` (GCEA, frets 0–12) for the exercise's distinct notes.
- States: `loading` (reserved space) / `empty` (missing scale + picker CTA) / `error` (message + retry) / `ready`.
- Test hooks: `data-testid="trainer-panel"`, `data-testid="trainer-difficulty-tab-<difficulty>"`, `data-testid="trainer-group-<difficulty>"`, `data-testid="trainer-play-<exerciseId>"`, `data-testid="trainer-loop-<exerciseId>"`, `data-testid="trainer-stop"`, progress via `aria-live="polite"` + `aria-busy`.

## `TrainerTimingStrip` (new, `frontend/src/components/TrainerTimingStrip.tsx`)

Props: `bpm: number; onBpmChange: (next: number) => void; octave: number; onOctaveChange: (next: number) => void`.

- Slider `60–240` + readout `♩= N` (`aria-valuetext="N beats per minute"`); presets Slow 60 / Steady 90 / Brisk 120 / Fast 160 / Melisma 200 / Blaze 240 set the slider (`aria-pressed`) (amended 2026-10-01).
- While a preset is selected, its short practice tips render as `<ul data-testid="trainer-tempo-tips" aria-live="polite" aria-label="<Preset> practice tips">`; none on a custom tempo (amended 2026-10-01).
- Standalone: renders correctly in isolation with mock props.

## `SheetView` tab extension (edit, `frontend/src/components/SheetView.tsx`)

- `SheetTab` becomes `"sheet" | "analysis" | "trainer"`; tab order and labels (amended 2026-09-30): "Lyrics + Chords" (`data-testid="sheet-tab-sheet"`), "1st-voice trainer" (`data-testid="sheet-tab-trainer"`), "AI 2nd voice analyzer" (`data-testid="sheet-tab-analysis"`); 3-way arrow roving follows that order; `hasVisitedTrainer` lazy-mount + `hidden`, passes `active={tab === "trainer"}` so hide stops playback.
- Lyrics-only sheets show Lyrics + Chords + 1st-voice trainer (analyzer remains chord-gated).
- SheetView holds the open analysis (`onOpenAnalysisChange` from SecondVoicePanel) and passes it as `analysisKey` only when `open.transpose === transpose`, else null — stale analyses never leak into the trainer.
