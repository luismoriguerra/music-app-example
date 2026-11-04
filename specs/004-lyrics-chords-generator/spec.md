# Feature Specification: Ukulele Lyrics + Chords Generator

**Feature Branch**: `004-lyrics-chords-generator`

**Created**: 2026-09-15

**Status**: Approved

**Input**: User description: "let's explore a new card in Ukulele Course, this is a Lyrics+chords generator. this will receive an input that receive a song name, them, it will search for it and generate the lyrics with chords. we want to store search history to review it later again or generate it"

## Clarifications

### Session 2026-09-16

- Q: Where do the lyric lines in a generated sheet come from — reproduce found lyrics, add chords to learner-provided lyrics, or chords-only? → A: Full reproduction — sheets show the found song's lyrics with aligned chord symbols. The app is a private single-user hobby app for personal use; public song-data providers are evaluated at plan time through REQUIRED provider research, and every sheet attributes its source with a link back.
- Q: What is the scope of search-history persistence — device-only, account-synced, or session-only? → A: Server-side persistence keyed by a synthetic single-owner identity. No login and no multi-user accounts ship in this feature; the owner is the only user.
- Q: Which chord vocabulary may generated sheets use — catalog-only major/minor or full? → A: Full vocabulary as songs require (7ths, sus, dim, aug, and beyond), in standard Western notation.
- Q: Should sheets link out to other sources (lyrics/chords pages, video)? → A: Yes — every generated sheet includes a sources list linking to other pages with lyrics/chords for the song, including video results where available; links open outside the app (follow-up 2026-09-16).
- Q: When lyrics and chords come from different sources, how is the sheet attributed — single source or per-part labels? → A: Per-part labels — `lyrics:` and `chords:` attributions, each with a link back where the source is external; model-aligned chords labeled `chords: model-generated` (H1–H5 review 2026-09-16; updates FR-012, Song Sheet entity, SC-005).
- Q: When a complete chord chart exists for a song, does the sheet come from it whole or get assembled from multiple sources — and what happens otherwise? → A: Sheets come whole from one source when a complete chord chart exists; otherwise found lyrics with model-aligned chords; the detailed sourcing strategy (including fallbacks) is decided at plan time in research.md (H1–H5 review 2026-09-16; no FR change).
- Q: Does history persist full sheets given that some sources forbid storage? → A: Yes — history persists full sheets; sources whose terms forbid storage are excluded from persisted sources; single-user private noncommercial posture with attribution + link-back; revisit if the app gains users (H1–H5 review 2026-09-16; no FR change).
- Q: What should the system do when a search finds lyrics but no chords are available? → A: First attempt chord generation via search + model alignment; if still chordless, store the sheet with a chords-missing notice and count it as a failing SC-005 sample (bulk clarify 2026-09-16; updates Edge Cases, FR-004, SC-005).
- Q: How should the 10-first-time-users check be handled for a single-user hobby app? → A: Waived; the owner performs the task-based walkthrough unaided (bulk clarify 2026-09-16; updates SC-003).
- Q: Does regenerate create a new history entry or replace the existing one? → A: New entry each time, append-only; prior entry preserved (bulk clarify 2026-09-16; updates FR-010, FR-009, Story 3).
- Q: What does a "fresh" regenerate re-run? → A: Full search-and-generate pipeline for the same song (bulk clarify 2026-09-16; updates FR-010, Assumptions).
- Q: Which provider credentials will be provisioned? → A: All required credentials (chord fallback, video links, rich candidates); defined degraded states apply when any is unavailable (bulk clarify 2026-09-16; no FR change).
- Q: What counts as a chord-bearing line for the SC-005 80% sample? → A: Any lyric line carrying ≥1 valid full-vocabulary symbol per FR-013 (bulk clarify 2026-09-16; updates SC-005).
- Q: How should chords outside the catalog reference render? → A: Symbol plus a diagram-unavailable indication; catalog matches link to the Chords topic (bulk clarify 2026-09-16; updates FR-013).
- Q: What satisfies SC-008 when video sourcing is absent? → A: Video spanning required only when provisioned; pages-only pairs count otherwise (bulk clarify 2026-09-16; updates SC-008).
- Q: What happens at runtime when video quota is exhausted? → A: Sheet renders fully with page links intact; video part shows empty state + notice (bulk clarify 2026-09-16; updates Edge Cases).
- Q: Should history grow unbounded or cap at some size? → A: Unbounded append-only, no delete in v1 (bulk clarify 2026-09-16; updates FR-009).
- Q: How does the backend time budget enforce per-stage timeouts? → A: 25 s pipeline deadline propagated to stages with skip-vs-fail (skip video → sheet w/o video; skip model → lyrics-only + notice; lyrics-stage timeout → error, no partial stored) (bulk clarify 2026-09-16; updates Edge Cases, Assumptions; plan default in research R10).

