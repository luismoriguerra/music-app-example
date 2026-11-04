# Feature Specification: Ukulele Scales Topic

**Feature Branch**: `005-ukulele-scales-topic`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "let's add a new topic in Ukulele Course. Call it 'Scales' — here we are going to teach scale major and minor — and propose how to do it". Pre-spec deliberation produced DR-001–DR-005 (explorer-first single topic, fretboard-chart diagram, 24 enharmonic-combined entries, natural minor only, per-entry conventional note spelling).

## Clarifications

### Session 2026-09-16 (post-implementation, user request)

- Q: When a scale entry is opened, should the other entries stay visible (inline expansion) or should the opened scale take the full view? → A: Full-width focus view — opening a scale hides the list and filter and shows that scale's detail full-width; a "Back to all scales" button and the Escape key return to the list (recorded as DR-006; US3 and FR-006 updated accordingly).
- Q: Should the detail show more than the 1st-position chart? → A: Yes — add a landscape 12-fret neck reference below the chart showing every scale tone across G/C/E/A, with tonics filled and 1st-position notes badged in playing order (recorded as DR-006; FR-011's first-position chart is unchanged).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Discover and open the Scales topic (Priority: P1)

A visitor on the Ukulele course page sees a "Scales" topic card next to the
Chords, Harmonic Circles, and Circles cards. Selecting the card opens the
Scales explorer view.

**Why this priority**: Discovery is the entry point of the feature. Without
the course-page card and its navigation, the explorer exists but is
unreachable — this story wires the new topic into the established
catalog → course → topic journey.

**Independent Test**: Can be fully tested by opening the Ukulele course page
directly and verifying that the Scales card appears labeled as a Topic and
that selecting it opens the explorer view showing the scale list. Delivers
topic discoverability even before filtering or diagrams are judged.

**Acceptance Scenarios**:

1. **Given** a visitor on the Ukulele course page, **When** the page loads,
   **Then** a "Scales" card labeled as a Topic appears alongside the existing
   cards, ordered after them.
2. **Given** a visitor on the Ukulele course page, **When** they select the
   Scales card, **Then** the Scales explorer view opens showing the list of
   scales.

---

### User Story 2 - Filter scales by type or note (Priority: P2)

A learner in the Scales view sees a list of ukulele scales and a dropdown
filter. Using the dropdown, they can narrow the list to Major scales, Minor
scales, or scales rooted on a specific note (A, B, C, D, E, F, G, including
flat and sharp variants such as Bb and F#), and the list updates to show only
matching scales.

**Why this priority**: The filterable explorer is the core learning value of
the feature: find a scale by key and study it. It builds on discovery
(Story 1) and repeats the proven Chords-explorer increment for scales.

**Independent Test**: Can be fully tested by opening the Scales view directly,
choosing each dropdown option, and verifying the list shows only matching
scales. Delivers a usable scale reference even before diagrams are judged.

**Acceptance Scenarios**:

1. **Given** a learner in the Scales view, **When** they select "Major" in
   the dropdown, **Then** only major scales are listed.
2. **Given** a learner in the Scales view, **When** they select "Minor" in
   the dropdown, **Then** only minor scales are listed.
3. **Given** a learner in the Scales view, **When** they select a note
   (e.g., "C", "Bb", or "F#"), **Then** only scales for that pitch are
   listed (selecting "Bb" and selecting "A#" show the same combined
   "Bb / A#" entries).
4. **Given** a filtered scale list, **When** the learner changes the dropdown
   back to show everything, **Then** the full scale list is restored.

---

### User Story 3 - Study a scale's notes and fingering (Priority: P3)

A learner in the Scales view selects a scale entry and it opens in a
full-width focus view, showing the scale's notes in playing order with
scale degrees and the interval pattern, plus a fretboard-chart diagram of
the ukulele fingering with numbered playing order and a landscape 12-fret
neck reference — so they can play the scale without leaving the page.

**Why this priority**: Notes plus fingering turn lookup into practice — the
moment the explorer becomes a playing tool. It builds on the browsable list
(Story 2) and is the feature's instructional payoff.

**Independent Test**: Can be fully tested by opening the Scales view
directly, opening any entry, and verifying that the note sequence, scale
degrees, interval pattern, a numbered fretboard-chart diagram, and a 12-fret
neck reference all render.
Delivers playable scales even as a standalone check.

**Acceptance Scenarios**:

1. **Given** a learner in the Scales view, **When** they select a scale
   entry, **Then** a full-width focus view opens showing the scale's name,
   type, root note, note sequence, scale degrees, interval pattern,
   fingering diagram, and 12-fret neck reference, while the list and
   filter are hidden.
2. **Given** an open scale focus view, **When** the learner activates the
   "Back to all scales" button or presses Escape, **Then** the focus view
   closes and the full scale list is restored.
3. **Given** a learner on a narrow mobile viewport (360px wide), **When**
   they open a scale entry, **Then** the diagram, neck reference, and note
   sequence remain
   fully visible with no horizontal scrolling.

---

### Edge Cases

- What happens when the Scales topic has no scale entries yet? The view MUST
  show a friendly empty state, rather than a blank page or an error.
- What happens when a filter selection matches zero scales? The view MUST
  show a "no matching scales" message and offer a way back to the full
  list (e.g., resetting the dropdown).
- How does the system handle a scale entry missing its diagram data? The entry
  MUST still appear with its name and notes plus a placeholder indicating the
  diagram is unavailable, rather than breaking the list.
- What happens when the scale list is long? The learner MUST be able to browse
  through the entire list (e.g., via scrolling) without entries being cut off
  or unreachable.
- What happens when a visitor opens an unknown topic address? The app MUST
  show the not-found page identifying that the requested content does not
  exist, with a way back to the catalog.
- What happens while content is loading or fails to load? The view MUST
  show a loading indicator while loading and an error state with a retry
  action when loading fails.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The Ukulele course page MUST show a "Scales" card labeled with
  the Topic kind alongside the existing cards, ordered after them.
- **FR-002**: Selecting the Scales card MUST open the Scales explorer view at
  the topic's stable human-readable slug address derived from its title.
- **FR-003**: The Scales view MUST display a list of ukulele scales (major
  and natural minor only for this feature) where each entry shows the scale
  name.
- **FR-004**: The Scales view MUST provide a dropdown filter offering at
  minimum the options "All scales", "Major", "Minor", and per-note selection
  for the natural notes A through G plus both flat and sharp variants
  (enharmonic spellings such as Bb and A# both appear as options, and each
  matches the combined entry for its pitch). Options MUST be grouped — all /
  by type / by note (naturals, flats, sharps) — so the list stays scannable
  on desktop and mobile.
- **FR-005**: Changing the dropdown selection MUST immediately update the
  visible scale list to show only matching entries, and selecting "All
  scales" MUST restore the full list (FR-010 default order).
- **FR-006**: Selecting a scale entry MUST open a full-width focus view for
  that scale — hiding the list and filter — showing the scale's name, type,
  root note, note sequence in playing order, scale degrees, interval
  pattern, fingering diagram, and 12-fret neck reference. A "Back to all
  scales" button and the Escape key MUST return to the list. Opening and
  returning MUST be keyboard-operable and exposed to assistive technology.
- **FR-007**: Scale entries MUST be identified exactly one per pitch and type
  (12 pitches × major/natural-minor = 24 entries). Display names combine both
  spellings flat-first for enharmonic pitches (e.g. "Bb / A# major"), and the
  Bb and A# filter options match the same entry.
- **FR-008**: Note sequences within each entry MUST be spelled from the
  conventional tonic per the Appendix spelling table (e.g. the "Db / C# minor"
  entry shows C# natural minor notes), never from a theoretical key. No entry
  may ship a note sequence containing double-flats or double-sharps.
- **FR-009**: Only natural minor ships in this feature. Harmonic and melodic
  minor variants MUST NOT ship as diagrammed entries; they may appear at most
  as unnamed prose mentions.
- **FR-010**: The Scales list MUST default to alphabetical order by scale
  display name, with the major scale before the minor scale for the same
  root pitch.
- **FR-011**: Each entry's fingering diagram MUST show a one-octave
  first-position fingering as a fretboard chart: four strings, numbered dots
  in playing order, open-string marks where applicable, and a position label.
- **FR-012**: Empty states MUST be shown (instead of blank pages or errors)
  when the topic has no scales or when a filter matches no scales (with a
  reset path back to the full list).
- **FR-013**: Opening an unknown topic address MUST show a not-found page
  identifying that the requested content does not exist, with a way back
  to the catalog.
- **FR-014**: The Scales view MUST handle loading, empty, and error states: a
  loading indicator while content loads, a friendly empty state when there is
  nothing to show, and an error state with a retry action when loading fails.
- **FR-015**: A scale entry missing its diagram data MUST still render with
  its name, notes, and degrees plus a diagram-unavailable placeholder; it
  MUST NOT break the list.

### Key Entities

- **Topic**: An instructional unit within a course (established concept).
  This feature adds one entry under the Ukulele course: "Scales" (the scales
  explorer), with a title, short description, the explicitly declared Topic
  kind, and a stable human-readable address.
- **Scale**: A ukulele scale entry — exactly one per pitch and type (12
  pitches × major/natural-minor = 24 entries). Has a display name ("{root}
  major" / "{root} minor", e.g. "C major"; enharmonic pitches combine both
  spellings flat-first, e.g. "Bb / A# major"), a type (major or minor), a
  root-note spelling plus its enharmonic alias if any, a note sequence in
  playing order spelled from the conventional tonic, scale degrees, an
  interval pattern, and a one-octave first-position fingering.
- **ScaleDiagram**: A scale's fingering visualization — a fretboard chart over
  four strings with numbered positions in playing order, open-string marks,
  and a position label.

### Decision records

| Record                                             | Settles                                                      | Status   |
| -------------------------------------------------- | ------------------------------------------------------------ | -------- |
| [DR-001](decisions/DR-001-scales-topic-shape.md)   | Explorer-first single "Scales" topic; lesson deferred        | Accepted |
| [DR-002](decisions/DR-002-scale-diagram-visual.md) | Fretboard chart for scale fingerings                         | Accepted |
| [DR-003](decisions/DR-003-scale-entry-identity.md) | 24 entries, enharmonic-combined flat-first                   | Accepted |
| [DR-004](decisions/DR-004-minor-scale-scope.md)    | Natural minor only in v1                                     | Accepted |
| [DR-005](decisions/DR-005-scale-note-spelling.md)  | Per-entry conventional note spelling within combined entries | Accepted |
| [DR-006](decisions/DR-006-scale-focus-view-neck-reference.md) | Full-width focus detail + 12-fret neck reference (DR-002 stands) | Accepted |

DR-001–DR-005 decided pre-spec under `004-lyrics-chords-generator` (active feature at the time); moved here when this spec was created. DR-001/DR-003 Evidence/Harder/Confidence corrected pre-push (route dispatch, `format` enum, `scales` collection, validate parallels). DR-006 recorded post-implementation from the 2026-09-16 user request; it complements DR-002 (portrait chart unchanged) rather than superseding it.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A first-time visitor can reach the Scales view from the Home
  page within 3 selections (course card, then topic card).
- **SC-002**: Changing the scale filter dropdown updates the visible list
  within 2 seconds of the selection.
- **SC-003**: 4 out of 5 first-time learners can find the G major scale and
  name its notes from the open scale detail view on their first attempt
  without
  guidance (verified by a task-based check with 5 first-time learners before
  release; at least 4 MUST succeed unaided).
- **SC-004**: The scale list covers all major and natural-minor scales for
  the 12 chromatic root pitches (24 entries; each enharmonic pitch appears
  once with a combined name such as "Bb / A#"); the note filter offers both
  flat and sharp spellings for applicable notes (e.g., Bb and A# both appear,
  and each matches the combined entry).
- **SC-005**: Zero theoretical-key spellings — every entry's note sequence
  matches the Appendix spelling table with no double-flats or double-sharps
  (verified by a content audit before release).
- **SC-006**: A visitor opening an unknown topic address sees a not-found
  page with a working link back to the catalog.
- **SC-007**: The Scales view shows its primary content (scale list) within
  2 seconds of navigation on a typical broadband or 4G connection.
- **SC-008**: An open scale detail view renders its diagram, neck reference,
  and note sequence on a 360px-wide viewport with no horizontal scrolling.

## Assumptions

- "Minor" means natural minor (DR-004); the owner walkthrough confirms
  beginners read unqualified "minor" this way before content authoring starts.
- Scale diagrams assume standard ukulele tuning (G–C–E–A); alternate tunings
  are out of scope for this feature.
- Each entry shows a one-octave first-position fingering (DR-001/DR-002);
  movable multi-position shapes are a later increment.
- Eb minor is spelled with flats (Eb F Gb Ab Bb Cb Db) for flat-side
  consistency with its combined display name; D# minor (6 sharps) is the
  documented alternative if the plan-time music-reference validation
  overturns this default (DR-005 open row).
- Gb major is spelled with flats (Gb Ab Bb Cb Db Eb F); F# major is an
  equally valid enharmonic the plan may substitute with no spec change.
- Scale content is curated and built in — no authoring/CMS interface is part
  of this feature.
- No user accounts, progress tracking, or personalization in this feature;
  browsing and filtering are available to anonymous visitors.
- User interface copy is in English for this feature; localization is out of
  scope.
- Visitors access the app with a modern browser and network connectivity;
  offline use is out of scope for this feature.
- Slugs are derived from English titles; the Scales topic address follows the
  established course-topics pattern.
- Audio preview is deferred: scale interaction is detail-display only in this
  feature (mirrors the 001 FR-010 deferral); no plan-phase audio research is
  required since 001 already covered playback options generically.
- Constitution workflow notes: `/speckit-clarify` is skipped — ambiguity was
  resolved pre-spec through deliberate exploration with five evidence-backed
  decision records (DR-001–DR-005) instead of a clarify session.
  `/speckit-analyze` before implement is deferred to the `/speckit-converge`
  review: the feature is frontend-only content mirroring two shipped
  precedents (001 Chords explorer, 003 Circles explorer) with no new
  cross-artifact contracts.
- Out of scope: additional courses beyond Ukulele, additional Ukulele topics
  beyond Scales, a Scales lesson chapter (DR-001 follow-up), harmonic/melodic
  minor entries, search across the catalog, and social/sharing features.

## Out of Scope _(optional)_

- A Scales lesson chapter (long-form prose teaching scale theory) — the
  DR-001 follow-up increment; this feature ships the explorer only.
- Harmonic and melodic minor scale entries — natural minor only (DR-004).
- Multi-position or movable-shape fingerings — one-octave first-position
  only (DR-001/DR-002).
- Audio playback of scales — detail-display only in this feature.
- Additional courses (Guitar, Piano, etc.) — the catalog pattern MUST support
  them later, but only Ukulele ships in this feature.
- User accounts, saved progress, favorites, or streaks.
- Catalog-wide search, sorting options beyond the scale dropdown, and
  recommendations.
- Content authoring, editing, or moderation interfaces.
- Native mobile apps; the app is used through a web browser.
- Accessibility targets beyond standard semantic markup and keyboard
  operability of cards, dropdown, and list (to be detailed at plan time).

## Appendix: Conventional spelling table _(normative for FR-008)_

Major scales (W–W–H–W–W–W–H), spelled from the entry's flat-side root:

| Entry         | Notes               |
| ------------- | ------------------- |
| C major       | C D E F G A B       |
| Db / C# major | Db Eb F Gb Ab Bb C  |
| D major       | D E F# G A B C#     |
| Eb / D# major | Eb F G Ab Bb C D    |
| E major       | E F# G# A B C# D#   |
| F major       | F G A Bb C D E      |
| Gb / F# major | Gb Ab Bb Cb Db Eb F |
| G major       | G A B C D E F#      |
| Ab / G# major | Ab Bb C Db Eb F G   |
| A major       | A B C# D E F# G#    |
| Bb / A# major | Bb C D Eb F G A     |
| B major       | B C# D# E F# G# A#  |

Natural minor scales (W–H–W–W–H–W–W), spelled from the conventional tonic
(DR-005); combined entries whose flat root would be theoretical use the sharp
spelling:

| Entry         | Spelled as                              | Notes               |
| ------------- | --------------------------------------- | ------------------- |
| A minor       | A                                       | A B C D E F G       |
| B minor       | B                                       | B C# D E F# G A     |
| C minor       | C                                       | C D Eb F G Ab Bb    |
| Db / C# minor | C#                                      | C# D# E F# G# A B   |
| D minor       | D                                       | D E F G A Bb C      |
| Eb / D# minor | Eb (default; D# if reference overturns) | Eb F Gb Ab Bb Cb Db |
| E minor       | E                                       | E F# G A B C D      |
| F minor       | F                                       | F G Ab Bb C Db Eb   |
| Gb / F# minor | F#                                      | F# G# A B C# D E    |
| G minor       | G                                       | G A Bb C D Eb F     |
| Ab / G# minor | G#                                      | G# A# B C# D# E F#  |
| Bb / A# minor | Bb                                      | Bb C Db Eb F Gb Ab  |

Plan MUST validate every row against a music reference before content
authoring; any overturned row updates this table via `/speckit-clarify`
without changing entry identity (DR-003).
