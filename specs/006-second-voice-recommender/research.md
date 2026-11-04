# Research: AI Second-Voice Recommender

**Feature**: `006-second-voice-recommender` | **Date**: 2026-09-17
**Spec**: [spec.md](./spec.md) | **Decisions**: [DR-001](decisions/DR-001-analysis-payload.md), [DR-002](decisions/DR-002-persist-analysis-history.md), [DR-003](decisions/DR-003-structured-json-output.md)

Phase 0 output. Every Technical Context unknown is resolved below as Decision / Rationale / Alternatives considered. No NEEDS CLARIFICATION remains. No model ID is chosen here — R3 records why and defines the mandatory pre-wiring gate (Principle V); Appendix A is DECIDED (T009 live run 2026-09-17 — winner `google/gemini-2.5-flash-lite`).

Context: private single-user hobby app, personal practice only. No login; all analyses belong to the synthetic single-owner identity (FR-005). The panel lives inside the 004 open sheet view (no new route); sheets are immutable parents; the stepper stays display-only. All inference goes through `backend/`; the browser never holds provider keys (Principles VI, VII). Analysis body is English beginner pedagogy with Anglo note names (FR-012); all-English.

---

## R0. Transpose-visibility rule (decided: DR-001, Option B)

- **Decision**: The analysis input is the rendered transposed chords. The frontend POSTs `chords_by_line` derived from `displaySheet` at the stepper's current offset, plus `sheet_id` + `transpose` for provenance. The backend validates shape/count/vocabulary against the stored sheet and zips onto stored lyrics. No lyric text crosses the request wire; no Python transpose code exists.
- **Rationale**: The stepper needs instant local transpose, so `frontend/src/lib/chord-diagrams.ts:692-711` (`transposeSheet`) is the pitch-math owner regardless. Backend transposition would duplicate `transposeSheet` + `chooseSheetSpelling` (`chord-diagrams.ts:655-683`) + `transposeChordSymbol` (`chord-diagrams.ts:601-638`) including the tonic maps (`chord-diagrams.ts:641-644`) and hinge correctness on byte-for-byte parity — cross-boundary duplication Principle VIII forbids. Parity by construction (analyze the rendered symbols) dominates verification-by-port.
- **Alternatives considered**:
  - Backend transposes from `{sheet_id, transpose}` (rejected — DR-001: duplication + parity hinge).
  - Full transposed `body` echo incl. lyrics (rejected — DR-001: re-opens the lyric-drift channel `ChordsOut` closed, `backend/agents/sheets/fallback.py:6-8`).
  - Trust pitch AND shape (no validation) (rejected: miscounted lines would zip chords onto wrong lyric lines silently; shape checks are cheap).

## R1. `SecondVoiceOut` schema design (final)

- **Decision**: English keys, English string values. Top-level fields map 1:1 to the 9 final-format headings so FR-009 rendering is a heading map, not prose parsing:
  `key {tonic, mode, justification}` · `scale [note]` · `diatonic_chords [{degree, chord}]` (I, ii, iii, IV, V, vi, vii°) · `progression [{section, chords [symbol], degrees [roman]}]` · `special_chords [{chord, function}]` (empty array legal) · `cadences [{name, chords, location}]` · `section_feel [{section, feeling}]` · `second_voice {melody_status: missing|present, strategy, up?, down?, recommendation?}` ·   `note_table [{section, lyric_snippet, chord, first_voice?, second_voice?, interval?, explanation?}]` · `singing_tips [string]`.
  Row rules (enforced at insert + asserted in evals): `melody_status == missing` ⟹ `note_table` rows MUST carry no pitches at all — `second_voice`, `first_voice`, and `interval` MUST each be null — AND `up`/`down`/`recommendation` MUST each be null (strategy-only; FR-010; F3 fix — a first-voice pitch with no melody is as invented as a second-voice one; T031 fix — the model filled `recommendation` with a "please provide melody" note on full_length, so the missing-explanation lives in `strategy` only); every `chord` symbol MUST be FR-013-valid; `degrees` length MUST equal `chords` length per progression row; `lyric_snippet` ≤ 120 chars (anchor, not reproduction).