### Session 2026-09-16 (M2 amendment — chord reference rail)

- Q: How should chords outside the catalog reference render, given generated diagrams are now available? → A: M2 amended — off-catalog symbols get a generated standard-GCEA fingering diagram (pure `lib/chord-diagrams.ts`: parse the FR-013 symbol, search a playable voicing); the sheet view stacks every unique song chord with its diagram in a right-side "Chords in this song" reference rail (curated catalog diagrams for plain major/minor, generated for the rest). Inline, catalog matches keep linking to the Chords topic and generated symbols render plainly; the diagram-unavailable indication now appears ONLY for unvoiceable symbols. Owner walkthrough 2026-09-16; updates FR-013, US2 scenario 7.

### Session 2026-09-16 (transpose stepper)

- Q: Should learners be able to transpose a generated sheet up/down by half-tones? → A: Yes, display-only — a − / Tr. N / + stepper above the lyrics shifts every shown chord (inline + "Chords in this song" rail) by semitones from the original key; key-aware accidental spelling follows the transposed tonic (most-frequent root, first-appearance tiebreak; flats for Db/Eb/F/Ab/Bb, sharps for D/E/G/A/B, step direction only for C and F#/Gb; major-key map, minor tonics a known limitation); slash bass moves with the root; symbols the parser cannot voice stay put; reset via the center label; hidden for lyrics-only sheets; never persisted. Owner walkthrough 2026-09-16; updates FR-017, US2 scenario 8, Out of Scope.

### Session 2026-09-16 (transpose helpers)

- Q: Should the transpose stepper offer one-tap jumps? → A: Yes — Reset, −3, +3 semitone shortcuts beside the stepper (jumps clamp to ±11; same display-only semantics as FR-017; Reset duplicates the center-label reset for discoverability). Owner walkthrough 2026-09-16; updates FR-017, US2 scenario 8.

### Session 2026-09-16 (history carousel + delete)

- Q: Should history stay a vertical list, and can learners remove entries? → A: History renders as a horizontal newest-first snap carousel with prev/next paging, and each entry offers delete behind an explicit confirm step (dialog names the song and warns the removal is permanent; Cancel/Escape aborts); confirmed delete removes the entry plus its orphaned sheet (204, zero providers) while siblings keep working. Owner walkthrough 2026-09-16; updates FR-009, FR-010, US3 scenario 5, History Entry entity.

### Session 2026-09-16 (sheet actions + regenerate confirm)

- Q: Should regenerate ask for confirmation, and where do sheet-level actions live? → A: Regenerate is guarded by the same explicit confirm step as delete on both surfaces (dialog names the song, states it re-runs the full search as a NEW entry with the current one kept and may return a different sheet; Cancel/Escape aborts) because it spends provider calls and ~30 s. The open sheet exposes a compact regenerate + delete action pair mirroring the history card; deleting the open entry (after confirm) returns to the empty generator. The history card title itself opens the sheet. Owner walkthrough 2026-09-16; updates FR-009, FR-010, US3 scenarios 2, 3, 5.
- Q: Which identity does a sheet carry when the chord chart found is another performer's arrangement (e.g. picked "Yesterday — Matt Monro", only The Beatles' chart exists)? → A: "As found" (FR-005) means the chart's identity on a chart hit: the sheet's matched title/performer are re-stamped from the chart (sheet row and history entry agree; the learner's query text is preserved verbatim). On a chart miss the learner's pick stays. Owner walkthrough 2026-09-16; updates FR-005, Assumptions, research.md T053 addendum.

### Session 2026-09-16 (inline chord diagrams)

- Q: Should inline chord symbols keep linking away to the Chords topic? → A: No — inline symbols never navigate. Every voiceable symbol (catalog or generated) reveals its fingering diagram in place: mouse hover shows it transiently; click, tap, Enter or Space pin it open; a second activation, Escape, or a tap outside closes it. The diagram-unavailable indication stays for unvoiceable symbols only. Owner walkthrough 2026-09-16; supersedes the M2 "keep linking" clause; updates FR-013, US2 scenario 7.

### Session 2026-09-18 (chord audio)

- Q: Should sheet chords play sound, and how does that interact with the diagram pin? → A: Yes — activating a voiceable chord (click, tap, Enter, Space) sounds its exact displayed uke voicing (re-entrant GCEA fretting) AND toggles the diagram pin; hover stays silent and transient. Playback follows one shared strum (default, ~25 ms string brush) / block (simultaneous strike) setting, switchable in the analysis table and persisted across reloads. Owner walkthrough 2026-09-18; updates FR-013.

### Session 2026-10-01 (dedicated sheet page + history paging + favorites)

- Q: Should an opened sheet stay embedded in the search page behind `?entry=<uuid>`? → A: No — every stored sheet opens on its own page at `/courses/ukulele/games/lyrics-chords/{entry_id}` whose breadcrumb extends the generator's with the song title (`Courses / Ukulele / Lyrics + Chords / {title}`); generating, re-opening, and regenerating all navigate there; legacy `?entry=<uuid>` links redirect to the dedicated page. Owner request 2026-10-01; updates FR-009, FR-010, FR-015, US3 scenarios 2, 3, 5; supersedes the `?entry=` deep-link contract (game-route.md).
- Q: How are history entries beyond the first page reached (T059)? → A: Numbered pagination — 10 entries per page with previous/next controls and a "Page N of M" indicator over the server `total`; a page emptied by delete falls back to the last remaining page. Owner request 2026-10-01; updates FR-009, US3 scenario 1.
- Q: Can learners curate their songbook? → A: Yes — each history entry can be marked/unmarked as a favorite (from the history card and the sheet page), and the history can be filtered to favorites only and/or by a name search matching the query, title, or performer (case- and accent-insensitive). Filters apply server-side so pagination and the count reflect the filtered set. Owner request 2026-10-01; adds FR-018; updates History Entry entity.
- Q: Should the generator be reachable from Home without opening the course? → A: Yes — Home shows a "Quick access" section above the course grid with the Lyrics + Chords game card (same card as the course page, "Open game"). Owner request 2026-10-01; adds FR-001a.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover and open the generator (Priority: P1)

A visitor on the Ukulele course page sees a "Lyrics + Chords" generator card
alongside the Chords and Harmonic Circles cards. Selecting the card opens the
generator view with a song-name input.

**Why this priority**: Discovery is the entry point of the feature. Without
the course-page card and its navigation, the generator exists but is
unreachable — this story wires it into the established
catalog → course → content journey.

**Independent Test**: Can be fully tested by opening the Ukulele course page
directly and verifying that the generator card appears labeled with its kind
and that selecting it opens the generator view showing the song-name input.
Delivers discoverability even before generation quality is judged.

**Acceptance Scenarios**:

1. **Given** a visitor on the Ukulele course page, **When** the page loads,
   **Then** a generator card labeled with its explicitly declared kind
   appears alongside the existing cards, showing a title, a short
   description, and a clear entry action.
2. **Given** a visitor on the Ukulele course page, **When** they select the
   generator card, **Then** the generator view opens showing a song-name
   input and a search-and-generate action.

---

### User Story 2 - Search a song and generate lyrics with chords (Priority: P2)

A learner in the generator view types a song name, submits it, and receives
a song sheet: the matched song's lyrics with chord symbols aligned to the
lyric lines they accompany, ready to play on ukulele, plus a sources list
linking to other pages with lyrics/chords for the song, including video
results where available.

**Why this priority**: Search-and-generate is the core learning value of the
feature. It builds on discovery (Story 1) and proves the first interactive
(game-kind) content end to end.

**Independent Test**: Can be fully tested by opening the generator view
directly, entering a well-known song name, and verifying that a song sheet
with lyrics and aligned chord symbols appears. Delivers a playable sheet
even before history is judged.

**Acceptance Scenarios**:

1. **Given** a learner in the generator view, **When** they enter a song
   name and submit, **Then** the system searches for the song and shows a
   song sheet identifying the matched song (title and performer as found)
   with chord symbols aligned to lyric lines.
2. **Given** a submitted song name matching several songs, **When** the
   search completes, **Then** the learner sees a candidate list and picking
   one generates that song's sheet.
3. **Given** a learner submitting a search, **When** the search or generation
   is in progress, **Then** a loading indicator is shown until the sheet, a
   no-match state, or an error state appears.
4. **Given** a submitted song name with no match, **When** the search
   completes, **Then** a no-match state explains nothing was found and offers
   a way to try a different spelling.
5. **Given** a failed search or generation, **When** the failure occurs,
   **Then** an error state with a retry action appears and the entered song
   name is preserved.
6. **Given** a generated song sheet, **When** it loads, **Then** a sources
   list appears alongside the sheet with links to other pages providing
   lyrics/chords for the song, including video results where available.
7. **Given** a generated song sheet, **When** it loads, **Then** a "Chords in
   this song" reference appears beside the lyrics stacking every unique song
   chord with its fingering diagram (catalog or generated per FR-013); and
   **When** the learner hovers or taps an inline chord symbol, **Then** that
   chord's diagram appears in place without leaving the sheet.
8. **Given** a generated song sheet with chords, **When** the learner steps the transpose control up or down, **Then** every shown chord (inline + chord reference) shifts by that many semitones from the original key and the control offers a reset plus −3/+3 semitone jump shortcuts.

---

### User Story 3 - Review history and re-open or regenerate sheets (Priority: P3)

A returning learner opens their search history, sees past song searches with
the songs they produced, re-opens any sheet to play it again, or regenerates
a fresh sheet for the same song.

**Why this priority**: History turns one-off generation into a reusable
songbook. It builds on generation (Story 2) and is the feature's retention
value: past work is kept until the learner deletes it.

**Independent Test**: Can be fully tested by generating sheets for two songs,
leaving, returning to the history, and verifying both entries re-open their
full sheets and regenerate produces a fresh sheet. Delivers the songbook
even before other courses exist.

**Acceptance Scenarios**:

1. **Given** a learner who completed at least one search, **When** they open
   the history, **Then** every past search appears as an entry showing the
   song query and the matched song, newest first, paginated 10 per page.
2. **Given** a learner in the history, **When** they select an entry (its
   title or its open action), **Then** the full song sheet for that search
   opens on its dedicated page `/courses/ukulele/games/lyrics-chords/{id}`.
3. **Given** a learner viewing a sheet or history entry, **When** they choose
   regenerate and confirm, **Then** a fresh sheet is generated for the same
   song as a new history entry (prior entry preserved); cancelling runs
   nothing.
4. **Given** a learner with no past searches, **When** they open the history,
   **Then** a friendly empty state explains that generated songs will appear
   there.
5. **Given** a learner in the history or viewing an open sheet, **When** they
   delete the entry and confirm, **Then** the entry and its sheet are removed
   while the remaining entries keep working; deleting the open sheet returns
   to the generator search page.
6. **Given** a learner with history, **When** they star entries and filter by
   favorites and/or a name, **Then** only matching entries are listed and the
   count and pages reflect the filtered set.

---

### Edge Cases

- What happens when the learner submits an empty song name? The submission
  MUST be blocked with inline guidance; no search runs.
- What happens when the song name matches nothing? A no-match state MUST
  appear with a way to retry a different spelling (Story 2, scenario 4).
- What happens when generation produces lyric lines without chord symbols?
  The system MUST first attempt chord generation via search + model alignment;
  if still chordless, the lines MUST still render with a chords-missing notice;
  the sheet is stored and counts as a failing SC-005 sample.
- What happens when a history entry's sheet can no longer be restored? That
  entry MUST be marked unavailable while the rest of the history keeps
  working.
- What happens when the learner opens an unknown generator or history
  address? A not-found page MUST appear with a way back to the catalog.
- What happens while content loads or fails to load? Every view MUST show a
  loading indicator while loading and an error state with a retry action
  when loading fails.
- What happens with over-long input or unusual characters? The input MUST be
  whitespace-trimmed; over-long input gets validation guidance and MUST NOT run a search.
- What happens when no external sources are found for a song? The sheet MUST
  still render fully; the sources list shows an empty state explaining no
  other sources were found.
- What happens when a source link is dead or blocked? The app MUST NOT break;
  links open outside the app and their availability is not guaranteed.
- What happens when video quota is exhausted? The sheet MUST still render
  fully with page links intact; the video part shows an empty state with a notice.
- What happens when part of generation times out? The pipeline MUST
  short-circuit with skip-vs-fail: skip video → sheet without video; skip model
  fallback → lyrics-only sheet with chords-missing notice; lyrics-stage timeout
  → error state with retry and no partial sheet stored.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Ukulele course page MUST display the generator as a card
  showing its explicitly declared kind (Game), a title, a short description,
  and an entry action that opens the generator.
- **FR-001a**: The Home page MUST show a "Quick access" section above the
  course grid containing the generator's game card, opening the same address.
- **FR-002**: Selecting the generator card MUST open the generator view at a
  stable human-readable slug address derived from its title.
- **FR-003**: The generator view MUST provide a song-name input and a single
  search-and-generate action; submitting an empty query MUST be blocked with
  inline guidance.
- **FR-004**: On submit, the system MUST search for the named song and
  generate a song sheet for the match: lyric lines with chord symbols
  aligned to the lines they accompany; when no chords are initially found, the
  system MUST attempt chord generation via search + model alignment before
  emitting a lyrics-only sheet.
- **FR-005**: Every generated sheet MUST identify the matched song (title and
  performer as found — on a chord-chart hit the chart's own title/performer,
  otherwise the learner's pick; the query text is kept verbatim) and present
  lyrics with aligned chord symbols using standard chord names.
- **FR-006**: When a song name matches several songs, the system MUST show a
  candidate list and generate only after the learner picks one.
- **FR-007**: The generator MUST show a loading indicator during search and
  generation, a no-match state when nothing is found, and an error state
  with a retry action (preserving the input) when search or generation
  fails.
- **FR-008**: Every completed search MUST be stored in history with the song
  query, the matched song identity, the generated sheet, and a timestamp.
- **FR-009**: The history MUST list entries newest first and unbounded,
  paginated 10 per page with previous/next controls and a "Page N of M"
  indicator; selecting an entry MUST open its full song sheet on the
  dedicated sheet page `/courses/ukulele/games/lyrics-chords/{entry_id}`,
  whose breadcrumb is `Courses / Ukulele / Lyrics + Chords / {title}`; each
  entry MUST offer a delete action guarded by an explicit confirmation step,
  removing the entry and its orphaned sheet.
- **FR-010**: Regenerate and delete actions MUST be available from both the
  open sheet view and the history entry, each guarded by the same explicit
  confirmation step (the dialog names the song; Cancel/Escape aborts without
  any request); regenerating MUST re-run the full search-and-generate
  pipeline for the same song and MUST create a NEW history entry pointing at the
  new sheet (regenerate never replaces or deletes; prior entry preserved —
  only the FR-009 delete action removes entries).
- **FR-011**: History MUST persist across visits, stored server-side and
  keyed by a synthetic single-owner identity; no login and no multi-user
  accounts ship in this feature.
- **FR-012**: Every generated sheet MUST reproduce the found song's lyrics
  with aligned chord symbols and attribute the lyric source and the chord
  source separately (`lyrics:` and `chords:` labels, each with a link back
  to its source where the source is external; model-aligned chords MUST be
  labeled `chords: model-generated`); providers are selected at plan time
  through REQUIRED provider research (see Assumptions).
- **FR-013**: Chord symbols in generated sheets MUST use the full vocabulary
  songs require (major, minor, 7ths, sus, dim, aug, and beyond) in standard
  Western notation; every unique song chord MUST appear with a fingering
  diagram in a "Chords in this song" reference rail beside the lyrics —
  curated catalog diagrams for plain major/minor, generated standard-GCEA
  fingerings for extended/altered symbols. Inline symbols MUST NOT navigate
  away; every voiceable inline symbol MUST reveal its diagram in place on
  hover (transient, silent) or on click/tap/keyboard activation (pinned
  until a second activation, Escape, or an outside tap); each activation
  MUST also sound the symbol's displayed uke voicing through the shared
  strum/block chord player; a diagram-unavailable
  indication MUST appear ONLY for symbols no voicing can be computed for
  (which still render as plain text).
- **FR-014**: Every view (generator, candidate list, sheet, history) MUST
  handle loading, empty, and error states: a loading indicator while content
  loads, a friendly empty state when there is nothing to show, and an error
  state with a retry action when loading fails.
- **FR-015**: Opening an unknown generator or history address (unknown or
  malformed `{entry_id}` on the sheet page) MUST show a not-found view
  identifying that the requested content does not exist, with a way back to
  the catalog and the generator.
- **FR-016**: Every generated sheet MUST include a sources list of links to
  other pages providing lyrics/chords for the matched song, including video
  results where available; each link MUST show its provider/label, links MUST
  open outside the app, and the sheet MUST still render when no external
  sources are found.
- **FR-017**: A generated sheet with chords MUST offer a display-only transpose stepper (− / Tr. N / +) shifting every shown chord symbol (inline lyrics + "Chords in this song" rail) by N semitones up or down from the original key (±11 max; ±12 is the identity); accidental spelling MUST follow the transposed tonic — the most-frequent root pitch-class (first-appearance tiebreak) transposed by N: flats for Db/Eb/F/Ab/Bb, sharps for D/E/G/A/B, step direction only for C and F#/Gb (major-key map; minor tonics sharing a pitch class are a known limitation); slash bass notes MUST move with the root; quality tails MUST be preserved verbatim; symbols no voicing can be computed for MUST stay untransposed; the center label MUST reset to the original key; Reset/−3/+3 one-tap shortcut buttons MUST sit beside the stepper with identical display-only semantics (jumps clamp to ±11); transposition MUST NOT persist to history.
- **FR-018**: Each history entry MUST be markable/unmarkable as a favorite
  from its history card and from its sheet page (persisted server-side); the
  history MUST be filterable to favorites only and by a name search matching
  the query, matched title, or performer (case- and accent-insensitive),
  applied server-side so the count and pagination reflect the filtered set.

### Key Entities

- **Owner**: The single synthetic user identity that owns all history; no
  login, no additional users in this feature.
- **Song Query**: The raw song-name text a learner submits for searching.
- **Song Sheet**: A generated result — the matched song identity (title,
  performer), lyric lines, chord symbols aligned to those lines, a chord
  reference (one fingering diagram per unique chord), per-part
  source attribution (lyric source and chord source, each with link-back
  where external), a sources list of outbound links, and the
  generation timestamp.
- **History Entry**: A stored past search owned by the single owner — the
  song query, the matched song identity, a reference to its generated
  sheet, a favorite flag (FR-018), and a timestamp; ordered newest first;
  removable only via the confirmed FR-009 delete.
- **Source Link**: An outbound reference on a sheet — a label/provider name
  plus a link to an external page with lyrics/chords or video for the
  matched song; links open outside the app.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can reach the generator view from the Home
  page within 3 selections (course card, then generator card).
- **SC-002**: A submitted song search produces a sheet, candidate list, or
  no-match state within 30 seconds wall-clock in local validation (25 s backend budget is the enforceable proxy).
- **SC-003**: The owner can generate a song sheet for a named song on the first
  attempt without guidance (verified by a single-owner task-based walkthrough
  before release; the 10-user panel is waived for this single-user hobby app).
- **SC-004**: A returning learner can re-open any history entry's full sheet
  within 2 selections from the generator view.
- **SC-005**: In a sample of 10 generated sheets for well-known songs, every
  sheet shows the matched song identity, the per-part source attribution,
  and at least 80% of lyric lines carry chord symbols (a line counts as
  chord-bearing when it carries ≥1 valid full-vocabulary symbol per FR-013);
  lyrics-only sheets count as failing the 80% bar.
- **SC-006**: A history entry created in one visit is still listed and
  re-openable in the next visit.
- **SC-007**: A visitor opening an unknown generator or history address sees
  a not-found page with a working link back to the catalog.
- **SC-008**: In a sample of 10 generated sheets for well-known songs, every
  sheet with available external sources shows a sources list with at least 2
  working outbound links spanning lyrics/chords pages and video results
  where available (video spanning required only when video sourcing is
  provisioned; pages-only pairs count otherwise; working = target returns
  HTTP 200 or manual click-through resolves, incl. YouTube watch pages).

## Assumptions

- The generator is the Ukulele course's first Game-kind card (interactive
  activity per the catalog taxonomy); its slug derives from its title and
  its address follows the established course-games pattern.
- Multiple song matches resolve through a learner-picked candidate list;
  the system never auto-generates for an ambiguous match.
- Regenerate means a full search-and-generate pipeline re-run for the same song;
  the new sheet MAY differ from the previous one.
- Chord names follow standard Western notation; chord diagrams assume
  standard ukulele tuning (G-C-E-A).
- The app is a private single-user hobby app for personal use; browsing,
  searching, generating, and history are available without login, and all
  history belongs to the synthetic single-owner identity.
- The owner provisions all required provider credentials (chord fallback,
  video links, rich candidates); defined degraded states apply when any is
  unavailable.
- Backend generation runs under a 25 s pipeline deadline inside the 30 s
  SC-002 envelope; per-stage timeouts short-circuit per Edge Cases.
- Plan-phase provider research is REQUIRED: the plan MUST evaluate public
  song-data (lyrics and chords) providers for coverage, reliability, rate
  limits, licensing/terms fit for private personal use, and history-storage
  compatibility (whether retrieved content may be persisted) in research.md
  and recommend a sourcing strategy before tasks.
- Generated sheets are for personal practice only; no redistribution,
  publishing, or sharing of retrieved song content ships in this feature.
- External source links open outside the app; their availability and content
  are not controlled by the app, and embedded playback of linked video or
  audio does not ship in this feature.
- User interface copy is in English for this feature; localization is out of
  scope.
- Visitors access the app with a modern browser and network connectivity;
  offline use is out of scope for this feature.

## Out of Scope *(optional)*

- Additional courses beyond Ukulele; additional generator types beyond
  lyrics with chords.
- Audio playback, recording, tuner, strumming-pattern features, or embedded
  playback of linked video/audio (sources link out; nothing plays inline).
- Capo settings or alternate tunings (display-only transpose stepper ships per FR-017; no persistent transposed key).
- Printing, exporting, sharing, or publishing generated sheets.
- Login, multi-user accounts, saved progress, or favorites beyond the
  single-owner search history.
- Catalog-wide search across courses, topics, and games.
- Content authoring, editing, or moderation interfaces.
- Native mobile apps; the app is used through a web browser.
- Accessibility targets beyond standard semantic markup and keyboard
  operability of input, cards, lists, and history (to be detailed at plan
  time).
