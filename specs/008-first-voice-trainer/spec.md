# Feature Specification: 1st-Voice Trainer Tab

**Feature Branch**: `008-first-voice-trainer`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "When you select a song in the Lyrics + Chords game we have 2 tabs (Sheet, AI 2nd voice). Add a new tab: First voice trainer. This new tab must provide voice exercises for agility, tonality, flexibility following the selected scale in the transpose. The tab must provide a Play button that plays the whole exercise sequence for practice. Also add a timing control to change the reproduction timing."

## Clarifications

### Session 2026-10-01 (loop count dropdown, uke fretboard)

- Q: Let the user choose how many rounds Loop plays, and show the ukulele neck with the exercise's notes for manual play? → A: Yes. A dropdown beside the Loop button offers ×3 (default), ×5, ×6; the choice is shared across exercises and persisted (`trainer.loops`), applies to the next Loop press, and never alters a running loop. Each exercise card ends with a "Show uke fretboard" toggle (collapsed by default) revealing a GCEA 12-fret neck (frets 0–12) marking every position of the exercise's notes, tonic filled.

### Session 2026-09-30 (Loop ×3, Master group, difficulty tabs)

- Q: Add a button that plays the exercise sequence in a loop 3 times, plus 4 more exercises per existing group, a new "Master" group, and switch the difficulty groups to tabs? → A: Yes. Loop ×3 is a second action beside Play on every exercise, its own button flips to Stop while it is the one running (Play and Loop ×3 are independent, mutually-exclusive controls — starting either stops the other). Basic/Intermediate/Advanced each gained 4 new exercises (8 per group); a new "Master" group ships with 8 creative exercises — 32 total. The three-group stacked list became a keyboard-operable tablist (arrow-key roving) so only one group's exercises render at a time; switching groups stops any running playback. Owner request 2026-09-30; updates FR-002, FR-005, FR-006, SC-001, Key Entities.

### Session 2026-09-30 (main tab order)

- Q: How should the song sheet's main tabs be organized? → A: "Lyrics + Chords" (renamed from "Sheet") first, "1st-voice trainer" second, "AI 2nd voice analyzer" (renamed from "AI 2nd voice") third; arrow-key roving follows that order. Lyrics-only sheets show Lyrics + Chords + 1st-voice trainer. Owner request 2026-09-30; updates FR-001 (006 records the analyzer auto-generate change).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Practice scale-aware voice exercises in the song key (Priority: P1)

A learner who opened a song sheet switches to the new "1st-voice trainer" tab and sees voice exercises grouped by difficulty (Basic, Intermediate, Advanced, Master) presented as tabs, each tagged by technique (agility, tonality, flexibility), built from the song's scale at the current transpose setting. Changing the transpose updates the exercises to the new key.

**Why this priority**: This is the core learning value. Without scale-at-transpose exercises, the tab has no reason to exist; playback and timing build on it.

**Independent Test**: Can be fully tested by opening any song with chords, switching to the trainer tab, and verifying exercises for all three categories appear in the transposed key; moving the transpose stepper changes the exercise notes. Delivers practicable exercises even before audio is judged.

**Acceptance Scenarios**:

1. **Given** a learner viewing a song sheet with chords, **When** they select the trainer tab, **Then** a Basic/Intermediate/Advanced/Master tablist appears with Basic active by default; selecting a tab shows that group's exercises (each badged agility/tonality/flexibility), each showing its ordered note sequence in the current transposed key.
2. **Given** a learner on the trainer tab, **When** they move the transpose stepper, **Then** every exercise sequence updates to the new key without leaving the tab.
3. **Given** a learner on the trainer tab, **When** they switch back to Sheet or AI 2nd voice and return, **Then** the trainer state (selected exercise, timing) is preserved.
4. **Given** a lyrics-only song (no chords), **When** the learner opens the sheet, **Then** the trainer tab remains available with a scale fallback and an explanation of the fallback.

---

### User Story 2 - Hear the whole exercise via Play-all (Priority: P2)

A learner on the trainer tab presses Play on an exercise and hears the full note sequence played back in order as a sing-along reference, with visible progress and a way to stop.

**Why this priority**: Reference audio turns notation into practice. It builds on the exercise list (Story 1) and proves the practice loop end to end.

**Independent Test**: Can be fully tested by pressing Play on any exercise and verifying the whole sequence sounds in order, progress is visible, and Stop halts playback. Delivers the practice loop even before timing controls are judged.

**Acceptance Scenarios**:

