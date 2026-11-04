# Feature Specification: 2nd-Voice Trainer

**Feature Branch**: `013-second-voice-trainer`

**Created**: 2026-11-02

**Status**: Draft

**Input**: User description: "let's review 2nd voice trainer. I want to make it more practical and less theoretical. first let's remove the theoretical part and include similar 1st voice exercise but for 2nd voice"

## Clarifications

### Session 2026-11-02 (scope decisions taken from repo context, no questions asked)

- Q: Which sections count as "the theoretical part"? → A: Everything in the "AI 2nd voice analyzer" tab that explains harmony instead of telling the learner what to sing: Key, Scale, Diatonic chords, Roman-numeral progression, Special chords, Important cadences, Section-by-section feel. The sections that tell the learner what to sing stay: Recommended second voice (strategy, harmony lanes, Possible Tones by Chord), Note-by-note table, Singing tips.
- Q: Does the backend stop producing the theory fields? → A: No. The analysis schema, stored analyses, and prompt are untouched in this increment: the analysis key and scale still feed the 1st-voice trainer's analysis-key path (008 FR-004). Trimming the prompt to save tokens is a separate cross-app decision.
- Q: Where do the exercises live? → A: Inside the existing "AI 2nd voice analyzer" tab, above the analysis content. The tab label is unchanged.
- Q: Song-specific drills built from the AI note-by-note table? → A: Deferred. This increment mirrors the 1st-voice trainer: deterministic scale-aware drills. The note table's pitches are model-generated text gated by the missing-melody rule (006 FR-010), a different risk class that deserves its own spec.

### Session 2026-11-02 (owner request after trying the running app)

- Q: Should the trainer explain how to use it? → A: Yes. A "How to practice" guide inside the trainer, one click away and collapsed by default so it does not push the exercises down. It explains the practice flow in plain language and names the controls exactly as they are labelled. Nothing new is persisted: the open or closed state is not remembered.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See only what to sing, not the theory (Priority: P1)

A learner opens the "AI 2nd voice analyzer" tab of a song and no longer meets the harmony-analysis block (Key, Scale, Diatonic chords, Roman-numeral progression, Special chords, Important cadences, Section-by-section feel). What remains is practical: the recommended second voice with its harmony lanes and chord-tone table, the note-by-note table, and the singing tips, plus the existing Regenerate / Past analyses controls.

**Why this priority**: It is the owner's first explicit request, it is independently deliverable, and it makes room for the exercises.

**Independent Test**: Open any chord song that has a saved analysis, switch to the analyzer tab, and verify none of the seven removed headings is present while the remaining sections, chord audio, Regenerate, and Past analyses still work.

**Acceptance Scenarios**:

1. **Given** a song with an open analysis, **When** the learner opens the analyzer tab, **Then** none of Key, Scale, Diatonic chords, Roman-numeral progression, Special chords, Important cadences, Section-by-section feel is shown.
2. **Given** the same tab, **When** the learner looks below, **Then** Recommended second voice, Possible Tones by Chord (with chord/note audio and strum/block), Note-by-note table, and Singing tips are shown exactly as before.
3. **Given** a saved analysis, **When** the learner opens the 1st-voice trainer tab, **Then** its scale label still reads "from AI analysis" when the analysis applies at the current transpose (the analysis key is still produced and stored).

---

### User Story 2 - Practice harmony exercises in the song's key (Priority: P1)

The analyzer tab starts with a 2nd-voice trainer: exercises grouped by difficulty (Basic, Intermediate, Advanced, Master) as tabs, each tagged by technique (Parallel, Intervals, Independence). Every exercise shows two lines step by step — the Lead (1st voice) and Your part (2nd voice) — with the interval between them (for example "3rd above"), all built from the song's scale at the current transpose.

**Why this priority**: It is the owner's second explicit request and the core learning value; without it the tab has nothing practical to do.

**Independent Test**: Open a chord song, open the analyzer tab, and verify the trainer lists exercises for all four difficulty tabs in the song's key; move the transpose stepper and verify the notes follow.

**Acceptance Scenarios**:

