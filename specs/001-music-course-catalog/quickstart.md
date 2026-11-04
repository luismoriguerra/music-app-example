# Quickstart: Music Course Catalog (Ukulele + Chords)

**Feature**: `001-music-course-catalog` | **Date**: 2026-09-15
Validates the feature end to end. Details live in [plan.md](./plan.md),
[data-model.md](./data-model.md), and [contracts/](./contracts/routes.md) —
this file is the run guide only.

## Prerequisites

- Node 22+, npm, Python 3.12+, Docker (all verified on this machine).
- Fresh checkout; nothing globally installed beyond the above.

## Setup

```bash
# Frontend (Astro app)
cd frontend && npm install && cd ..

# Backend (AgentOS scaffold) — env + compose
cp .env.example .env   # or backend/.env.example → backend/.env per scaffold
docker compose up -d --build
```

## Run

```bash
# Terminal 1 — frontend
cd frontend && npm run dev      # → http://localhost:4321

# Backend health (repo root, after `docker compose up -d`)
curl http://localhost:8000/health     # → {"status":"ok"} (port per scaffold)
```

## Test

```bash
cd frontend && npx vitest run   # frontend unit tests (Principle III)
cd frontend && npm run check-content  # content integrity gate (also runs as prebuild)
cd frontend && npm run check && npm run lint && npm run format:check  # frontend type-check + lint/format (Principle VIII)
pytest backend/                        # backend scaffold tests (from repo root)
ruff check backend/ && ruff format --check backend/  # backend lint/format (Principle VIII, from repo root)
```

## Validation scenarios (map 1:1 to user stories)

### V1 — Browse the catalog (Story 1, P1)

1. Open `/`. Expect: one course card, "Ukulele", with description + entry action.
2. Select the card. Expect: navigation to `/courses/ukulele`.
3. Temporarily empty the `courses` collection and rebuild. Expect: friendly
   empty state, no blank page (FR-013). Restore afterwards.

### V2 — Explore the course (Story 2, P2)

1. Open `/courses/ukulele`. Expect: course title + one card labeled
   "Topic — Chords" with description.
2. Select the Chords card. Expect: navigation to
   `/courses/ukulele/topics/chords`.

### V3 — Filter chords (Story 3, P3)

1. Open the Chords view. Expect: full chord list (SC-005: 24 entries, enharmonics
   combined e.g. "Bb / A#"), each with name + diagram; grouped dropdown
   offers All chords / Major / Minor / notes (naturals, flats, sharps).
2. Select "Major" → only major chords. Select "Minor" → only minor.
3. Select "C" → only C chords; "Bb" → the combined "Bb / A#" entries; "A#" → the same entries.
4. Reset to all → full list restored (acceptance #4).
5. Select a chord entry → it expands in place with name, type, root, diagram;
   selecting again collapses it (FR-010, no audio).
6. Each dropdown change visibly updates within 2s (SC-002).

### V4 — Not-found + states (FR-014/016, SC-006)

1. Open `/courses/banjo` and `/courses/ukulele/topics/scales`. Expect: 404
   page with working link back to `/`.
2. Chords view: simulate filter with zero matches (if seed allows) → "no
   matching chords" + reset path. Corrupt one chord's diagram in a scratch
   copy → entry shows placeholder, list intact.

## Done when

- V1–V4 pass, `npm test` + `npm run check-content` + `npm run check` + `pytest` + lint/format green, `docker compose ps` shows api + db
  healthy, primary content appears within 2s (SC-007), and no secrets
  committed (`.env` untracked, `.env.example` only).
