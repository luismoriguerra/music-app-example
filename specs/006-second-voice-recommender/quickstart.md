# Quickstart: AI Second-Voice Recommender

**Feature**: `006-second-voice-recommender` | **Date**: 2026-09-17
Validates the feature end to end. Details live in [plan.md](./plan.md), [data-model.md](./data-model.md), and [contracts/](./contracts/rest-api.md) — this file is the run guide only.

## Prerequisites

- Node 22+, npm, Python 3.12+, Docker (004-verified: Node v22.19.0, Python 3.12.11, Docker 29.4.0).
- Fresh checkout; nothing globally installed beyond the above.
- `OPENROUTER_API_KEY` + `SECOND_VOICE_MODEL_ID` in `.env` (REQUIRED for live inference + evals; without either the panel shows unavailable + retry and evals skip — 004 degrade precedent). Set `SECOND_VOICE_MODEL_ID` to the Appendix A winner at T009.
- Appendix A MUST be filled (gated `openrouter-model-eval`) before any live-analysis validation — no model-ID code merges before the record exists (Principle V).

## Setup

```bash
# Backend env + services (from repo root)
cp .env.example .env   # add OPENROUTER_API_KEY; never commit .env
docker compose up -d --build   # api + db (Postgres 17, pgvector)

# Frontend (Astro app)
cd frontend && npm install && cd ..

# Gates (run per app from its dir; all MUST be green)
cd backend && python -m pytest -q && ruff check . && ruff format --check . && cd ..
cd frontend && npm test -- --run && npm run lint && npm run format:check && cd ..
```

## Validation

### V1 — Analyze at a transpose (US1, SC-001/SC-002)

1. Open any chord-bearing sheet (generate one via 004 if history is empty).
2. Set the stepper to a non-zero offset (e.g. `Tr. +5`).
3. Select the "AI 2nd voice" tab, then the "AI 2nd voice" run button → loading indicator → structured English analysis within 60 s; the rendered view shows Recommended second voice, Note-by-note table, and Singing tips (amended 2026-11-02, 013; every field is still stored).
4. Verify: every chord symbol in the Note-by-note table and the Possible Tones table matches the TRANSPOSED symbols on screen (not the stored originals); Anglo note names with explicit sharps/flats; transpose badge shows `@Tr. +5` (amended 2026-11-02, 013: the Progression section is no longer rendered).

### V2 — History persists + re-opens free (US2, SC-004/SC-006)

1. In the analysis tab with V1's analysis open, change the stepper above the tabs (e.g. `+5` → `+3`) and re-run → NEW history entry.
2. Open "Past analyses" → 2 entries newest-first, each with `@Tr.` badge + timestamp + model id.
3. Select the older entry → full analysis opens instantly (assert zero provider calls: backend logs show no OpenRouter request, or run with the key temporarily unset — re-open still works).
4. Leave the sheet, return (reload) → both entries still listed and re-openable with identical rendering.

### V3 — Stale + re-run (US1 scenario 5, FR-008)

1. With an analysis computed at `+3` open, move the stepper to `+4` → stale badge "Computed at Tr. +3 — showing Tr. +4" + "Re-run at Tr. +4".
2. The stale analysis remains fully readable. Select re-run → NEW third entry at `+4`; history shows 3.

### V4 — No-melody gate (US3, SC-005 critical)

1. Run analysis on any lyrics + chords sheet (v1 sheets never carry melody notes).
2. Verify: "Recommended second voice" states the melody is missing + gives intervallic strategy (thirds/sixths/common-tones/contrary motion, singability rules); "Note-by-note table" carries anchors + chords + explanations with pitch cells "—" (zero invented pitches); `melody_status: missing` in the stored JSON.

### V5 — Degraded + error paths (FR-011/FR-014, Edge Cases)

1. Lyrics-only sheet → no tabs, sheet renders directly (same chords-missing rule as the stepper).
2. Backend stopped (or key unset) → error/unavailable state + retry; sheet + stepper preserved; nothing stored (history count unchanged).
3. Tampered payload (drop a line from `chords_by_line` via devtools/curl) → `VALIDATION_ERROR` 422, nothing stored.
4. Delete one history entry → confirm dialog (names song + offset) → only that row removed; sheet + siblings work.

### V6 — API contract checks (no browser)

```bash
API=http://localhost:8000
SHEET=<sheet_id from 004 history>
# Analyze (snapshot counts MUST match the stored sheet or 422)
curl -s $API/api/v1/sheets/$SHEET/second-voice -H 'Content-Type: application/json' \
  -d '{"transpose":5,"chords_by_line":[{"section":0,"line":0,"chords":[{"offset":0,"symbol":"C"}]}]}' | head -c 400
# List (summaries, newest-first, zero providers)
curl -s "$API/api/v1/sheets/$SHEET/second-voice?limit=20" | head -c 400
# Get-one (full JSON) / Delete (204; second delete → NOT_FOUND)
curl -s $API/api/v1/second-voice/<analysis_id> | head -c 400
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE $API/api/v1/second-voice/<analysis_id>
```

### Evals (Principle IV — REQUIRED before merge)

```bash
cd backend && python -m pytest evals/test_second_voice.py -v   # live; skips without OPENROUTER_API_KEY + SECOND_VOICE_MODEL_ID
```

6/6 green required (`transpose_respected`, `degrees_consistent`, `non_diatonic_flagged`, `no_invented_melody` [critical], `english_format_complete`, `latency_within_budget`). Re-run on ANY prompt/tool/model change. Record the run (model id, per-gate result, latency) in the PR/converge notes.

### SC-005 sample (frozen, 5 analyses over ≥3 songs at varied offsets)

Run 5 analyses across ≥3 songs at varied transpose offsets (include one fully-diatonic song and one with a secondary dominant + modal borrowing). Assert: 100% transpose_respected, 100% degrees_consistent, 100% non_diatonic_flagged, 100% no_invented_melody (any invented pitch fails the sample), 100% english_format_complete. The sample is point-in-time (model behavior), not CI — CI stays hermetic with recorded fixtures.
