# Feature Specification: AI Second-Voice Recommender (Lyrics + Chords)

**Feature Branch**: `006-second-voice-recommender`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: Improve game Courses / Course / Lyrics + Chords - introduce a new AI 2nd voz recommender button. Rule: after setting expected Tone using transpose button, click new button and process 19-step English harmonic + second-voice prompt. Clarifications 2026-09-17: (1) best recommendation via DRs, (2) always persist + per-song history, (3) JSON structured output.

## Clarifications

### Session 2026-09-17 (specify - user decisions, recorded pre-plan)

- Q: Which payload crosses the boundary - {sheet_id, transpose} with backend transposition, or frontend rendered chords? -> A: Best-recommendation Option B: frontend POSTs transposed chords it renders (displaySheet-derived chords_by_line) plus sheet_id + transpose for provenance; backend validates shape/count/vocab against stored sheet, zips onto stored lyrics, never does pitch math. Zero duplication, parity by construction. DR-001.
- Q: Ephemeral or persisted? -> A: Always persisted: every completed analysis stored server-side; open sheet shows per-song history (newest first, transpose badge + timestamp, re-open). DR-002.
- Q: Model output shape - Markdown blob or structured JSON? -> A: Structured JSON (SecondVoiceOut via Agno output_schema): deterministic sections mirroring 9 final-format headings plus note table; panel renders from JSON. DR-003.
- Q: What does analysis see when transposed? -> A: Transposed chords at stepper offset (exact symbols on screen), not stored originals. transpose 0 = original key. Stepper change after analysis marks stale + re-run; re-run creates NEW row.
- Q: Language? -> A: Analysis body English per owner 19-step prompt (beginner theory + ukulele, Anglo names C D E F G A B with sharps/flats). All-English, no locale exception (2026-09-17: Spanish removed per owner request).
- Q: No melody notes available? -> A: No-melody gate (steps 10-12): state missing info, intervallic strategy only, NEVER invent exact notes. Melody input is v2, not v1.
- Q: Button placement/enabled? -> A: Beside TransposeControl in SheetView, only when sheet has chords (hidden for lyrics-only). Disabled while in flight; loading/error/retry/empty states follow 004 FR-014 idioms.

### Session 2026-09-17 (analyze F1–F4 + cascade-copy advisory F5)

- F3: no-melody invariant tightened — `missing` ⟹ `second_voice`, `first_voice`, AND `interval` MUST all be null per note-table row (was SHOULD for the latter two); enforced in Zod/Pydantic/DB validators.
- F5: FR-013 cascade-copy — both 004 entry-delete confirms name the cascade with the generic suffix "and any saved second-voice analyses" (unconditional; exact counts rejected — fetch-on-intent in a destructive path buys loading/error states for a number that cannot change an all-or-nothing choice; revisit via GET list?limit=1 → `total` if the owner wants counts). No DR: copy wording is an implementation detail, recorded here rather than in the ledger.
- F1/F2/F4 are plan/tasks-level only (T009/T031 eval-method split, T018 provisional render, T008→T009 typo) and touch no spec requirement.

### Session 2026-09-18 (owner-directed UI change: tabbed layout, post-implement)

- Owner request supersedes the "beside stepper" placement: the sheet view renders a shared transpose stepper above two tabs — "Sheet" (lyrics + chords) and "AI 2nd voice" (analysis panel + history). The analysis tab lazy-mounts `SecondVoicePanel` on first visit (then stays mounted via `hidden`, preserving runs/history across tab switches) and auto-opens the newest saved analysis at the current transpose, else the newest overall (zero inference), or shows the generate path when empty. Lyrics-only sheets render the sheet directly with no tabs (same chords-missing rule). FR-001/SC-001/SC-004, `contracts/analysis-panel.md` composition, `plan.md` SheetView line, and `quickstart.md` V1/V2/V5 steps amended in the same commit (T038); no behavior change to transpose, persistence, or the 9-section contract.

### Session 2026-09-30 (owner-directed: tab order + auto-generate on first visit)