1. **Given** a song with chords, **When** the learner opens the analyzer tab, **Then** a Basic/Intermediate/Advanced/Master tablist appears with Basic selected and each exercise shows its Lead notes, Your-part notes, and per-step interval in the current key, with a visible scale label naming where the key came from.
2. **Given** the trainer is showing, **When** the learner moves the transpose stepper, **Then** every exercise updates to the new key without leaving the tab.
3. **Given** the AI analysis is still generating, failed, or missing, **When** the learner opens the tab, **Then** the trainer is already usable (key taken from the song's chords).
4. **Given** a minor-key song, **When** the learner reads an exercise, **Then** its intervals follow that key's scale (a "3rd above" is major or minor according to the scale), never a fixed semitone count.

---

### User Story 3 - Hear the exercise and choose what you hear (Priority: P1)

Each exercise has Play and Loop actions with reference audio, plus a "Reference audio" choice — Both voices (default), Your part, Lead only — so the learner can first hear the finished harmony, then learn their own line, then sing it against the lead alone.

**Why this priority**: Reference audio turns the notation into practice; the voice choice is what makes it 2nd-voice practice rather than a repeat of the 1st-voice trainer.

**Independent Test**: Press Play on an exercise with each of the three choices and verify the sounded lines match the choice; press Stop and Escape mid-run and verify prompt halts.

**Acceptance Scenarios**:

1. **Given** "Both voices", **When** the learner presses Play, **Then** the lead and the learner's line sound together step by step at the chosen tempo.
2. **Given** "Your part" or "Lead only", **When** the learner presses Play, **Then** only that line sounds.
3. **Given** a running exercise, **When** the learner presses Stop or Escape, switches tab/difficulty, picks another exercise, or leaves the song, **Then** playback halts promptly and never overlaps another run.
4. **Given** an exercise, **When** the learner presses Loop, **Then** the exercise plays the chosen number of rounds (3, 5, or 6) as one uninterrupted run; changing the count never alters a running loop.
5. **Given** an exercise card, **When** the learner taps a step, **Then** that step's pitch(es) sound according to the voice choice, stopping any running sequence first.
6. **Given** a running exercise, **When** the learner watches the card, **Then** the current step is highlighted and the round/step position is shown.

---

### User Story 4 - Tempo, octave, and remembered settings (Priority: P2)

The trainer uses the same tempo control (slider with presets) and vocal-octave choice as the 1st-voice trainer. The last-used tempo and loop count are remembered and are the same settings the 1st-voice trainer uses.

**Why this priority**: Practice needs slow and fast runs; sharing the settings avoids two competing preferences.

**Independent Test**: Set a tempo and loop count in one trainer, open the other, and verify both show the same values; start a run at a faster tempo and verify it finishes sooner.

**Acceptance Scenarios**:

1. **Given** the trainer, **When** the learner changes tempo, **Then** the next Play/Loop uses it and a running session is not altered.
2. **Given** a tempo and loop count chosen in either trainer, **When** the learner opens the other trainer, **Then** it starts with those values.
3. **Given** the octave choice, **When** the learner changes it, **Then** every sounded pitch of the next run shifts to that octave relative to the tonic.

---

### User Story 5 - Know how to practice (Priority: P2)

A learner who has never used the trainer opens a "How to practice" guide at the top of it. The guide explains, in a few plain steps, how to set the tempo and octave, what each Reference-audio choice plays, how Play, Loop, Stop, and step taps work, how to read a step (Lead, You, interval), and how to move up the levels. It says that the Lead is a practice line in the song's key, not the song's own melody.

**Why this priority**: The owner tried the running app and asked for a "how to" description; the controls (Reference audio, loop rounds, levels) are not self-explanatory to a first-time learner.

**Independent Test**: Open the analyzer tab of a chord song, open the guide, and verify it names each Reference-audio option and each difficulty level as the controls label them; then start an exercise and verify that opening and closing the guide leaves playback untouched.

**Acceptance Scenarios**:

1. **Given** the ready trainer, **When** the learner looks under the scale label, **Then** a "How to practice" disclosure is visible and collapsed.
2. **Given** the collapsed guide, **When** the learner opens it with a pointer or the keyboard, **Then** the steps are shown, and every Reference-audio option and difficulty level is named exactly as its control is labelled.
3. **Given** a running exercise, **When** the learner opens or closes the guide, **Then** playback continues unchanged.

---

### Edge Cases

- No analysis yet, generating, failed, or stale (analysis computed at a different transpose): the trainer still works; its key comes from the analysis only when it applies at the current transpose, otherwise from the song's chords (same rule as 008 FR-004).
- The key cannot be determined: a friendly empty state names the problem and offers a scale picker, never a blank panel.
- Audio is unavailable in the browser: Play/Loop/step previews are disabled with an explanation; exercises still render.
- The learner changes transpose, key, tempo, octave, or voice choice mid-playback: the running session finishes its frozen snapshot or is stopped by the learner; it never morphs or overlaps a new run.
- The learner leaves the tab, switches song, or unmounts the page mid-playback: playback stops and releases audio.
- Lyrics-only songs: the analyzer tab stays hidden (unchanged); the 1st-voice trainer remains the practice surface.
- A lead line that holds one pitch while the learner's line moves (and the reverse) is valid; unison steps sound a single pitch.
- Voices stay step-aligned: both lines of an exercise always have the same number of steps and are scheduled from the same start instant.
- The learner opens or closes the guide while an exercise is playing: the run is unaffected. In the scale-picker and error states there is nothing to practice, so no guide is shown.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The "AI 2nd voice analyzer" tab MUST NOT render Key, Scale, Diatonic chords, Roman-numeral progression, Special chords, Important cadences, or Section-by-section feel. The analysis data model, stored analyses, and generation remain unchanged.
- **FR-002**: The tab MUST keep Regenerate, Past analyses, stale handling, and the practical sections — Recommended second voice (strategy, harmony lanes, Possible Tones by Chord with audio), Note-by-note table, Singing tips — behaving as before.
- **FR-003**: The tab MUST show a 2nd-voice trainer above the analysis content whenever the tab is visible, independent of the analysis state (idle, loading, failed, stale, ready).
- **FR-004**: The trainer MUST determine its scale like the 1st-voice trainer (008 FR-004): analysis key when it applies at the current transpose, otherwise the transposed-tonic heuristic; it MUST show a visible scale label with the source and offer a scale picker when no scale can be determined.
- **FR-005**: Exercises MUST be grouped by difficulty — Basic, Intermediate, Advanced, Master — as a keyboard-operable tablist (arrow-key roving, Basic selected by default), with at least one exercise per group, each tagged by technique (Parallel, Intervals, Independence).
- **FR-006**: Each exercise MUST present an ordered list of steps; each step shows the Lead note, Your-part note, and the interval between them (size and above/below/same). Intervals MUST be diatonic — counted in scale steps of the selected key, so major/minor quality follows the key — never a fixed semitone offset.
- **FR-007**: The catalog MUST include at least: parallel 3rds above, parallel 3rds below, parallel 6ths above, parallel 6ths below, an interval ladder over a held lead, a hold-your-note drill (lead moves, learner's pitch stays), and a crossing-lines drill (contrary motion).
- **FR-008**: Every exercise MUST provide Play (one pass), Loop (3, 5, or 6 rounds as one uninterrupted run), and Stop; each action's own button shows Stop while it is the one running. Starting any run, pressing Stop or Escape, switching difficulty tab, tab, song, or unmounting MUST stop the running session with no new notes later than 250 ms afterwards; at most one session is active.
- **FR-009**: A "Reference audio" control MUST offer Both voices (default), Your part, and Lead only; it applies to the next Play, Loop, or step preview and MUST NOT alter a running session. Both lines of an exercise MUST start at the same instant and advance one step per beat.
- **FR-010**: Every sounded pitch MUST be placed relative to the scale tonic (tonic at the chosen octave; steps above or below carry octave offsets) so lines never drop or jump an octave in keys other than C. The tonic always sounds at the chosen octave, so transposing a song by n semitones MUST shift every sounded pitch class by n modulo 12; the register does not follow absolute transposition (for example, a transpose from B to C keeps the tonic at the chosen octave).
- **FR-011**: The trainer MUST reuse the 1st-voice trainer's tempo control and octave choice, and MUST share its persisted tempo and loop-count settings; changing them MUST NOT alter a running session.
- **FR-012**: During playback the trainer MUST show the current round/step position and highlight the current step of the running exercise.
- **FR-013**: Every step MUST be individually playable (tap to hear that step per the voice choice); a preview MUST stop any running sequence first and MUST NOT start a new sequence.
- **FR-014**: Playback MUST start only from an explicit user gesture and MUST degrade gracefully (disabled controls with explanation) when audio is unavailable.
- **FR-015**: This feature MUST NOT change any backend endpoint, analysis schema, stored analysis, or hosted-model call, and transposition MUST remain display-only.
- **FR-016**: The 1st-voice trainer's behavior MUST be unchanged; any code shared with it MUST be extracted without altering its observable behavior or its test suite.
- **FR-017**: The ready trainer MUST show a "How to practice" guide under the scale label: a keyboard-operable disclosure, collapsed by default, that explains in plain language how to set the tempo and octave, what each Reference-audio option plays, how Play, Loop, Stop (and Escape), and step taps work, how to read a step (Lead, You, interval), and how to move through the difficulty levels. It MUST name every Reference-audio option and difficulty level exactly as the controls label them, MUST state that the Lead is a practice line in the song's key and not the song's melody, and MUST NOT start, stop, or alter playback when opened or closed.

### Key Entities

- **2nd-Voice Exercise**: A practicable harmony pattern — a difficulty, a technique, a title and description, and an ordered list of steps in the selected scale at the current transpose.
- **Step**: One beat of an exercise — the Lead pitch, Your-part pitch (each a scale note plus octave offset), and the diatonic interval between them.
- **Reference Mix**: The learner's choice of what sounds — both voices, only Your part, or only the Lead.
- **Selected Scale at Transpose / Playback Session / Timing Setting**: Reused unchanged from the 1st-voice trainer (008).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Opening the analyzer tab for a song with an analysis shows none of the seven removed headings, and all three practical sections remain.
- **SC-002**: From an open song, a learner reaches a playing 2nd-voice exercise within 2 interactions (open the tab, press Play) — including when no AI analysis exists yet.
- **SC-003**: In a sample of 3 songs at 3 transpose positions each, every exercise's sounded pitch classes equal the untransposed pitch classes shifted by the transpose modulo 12, every exercise's tonic sounds at the chosen octave, and each displayed note matches the displayed key.
- **SC-004**: With each of the three voice choices, the set of lines sent to playback equals the choice (both lines, only Your part, only Lead) for 100% of exercises.
- **SC-005**: No overlapping or leaked playback occurs in a walkthrough covering Play-twice, Stop mid-run, Escape, difficulty-tab switch mid-run, tab switch mid-run, and song change mid-run.
- **SC-006**: The 1st-voice trainer's existing automated tests pass unchanged after its persisted settings move to a shared module and its sequencer gains a multi-pitch entry point.
- **SC-007**: With the guide open, 100% of the Reference-audio options and difficulty levels shown by the trainer are named in it with identical labels, and opening or closing it during a run never stops or restarts the run.

## Assumptions

- The increment is frontend-only: exercises are deterministic patterns over the selected scale; no new endpoints, no hosted model calls, no persisted routines beyond the shared tempo and loop settings.
- The scale-aware drills mirror the 1st-voice trainer's structure; song-specific drills from the AI note table are a follow-up spec.
- The guide is static English text inside the trainer: no new endpoint, dependency, or persistence. Rewording it later is a copy change, not a behavior change.
- Process note (constitution I): `/speckit-clarify` was skipped because the owner's request is unambiguous for this increment and every scoping choice is recorded above; `/speckit-analyze` was skipped because the change is a single frontend increment — spec/plan/tasks consistency is re-checked in the converge step instead.
- Out of scope: renaming the tab, changing the analysis prompt or schema, mic-based pitch feedback, new routes, and history/persistence of exercise runs.
