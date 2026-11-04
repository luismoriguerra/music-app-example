# Decision: Analysis payload — who transposes

## Status
**Accepted**

## Context
The analysis MUST see the transposed chords the learner sees (spec FR-002/FR-003, Clarifications 2026-09-17). The stepper is display-only and lives in `SheetView`; the question is what crosses the frontend/backend boundary: a bare offset the backend re-applies, or the rendered symbols themselves.

**Question:** Should the frontend POST `{sheet_id, transpose}` for backend-side transposition (Option A), or the rendered transposed chords plus provenance (Option B)?

**Constraints that matter:**
- FR-002 — analysis input is the displayed (transposed) chords.
- FR-003 — backend validates shape/count/vocab; pitch trusted (single-owner).
- Principle VIII — no duplication across the frontend/backend boundary past a third use; lib stays pure.
- Principle II — cross-app handoff through explicit REST contracts.

## Options Considered
- **Option A — `{sheet_id, transpose}`; backend transposes.** Backend loads the immutable sheet, re-applies N semitones server-side, then analyzes. Requires a Python port of the transpose stack. **(rejected)**
- **Option B — Frontend POSTs `chords_by_line` from `displaySheet` + `sheet_id`/`transpose` provenance.** Backend validates shape/count/vocab against the stored sheet, zips transposed chords onto stored lyrics, never does pitch math. **(chosen)**
- **Option C — Frontend POSTs full transposed `body` including lyric text.** Same as B but echoes lyrics. **(rejected)**

## Assumptions
- [low risk] `transposeSheet` remains the single pitch-math owner; no server-side recompute is needed in v1 (interactive use only, no batch evals over offsets).
- [low risk] Single-owner trust posture holds (no login, self-harm only) — shape verification is sufficient.
- [medium risk] Line/section counts are stable between render and POST — mitigated by validating counts and rejecting on mismatch.

## Evidence
- `frontend/src/components/SheetView.tsx:34` — `useState(0)` transpose is local view state, reset on `sheet.id`.
- `frontend/src/components/SheetView.tsx:38-41` — `displaySheet = transposeSheet(sheet, transpose)`; render derives from it.
- `frontend/src/lib/chord-diagrams.ts:692-711` — `transposeSheet` (pure, input never mutated, offsets/lyrics pass through).
- `frontend/src/lib/chord-diagrams.ts:655-683` — `chooseSheetSpelling` (most-frequent-root tonic, first-appearance tiebreak).
- `frontend/src/lib/chord-diagrams.ts:601-638` — `transposeChordSymbol` (tail-preserving, slash-bass moves, unparseable stays put).
- `frontend/src/lib/chord-diagrams.ts:641-644` — `FLAT_TONIC_PCS` / `SHARP_TONIC_PCS` major-key maps.
- `frontend/src/lib/chord-diagrams.ts:546-547` — `TRANSPOSE_MIN/MAX` ±11 bounds.
- `backend/agents/sheets/fallback.py:61-64` — `ChordsOut` chords-only wire precedent (no lyric text crosses).
- `backend/agents/sheets/fallback.py:96-126` — `_zip_body` zips model chords onto held lyrics; the pattern FR-002 reuses.
- `backend/db_models.py:57-61` — `CHORD_SYMBOL_RE` MUST stay textually identical to `frontend/src/lib/sheets.ts` (vocab check, not pitch math).
- `specs/004-lyrics-chords-generator/data-model.md:37-39` — sheets immutable after insert (validation baseline is stable).

## Decision
**Option B.** The frontend is already the pitch-math owner (stepper needs instant local transpose), so Option A would duplicate `transposeSheet` + `chooseSheetSpelling` + `transposeChordSymbol` in Python and hinge correctness on byte-for-byte spelling parity — exactly the cross-boundary duplication Principle VIII forbids. Option B has zero new duplication and parity by construction (analyzes the rendered symbols). Option C rejected: echoing lyrics re-opens the drift channel `ChordsOut` deliberately closed (fallback.py:6-8); backend zips onto stored lyrics instead.

## Confidence
High — rests on existing code paths (displaySheet derivation, ChordsOut zip precedent) and an explicit user decision (Clarifications 2026-09-17); the only new surface is a chords-by-line contract mirroring an already-defined body shape.

## Consequences
**Easier:** No Python transpose port, no parity fixtures; contract tests reuse the 004 body-shape pattern; analysis provably matches the screen.
**Harder:** Backend cannot recompute an analysis from `(sheet_id, transpose)` alone — re-run requires the client to re-send the snapshot (acceptable: interactive v1, persisted rows make re-derive unnecessary).
**Risks that remain:** Tampered pitch passes validation by design — mitigated by single-owner posture (self-harm only) + shape/count/vocab verification per FR-003.

## Revisit Trigger
Reopen if: server-side recompute without a client is needed (batch evals over offsets, re-derive from `(sheet_id, transpose)` alone), a second user arrives (trust posture changes), or the stepper gains a persisted key (transpose becomes sheet state, not view state).
