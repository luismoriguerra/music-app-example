# Implementation Plan: 1st-Voice Trainer Tab

**Branch**: `feat/first-voice-trainer-c0c8` | **Date**: 2026-09-18 | **Spec**: `specs/008-first-voice-trainer/spec.md`

**Input**: Feature specification from `specs/008-first-voice-trainer/spec.md`

## Summary

Add a third "1st-voice trainer" tab to the Lyrics + Chords song sheet delivering deterministic agility/tonality/flexibility vocalises from the song's scale at the shared transpose, each with cancellable Play-all reference audio and a trainer-level tempo control. Frontend-only (`frontend/`), no backend changes, no hosted models.

## Technical Context

**Language/Version**: TypeScript 5 + Astro 7 islands (React components for interactive islands)

**Primary Dependencies**: React, Tailwind CSS v4 + shadcn/ui, Web Audio API (zero npm deps for sound), Zod (schemas where boundaries need them)

**Storage**: N/A (display-only; transpose never persists; BPM in-memory default, optional `localStorage` polish)

**Testing**: Vitest (frontend unit tests for every util/component/island); no backend tests (no backend change); no Agno evals (no agent behavior change)

**Target Platform**: Modern desktop + mobile browsers (Web Audio, keyboard + touch)

**Project Type**: Web application, frontend-only increment

**Performance Goals**: Play-all starts audibly within ~200 ms of press; tempo/preset switch applies instantly to next Play; no layout shift when progress highlight moves; sequence timing drift inaudible at 60–240 BPM (amended 2026-10-01; notes ring at most 2 steps so fast runs stay distinct)

**Constraints**: Audio MUST start from an explicit user gesture and no-op safely in SSR/tests; `frontend/src/lib/` MUST NOT import UI/Astro (downward-only deps); new UI MUST be standalone presentational components with loading/empty/error/ready states; ESLint + Prettier green before merge

**Scale/Scope**: 1 tab extension in `SheetView.tsx`, 1–2 new components (`TrainerPanel`, `TrainerTimingStrip`), 2 pure lib modules (exercise patterns, cancellable sequencer); ~9 exercise patterns across 3 categories

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] I. Spec-driven: spec written and validated (`checklists/requirements.md` green) before this plan; tasks → implement → converge to follow.
- [x] II. Monorepo boundaries: all changes under `frontend/` (owner `astro-frontend`); no `backend/` edits; no root app code.
- [x] III. Test-first: Vitest for sequencer math, pattern builder, scale resolution, and each component/island (write-first, red-green); gates green before merge.
- [x] IV. Agent evals: no agent/prompt/model change — no Agno scenarios required.
- [x] V. Model selection: no hosted LLM use — no `openrouter-model-eval` record required (documented in `research.md` R2).
- [x] VI. Browser AI/on-device: no provider keys in browser, no hosted calls; Web Audio only; full function without WebMCP/AI features.
- [x] VII. Backend/MCP: no backend, persistence, auth, or MCP Apps change.
- [x] VIII. Clean code & architecture: pages → components → lib → content; lib pure; standalone reusable components; logic in lib; fastest-correct codegen (upfront scheduling, deferred mount); ESLint + Prettier green.

Post-design re-check: no new violations introduced. Timing persistence (optional polish) uses `localStorage` only, no secrets. No complexity-tracking exceptions needed.

## Project Structure

### Documentation (this feature)

```text
specs/008-first-voice-trainer/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 decisions (R1–R6)
├── data-model.md        # Entities + transitions
├── quickstart.md        # Validation guide
├── contracts/           # Component + lib contracts
│   ├── trainer-panel.md
│   └── sequencer.md
├── checklists/
│   └── requirements.md  # Spec quality gate
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   ├── SheetView.tsx          # extend: 3rd tab + shared transpose (edit)
│   │   ├── TrainerPanel.tsx       # new: exercises + Play-all + progress (new)
│   │   └── TrainerTimingStrip.tsx # new: BPM slider + presets + octave (new)
│   ├── lib/
│   │   ├── trainer-exercises.ts   # new: pure pattern builder over scale notes (new)
│   │   ├── trainer-scale.ts       # new: pure scale-at-transpose resolver (new)
│   │   ├── trainer-sequence.ts    # new: cancellable upfront scheduler (new)
│   │   ├── sound.ts               # reuse: AudioContext, envelopes (reuse)
│   │   ├── scales.ts              # reuse: SPELLING_TABLE/scaleSpelling (reuse)
│   │   └── chord-diagrams.ts      # reuse: transposeSheet/tonic proxy (reuse)
│   └── content/                   # untouched
└── tests/
    ├── trainer-exercises.test.ts
    ├── trainer-scale.test.ts
    ├── trainer-sequence.test.ts
    ├── TrainerPanel.test.tsx
    ├── TrainerPanel.playback.test.tsx
    ├── TrainerTimingStrip.test.tsx
    └── SheetView.trainer.test.tsx
```

**Structure Decision**: Frontend-only increment inside the existing Astro islands layout. All domain logic in new pure `lib/` modules (zero UI imports); components presentational (props in, events out). No backend, content, or route changes.

## Complexity Tracking

> No constitution violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
