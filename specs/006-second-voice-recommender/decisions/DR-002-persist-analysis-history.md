# Decision: Persist every analysis with per-song history

## Status
**Accepted**

## Context
Story 2 (retention/songbook) needs past analyses comparable across keys (e.g. V–I at +3 vs +5) with free re-open. The question is whether analyses are ephemeral (recompute per click) or always persisted with a per-song history surface.

**Question:** Should completed analyses be ephemeral or always persisted with a per-song newest-first history?

**Constraints that matter:**
- FR-005 — every completed analysis persists (sheet_id, transpose, model_id, JSON, timestamp).
- FR-006/FR-007 — per-song history, newest-first, re-open with zero providers, append-only + confirmed delete.
- FR-013 — sheet delete cascades; re-open serves stored rows (004 R7 invariant extended).
- Principle VII — all persistent state in the project's own Postgres; no SQLite.

## Options Considered
- **Option A — Ephemeral: recompute per click, no storage.** Smallest scope, no migration; every re-open costs inference. **(rejected)**
- **Option B — Always persist per `(sheet_id)` with transpose provenance; per-song history.** New `second_voice_analyses` table (FK → song_sheets, CASCADE); list/re-open/delete routes; unbounded append-only mirroring 004 history. **(chosen)**
- **Option C — Deduplicate on `(sheet_id, transpose)`: one row per offset, re-run replaces.** Saves rows; destroys comparability across runs and contradicts the append-only songbook idiom. **(rejected)**

## Assumptions
- [low risk] Analysis rows stay in the hundreds (same scale as 004 history); unbounded growth needs no cap in v1.
- [low risk] Per-sheet scoping satisfies "per song" — cross-regenerate grouping by normalized title+performer is a follow-up, not v1.
- [medium risk] JSONB rows (~2–4k tokens of analysis) keep re-open a single cheap local read — mitigated by the same no-requery rule as 004 (no provider calls on read).

## Evidence
- `backend/db_models.py:255-311` — `SongSheet` SQLAlchemy model + mapper-event validation pattern the new table clones.
- `backend/db_models.py:314-340` — `HistoryEntry` newest-first listing pattern (`created_at DESC` ordering precedent).
- `backend/db_models.py:343-352` — `before_insert`/`before_update` validation events (defense-in-depth pattern).
- `backend/app/routes_sheets.py:296-306` — `GET /history` Postgres-only list, zero providers.
- `backend/app/routes_sheets.py:309-320` — `GET /history/{entry_id}` re-open with ZERO provider re-querying (R7 rule FR-006 extends).
- `backend/app/routes_sheets.py:348-368` — `DELETE` entry + orphaned sheet, entry-first for FK RESTRICT (FR-007 mirrors the confirm + remove-one idiom).
- `specs/004-lyrics-chords-generator/data-model.md:73-79` — append-only history, regenerate inserts, confirmed delete is the sole removal path.
- `specs/004-lyrics-chords-generator/contracts/rest-api.md:99-117` — list newest-first + re-open contracts the new routes mirror.

## Decision
**Option B.** Option A rejected: it contradicts the explicit user directive (Clarifications 2026-09-17: "always persist … historical review per song") and burns inference on every re-open. Option C rejected: dedup-on-offset silently replaces history the learner may want to compare (same run at the same offset can differ across model versions), and breaks the 004 append-only invariant the codebase already implements. Option B reuses proven patterns (table + mapper validation + list/get/delete routes + newest-first ordering) with one new table and three new routes.

## Confidence
High — the user explicitly directed persistence; the implementation clones two shipped patterns (004 sheet/history tables and routes) with no new infrastructure.

## Consequences
**Easier:** Re-open is free and instant; past keys comparable; provenance (offset + model + timestamp) auditable; SC-006 testable as a row round-trip.
**Harder:** One migration (new table + FK CASCADE + index on `(sheet_id, created_at DESC)`); three new routes + Zod/Pydantic mirrors + contract tests; history UI (list + badges + confirm delete) in the panel.
**Risks that remain:** Row growth per prolific re-runner — mitigated by single-owner scale (hundreds) and per-entry delete; cross-sheet "same song" grouping deferred (revisit trigger).

## Revisit Trigger
Reopen if: the owner wants cross-regenerate grouping (normalize title+performer across sheet_ids), a retention cap (storage or clutter), or shared/published analyses (multi-user — also reopens FR-005/FR-013 and the 004 R8 posture).
