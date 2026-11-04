# backend — AgentOS scaffold (Python 3.12)

FastAPI app with `GET /health`, the Lyrics + Chords sheets API (004), and the
AI second-voice API (006): `POST /api/v1/sheets/{id}/second-voice` (analyze +
persist), `GET /api/v1/sheets/{id}/second-voice` (newest-first history),
`GET /api/v1/second-voice/{id}` (re-open), `DELETE /api/v1/second-voice/{id}`
(contract: `specs/006-second-voice-recommender/contracts/rest-api.md`).
PostgreSQL config from environment; AgentOS mounts only when `AGENTOS_ENABLED=true`.

## One-liners

```bash
python3 -m venv .venv && .venv/bin/pip install -e '.[dev]'
infisical run --env=dev --path=/backend -- env DB_HOST=localhost DB_PORT=5432 DB_NAME=music_app DB_USER=music .venv/bin/uvicorn app.main:app --reload --port 8000   # dev (host run: DB on localhost)
infisical run --env=dev --path=/backend -- .venv/bin/pytest                                     # tests (DB tests need the dev DB password from Infisical)
TEST_DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/music_app_test .venv/bin/pytest  # explicit test DB
infisical run --env=dev --path=/backend -- .venv/bin/pytest evals/                              # Agno eval scenarios (Principle IV gate); live: calls OpenRouter
infisical run --env=dev --path=/backend -- .venv/bin/pytest evals/test_second_voice.py -v       # 006 theory-agent gates (6/6 green required; skips until SECOND_VOICE_MODEL_ID is in Infisical dev /backend)
.venv/bin/ruff check . && .venv/bin/ruff format --check .   # lint/format
infisical run --env=dev --path=/backend -- docker compose up -d --build                         # from repo root: api + db
curl http://localhost:8000/health
```

## Architecture (constitution Principle VIII — dependency direction ↓)

```
app/        composition: FastAPI routes + optional AgentOS wiring (main.py)
  ↓           routes_sheets.py: validation → pipeline/services → persist (no provider/raw-SQL code)
agents/     domain: clients + orchestration (agents/sheets/: candidates, charts,
  ↓           lyrics, sources, normalize, pipeline, fallback; agents/second_voice/:
            validate, analyze) — no web imports
db_models.py  feature tables (song_sheets, history_entries, second_voice_analyses) + row validation
  ↓
db.py       persistence: DatabaseConfig from DB_* env, PostgresDb factory — no SQLite
```

Domain never imports the web layer; configuration flows in via environment only
(`.env.example` at repo root). JWT/RBAC is deferred until any network-exposed
deployment (constitution VII); v1 stamps the synthetic single-owner `OWNER_ID`.

## Sheets env vars (004 — all degrade gracefully when absent)

```bash
DATABASE_URL / DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD  # Postgres (required for sheets routes)
OWNER_ID=owner                       # synthetic single-owner identity (FR-011)
CORS_ORIGINS=http://localhost:4321   # browser origin(s), comma-separated
OPENROUTER_API_KEY=                  # model chord fallback (chart miss → model; gated on research Appendix A)
YOUTUBE_API_KEY=                     # video source links (absent → degraded video entry, page links intact)
GENIUS_ACCESS_TOKEN=                 # rich candidates (absent → LRCLIB-only mode)
```

## Second-voice notes (006)

- Inference budget: single Agno attempt, 45 s timeout, `max_tokens` pinned at
  16000 (pre-concise probe measured 10.9k out on a 13-line song, 2026-09-17;
  concise caps + 1-sentence prompt now bound output to gist, T031 re-proves)
  inside the 60 s SC-002 wall — no in-route retries;
  failures fail closed as 502 `PROVIDER_ERROR` with nothing stored (FR-014).
- Concise contract: prose/row maxima in `SecondVoiceOut` (Pydantic/Zod/DB),
  e.g. tips ≤5×160 chars, note_table ≤60 rows, explanations ≤240 chars —
  over-verbose model JSON fails closed as 502 (user: analysis too long).
- Model: Appendix A (`specs/006-second-voice-recommender/research.md`) is the
  sole decider — DECIDED 2026-09-17 (T009): `google/gemini-2.5-flash-lite`
  via OpenRouter. No model ID is hardcoded:
  `agents/second_voice/analyze.py` resolves `SECOND_VOICE_MODEL_ID` from the
  environment, and analyze fails closed (502, nothing stored) until the
  operator exports the winner.