- Owner request: sheet tabs are now ordered and named "Lyrics + Chords" (was "Sheet"), "1st-voice trainer" (008), "AI 2nd voice analyzer" (was "AI 2nd voice"). On first visit to the analyzer tab, when the song has no saved analysis, the panel auto-generates one at the current transpose (at most once per mounted panel — retries/re-runs stay explicit) and shows a generating animation (spinner + placeholder lines, `role="status"`) while it waits. Saved analyses still auto-open with zero inference; a failed history load never triggers generation. Amends FR-001 and FR-011.

### Session 2026-11-02 (owner-directed: 013 2nd-voice trainer)

- Owner request: the "AI 2nd voice analyzer" tab opens with the 2nd-voice trainer (spec 013), and the rendered analysis no longer shows the harmony-theory sections (Key, Scale, Diatonic chords, Roman-numeral progression, Special chords, Important cadences, Section-by-section feel). The rendered analysis shows Recommended second voice, Note-by-note table, and Singing tips. The stored `SecondVoiceOut` (all fields: `key`, `scale`, `diatonic_chords`, `progression`, `special_chords`, `cadences`, `section_feel`, `second_voice`, `note_table`, `singing_tips`), its schema, backend validation, and the backend eval gates (`english_format_complete`, `no_invented_melody`) are unchanged. Amends FR-009, US3 scenario 1, and SC-007; `contracts/analysis-panel.md`, `plan.md` (SecondVoiceView line), and `quickstart.md` V1 are amended in the same change.

## User Scenarios & Testing

### User Story 1 - Generate analysis at current transpose (Priority: P1)

Learner sets singing key with transpose stepper (e.g. Tr. +5), selects AI 2nd voice button. System analyzes transposed chords + lyrics, returns structured English analysis: key, scale, diatonics, Roman degrees, non-diatonic function, cadences, section feel, melody-gated 2nd voice, note table where melody exists, tips.

**Why this priority**: Core learning value. Without it nothing to persist (Story 2) or trust (Story 3).

**Independent Test**: Open chord-bearing sheet, set non-zero transpose, select button, verify 9-section English analysis referencing transposed symbols.

**Acceptance Scenarios**:

1. **Given** sheet at Tr. +N, **When** select AI 2nd voice, **Then** loading then structured 9-section analysis of transposed chords.
2. **Given** sheet at Tr. 0, **When** run analysis, **Then** references stored originals, records transpose 0.
3. **Given** lyrics-only sheet, **When** loads, **Then** button hidden, no request possible.
4. **Given** submitted request, **When** inference fails, **Then** error + retry, sheet + stepper preserved, nothing stored.
5. **Given** analysis shown then stepper moves, **When** offset changes, **Then** stale badge (names computed offset) + one-action re-run.

---

### User Story 2 - Review persisted history per song (Priority: P2)

Returning learner re-opens sheet, sees past analyses newest-first (transpose badge, timestamp, model), re-opens any with zero inference, or deletes behind confirm.

**Why this priority**: Retention/songbook value; past keys comparable; re-open free.

**Independent Test**: Run 2 analyses at different offsets, leave, return, verify both re-open full analyses; re-run creates third.

**Acceptance Scenarios**:

1. **Given** >=1 analysis, **When** open history, **Then** newest-first with @Tr. badge, timestamp, model id.
2. **Given** history, **When** select entry, **Then** full persisted analysis opens, zero providers.
3. **Given** viewing analysis/history, **When** re-run at current offset + confirm, **Then** NEW entry; cancel runs nothing.
4. **Given** no analyses, **When** open history, **Then** friendly empty state.
5. **Given** history, **When** delete + confirm, **Then** only that analysis removed; sheet + siblings work; deleting open returns to empty-analysis state.

---

### User Story 3 - Trust deterministic honestly-gated analysis (Priority: P3)

Learner reads stable labeled sections, Anglo names with sharps/flats; no-melody sheets show honest missing notice + strategy, never invented notes.

**Why this priority**: Trust/teachability; identical inputs re-render identically; gate prevents confidently-wrong notes.

**Independent Test**: Re-open persisted analysis verify identical render; run no-melody path verify notice + strategy-only, zero invented rows.

**Acceptance Scenarios**:

1. **Given** persisted analysis, **When** renders, **Then** the practical sections (Recommended second voice, Note-by-note table, Singing tips) under stable headings with Anglo names and explicit sharps/flats; the stored analysis still holds every field. (Amended 2026-11-02, 013.)
2. **Given** no-melody sheet, **When** completes, **Then** states missing info, strategy only, zero invented pitch rows.
3. **Given** non-diatonic chord present, **When** completes, **Then** flagged with function + cadences named.

---

### Edge Cases

- Tr. 0 is valid tone: runs against original key, records transpose 0.
- All symbols unparseable: block with guidance; no inference, nothing stored.
- Sheet deleted: its analyses cascade (the delete confirm names the cascade, FR-013); entry marked unavailable; other songs work.
- Unknown analysis address: not-found state + way back (004 FR-015 idiom).
- Loading/failure: panel loading then error+retry; sheet stays interactive.
- Malformed/schema-invalid model JSON: fail closed, nothing stored, no partial render.
- Missing key/timeout: unavailable/timeout notice + retry; nothing stored.
- Double-submit: one in flight per sheet; button disables while busy.
- Tampered chords_by_line (counts/offsets/vocab): VALIDATION_ERROR, store nothing; pitch trusted, shape verified.

## Requirements

### Functional Requirements

- **FR-001**: Sheet view MUST offer a shared transpose stepper above the “Lyrics + Chords” | “1st-voice trainer” | “AI 2nd voice analyzer” tabs (in that order) when the sheet has chords; the analyzer tab hosts the AI 2nd voice action + panel + history (lazy-mounted on first visit, state preserved across tab switches). On first visit with no saved analysis for the song, the panel MUST auto-generate one at the current transpose (once per mount; zero inference when saved analyses exist). Lyrics-only sheets show no analyzer tab and no action (matches stepper rule). (Amended 2026-09-30: tab rename/reorder + auto-generate.)
- **FR-002**: Action MUST submit displayed (transposed) chords as chords_by_line keyed by section/line plus sheet_id + transpose (-11..+11); MUST NOT send lyric text (backend zips onto stored lyrics).
- **FR-003**: Backend MUST validate payload vs stored sheet (counts, offsets in range, FR-013 vocab); reject with VALIDATION_ERROR storing nothing. Pitch trusted, shape verified.
- **FR-004**: Backend MUST run 19-step English analysis via Agno Agent over OpenRouter with SecondVoiceOut JSON output_schema, transposed chords + stored lyrics as only musical input, model id recorded.
- **FR-005**: Every completed analysis MUST persist server-side (sheet_id, transpose, model_id, analysis JSON, timestamp) under single-owner identity; no login.
- **FR-006**: Sheet MUST expose per-song history newest-first (transpose badge, timestamp, model); select MUST open full persisted analysis with zero providers.
- **FR-007**: Re-run MUST create NEW entry append-only; each entry MUST offer delete behind explicit confirm (names song + offset; Cancel/Escape aborts); delete removes only that analysis.
- **FR-008**: Stepper change after analysis MUST mark stale (names computed offset) + one-action re-run; stale remains re-openable.
- **FR-009**: Rendered analysis MUST present the practical sections under stable headings (Recommended second voice, Note-by-note table, Singing tips) with Anglo names + explicit sharps/flats; data-driven from JSON. The stored analysis still carries every field (`key`, `scale`, `diatonic_chords`, `progression`, `special_chords`, `cadences`, `section_feel`, `second_voice`, `note_table`, `singing_tips`). (Amended 2026-11-02, owner-directed 013: the harmony-theory sections are no longer rendered.)
- **FR-010**: No-melody gate MUST hold: state missing info, strategy only, zero invented pitch rows. Melody input out of scope v1.
- **FR-011**: Panel/history MUST handle loading/empty/error (indicator, empty state, error+retry preserving sheet+stepper). While an analysis is generating (auto or manual) the panel MUST show an animated generating state (spinner + placeholder content) announced via `role="status"`. Button disables in flight. (Amended 2026-09-30: animated generating state.)
- **FR-012**: All-English: chrome and analysis body in English beginner pedagogy (Spanish locale removed 2026-09-17 per owner request).
- **FR-013**: Sheet delete MUST cascade to analyses; single-analysis delete MUST NOT touch sheet/siblings. The 004 history-entry delete `ConfirmDialog` (both surfaces: open-sheet toolbar + history card) MUST name the cascade — copy includes "and any saved second-voice analyses" so deleting a song never silently wipes persisted analyses (F5 fix). Re-open serves stored rows, zero re-query (004 R7 extended).
- **FR-014**: Schema-invalid output, missing key, or timeout MUST fail closed: notice + retry, nothing stored, no partial render. Never hard 500 page.

