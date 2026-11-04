# Feature Specification: Ukulele Harmonic Circles Topic

**Feature Branch**: `003-ukulele-harmonic-circles`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "introduce a new topic in ukulele course 'armonic circles', write this new topic as if it was Book material."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover and open the Harmonic Circles topic (Priority: P1)

A visitor on the Ukulele course page sees a "Harmonic Circles" topic card
next to the Chords card. Selecting the card opens the Harmonic Circles
lesson view.

**Why this priority**: Discovery is the entry point of the feature. Without
the course-page card and its navigation, the lesson exists but is
unreachable — this story wires the new topic into the established
catalog → course → topic journey.

**Independent Test**: Can be fully tested by opening the Ukulele course page
directly and verifying that the Harmonic Circles card appears labeled as a
Topic and that selecting it opens the lesson view showing the lesson title.
Delivers topic discoverability even before the full lesson prose is judged.

**Acceptance Scenarios**:

1. **Given** a visitor on the Ukulele course page, **When** the page loads,
   **Then** a "Harmonic Circles" card labeled as a Topic appears alongside
   the Chords card, ordered after it.
2. **Given** a visitor on the Ukulele course page, **When** they select the
   Harmonic Circles card, **Then** the Harmonic Circles lesson view opens
   showing the lesson title and its content.

---

### User Story 2 - Read the lesson as book material (Priority: P2)

A learner in the Harmonic Circles lesson view reads a method-book-style
chapter: an introduction plus headed sections explaining what harmonic
circles are, the essential circles for ukulele with their chord sequences
and scale-degree context, how to practice them cleanly, and how to recognize
them in songs — written as continuous instructional prose, not as raw data
or bare lists.

**Why this priority**: The lesson prose is the core learning value of the
feature. It builds on discovery (Story 1) and proves the topic pattern
beyond the Chords reference: topics can also teach through long-form reading.

**Independent Test**: Can be fully tested by opening the lesson view
directly and verifying that the introduction and every headed section
render in reading order as continuous prose. Delivers a readable chapter
even before progression diagrams are judged.

**Acceptance Scenarios**:

1. **Given** a learner in the Harmonic Circles lesson view, **When** the
   view loads, **Then** the lesson title, an introduction, and at least
   four headed sections plus a closing summary render in reading order.
2. **Given** a learner reading any section, **When** they read through it,
   **Then** the text flows as continuous instructional prose (full
   sentences and paragraphs carrying the explanation).
3. **Given** a learner on a narrow mobile viewport (360px wide), **When**
   they read the lesson, **Then** all sections remain reachable by vertical
   scrolling with no horizontal scrolling and section headings intact.
4. **Given** a learner in the lesson view, **When** they use the in-chapter
   index, **Then** entries for the introduction, every section in order,
   and the summary link to matching anchors, and every anchor resolves.

---

### User Story 3 - Play along with progression diagrams (Priority: P3)

A learner at a chord progression inside the lesson sees every chord with
its name and fingering diagram inline, so they can fret and strum the
circle without leaving the page or looking chords up elsewhere.

**Why this priority**: Diagrams turn reading into playing — the moment the
lesson becomes a practice tool. It builds on the readable chapter
(Story 2) and reuses the trusted Chords reference so fingerings stay
consistent across the course.

**Independent Test**: Can be fully tested by opening the lesson view
directly, locating each progression, and verifying that every named chord
shows its name plus a fingering diagram matching that chord's entry in the
Chords reference. Delivers playable progressions even as a standalone check.

**Acceptance Scenarios**:

1. **Given** a learner viewing a progression in the lesson, **When** the
   progression is displayed, **Then** every chord in it shows its name and
   its fingering diagram inline.
2. **Given** the inline diagrams, **When** compared against the Chords
   reference, **Then** each diagram matches that chord's reference diagram.