- **Rationale**: English keys keep code/tests consistent with the 004 wire (which is English); English values carry the pedagogy. Field-level claims make SC-005/SC-007 mechanical assertions instead of reading comprehension. The insert-time `missing ⟹ no pitches` rule turns the critical gate into a database invariant, not just a prompt hope.
- **Alternatives considered**:
  - Spanish keys (rejected: splits the codebase's naming convention for zero learner benefit — learners never see keys).
  - Markdown blob / hybrid skeleton+prose (rejected — DR-003: unparseable claims).
  - One opaque `sections [{heading, body}]` array (rejected: headings drift, degrees/intervals unassertable; the 9 headings are fixed curriculum, so typed fields cost nothing extra).

## R2. Prompt encoding: 19 steps → instructions + schema (final)

- **Decision**: The owner's 19-step prompt is encoded as Agno `INSTRUCTIONS` (ordered process, steps 1–19, ending with the no-melody gate and output-schema obedience) plus the `SecondVoiceOut` schema as the output contract. Model input per run: numbered transposed-chords-by-line + section headings + stored lyric lines (lyrics included because section feel + table anchors need them; output carries snippets only). System prompt pins: English beginner pedagogy, ukulele framing, Anglo note names with explicit sharps/flats, Roman-numeral conventions (uppercase major, lowercase minor, ° diminished), and "never invent melody/second-voice pitches when melody_status is missing".
- **Rationale**: Instructions teach the process; the schema teaches the shape. Numbered-line input mirrors `fallback.number_lyrics` (`backend/agents/sheets/fallback.py:90-93`) so line references stay stable. Keeping full lyrics in the model input but snippets-only in the stored output balances analysis quality (section feel needs words) with the no-redistribution posture (R8).
- **Alternatives considered**:
  - Chords-only input, no lyrics (rejected: section feel + lyric-anchored table rows need the words; the request wire stays lyric-free per DR-001, but the backend already holds the lyrics and may feed them to its own agent call).
  - Verbatim 19-step prompt pasted per call with no schema (rejected: DR-003 — prose output).
  - Multi-call pipeline (key → degrees → voice) (rejected for v1: 3× latency/cost/complexity; single-call JSON first, split only if the gated eval shows schema-validity collapse at ~2–4k tokens — DR-003 revisit trigger).

## R3. Model selection posture + mandatory gate (final: gated, Luna NOT reused)

- **Decision**: **No model is chosen in this plan.** The 004 winner (`openai/gpt-5.6-luna` via `openrouter-model-eval`, 004 Appendix A) was selected for structured chord alignment (short JSON, ≤20 s, vocab richness explicitly deprioritized). This task differs on every discriminating axis: multi-step theory reasoning (key inference, degree mapping, function labeling), long structured output (~2–4k tokens vs ~1.2k chords-only), English pedagogy quality, and a 45 s budget. Reusing Luna without evidence would violate Principle V. The tasks phase MUST run `openrouter-model-eval` with the requirements below BEFORE wiring the agent, and record requirements / candidates / test results / winner + rationale / exact model ID + provider route in Appendix A. Hardcoded model IDs without that record remain forbidden. The R6 eval suite MUST be green on the winner before merge.
- **Model requirements for the gated eval** (inputs to the skill run): task = ordered theory reasoning + long structured JSON (`SecondVoiceOut`, ~2–4k tokens) + English beginner pedagogy; quality bars = SC-005/SC-007 (transpose respected, degrees consistent, non-diatonics flagged with function, zero invented pitches on no-melody fixtures, all 9 sections present); latency budget = ≤45 s per analysis; cost ceiling = hobby-trivial per analysis (measure, don't guess); context = one song (lyrics + chords, small); route = OpenRouter-hosted via `backend/` only; reasoning effort configurable (004 learned mandatory-reasoning endpoints add latency variance + billed reasoning tokens).
- **Rationale**: Principle V is non-negotiable and the task shift is material (alignment → reasoning + 3× output). The gate also re-validates the single-call assumption: if no candidate holds schema validity at full length within 45 s, R2's multi-call fallback activates via the DR-003 revisit trigger instead of shipping a flaky agent.
- **Alternatives considered**:
  - Reuse Luna unconditionally (rejected: Principle V violation; different task, different output scale).
  - Choose from training-data knowledge now (rejected: Principle V forbids; landscape expires weekly).
  - Client-side inference (rejected: Principle VI — hosted inference goes through `backend/`; browser holds zero keys; reasoning models exceed on-device budgets anyway).

## R4. Persistence mechanics (decided: DR-002, Option B)

- **Decision**: New `second_voice_analyses` table (data-model.md): `id` uuid pk, `owner_id` text, `sheet_id` uuid FK → `song_sheets.id` ON DELETE CASCADE, `transpose` smallint −11…+11, `model_id` text, `analysis` jsonb (`SecondVoiceOut`), `created_at` timestamptz; index on `(sheet_id, created_at DESC)` for the newest-first per-song list. Mapper-event validation clones `backend/db_models.py:343-352`; list/get/delete routes mirror `backend/app/routes_sheets.py:296-368`. Unbounded append-only; re-run inserts; confirmed delete removes one row; sheet delete cascades.
- **Rationale**: Clones two shipped patterns (table + validation events; list/get/delete routes) with one table and four endpoints. CASCADE (not 004's entry-first RESTRICT dance) is correct here because analyses are strictly owned children with no independent lifecycle — deleting a song deletes its songbook notes about it.
- **Alternatives considered**:
  - Ephemeral (rejected — DR-002: contradicts the explicit user directive, burns inference per re-open).
  - Dedup on `(sheet_id, transpose)` (rejected — DR-002: destroys run comparability, breaks append-only).
  - Separate `analysis_history_entries` join table (rejected: 004's entries table exists because history has its own identity (query text) apart from sheets; an analysis has no identity beyond its row — entry IS the row, YAGNI).

## R5. UI composition: panel inside the open sheet (final)

- **Decision**: `SecondVoicePanel` (container: trigger + fetch + stale + history state) rendered beside `TransposeControl` in `SheetView`, receiving `displaySheet` + `transpose` + `apiBaseUrl` as props; `SecondVoiceView` (presentational: 9 sections + table + missing-melody notice); `AnalysisHistoryList` (presentational: newest-first badges + open + `ConfirmDialog` delete reuse). Stale rule: `openAnalysis.transpose !== transpose` → stale badge naming the computed offset + one-action re-run (FR-008). Button hidden when `chord_source === "none"`; disabled while in flight. History toggle shows empty state when zero rows. All fetch is runtime island-tree fetch (the 004 `client:load` tree), never SSR.
- **Rationale**: Keeps 004 layering (island tree owns fetch; presentational components render props) while avoiding `SheetGenerator` bloat — the panel is a self-contained container child, and the whole tree is already client-side so no new island boundary is needed. Stale-as-derived-state (not stored) can't desync: it recomputes from props on every render.
- **Alternatives considered**:
  - Lift all analysis state to `SheetGenerator` (rejected: bloats the generator with a second fetch domain; panel props would sprawl across handlers + data + history).
  - Separate game route/card for analysis (rejected: spec assumption — analysis is a sheet augmentation, not a destination; a route would strand the transpose context that defines the input).
  - Modal dialog for results (rejected: analyses are studied alongside the sheet — inline panel below the stepper keeps chords and theory co-visible).

## R6. Eval suite design (final: 6 scenarios, 1 critical)

- **Decision**: `backend/evals/test_second_voice.py`, live, skip-without-key (004 `test_sheets_fallback.py` precedent), fixtures with KNOWN answers (public-domain progressions + synthetic transpositions, not copyrighted sheets): `transpose_respected` (every analyzed symbol equals the transposed input — mechanical string compare, not model judgment); `degrees_consistent` (recompute degrees from chords + declared key with an independent degree mapper; mismatch fails); `non_diatonic_flagged` (fixtures include a secondary dominant + a modal-borrowing chord; both must appear in `special_chords` with a function label); `no_invented_melody` (**critical**: no-melody fixtures MUST yield `melody_status: missing` AND zero `second_voice` pitches in `note_table` — any invented pitch fails the suite); `english_format_complete` (all 9 sections present, Anglo note-name regex, no empty required arrays except `special_chords`); `latency_within_budget` (≤45 s per run). Gates green before merge; re-run on any prompt/tool/model change (Principle IV).
- **Rationale**: Three gates are mechanical (string compare, degree recompute, emptiness check) — they pin the failure modes schemas alone can't catch (wrong-key theory, invented notes). Known-answer fixtures avoid judging theory taste; the suite asserts consistency and honesty, not elegance. The 004 precedent (5/5 green in 21 s) shows live gated evals are affordable at this scale.
- **Alternatives considered**:
  - LLM-as-judge scoring (rejected for v1: nondeterministic, expensive, and unnecessary — consistency/honesty are computable; revisit only for pedagogy-quality regression).
  - Unit-test-only (mocked agent) (rejected: Principle IV — behavior gates must target the real agent; mocks can't catch schema-valid-but-dishonest runs).
  - Reusing the 004 chord fixtures verbatim (rejected: alignment fixtures lack the theory features under test — transpositions, non-diatonics, cadences; new fixtures required).

## R7. Budget: 45 s inference inside 60 s wall (final)

- **Decision**: SC-002 60 s wall-clock (local validation) with a 45 s backend inference budget as the enforceable proxy. Single Agno call per analysis; no retries inside the budget (one attempt; failure → PROVIDER_ERROR + retry action, never a hung panel). Cost is measured during the gated eval (tokens in/out per analysis at the winner's price), not projected from training data; the Appendix A record MUST include $/analysis on the longest fixture, labeled by fixture size (T009: longest synthetic, 6 lines; T031: full-length, 36 lines).
- **Rationale**: Theory reasoning + ~2–4k output tokens strictly exceeds the 004 alignment profile (≤20 s, ~1.2k tokens), so the 004 25 s pipeline budget cannot be reused — but the 004 lesson (measure through the real Agent path, not the MCP client; pin `max_tokens` explicitly above Agno's 1024 default) transfers directly. Single-attempt keeps the panel predictable; the retry action (human-paced) is the retry policy.
- **Alternatives considered**:
  - Reuse the 25 s pipeline budget (rejected: under-budgets a 3× output task; would fail-closed on real songs).
  - Auto-retry with backoff inside the route (rejected: burns quota on likely-deterministic failures (schema invalid, key absent) and stretches the wall past SC-002; human retry is the policy).
  - Streaming/SSE partial render (rejected: out of scope — single JSON fits 60 s; revisit only if wall measurements cluster near the ceiling).

## R8. Licensing/posture: derived-from-persisted, minimal quotes (final)

- **Decision**: Analyses derive from already-persisted sheets (no new providers, no new fetch terms). The stored `analysis` JSON carries `lyric_snippet` anchors (≤120 chars per table row) for singability reference, never full lyric lines or full lyric reproduction. Single-owner private noncommercial posture with the 004 R8 triggers inherited: second user, enforcement signal, or provider-term change → `/speckit-converge` review. No redistribution/publishing/sharing surface ships.
- **Rationale**: The analysis feature adds no new ingestion — its only inputs are the learner's own transposed chords (derived) and the already-stored sheet (accepted 004 posture). Snippet-only storage keeps the new table from becoming a second lyrics copy; 120 chars anchors a sung phrase without reproducing a verse.
- **Alternatives considered**:
  - Full lyric lines in `note_table` (rejected: duplicates the lyrics store per analysis row; unbounded copies of copyrighted text).
  - No lyric references at all (rejected: note-by-note guidance without anchors is unusable — "bar 3" means nothing to a beginner with a chord sheet).
  - Per-analysis source attribution block (rejected: the parent sheet already carries FR-012 attribution; analyses inherit it by FK — duplicating URLs per row adds noise, not provenance).

## R9. Backend architecture (Principles VII + VIII) (final)

- **Decision**: `app/routes_second_voice.py` (REST: analyze/list/get/delete + 004 error taxonomy reuse) over `agents/second_voice/` (pure domain: `analyze.py` = `SecondVoiceOut` + `INSTRUCTIONS` + `build_agent` factory + run/zip; `validate.py` = snapshot-vs-stored validation) over `db_models.py` (`second_voice_analyses` + validators + CASCADE). The analysis Agent is pipeline-internal (factory-built per request, never in `AgentOS(agents=[...])`, which stays empty — 004 R10 precedent). Synthetic owner stamped server-side; no auth headers in v1 (FR-005; JWT/RBAC deferred with the 004 justification). CORS unchanged (004 `CORS_ORIGINS`).
- **Rationale**: Second verse of the 004 layering song — same shapes, second domain. Factory-per-request preserves missing-key → unavailable-at-request-time degradation; keeping the agent out of AgentOS avoids servable-agent surface for what is a request-scoped inference call.
- **Alternatives considered**:
  - AgentOS-servable agent + MCP tools (rejected: 004 R10 precedent — CRUD-shaped inference-over-stored-rows is simpler as REST; no MCP Apps view needed, Astro renders natively).
  - Analysis logic inside `agents/sheets/` (rejected: sheets = ingestion/generation pipeline; second-voice = theory reasoning over stored sheets — separate domain, separate evals, separate budget; one package per domain).
  - Bare OpenAI SDK calls (rejected: 004 R6 precedent — Agno Agent with `output_schema` so evals target a real agent and schema discipline is structural).

## R10. Frontend architecture (Principle VIII) (final)

- **Decision**: Panel-inside-sheet, zero framework changes. New pure `lib/second-voice.ts` (snapshot builder `displaySheet → chords_by_line`, stale predicate, heading map; zero Astro imports); Zod mirrors beside the 004 schemas; container `SecondVoicePanel` + presentational `SecondVoiceView` + `AnalysisHistoryList` under `components/`; `SheetView` edit (render site + `apiBaseUrl` threading); `ConfirmDialog` reused for delete. ViewStates idiom reused for FR-011. Chord symbols in the analysis render as text (no diagrams — theory context, not playing context).
- **Rationale**: Follows the 004-established pattern (island tree → components → pure lib → content) and the 004 amendment cadence (small EDITs + focused NEW files). Snapshot building in pure lib keeps it unit-testable without React; the container/presentational split keeps fetch state out of the theory renderer.
- **Alternatives considered**:
  - SSR/prerendered analyses (rejected: analyses are per-offset dynamic inference; prerendering buys nothing and breaks static output).
  - Chord diagrams inside the analysis (rejected: the sheet beside the panel already shows every diagram; theory sections need symbols + degrees, not fingerings — visual noise).
  - New `ui://` MCP Apps surface (rejected: first-party Astro UI, not backend tool views — 004 R11 precedent).

## R11. Testing + eval strategy (Principles III + IV) (final)

- **Decision**:
  - Frontend (Vitest, `frontend/tests/`): Zod schema tests (valid + invalid fixtures per new REST shape), `lib/second-voice.ts` pure-function tests (snapshot builder incl. slash-bass/offset preservation, stale predicate, heading map), component tests (button hidden for lyrics-only; loading/error/empty/stale states; history open + delete-confirm; 9-section render incl. missing-melody notice).
  - Backend (pytest, `backend/tests/`): route tests with `TestClient` (analyze happy path with stubbed agent, list order, get-serves-stored, delete-removes-one, error taxonomy mapping incl. tampered-snapshot VALIDATION_ERROR), validation tests (counts/offsets/vocab/TR-range vs recorded sheet fixtures), model tests (insert rules, CASCADE on sheet delete, owner invariant) against transient Postgres — no SQLite anywhere.
  - Evals (Agno scenarios, `backend/evals/test_second_voice.py`, Principle IV — REQUIRED, R6): the 6 gates above, live, skip without key. MUST be green before merge; re-run on any prompt/tool/model change.
- **Rationale**: Mirrors the 004 test split (idiomatic runner per runtime) with the same hermetic-CI rule (recorded fixtures; live inference only in evals + manual quickstart). The stubbed-agent route tests keep CI deterministic while evals cover the real behavior — the 004 T036/T037 division of labor.
- **Alternatives considered**:
  - Playwright E2E (deferred, same as 004 R12: unit + contract + scenario + quickstart covers the surface without flake/CI cost).
  - Live-inference CI tests (rejected: flaky, quota-burning; recorded fixtures + manual quickstart probe instead, 004 precedent).

---

## Appendix A — Model decision record (Principle V)

STATUS: **DECIDED 2026-09-17 (T009 live run).** Winner: `google/gemini-2.5-flash-lite` via OpenRouter. NOTE (R11 prompt change): all T009 figures below were measured on the Spanish prompt; the tree switched to an all-English prompt after T009, so T031 re-runs supersede these numbers. Method note: no MCP client existed in this session, so primary evidence came from direct OpenRouter REST `chat/completions` (the same endpoint Agno's `OpenRouter` model hits) with `strict: true` + the raw `SecondVoiceOut.model_json_schema()`; supplementary production-path runs went through the already-merged env-gated `build_agent()` purely as a harness. F1 intent intact: no model ID was merged to reach this verdict — `analyze.py` still resolves `SECOND_VOICE_MODEL_ID` at runtime and fails closed when unset; the winner lands via env, no code change. T031 still owns full agent-path budget evidence (2+ runs, output tokens) and the 6-gate suite.

### Requirements (from R3)

Ordered theory reasoning (key inference → scale → diatonics → degrees → functions → cadences → section feel → gated second voice) with long structured JSON output (`SecondVoiceOut`, ~2–4k tokens), English beginner pedagogy, Anglo note names with explicit sharps/flats, latency ≤45 s per analysis, hobby-trivial $/analysis, one song of context, `structured_outputs` support (Agno `output_schema`), OpenRouter-hosted via `backend/` only, configurable reasoning effort.

### Live catalog filter

(Live catalog 2026-09-17 via `GET /api/v1/models`. Filter: OpenRouter-hosted, structured-output capable, context ≥16k, hobby-trivial pricing. Shortlist: `openai/gpt-5.6-luna` — 004 incumbent, OpenAI-routed, $0.20/M in / $1.20/M out, 1.05M ctx; `google/gemini-2.5-flash-lite` — price/latency leader, $0.10/M in / $0.40/M out, 1M ctx; `deepseek/deepseek-v4-flash` — cheapest reasoning, $0.07/M in / $0.14/M out, 1M ctx. Reasoning effort is provider-managed on all three — no `reasoning_effort` knob needed, unlike 004's disable.)

### Test prompts + results

(Live run 2026-09-17. Prompt: shipped R2 `INSTRUCTIONS` + `format_analysis_input()` rendering; schema: raw `SecondVoiceOut.model_json_schema()`. Fixtures from `backend/evals/test_second_voice.py`: `diatonic` (C/Am/F/G, key C), `transposed` (same song analyzed at Tr. +5 → F/Dm/Bb/C, key F), `non_diatonic` (C/E7/Am/Fm/G/C: secondary dominant + borrowed iv). All three fixtures are no-melody — the `no_invented_melody` critical gate asserts `melody_status == "missing"` + all-null pitches on every fixture. All three T009 fixtures are 4-6 lines; the "longest fixture" behind the $/analysis column is the 6-line `non_diatonic` — full-length (36-line) cost/latency is deferred to T031's `full_length` fixture, so do not overread these figures as per-analysis cost on real songs.

REST primary (strict + raw schema):

| model | diatonic | transposed | non_diatonic | schema-valid | R6 gates | $/analysis (longest T009: 6 lines) |
|---|---|---|---|---|---|---|
| `google/gemini-2.5-flash-lite` | 3.8 s ✓ | 3.7 s ✓ | 6.4 s ✓ | 3/3 | all pass (transpose ✓, degrees ✓, E7/Fm flagged ✓, no-melody ✓, english ✓) | $0.00073 (965 in / 1591 out) |
| `deepseek/deepseek-v4-flash` | 23.1 s ✓ | 23.0 s ✓ | 31.9 s ✓ | 3/3 | all pass | $0.00044 (2271 in / 3339 out, incl. 2040 reasoning) |
| `openai/gpt-5.6-luna` | 400 | 400 | 400 | 0/3 | n/a (transport) | — |

Luna 400 root cause (response body captured 2026-09-17; providers attempted: OpenAI, Azure): `Invalid schema for response_format 'SecondVoiceOut': In context=(), 'additionalProperties' is required to be supplied and to be false.` The REST harness sent the raw Pydantic schema (no `additionalProperties`; optionals `up`/`down`/`recommendation`/`first_voice`/`second_voice`/`interval` absent from `required`) under `strict: true` — OpenAI-strict rejects that shape. **Harness artifact, not a model failure:** the production path (`OpenRouter → OpenAILike → OpenAIChat`, Agno 2.4.7) sends `strict: true` with `sanitize_response_schema()` applied (`agno/utils/models/openai_responses.py`: sets `additionalProperties: false`, drops `default: null`, adds every property to `required`). Proven by the supplementary runs — same model, same fixtures, sanitized schema: 3/3.

Supplementary production-path (via `build_agent()`, strict + sanitized schema):

| model | fixture | latency | result |
|---|---|---|---|
| `google/gemini-2.5-flash-lite` | non_diatonic | 7.9 s | valid; key C; E7/Fm flagged; note_table 6 rows all-null |
| `openai/gpt-5.6-luna` | diatonic | 8.2 s | valid; key C; null note_table |
| `openai/gpt-5.6-luna` | transposed | 10.4 s | valid; key F (transpose respected); degrees [I vi IV V] |
| `openai/gpt-5.6-luna` | non_diatonic | 13.5 s | valid; key C; E7/Fm flagged; degrees incl. `V7/vi` + `iv prestado` |

Notes: (1) Luna's `iv prestado` (prose inside a degree slot) is cosmetic — `degrees_consistent` covered diatonic/transposed at T009, both clean (full_length added post-T009; re-verified at T031). (2) Luna $/analysis is an **estimate** ≈$0.002 on the longest fixture (catalog pricing × ~950 in / ~1500 out tokens): unmeasurable on REST (no successful call), and its Agno smoke runs predate metrics capture (`run_analysis_with_metrics` reads `RunOutput.metrics` — added post-T009; `/activity` 403 on this key so no backfill). (3) Raw per-call rows: `/tmp/t009_report.json` (REST) + this section (Agno path). Full gate assertions on the winner run at T031 through `build_agent()`.)

### Decision

Winner: **`google/gemini-2.5-flash-lite`**, route `OpenRouter(id="google/gemini-2.5-flash-lite")`. Rationale: green on every R6 gate across all 3 fixtures (3/3 REST + longest-fixture Agno smoke); fastest on every fixture (3.7–6.4 s REST, 7.9 s agent-path — best headroom under the 45 s budget for an interactive button); $0.00073/analysis measured on the longest T009 fixture (6-line non_diatonic; full-length figure lands at T031) — 2nd-cheapest at negligible absolute cost. Runner-up `openai/gpt-5.6-luna`: viable on the production path (3/3, 8.2–13.5 s) but ~3x the cost (est.), slower, one cosmetic quality signal. `deepseek/deepseek-v4-flash`: cheapest ($0.00044) and gate-green but 4–5x the latency (23–32 s, 1248–2040 reasoning tokens) — not worth $0.0003 for a click-and-wait panel. Revisit trigger: T031 eval failure on the winner, quality regressions on real songs, or material price/latency shifts — rerun this appendix, never swap IDs by hand.

### Configure

```python
# SECOND_VOICE_MODEL_ID=google/gemini-2.5-flash-lite (env, no code change)
Agent(
    model=OpenRouter(id="google/gemini-2.5-flash-lite", api_key=..., timeout=45.0, max_tokens=16000),
    instructions=INSTRUCTIONS,  # R2 19-step prompt
    output_schema=model_facing_schema(),  # strict:true + Agno sanitize MINUS maxLength/maxItems (Gemini constrained-decoding cannot serve maxima — "too many states"; concise caps enforced on receipt via SecondVoiceOut.model_validate, fail closed FR-014)
    markdown=False, retries=0,
)
```
Stored per-row as `model_id` for provenance. `max_tokens=16000` pinned above Agno's 1024 default (004 lesson; T009 sized 8k off the 6-line fixture — 8k proven too small 2026-09-17 when a live 13-line probe measured 10,873 output tokens and truncated, so the cap moved to 16k; T031 re-proves on `full_length`). No `reasoning_effort` knob: not needed for this winner.

### Budget evidence on the shipped path (Agent, not the MCP client)

(Measured at T031, 2026-09-17, real agent via `build_agent()`, model `google/gemini-2.5-flash-lite`, concise prompt + caps. Evals 6/6 green in 19.9 s. Per-fixture `[budget]` (`RunOutput.metrics`): diatonic 4.1 s, 1041 in / 918 out; transposed 3.8 s, 1042 in / 978 out; non_diatonic 5.7 s, 1074 in / 1333 out; full_length (36 lines / 9 sections) 6.1 s, 1676 in / 1430 out. Second full_length run (standalone probe, same prompt): 7.7 s, 1648 in / 1629 out. All schema-valid on receipt (concise caps enforced by `SecondVoiceOut.model_validate` — violations fail closed, none occurred). $/analysis on the longest fixture ≈ $0.00074 ((1676×$0.10 + 1430×$0.40)/1M). Contrast: the pre-concise 13-line Yesterday probe measured 10,873 output tokens; the post-concise live-API Yesterday run (Tr. 0, 200 in 8.0 s) returned progression=5, feel=3, special=6, cadences=2, note_table=11, tips=5 with every field at 1–2 sentences. Single-call JSON stands: full-length validity holds within 45 s; the R2 multi-call fallback is not triggered.)