1. **Given** a learner on the trainer tab, **When** they press Play on an exercise, **Then** the full ordered sequence plays from start to finish without further interaction.
2. **Given** a sequence is playing, **When** the learner watches the exercise, **Then** the current note/position is visibly indicated along with playback state (playing vs idle).
3. **Given** a sequence is playing, **When** the learner presses Stop (or Escape), **Then** playback halts promptly and the exercise returns to idle.
4. **Given** a learner presses Play twice in a row, **When** the second press occurs, **Then** the first playback stops and the sequence restarts (never overlapping).

---

### User Story 3 - Adjust reproduction timing (Priority: P3)

A learner on the trainer tab adjusts the reproduction timing (tempo) so slow practice and performance-tempo run-throughs are both possible; the next Play uses the chosen timing.

**Why this priority**: Timing control turns one fixed demo into a practice instrument. It builds on playback (Story 2) and is the feature's retention value.

**Independent Test**: Can be fully tested by setting a slow tempo, playing an exercise, then setting a fast tempo and playing again, verifying the second run-through completes noticeably faster. Delivers adjustable practice even before polish.

**Acceptance Scenarios**:

1. **Given** a learner on the trainer tab, **When** they view the timing control, **Then** the current tempo is shown with an adjustable control plus quick presets.
2. **Given** a learner sets a slow tempo and presses Play, **When** they set a fast tempo and press Play again, **Then** the second playback completes in less time than the first.
3. **Given** a learner changes the tempo, **When** they reload or switch songs and return, **Then** a sensible default tempo applies (persistence of the exact value is not required for v1).

---

### Edge Cases

- What happens when the song has no chords? The trainer tab MUST still appear with a scale fallback (song-key default or user-picked scale) and MUST explain the fallback; playback still works.
- What happens when the scale cannot be determined? The tab MUST show a friendly empty state naming the missing scale and offering a scale choice, never a blank panel.
- What happens when playback is triggered without audio support? The UI MUST stay usable (buttons disabled with explanation or silent no-op), never crash.
- What happens when the learner changes transpose or scale mid-playback? The running playback MUST finish its frozen snapshot or stop cleanly; it MUST NOT morph mid-sequence or overlap a new run.
- What happens when the learner leaves the tab or song mid-playback? Playback MUST stop and release audio resources; returning shows idle state.
- What happens with unusual input (empty scale, single-note exercise)? The exercise MUST render its notes and Play MUST still complete without error.
- What happens while exercise content loads? Every view MUST show loading/empty/error states with retry where async work occurs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A generated song sheet with chords MUST show three tabs in this order: Lyrics + Chords, 1st-voice trainer, and AI 2nd voice analyzer, with keyboard-operable tab switching and preserved per-tab state across switches. (Amended 2026-09-30: renamed "Sheet" → "Lyrics + Chords" and "AI 2nd voice" → "AI 2nd voice analyzer"; trainer moved to second.)
- **FR-002**: The trainer tab MUST present voice exercises grouped by difficulty — Basic, Intermediate, Advanced, Master — with each exercise tagged by technique (agility, tonality, flexibility) and showing its ordered note sequence derived from the selected scale at the current transpose. Difficulty groups render as a keyboard-operable tablist (arrow-key roving) so only one group's exercises show at a time. (Amended 2026-09-18: grouping moved from technique to difficulty at the learner's request; technique survives as a per-card badge. Amended 2026-09-30: added a fourth "Master" group and 20 more exercises — 32 total, 8 per group; grouping presented as tabs for navigation, replacing the earlier single stacked list.)
- **FR-003**: The trainer tab MUST follow the shared transpose setting: changing transpose MUST update all exercise sequences to the new key; transposition MUST remain display-only and MUST NOT persist to history.
- **FR-004**: The trainer tab MUST determine its scale from the song context (analysis key/scale when available, otherwise the transposed-tonic heuristic) with a visible scale label; when neither is available it MUST offer a scale choice fallback.
- **FR-005**: Every exercise MUST provide a Play action that sounds the full ordered sequence once, plus a Loop ×3 action that sounds the same sequence three times back-to-back as one uninterrupted run; each action's own button shows Stop while it is the one running. A Stop action halts playback promptly (no new notes scheduled later than 250 ms after Stop). Every note in an exercise MUST also be individually playable (tap a note to hear just that pitch); a note preview MUST stop any running sequence first and MUST NOT start a new sequence. (Amended 2026-09-30: added the Loop ×3 action alongside Play.)
- **FR-005a** (amended 2026-10-01): The Loop action MUST offer a round-count choice of 3, 5, or 6 (default 3, remembered across visits); changing it MUST NOT stop or alter a running loop. Every exercise MUST offer a collapsed-by-default toggle that reveals a ukulele (GCEA) neck over frets 0–12 marking every position of the exercise's notes.
- **FR-006**: During playback the exercise MUST visibly indicate progress (current note/position, current repeat for Loop ×3, and playing state); overlapping playbacks MUST NOT occur — pressing Play, pressing Loop ×3, switching the running exercise's own control, picking a different exercise, or switching the difficulty tab MUST stop/replace the running one. Every sounded pitch MUST be placed relative to the scale tonic (tonic at the reference octave, other notes as intervals above it, degree 8 one octave up) so sequences never drop an octave in keys other than C. (Amended 2026-09-30: extended the no-overlap rule to the new Loop ×3 control and to difficulty-tab switches.)
- **FR-007**: The trainer tab MUST provide a reproduction-timing control showing the current tempo with an adjustable control and quick presets; the chosen timing MUST apply to subsequent Play runs.
- **FR-008**: Playback MUST start from an explicit user gesture, MUST respect the browser audio policy, and MUST degrade gracefully (disabled state with explanation) when audio is unavailable.
- **FR-009**: Every trainer view MUST handle loading, empty, and error states: a loading indicator while content loads, a friendly empty state when there is nothing to show, and an error/retry path when loading or playback setup fails.
- **FR-010**: Trainer playback MUST NOT disturb the other tabs: switching tabs or songs MUST stop running playback cleanly (no new notes later than 250 ms after the switch) and MUST NOT leak audio.

