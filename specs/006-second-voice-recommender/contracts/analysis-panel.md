# Contract: Analysis Panel (view states + composition — delta on 004)

**Feature**: `006-second-voice-recommender` | **Date**: 2026-09-17
**Spec**: [../spec.md](../spec.md) | **Research**: R5/R10 in [../research.md](../research.md) | **REST**: [rest-api.md](./rest-api.md)

Phase 1 output. This is the view-state half of the constitution-II handoff: where the button/panel/history live, which states each surface handles, and the stale rule. It extends the 004 `game-route.md` sheet view — no new route, no new content entry.

## Composition (inside the open sheet view)

```text
SheetView (EDIT: render site + apiBaseUrl threading)
├── header (identity) + attribution (unchanged, 004)
├── TransposeControl (unchanged, 004 — shared above the tabs)
├── tablist "Sheet views" (NEW, 006): Sheet | AI 2nd voice tabs (roving
│   tabindex, ←/→ move; hidden for lyrics-only — sheet renders directly)
│   ├── tabpanel "Sheet": lyrics + chord reference rail (unchanged, 004)
│   └── tabpanel "AI 2nd voice": SecondVoicePanel (NEW container,
│       lazy-mounted on first visit, stays mounted via `hidden`)
│       ├── trigger button "AI 2nd voice" (disabled in flight)
│       ├── state: idle | loading | ready | stale-ready | error | history-open
│       ├── SecondVoiceView (NEW presentational: 9 sections + note table + missing-melody notice)
│       └── AnalysisHistoryList (NEW presentational: newest-first + @Tr badges + ConfirmDialog delete)
```

Props: `SecondVoicePanel({ displaySheet, transpose, apiBaseUrl })`. `displaySheet` is the transposed sheet `SheetView` already derives (`transposeSheet(sheet, transpose)`); the panel builds `chords_by_line` from it via pure `lib/second-voice.ts` (never by re-implementing transpose). No new Astro island boundary — the whole tree is already under the 004 `client:load` island.

## View states (FR-011 — every surface handles loading/empty/error)

| Surface | Loading | Empty | Error | Ready |
|---|---|---|---|---|
| Trigger button (in the analysis tab) | — (disabled + spinner on the button, `aria-busy`) | no tabs when `chord_source === "none"` (sheet renders directly) | — | enabled, `Tr. +N` context label |
| Panel (analysis) | skeleton/spinner with `role=status` ("Analyzing at Tr. +N…") | prompt state ("Set your key, then run your first analysis") | error + retry (sheet + stepper preserved; nothing stored) | practical sections under stable headings (Recommended second voice, Note-by-note table, Singing tips) + stale badge when derived-stale (amended 2026-11-02, 013) |
| History list | inline spinner | "No analyses yet for this song — completed runs will appear here" | error + retry (list fetch failed; panel keeps working) | newest-first rows: `@Tr. +N` badge, timestamp, model id, open + delete |

## Stale rule (FR-008 — derived state, never stored)

`stale = openAnalysis !== null && openAnalysis.transpose !== transpose`. When stale: badge reads "Computed at Tr. +M — showing Tr. +N" + one-action "Re-run at Tr. +N" button. Stale analyses remain fully readable (history is immutable); re-run POSTs the new snapshot and inserts a NEW row (FR-007). The rule recomputes from props every render — no stored flag can desync.

## Heading map (FR-009 — stable headings, data-driven)

Field → heading (English, fixed order): `key` → "Key" · `scale` → "Scale" · `diatonic_chords` → "Diatonic chords" · `progression` → "Roman-numeral progression" · `special_chords` → "Special chords" (empty → "Fully diatonic — no special chords" empty row, still rendered) · `cadences` → "Important cadences" (empty → "No standout cadences.") · `section_feel` → "Section-by-section feel" · `second_voice` → "Recommended second voice" (always includes the missing-melody notice + strategy in v1) · `note_table` → "Note-by-note table" (v1: anchors + chords + explanations; pitch cells render "—" with the gate footnote) · `singing_tips` → "Singing tips".

(Amended 2026-11-02, 013.) Only three fields are rendered: `second_voice` → "Recommended second voice", `note_table` → "Note-by-note table", and `singing_tips` → "Singing tips". The other seven fields (`key`, `scale`, `diatonic_chords`, `progression`, `special_chords`, `cadences`, `section_feel`) remain in the stored JSON and backend validation but are not rendered. The analyzer-tab trainer still reads `key` and `scale` through the analysis-key path (008 FR-004).

Note names render Anglo (C D E F G A B) with explicit sharps/flats as stored; the panel MUST NOT re-spell symbols (DR-001: no pitch math outside `chord-diagrams.ts`).

## Keyboard + semantics (004 idioms reused)

Trigger is a native `<button>`; history rows are list items with open (button/link) + delete (icon button → `ConfirmDialog`, Cancel autofocus, Escape aborts); loading regions use `role=status`; error regions pair the message with a retry button; headings follow the sheet's outline order (panel title one level below the song title). The tablist uses roving tabindex (one tab in the tab order, ←/→ move and activate, `aria-controls`/`aria-labelledby` wiring); hidden panels keep their state.

## Non-goals (v1)

No new route or deep-linkable analysis URL (history lives in the panel; re-open is in-place); no cross-song views; no chord diagrams inside theory sections (the rail beside the panel already shows them, R10); no SSE/progressive render.