### Key Entities

- **Owner**: Single synthetic identity owning all analyses; no login (004 reused).
- **Transposed Snapshot** (transient): chords_by_line from displaySheet at offset N; validated then zipped onto stored lyrics.
- **Second-Voice Analysis**: Persisted: sheet_id, transpose, analysis JSON (9 sections + table + tips), model_id, timestamp. Immutable, newest-first per song.
- **Analysis History Entry**: Listing view (badge, timestamp, model); v1 entry IS analysis row.
- **Song Sheet** (004, referenced): Immutable parent: identity, stored lyrics, original chords for validation.

### Decision records

| Record | Settles | Status |
|---|---|---|
| [DR-001](decisions/DR-001-analysis-payload.md) | Frontend POSTs rendered transposed chords + provenance (Option B); backend validates shape, never transposes | Accepted |
| [DR-002](decisions/DR-002-persist-analysis-history.md) | Always persist every completed analysis; per-song newest-first history with re-open + confirmed delete | Accepted |
| [DR-003](decisions/DR-003-structured-json-output.md) | Agno output_schema=SecondVoiceOut JSON over Markdown blob; data-driven rendering, fail-closed on violation | Accepted |

## Success Criteria

### Measurable Outcomes

- **SC-001**: Learner can request analysis within 2 selections of setting transpose (analysis tab + run action).
- **SC-002**: Request yields structured analysis or error+retry within 60s wall (45s backend inference proxy; longer than 004 30s: reasoning + 2-4k tokens).
- **SC-003**: Owner runs analysis at chosen transpose + re-opens from history first try unaided (walkthrough; 10-user panel waived, 004 precedent).
- **SC-004**: Re-open any past analysis within 3 selections from the Sheet tab (tab → history → entry), zero providers; the newest analysis at the current transpose (else newest overall) auto-opens on first tab visit.
- **SC-005**: Sample of 5 analyses over >=3 songs at varied offsets: 100% transpose_respected, 100% degrees_consistent, 100% non_diatonic_flagged, 100% no_invented_melody (critical).
- **SC-006**: Analysis persists across visits with identical section rendering.
- **SC-007**: SC-005 sample: 100% of stored analyses carry every field with Anglo names + sharps/flats (`english_format_complete`), and 100% of rendered analyses show the practical sections with Anglo names + sharps/flats. (Amended 2026-11-02, 013.)

## Assumptions

- Extends 004 game (ukulele lyrics-chords slug); no new card/route/content entry; panel inside open sheet view.
- Sheets immutable (004 rule 7); stepper display-only, persisted only on analysis rows as provenance.
- Private single-user hobby; single-owner; keys server-side; browser zero keys (VI/VII).
- Owner provisions OpenRouter key; degraded unavailable + retry when absent; nothing stored until success.
- 45s inference budget in 60s SC-002 envelope; 004 25s pipeline untouched (separate route/budget).
- 19-step English prompt = owner curriculum; encoded as Agno instructions + SecondVoiceOut; eval gates per IV.
- Personal practice only; no redistribution/sharing; minimal lyric snippets as table anchors, never full re-emit.
- Modern browser + network; offline out of scope.
- Single-agent execution in task-ID order (004/005 precedent).

## Out of Scope

- Melody-note input (v2); v1 strategy-only gate.
- Audio playback/recording/tuner/pitch detection/sung capture.
- Server-side transposition (no Python port; frontend sole pitch owner per DR-001).
- Cross-song compare, stats, export/print/share.
- Login/multi-user/sharing.
- Streaming/SSE partial render; single JSON fits 60s.
- Embedded playback; new providers beyond OpenRouter.
- a11y beyond semantic markup + keyboard operability of button/panel/history.
