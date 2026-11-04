# Data Model: AI Second-Voice Recommender

**Feature**: `006-second-voice-recommender` | **Date**: 2026-09-17
**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md) (R1/R4)

Phase 1 output. One new Postgres table for persisted analyses; the 004 tables are referenced, never altered (sheets stay immutable parents). Field contracts: [contracts/rest-api.md](./contracts/rest-api.md) (wire shapes, mirrored by Zod in `frontend/src/lib/sheets/schemas.ts` and Pydantic in `backend/app/routes_second_voice.py`), [contracts/analysis-panel.md](./contracts/analysis-panel.md) (view states, stale rule).

## Postgres tables (SQLAlchemy, same database as AgentOS state + 004 tables)

### `second_voice_analyses` — one immutable analysis per completed run

| Field | Type | Required | Validation |
|---|---|---|---|
| `id` | uuid (pk) | yes | server-generated v4 |
| `owner_id` | text | yes | MUST equal `OWNER_ID` (`"owner"` default, env override permitted, 004 R10); keeps the multi-user door open |
| `sheet_id` | uuid (fk → `song_sheets.id`) | yes | MUST resolve to a sheet; FK `ON DELETE CASCADE` (FR-013: song delete takes its analyses) |
| `transpose` | smallint | yes | −11…+11 (the stepper offset analyzed; `TRANSPOSE_MIN/MAX` precedent); provenance, not recomputation input (DR-001) |
| `model_id` | text | yes | exact model ID + provider route (R3/Appendix A provenance; REQUIRED, never null — every row is a model run) |
| `analysis` | jsonb | yes | `SecondVoiceOut` (see below); 9 sections + note table + tips; validated at insert (rules 1–4) |
| `created_at` | timestamptz | yes | server clock, default now(); list order key (DESC, FR-006) |

Relationships: many-to-one to `song_sheets` (one song, many analyses across offsets/runs). Immutable after insert — re-run creates a NEW row, never updates (FR-007). Index: `(sheet_id, created_at DESC)` for the per-song newest-first list.

### `SecondVoiceOut` shape (shared by the agent, the row validator, and the panel)

English keys, English string values (R1). `?` = nullable/optional.

```jsonc
{
  "key": { "tonic": "G", "mode": "major", "justification": "…" },
  "scale": ["G", "A", "B", "C", "D", "E", "F#"],
  "diatonic_chords": [
    { "degree": "I", "chord": "G" }, { "degree": "ii", "chord": "Am" }
    // … iii, IV, V, vi, vii° — exactly 7; minor keys: i, ii°, III, iv, v, VI, VII
  ],
  "progression": [
    { "section": "Verse 1", "chords": ["G", "Em", "C", "D"], "degrees": ["I", "vi", "IV", "V"] }
  ],
  "special_chords": [ { "chord": "E7", "function": "secondary dominant V7/vi …" } ],  // [] legal
  "cadences": [ { "name": "V–I", "chords": ["D", "G"], "location": "end of the chorus" } ],
  "section_feel": [ { "section": "Verse 1", "feeling": "…" } ],
  "second_voice": {
    "melody_status": "missing",          // missing | present (v1: always missing)
    "strategy": "diatonic thirds above where they fit…",
    "up": null, "down": null,            // v1: null (no melody → no proposals)
    "recommendation": null               // v1: null
  },
  "note_table": [                        // v1: rows carry anchors + chords only (rule 2)
    { "section": "Chorus", "lyric_snippet": "…", "chord": "G",
      "first_voice": null, "second_voice": null, "interval": null, "explanation": "…" }
  ],
  "singing_tips": ["…"]
}
```

