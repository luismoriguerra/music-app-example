# Quickstart: Ukulele Lyrics + Chords Generator

**Feature**: `004-lyrics-chords-generator` | **Date**: 2026-09-16
Validates the feature end to end. Details live in [plan.md](./plan.md),
[data-model.md](./data-model.md), and [contracts/](./contracts/rest-api.md) —
this file is the run guide only.

## Prerequisites

- Node 22+, npm, Python 3.12+, Docker (verified: Node v22.19.0, Python
  3.12.11, Docker 29.4.0).
- Fresh checkout; nothing globally installed beyond the above.
- Optional keys (all degrade gracefully when absent, R10): `OPENROUTER_API_KEY`
  (model fallback on chart miss — REQUIRED before any release that promises
  SC-005; gated on research Appendix A), `YOUTUBE_API_KEY` (video links),
  `GENIUS_ACCESS_TOKEN` (rich candidates; LRCLIB-only mode otherwise).

## Setup

```bash
# Backend env + services (from repo root)
cp .env.example .env   # add any optional keys above; never commit .env
docker compose up -d --build   # api + db (Postgres 17, pgvector)

# Frontend (Astro app)
cd frontend && npm install && cd ..
# Backend deps for local test runs (no Docker needed for unit tests):
python3 -m venv backend/.venv && backend/.venv/bin/pip install -e 'backend[dev]'
```

## Run

```bash
# Terminal 1 — backend (or rely on compose `api`)
cd backend && ../backend/.venv/bin/uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend && npm run dev      # → http://localhost:4321
# Backend base URL for the island: PUBLIC_API_URL (default http://localhost:8000)
# CORS: API defaults CORS_ORIGINS to http://localhost:4321 (this dev origin); override only if serving the frontend elsewhere

# Smoke
curl http://localhost:8000/health
curl -X POST http://localhost:8000/api/v1/song-search \
  -H 'content-type: application/json' -d '{"query":"Riptide"}'
```

## Test

```bash
cd frontend && npx vitest run        # incl. Zod contract tests (Principle III)
cd frontend && npm run check-content # games-entry integrity (also runs as prebuild)
cd frontend && npm run check && npm run lint && npm run format:check
backend/.venv/bin/pytest backend/   # routes + domain (fixtures) + models (from repo root)
backend/.venv/bin/ruff check backend/ && backend/.venv/bin/ruff format --check backend/
# backend evals (Agno scenarios, Principle IV — fallback path; needs Appendix-A model + key):
backend/.venv/bin/pytest backend/evals/
```

## Validation scenarios (map 1:1 to user stories)

### V1 — Discover and open the generator (Story 1, P1)

1. Open `/courses/ukulele`. Expect: a card labeled Game — "Lyrics + Chords"
   with description + entry action, alongside Chords/Harmonic Circles.
2. Select it. Expect: `/courses/ukulele/games/lyrics-chords` showing the
   song-name input + search-and-generate action (≤3 selections from Home,
   SC-001).
3. Open `/courses/ukulele/games/does-not-exist`. Expect: 404 + link to `/`
   (FR-015, SC-007).

### V2 — Search and generate (Story 2, P2)

1. Enter "Riptide", submit. Expect: loading indicator, then a sheet with
   matched identity (title + performer), lyrics with aligned chords,
   `lyrics:`/`chords:` attribution with link-backs, and a sources list
   (lyrics/chords pages + video where keyed) — within 30 s (SC-002).
2. Enter an ambiguous name (e.g. "Hallelujah"). Expect: candidate list;
   picking one generates that song's sheet (FR-006).
3. Enter gibberish ("xqztptlk"). Expect: no-match state + retry path.
4. Submit empty input. Expect: inline guidance, no search (FR-003).
5. With backend stopped: submit. Expect: error state + retry, input
   preserved (FR-007). Restart backend afterwards.
6. SC-005 sample: generate the frozen 10-song list below; every sheet shows
   identity + per-part attribution and ≥80% of lyric lines carry chords.
   Frozen SC-005/SC-008 sample (2026-09-16): Riptide, Count on Me, Let It
   Be, Hallelujah, Stand By Me, Yesterday, Over the Rainbow, Wonderwall
   (probe n=8) + Imagine + Hey Jude. Validators generate exactly these 10.

### V3 — History re-open + regenerate (Story 3, P3)

1. After V2, open history. Expect: entries newest-first with query + matched
   song (FR-009).
2. Select an entry. Expect: full stored sheet within 2 selections (SC-004),
   served with zero provider calls (verify: backend log shows no upstream
   fetch on re-open — R7 rule).
3. Regenerate from sheet AND from entry. Expect: fresh sheet each time; a NEW
   entry appears per regenerate (append-only, data-model rule 7).
4. Restart browser/leave + return. Expect: history persists (SC-006).
5. Fresh DB (no searches): history shows the friendly empty state.
6. Deep links: open `/courses/ukulele/games/lyrics-chords?entry=<id from
   step 1>` in a fresh tab. Expect: the stored sheet renders directly with
   zero provider calls. Then open with
   `?entry=00000000-0000-0000-0000-000000000000`. Expect: the
   island-rendered not-found view with a working link back to `/` and to
   the generator (FR-015, SC-007).

### V4 — Live re-probe (manual, NOT CI — research probe section)

1. Re-run the R5/R2 fallback checks live: chart title-only fallback on an
   artist-misspelled query; LRCLIB long→short fallback on a long query.
   Expect: results in both cases (fallbacks REQUIRED).
2. If the Python chart client is persistently blocked (Cloudflare) where the
   Node probe succeeded: stop, evaluate the `tablatures-api` sidecar, and if
   unviable, trigger the R0 standing fallback via `/speckit-converge`
   (UG deep-link-only + model chords) — do NOT silently ship chordless.

## Done when

- V1–V4 pass; `npx vitest run` + `npm run check-content` + `npm run check` +
  `pytest` (unit + evals) + lint/format green; `docker compose ps` shows api
  + db healthy; V2 step 1 within 30 s (SC-002); SC-005 sample passes; no
  secrets committed (`.env` untracked, `.env.example` placeholders only);
  research Appendix A filled (model decision) before any fallback-path merge.