### Key Entities

- **Trainer Exercise**: A practicable vocal pattern — a difficulty (basic/intermediate/advanced/master), a technique category (agility/tonality/flexibility), an ordered note sequence in the selected scale at the current transpose, and its Play/Loop×3/Stop state.
- **Selected Scale at Transpose**: The scale (tonic, mode, note names) plus the transpose offset it was derived at; the source of truth for all exercise sequences on the tab.
- **Timing Setting**: The reproduction tempo (beats per minute) plus presets; applies to subsequent Play runs, display-scoped (persistence optional in v1).
- **Playback Session**: One Play or Loop ×3 run — the frozen note snapshot (tripled for Loop ×3), its timing, progress position, repeat count, and idle/playing/stopped state; at most one active per tab.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A learner can reach the trainer tab from an open song sheet within 1 selection and see a tab per difficulty group (Basic/Intermediate/Advanced/Master, 32 total, 8 per group).
- **SC-002**: A learner pressing Play hears the full exercise sequence in order on the first attempt without guidance (verified by a single-owner task-based walkthrough before release).
- **SC-003**: A learner can complete a slow-tempo run and a fast-tempo run of the same exercise, with the fast run finishing in measurably less time, within 3 interactions (set tempo, Play, Play again).
- **SC-004**: In a sample of 5 songs at 3 transpose positions each, every trainer exercise shows note sequences consistent with the displayed transposed key (no stale-key exercises).
- **SC-005**: No overlapping or leaked playback occurs during a walkthrough covering Play-twice, Stop mid-run, tab switch mid-run, and song change mid-run.
- **SC-006**: A learner opening a lyrics-only song still reaches a usable trainer (fallback scale + working Play) within 2 selections from the sheet.

## Assumptions

- The trainer is a frontend-only practice surface in v1: exercises are deterministic patterns over the selected scale; no new backend endpoints, no hosted model calls, no persisted routines.
- The transpose stepper stays shared above the tabs (existing behavior); the trainer never owns transposition.
- The song's scale defaults from the AI analysis when present, else the transposed-tonic heuristic; the conventional spelling table is the source of note names.
- Playback uses the browser audio capability already in the app (Web Audio); all sound starts from explicit user gestures.
- Default tempo is 84 BPM (Slow 60 / Steady 90 / Brisk 120 / Fast 160 / Melisma 200 / Blaze 240 presets, 60–240 slider range; amended 2026-10-01 from 60–140 for melisma practice, each preset shows short practice tips while selected); exact values are fixed in the plan.
- Learners use a modern browser with network connectivity; offline use is out of scope.
- Interface copy is in English; localization is out of scope.

## Out of Scope

- Backend-generated or AI-personalized exercise plans; persisted custom routines or progress tracking.
- Pitch detection / microphone grading of the learner's singing; recording or export of performances.
- Additional trainer categories beyond agility/tonality/flexibility; song-specific melodic dictation.
- Persistent transposed keys, printing/exporting/sharing of exercises.
- Login, multi-user accounts, or synced settings beyond single-owner history.