Rules: `diatonic_chords` has exactly 7 rows whose degrees follow `key.mode` — major `[I, ii, iii, IV, V, vi, vii°]`, minor (natural) `[i, ii°, III, iv, v, VI, VII]` (a major V/V7 in a minor key is non-diatonic → `special_chords`); `key.tonic` is a bare note name (receipt clamp splits `Em`/`Bbm`/`A minor` into tonic + `mode: minor`, suffix winning over a conflicting mode); every `chords` symbol (diatonic, progression, special, cadence, table) MUST be FR-013-valid; each `progression` row MUST have `len(degrees) == len(chords)`; `lyric_snippet` ≤ 120 chars; `special_chords` may be `[]` (fully diatonic songs); `note_table` may be `[]` only when the strategy explains why (never silently empty on a chord-bearing song). Concise caps (gist, not essay): prose ≤600/480/320 chars per field (justification/function/voice-options ≤600; feeling/explanation ≤480; tips ≤320; strategy ≤600; labels ≤80; locations ≤160; snippets ≤120), lists ≤20/12/60/5 rows (progression/section_feel ≤20; special/cadences ≤12; note_table ≤60; tips ≤5) — receipt clamped to these caps before validation (lists cut, strings truncated: cosmetic overflow never 502s a paid call), trust invariants (pitches, symbols, degrees, diatonics) fail closed; Pydantic/Zod/DB mirror the same numbers, prompt teaches 1–2 sentences (~2x headroom).

## Derived / UI state (not persisted)

- **Transposed Snapshot** (transient, request only): `{transpose, chords_by_line: [{section, line, chords: [{offset, symbol}]}]}` — derived from `displaySheet` by pure `lib/second-voice.ts`; validated against the stored sheet (counts, offsets, vocab) then discarded (DR-001). Never stored: the row keeps `transpose` for provenance, and the analyzed symbols live inside `analysis.progression[].chords`.
- **Stale** (derived, never stored): `openAnalysis.transpose !== currentStepper` → stale badge + re-run (contracts/analysis-panel.md). Recomputes from props every render; cannot desync.
- **Analysis History Entry** (listing projection): `{id, sheet_id, transpose, model_id, created_at}` — the list route returns summaries, never full JSON (rows are ~2–4k tokens; summaries keep the list cheap).
- **View states** per surface (FR-011): `loading → ready | empty | error`; error MUST offer retry; empty states per spec (no analyses yet, lyrics-only hides the button).

## Validation rules (backend + tests)

1. Every row has a resolvable `sheet_id` (FK), `transpose` in −11…+11, non-blank `model_id`, and `analysis` matching `SecondVoiceOut` (required keys, 7 diatonics with the exact degree set for `key.mode`, progression length parity, FR-013 symbols throughout, snippets ≤ 120 chars, concise prose/row caps per the shape rules above).
2. **No-melody invariant** (FR-010, insert-time): `second_voice.melody_status == "missing"` ⟹ every `note_table` row MUST have `second_voice: null` AND `first_voice: null` AND `interval: null` (F3 fix: with no melody, a first-voice pitch is as invented as a second-voice one) AND `second_voice.up/down/recommendation` MUST all be null (T031 fix: the model filled `recommendation` with a "please provide melody" note on full_length — `strategy` is the only prose channel when missing); violation rejects the insert (fail closed, FR-014). v1 rows are always `missing` (no melody input exists).
3. `owner_id` on every row equals `OWNER_ID` (single-owner invariant, FR-005) — enforced at insert, asserted in tests.
4. `special_chords: []` is legal (diatonic songs); `note_table: []` is legal only with a non-empty `second_voice.strategy` explaining the omission.
5. No UPDATE paths exist: analyses are immutable (re-run inserts; re-open reads stored rows only — R7/004-R7). The sole DELETE path removes one analysis row (FR-007); sheet DELETE cascades via FK (FR-013).
6. List order is ALWAYS `(sheet_id, created_at DESC)` (FR-006); list responses carry summaries only (rule: full `analysis` JSON appears ONLY on analyze + get-one responses).
7. Every `transpose` badge renders from the row's stored `transpose` (provenance), never recomputed — the row IS the record of what was analyzed (DR-001).
