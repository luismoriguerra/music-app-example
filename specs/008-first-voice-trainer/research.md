# Research: 1st-Voice Trainer Tab

**Feature**: `specs/008-first-voice-trainer/spec.md` | **Date**: 2026-09-18

## R1 — Scale source at transpose

- **Decision**: Trainer resolves its scale as: AI analysis key/scale when an analysis is open at (or near) the current transpose, else the transposed-tonic heuristic (most-frequent root pitch transposed by N), else a user-picked scale from the 24-scale catalog. The resolved scale label is always visible.
- **Rationale**: Instant value with zero backend on first visit (heuristic), upgraded accuracy when the learner already ran analysis; picker guarantees the empty state is actionable including lyrics-only sheets.
- **Alternatives considered**: Analysis-only (unusable before a run, dead on lyrics-only — rejected); heuristic-only (wrong on ambiguous minor tonics with no recourse — rejected); picker-only with no default (extra friction every visit — rejected).
- **Spelling**: Note names come from the normative `SPELLING_TABLE` via `scaleSpelling(rootPitch, type)` so enharmonics stay conventional.

## R2 — Exercise generation site

- **Decision**: Frontend-deterministic vocalise patterns over the resolved scale in v1. No new backend endpoints, no hosted LLM calls.
- **Rationale**: Zero latency/cost, on-device-first per constitution VI, trivially unit-testable; pattern library (stepwise runs, arpeggios/thirds, sustained drones) covers agility/tonality/flexibility without personalization.
- **Alternatives considered**: Backend-LLM personalized plans (rejected for v1: needs OpenRouter decision record per Principle V, eval gates per Principle IV, persistence, latency — disproportionate to a practice surface). Hybrid (deterministic now, LLM "custom routine" later) stays open without blocking v1.
- **Principle V note**: No model choice is made in this feature, so no `openrouter-model-eval` record is required.

## R3 — Play-all sequencer

- **Decision**: New cancellable sequencer in `frontend/src/lib/` scheduling all notes upfront against `AudioContext.currentTime` (`stepSeconds = 60 / BPM`), returning a stop handle. The played snapshot (midis + timing + octave) is frozen at press time.
- **Rationale**: Sample-accurate tempo at agility speeds, immune to background-tab timer throttling; freeze matches the existing snapshot philosophy (`buildSnapshot` copies symbols verbatim) and prevents mid-run morphing on transpose/scale change. Reuses `arpeggioMidis` octave-wrap and the triangle envelope in `sound.ts`.
- **Alternatives considered**: Chained `setTimeout` calling `playNote` (drifts, throttled — rejected as primary, acceptable fallback only); async-iterator with AbortController (readable but same timing limits — rejected).
- **Overlap/stop**: At most one session per tab; new Play stops/replaces the running one; Stop/Escape/tab-switch/song-change stops cleanly; already-ringing notes decay naturally.

## R4 — Timing control

- **Decision**: One trainer-level timing strip above the exercise list: BPM slider (60–140, default 84) with live readout + three presets (Slow 60 / Steady 90 / Brisk 120) that set the slider; note-length fixed legato-leaning in v1 with detached/legato left as a follow-up. Applies to the next Play (frozen per session).
- **Amendment 2026-10-01**: Range widened to 60–240 (sequencer cap 240) with Fast 160 / Melisma 200 / Blaze 240 presets for melisma practice; at one note per beat, 140 BPM was too slow for runs. Each note now rings `min(1.1 s, 2 × step)` so fast runs don't smear; each preset shows short practice tips while selected.
- **Rationale**: Single control inherits into every Play-all, avoids N sliders drifting; presets give one-tap mobile usability, slider gives precision; freeze avoids live-ramp complexity.
- **Alternatives considered**: Per-card tempo (rejected: sync burden); tap-tempo (rejected for v1: most code, hardest a11y); live-ramp mid-play (rejected: surprising while singing).
- **Persistence**: In-memory default in v1; persisting last BPM to `localStorage` (mirroring `chordMode`) is an allowed polish task, not required.

## R5 — Tab composition

- **Decision**: Extend `SheetTab` to `"sheet" | "analysis" | "trainer"`; third `role="tab"` + `tabpanel` reusing the active idiom and `data-testid="sheet-tab-trainer"`; `hasVisitedTrainer` lazy-mount then `hidden` (same as analysis); arrow-key roving becomes 3-way cycle; transpose stays shared above the tabs; lyrics-only sheets show Sheet + Trainer (analysis stays hidden per FR-001 of 006).
- **Rationale**: Minimal delta, preserves per-tab state and remount-per-song reset (`key={sheet.id}`), keeps keyboard contract intact.
- **Alternatives considered**: Trainer as separate page/route (rejected: breaks transpose-shared context and one-tap practice flow); always-mounted trainer (rejected: wasted audio/scheduler setup).

## R6 — Octave and progress UX

- **Decision**: Octave selector 3/4/5 reused from the analysis Scale section (default 4); progress = highlighted current-note chip + `aria-live="polite"` position text + `aria-busy` on the playing card; Stop button + Escape.
- **Rationale**: Consistency with shipped patterns learners already know; meets Component-completeness (loading/empty/error/ready) and keyboard operability without new idioms.