3. **Given** the full lesson, **When** the progressions are counted,
   **Then** at least three complete harmonic circles are present (for
   example in all twelve major keys: C, G, F, Bb, D, A, Eb, Ab, E,
   B, Db, and F#).

---

### User Story 4 - Browse all circles with a type/note filter (Priority: P2)

*(Amended by 006, 2026-09-17: was "Browse all circles with a key filter" — key-only dropdown and inline expansion superseded; see FR-012/FR-013.)*

A learner on the Ukulele course page sees a "Circles" topic card next to
the lesson card. Selecting it opens a circles explorer listing every
harmonic circle taught in the course, with a grouped dropdown to filter by
type (Major, Minor) or note (A–G plus flat and sharp spellings, enharmonic
spellings matching the same circles) and a full-width focus view showing
the circle's chords plus all seven diatonic chords with fingering diagrams
and a 12-fret neck reference — the same browse pattern as the Scales topic.

**Why this priority**: The explorer turns the lesson's circles into a
quick lookup tool: find a circle by key and play it without re-reading
the chapter. It is a follow-up increment ordered after the lesson
stories (US1–US3) and reuses their content as its single source.

**Independent Test**: Can be fully tested by opening the explorer view
directly and verifying that every lesson circle is listed, that the
grouped filter narrows to exactly the chosen type or note — with
enharmonic spellings (e.g. "Gb" and "F#") matching the same circles —
(and "All circles" restores all), and that opening a circle shows its
full-width focus view with the progression, all seven diatonic chords
with diagrams matching the Chords reference, and the neck reference.

**Acceptance Scenarios**:

1. **Given** a visitor on the Ukulele course page, **When** the page
   loads, **Then** a "Circles" card labeled as a Topic appears
   alongside the Chords and Harmonic Circles cards, ordered after them.
2. **Given** a visitor on the Ukulele course page, **When** they select
   the Circles card, **Then** the circles explorer opens showing every
   harmonic circle from the lesson with its name, key, scale degrees,
   and chord names.
3. **Given** a learner in the explorer, **When** they pick a type
   ("Major", "Minor") or a note (e.g. "Gb" or "F#") in the grouped
   dropdown, **Then** only matching circles are shown — enharmonic
   spellings list identical results; picking "All circles" restores
   the full list.
4. **Given** a learner viewing a circle, **When** they open it, **Then**
   a full-width focus view shows the progression, all seven diatonic
   chords (each with its name and fingering diagram matching the
   Chords reference, circle chords marked), and the key's neck
   reference; Back or Escape returns to the list with the filter kept.

---

### Edge Cases

- What happens when the lesson references a chord that has no entry in the
  Chords reference? The content check MUST fail with a message naming the
  broken reference — a diagram-less chord MUST NOT ship.
- What happens when a lesson body is empty or missing? The lesson view
  MUST show a friendly empty state, rather than a blank page or an error.
- What happens when a visitor opens an unknown topic address? The app MUST
  show the existing not-found page with a way back to the catalog (no
  regression from catalog behavior).
- What happens while the lesson is loading or fails to load? The view MUST
  show a loading indicator while loading and an error state with a retry
  action when loading fails, consistent with every other view.
- What happens when the lesson is long? The learner MUST be able to read
  through the entire chapter (e.g., via scrolling) without sections being
  cut off or unreachable, on desktop and mobile viewports.
- What happens when the explorer has no circles to show (no lesson
  progressions, or a filter matching nothing)? The view MUST show a
  friendly empty state with a way back to the full list, never a blank
  page or an error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Ukulele course page MUST show a "Harmonic Circles" card
  labeled with the Topic kind alongside the Chords card, ordered after it.
- **FR-002**: Selecting the Harmonic Circles card MUST open the Harmonic
  Circles lesson view at the topic's stable human-readable address.
- **FR-003**: The lesson view MUST present the topic as structured book
  material: a lesson title, an introduction, at least four headed sections
  covering the concept, the essential circles, practice technique, and
  using circles in songs, plus a closing summary.
- **FR-004**: The lesson MUST teach at least three complete harmonic
  circles in the Spanish-pedagogy "circulos armonicos" sense — per-key
  repeating chord cycles (for example circle of C: C–Am–F–G as I–vi–IV–V;
  circle of G: G–Em–C–D; circle of F: F–Dm–Bb–C; circle of Bb:
  Bb–Gm–Eb–F; circle of D: D–Bm–G–A; circle of A: A–F#m–D–E;
  circle of Eb: Eb–Cm–Ab–Bb; circle of Ab: Ab–Fm–Db–Eb; circle of E:
  E–C#m–A–B; circle of B: B–G#m–E–F#; circle of Db: Db–Bbm–Gb–Ab;
  circle of F#: F#–D#m–B–C#), each giving its chords
  in playing order with scale-degree context. This is NOT the circle of
  fifths: key-relationship diagrams are at most a sidebar mention, never
  the chapter's center.
- **FR-005**: Every chord named inside a progression MUST display its name
  and its fingering diagram inline, matching that chord's entry in the
  Chords reference.
- **FR-006**: The lesson prose MUST read as continuous instructional text
  in the style of a method-book chapter, in English, assuming standard
  ukulele tuning.
- **FR-007**: The lesson content MUST be curated and built in — no
  authoring or editing interface is part of this feature.
- **FR-008**: Every chord reference in the lesson MUST resolve to an
  existing Chords reference entry; any dangling reference MUST fail the
  content check with a message naming the broken reference and MUST NOT ship.
- **FR-009**: The lesson view MUST handle loading, empty, and error states:
  a loading indicator while content loads, a friendly empty state when
  there is nothing to show, and an error state with a retry action when
  loading fails.
- **FR-010**: Opening an unknown topic address MUST show the not-found page
  identifying that the requested content does not exist, with a way back
  to the catalog.
- **FR-012**: The Ukulele course page MUST show a "Circles" card labeled
  with the Topic kind, ordered after the Harmonic Circles card; selecting
  it MUST open the circles explorer at the topic's stable human-readable
  address. The explorer MUST list every harmonic circle taught in the
  course's lessons (name, key, key type, scale degrees, chord names) and
  MUST offer a grouped dropdown filter — "All circles", by type ("Major",
  "Minor"), and by note (naturals A–G plus flat and sharp spellings) —
  mirroring the Scales view; enharmonic spellings MUST match the same
  circles. Filtering MUST show exactly the matching circles.
  *(Amended by 006, 2026-09-17: supersedes the key-only dropdown — one
  option per key present — with the grouped All/by-type/by-note filter.)*
- **FR-013**: Selecting a circle in the explorer MUST open a full-width
  focus view for that circle — hiding the list and filter — showing the
  circle's name, key, degrees, and chords, the key's scale notes, a
  diatonic-chord table with all seven triads (each with degree, name, and
  fingering diagram matching the Chords reference, circle chords marked),
  and the key's 12-fret neck reference; a "Back to all circles" button and
  the Escape key MUST return to the list with the prior filter preserved.
  The explorer MUST handle empty (no circles, or no matches with a reset
  path) and error (message with retry) states, mirroring the Scales
  explorer. *(Amended by 006, 2026-09-17: supersedes inline single-open
  expansion.)*
- **FR-011**: The lesson view MUST include an in-chapter index listing the
  introduction, every section heading in reading order, and the summary;
  each entry MUST link to a matching anchor id in the chapter, and every
  anchor MUST resolve. On viewports at or above the large breakpoint the
  index MUST present as a sticky side block; on narrower viewports it MUST
  stack above the article with no horizontal scrolling.

### Key Entities

- **Topic**: An instructional unit within a course (established concept).
  This feature adds two entries under the Ukulele course: "Harmonic
  Circles" (the lesson chapter) and "Circles" (the circles explorer),
  each with a title, short description, the explicitly declared Topic
  kind, and a stable human-readable address.
- **LessonSection**: A headed unit of the lesson chapter — a heading plus
  instructional prose paragraphs, optionally followed by progression
  examples. The chapter is an ordered sequence of sections.
- **HarmonicCircle**: A per-key repeating chord cycle in the
  Spanish-pedagogy "circulos armonicos" sense (for example circle of C:
  C–Am–F–G as I–vi–IV–V) — NOT the circle of fifths. Taught with its
  chords in playing order and scale-degree labels.
- **ChordReference**: A chord named inside a progression, resolved to its
  Chords reference entry so its display name and fingering diagram render
  inline in the lesson.
- **ExplorerCircle**: A lesson progression surfaced in the circles
  explorer (derived, not stored): name, key (pitch plus both spellings
  where applicable), key type (major or minor), scale degrees, and chord
  names with their resolved Chords reference entries — plus its derived
  diatonic chord set and scale notes shown in the full-width focus view.
  *(Amended by 006, 2026-09-17: was name/key/degrees/chords for inline
  diagrams.)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can reach the Harmonic Circles lesson
  from the Home page within 3 selections (course card, then topic card).
- **SC-002**: The lesson view shows its full content within 2 seconds of
  navigation on a typical broadband or 4G connection.
- **SC-003**: The lesson contains at least three complete harmonic
  circles, and every chord in every circle displays its name and diagram
  (verified by a content audit before release).
- **SC-004**: Zero dangling chord references — the content check passes
  with every lesson chord reference resolving to the Chords reference.
- **SC-005**: The lesson renders as a single readable column on a 360px-wide
  viewport with no horizontal scrolling and all section headings visible
  in order.
- **SC-006**: 4 out of 5 first-time readers can write down one four-chord
  circle (chords in playing order) after reading the lesson unaided
  (verified by a task-based check with 5 first-time readers before
  release; at least 4 MUST succeed unaided).
- **SC-007**: The explorer lists 100% of the lesson's circles (count
  equality between lesson progressions and explorer entries), and
  filtering by any offered type or note shows exactly the matching
  circles — enharmonic note spellings list identical results (verified
  by the content-integrity test and quickstart V5).
  *(Amended by 006, 2026-09-17: was key-only filtering.)*

## Assumptions

- "armonic circles" is interpreted as Harmonic Circles in the
  Spanish-pedagogy "circulos armonicos" sense: per-key repeating chord
  cycles (circle of C: C–Am–F–G(7) as I–vi–IV–V), NOT the circle of
  fifths. The display title is "Harmonic Circles". The circle of fifths
  appears at most as a sidebar mention, never as the chapter's center.
- A bare topic entry carries only a short description and the topic view
  renders only the chord explorer (showing its empty state when the topic
  has no chords) — so this feature MUST ship the long-form lesson body
  together with its rendered reading view; content without rendering (or
  vice versa) is not a complete increment.
- User interface copy is in English for this feature; localization is out
  of scope (consistent with the catalog feature).
- Chord fingerings assume standard ukulele tuning (G–C–E–A); alternate
  tunings are out of scope.
- All progression chords are major, minor, or diminished chords covered by
  the Chords reference (36 entries since 006 — every major as I/IV/V, every
  minor as vi/ii/iii, every diminished as vii°/ii°). Seventh-chord variants
  sometimes shown in pedagogy (e.g. G7 closing the circle of C) are out of
  scope: the reference holds major/minor/diminished entries only, so the
  lesson references existing entries only and any "7" variant appears at
  most as unnamed prose, never as a diagrammed chord. *(Amended by 006,
  2026-09-17: was major/minor-only, 24 entries, "no new chord vocabulary".)*
- The lesson is a single chapter (roughly a 12–15 minute read), not a
  multi-page book; one topic entry carries the whole chapter.
- Content revision bar (post-implement audit): the chapter targets ~2,900
  words of instructional prose and names at least one real song recording
  to play along with per circle (all twelve major keys), plus hands-on practice
  drills (slow-change drill, metronome ladder, one-minute changes, song
  run). Song titles are illustrative play-along examples, not licensed or
  embedded content.
- The explorer derives its circles from the lesson progressions (single
  source of truth — no separate circles collection); new lesson circles
  appear in the explorer automatically. The dropdown is a grouped
  All/by-type/by-note filter with enharmonic matching (amended by 006;
  was "filters by key only").
- Course, topic, and lesson content is curated and built in — no
  authoring/CMS interface is part of this feature.
- No user accounts, progress tracking, or personalization in this feature;
  reading is available to anonymous visitors.
- `/speckit-clarify` is skipped for this run: the user scoped the run to
  specify → plan → tasks → implement, and no [NEEDS CLARIFICATION] remains
  — the defaults above (term spelling, English copy, standard tuning,
  major/minor/diminished vocabulary (amended by 006; was major/minor-only),
  single-chapter length) resolve the
  ambiguity, and the feature follows the established catalog/topic
  patterns with no new roles, permissions, or integrations.
- `/speckit-analyze` runs lightweight before implement (read-only
  consistency check across spec/plan/tasks); its summary is recorded in
  the PR, and any CRITICAL finding blocks implementation until resolved.

## Out of Scope *(optional)*

- Audio playback, previews, recording, or tuner features.
- The circle of fifths as taught content (key-relationship wheel); at
- Seventh and extended chords (G7, Cmaj7, etc.) as diagrammed lesson
  chords — the lesson references existing major/minor/diminished entries
  only (amended by 006; was major/minor).
- Interactive practice tools (transposer, auto-scroll player, strumming
- Additional topics, games, or courses beyond Harmonic Circles and
  Circles. *(Amended by 006, 2026-09-17: the "no changes to the existing
  Chords reference content" clause is dropped — 006 grew the reference
  to 36 entries with diminished triads.)*
- User accounts, saved progress, favorites, streaks, or sharing.
- Catalog-wide search, sorting, or recommendations.
- Content authoring, editing, or moderation interfaces.
- Native mobile apps; the lesson is read through a web browser.
- Accessibility targets beyond standard semantic markup and keyboard
  operability (to be detailed at plan time).
