# Feature Specification: Music Course Catalog (Ukulele + Chords)

**Feature Branch**: `001-music-course-catalog`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "Ok. this app, is a catalog of Courses for Music ideally. We are going to start with Ukulele Course. Home page: List or Catalog of courses as a list of Cards. Course Page: this provide a list of Topics, Games, etc as Cards too. The first course will be Ukulele and the first Topic will be chords: In this game I want to show the list of chords: in a dropdown we can select Major chords, minor, or select a Note: A, B, C, D, or its flat (bemol)."

## Clarifications

### Session 2026-09-15

- Q: Should the Chords topic ship as a browsable reference list, a scored game, or both in this feature? → A: Browsable/filterable chord reference only; a game mode ships only when its scoring rules are specified.
- Q: What happens when a learner selects a chord entry — detail display only, or also an audio preview? → A: Detail display only ships in this feature; audio preview is deferred pending REQUIRED plan-phase research that evaluates playback options and recommends one for future work (no audio ships in v1).
- Q: Which accidental spellings should the note dropdown offer — flats only, sharps only, or both? → A: Both flats and sharps — both spellings appear as filter options (e.g., Bb and A#); each enharmonic pitch shares one combined entry (see entry-identity decision below).
- Q: Which chord types does v1 cover — only major/minor, or also 7ths/dim/aug/sus? → A: Major and minor only. *(Amended by 006, 2026-09-17: major, minor, AND diminished — 36 entries; see 006 DR-001. 7ths/aug/sus remain out of scope.)*
- Q: What happens on an invalid deep link (unknown course/topic address)? → A: Show a not-found (404) page.
- Q: How are courses and topics addressed for linking? → A: Each has a unique human-readable slug derived from its title.
- Q: What distinguishes a Topic from a Game? → A: The kind is explicitly declared per content item, not inferred.
- Q: Should views define loading/empty/error UI states? → A: Yes — every view MUST handle loading, empty, and error states.
- Q: Should enharmonic spellings like Bb and A# be stored as separate chord entries or as a single shared entry? → A: Single shared entry per pitch and type (36 entries total — amended by 006, 2026-09-17: was 24 for major/minor, now × major/minor/diminished); display name combines both spellings flat-first (e.g. "Bb / A# major"); the Bb and A# filter options match the same entry. (UX best practice: no confusing duplicate diagrams, shorter mobile list.)
- Q: What is the canonical chord display-name format? → A: "{root} major" / "{root} minor" / "{root} diminished" with lowercase type (e.g. "C major", "B diminished" — diminished added by 006, 2026-09-17); enharmonic pitches combine spellings flat-first (e.g. "Bb / A# major"). (UX best practice: explicit type word for beginners.)
- Q: How is the chord detail display presented — modal dialog, inline expansion, or separate route? → A: Inline in-place expansion — only one entry expanded at a time, selecting it again collapses it; keyboard-operable with expanded state exposed to assistive technology. (UX best practice: preserves list scroll position on mobile, fastest comparison, no focus-trap complexity.)
- Q: What is the default chord list ordering? → A: Alphabetical by display name; major, then minor, then diminished for the same root pitch. (Amended by 006, 2026-09-17: was major-before-minor; UX best practice: alphabetical matches how beginners search.)
- Q: Should the filter dropdown be a flat list or grouped? → A: Grouped — "All chords" / by type (Major, Minor, Diminished — Diminished added by 006, 2026-09-17) / by note (naturals, flats, sharps) — so ~21 options stay scannable on desktop and mobile.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse the course catalog (Priority: P1)

A visitor opens the app's Home page and sees all available music courses
displayed as cards. Each card shows the course at a glance, and selecting a
card takes the visitor to that course's page.

**Why this priority**: The catalog Home page is the entry point of the entire
app. Nothing else is reachable without it, and it establishes the card-based
pattern every other page reuses.

**Independent Test**: Can be fully tested by opening the Home page and
verifying that course cards are listed and that selecting one navigates to
the corresponding course page. Delivers a browsable catalog even with a
single course.

**Acceptance Scenarios**:

1. **Given** the catalog contains at least one course, **When** a visitor
   opens the Home page, **Then** every course is shown as a card with its
   title, a short description, and a clear entry action.
2. **Given** a visitor on the Home page, **When** they select the Ukulele
   course card, **Then** they are taken to the Ukulele course page.

---

### User Story 2 - Explore a course's topics and games (Priority: P2)

A visitor on a course page (e.g., Ukulele) sees the course's Topics and Games
listed as cards, clearly distinguished by kind. Selecting a card opens that
topic or game.

**Why this priority**: The course page is the second level of navigation and
the container for all learning content. It depends on the catalog for reach
but defines how every course's content is discovered.

**Independent Test**: Can be fully tested by opening a course page directly
and verifying that its Topics and Games appear as cards and that selecting
the Chords card opens the Chords view. Delivers course content discovery.

**Acceptance Scenarios**:

1. **Given** a visitor on the Ukulele course page, **When** the page loads,
   **Then** the course title is shown along with one card per Topic and Game,
   each card labeled with its kind (Topic vs Game).
2. **Given** a visitor on the Ukulele course page, **When** they select the
   Chords topic card, **Then** the Chords view opens.

---

### User Story 3 - Filter chords by type or note (Priority: P3)

A learner in the Chords view sees a list of ukulele chords and a dropdown
filter. Using the dropdown, they can narrow the list to Major chords, Minor
chords, Diminished chords (added by 006), or chords rooted on a specific
note (A, B, C, D, E, F, G, including flat and sharp variants such as Bb
and F#), and the list updates to show only matching chords.

**Why this priority**: The Chords explorer is the first real learning content
and the flagship interactive feature of the Ukulele course. It builds on the
navigation skeleton (Stories 1-2) and proves the Topic pattern end to end.

**Independent Test**: Can be fully tested by opening the Chords view directly,
choosing each dropdown option, and verifying the list shows only matching
chords. Delivers a usable chord reference even before other topics exist.

**Acceptance Scenarios**:

1. **Given** a learner in the Chords view, **When** they select "Major" in
   the dropdown, **Then** only major chords are listed.
2. **Given** a learner in the Chords view, **When** they select "Minor" in
   the dropdown, **Then** only minor chords are listed.
3. **Given** a learner in the Chords view, **When** they select
   "Diminished" in the dropdown, **Then** only diminished chords are
   listed (added by 006 — exactly 12 entries).
4. **Given** a learner in the Chords view, **When** they select a note
   (e.g., "C", "Bb", or "F#"), **Then** only chords for that pitch are
   listed (selecting "Bb" and selecting "A#" show the same combined
   "Bb / A#" entries).
5. **Given** a filtered chord list, **When** the learner changes the dropdown
   back to show everything, **Then** the full chord list is restored.
6. **Given** a learner in the Chords view, **When** they select a chord
   entry, **Then** that entry expands in place showing the chord's name,
   type, root note, and diagram.

---

### Edge Cases

- What happens when the catalog contains no courses yet? The Home page MUST
  show a friendly empty state explaining that no courses are available, rather
  than a blank page or an error.
- What happens when a course has no Topics or Games yet? The course page MUST
  show the course title plus an empty state for its content list.
- What happens when a filter selection matches zero chords? The Chords view
  MUST show a "no matching chords" message and offer a way back to the full
  list (e.g., resetting the dropdown).
- How does the system handle a chord entry missing its diagram data? The entry
  MUST still appear with its name and a placeholder indicating the diagram is
  unavailable, rather than breaking the list.
- What happens when the chord list is long? The learner MUST be able to browse
  through the entire list (e.g., via scrolling) without entries being cut off
  or unreachable.
- What happens when a visitor opens an unknown course or topic address? The
  app MUST show a not-found page identifying that the requested content does
  not exist, with a way back to the catalog.
- What happens while content is loading or fails to load? Every view MUST
  show a loading indicator while loading and an error state with a retry
  action when loading fails.
- What happens when a content entry references a missing parent (e.g., a
  topic naming a course slug that does not exist)? The build MUST fail with
  a message identifying the broken entry — dangling references MUST NOT
  ship as runtime 404s.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Home page MUST display every available course as a card
  showing at minimum the course title, a short description, and an entry
  action that opens the course.
- **FR-002**: Selecting a course card MUST take the visitor to that course's
  page.
- **FR-003**: A course page MUST display the course title and one card per
  Topic and Game it contains, with each card indicating its explicitly
  declared kind (Topic vs Game) plus a title and short description.
- **FR-004**: Selecting a Topic or Game card MUST open the corresponding
  topic or game view.
- **FR-005**: The catalog MUST ship with a "Ukulele" course as its first
  course.
- **FR-006**: The Ukulele course MUST ship with a "Chords" topic as its first
  topic.
- **FR-007**: The Chords view MUST display a list of ukulele chords (major,
  minor, and diminished chords — 36 entries; amended by 006, superseding
  the "major and minor only" scope) where each entry shows the chord
  name and its fingering diagram.
- **FR-008**: The Chords view MUST provide a dropdown filter offering at
  minimum the options "All chords", "Major", "Minor", "Diminished"
  (added by 006), and per-note selection for the natural notes A through G
  plus both flat and sharp variants (enharmonic spellings such as Bb and A#
  both appear as options, and each matches the combined entry for its
  pitch). Options MUST be grouped — all / by type / by note (naturals,
  flats, sharps) — so the list stays scannable on desktop and mobile.
- **FR-009**: Changing the dropdown selection MUST immediately update the
  visible chord list to show only matching entries, and selecting "All
  chords" MUST restore the full list (FR-017 default order).
- **FR-010**: Selecting a chord entry MUST expand a detail display in place
  within the list — only one entry expanded at a time, and selecting the
  expanded entry again collapses it — showing that chord's name, type, root
  note, and diagram. The expanded/collapsed state MUST be keyboard-operable
  and exposed to assistive technology. Audio preview MUST NOT ship in
  this feature; it is deferred pending REQUIRED plan-phase research (see
  Assumptions) that evaluates playback options and recommends one for future
  work.
- **FR-011**: The Chords topic MUST be a browsable/filterable chord reference
  (list plus dropdown filter). Scored quiz or practice game modes are out of
  scope for this feature.
- **FR-012**: The catalog, course, and Chords layouts MUST accommodate future
  courses, topics, games, and chords without layout changes (new content
  appears as additional cards or list entries following the same patterns).
- **FR-013**: Empty states MUST be shown (instead of blank pages or errors)
  when there are no courses, when a course has no topics/games, or when a
  filter matches no chords.
- **FR-014**: Opening an unknown course or topic address MUST show a not-found
  page identifying that the requested content does not exist, with a way back
  to the catalog.
- **FR-015**: Every course, topic, and game MUST have a unique human-readable
  slug derived from its title, used as its stable address.
- **FR-016**: Every view (catalog Home, course page, Chords view) MUST handle
  loading, empty, and error states: a loading indicator while content loads, a
  friendly empty state when there is nothing to show, and an error state with
  a retry action when loading fails.
- **FR-017**: The Chords list MUST default to alphabetical order by chord
  display name, with the major chord, then the minor chord, then the
  diminished chord for the same root pitch (diminished tier added by 006).

### Key Entities

- **Course**: A music course (e.g., Ukulele). Has a title, short description,
  cover visual, a unique slug derived from its title, and a collection of
  Topics and Games.
- **Topic**: An instructional unit within a course (e.g., Chords). Has a
  title, short description, an explicitly declared kind ("Topic"), a unique
  slug derived from its title, and its learning content.
- **Game**: An interactive activity within a course. Has a title, short
  description, an explicitly declared kind ("Game"), a unique slug derived
  from its title, and its rules or scoring (no game ships in this feature).
- **Chord**: A ukulele chord entry — exactly one per pitch and type (12
  pitches × major/minor/diminished = 36 entries; amended by 006, was
  24 for major/minor). Has a display name ("{root} major" /
  "{root} minor" / "{root} diminished", e.g. "C major"; enharmonic pitches
  combine both spellings flat-first, e.g. "Bb / A# major"), a type (major,
  minor, or diminished), a root-note spelling plus its enharmonic alias if
  any, and a fingering diagram.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can reach the Chords view from the Home
  page within 3 selections (course card, then topic card).
- **SC-002**: Changing the chord filter dropdown updates the visible list
  within 2 seconds of the selection.
- **SC-003**: 9 out of 10 first-time users can locate a specific chord (e.g.,
  "C major") using the dropdown filter on their first attempt without
  guidance (verified by a task-based check with 10 first-time users before
  release; at least 9 MUST succeed unaided).
- **SC-004**: The Home page layout accommodates at least 20 course cards and
  a course page at least 50 topic/game cards with every card remaining fully
  visible (via scrolling) and selectable.
- **SC-005**: The chord list covers all major, minor, and diminished chords
  for the 12 chromatic root pitches (36 entries — amended by 006, was 24;
  each enharmonic pitch appears once with a combined name such as
  "Bb / A#"); the note filter offers both flat and sharp spellings for
  applicable notes (e.g., Bb and A# both appear, and each matches the
  combined entry); the type filter set to "Diminished" shows exactly 12.
- **SC-006**: A visitor opening an unknown course or topic address sees a
  not-found page with a working link back to the catalog.
- **SC-007**: The Home page, course pages, and Chords view show their primary
  content (cards or chord list) within 2 seconds of navigation on a typical
  broadband or 4G connection.

## Assumptions

- "Mayor chords" is interpreted as Major chords; "bemol" is interpreted as
  flat (b). Chord naming follows standard Western music notation.
- Chord display names use flat-first combined spellings for enharmonic pitches
  ("Bb / A#"), matching the original flat-first request; the note filter still
  offers each spelling separately.
- Chord diagrams assume standard ukulele tuning (G-C-E-A); alternate tunings
  are out of scope for this feature.
- Course, topic, game, and chord content is curated and built in — no
  authoring/CMS interface is part of this feature.
- No user accounts, progress tracking, or personalization in this feature;
  browsing and filtering are available to anonymous visitors.
- User interface copy is in English for this feature; localization is out of
  scope.
- Visitors access the app with a modern browser and network connectivity;
  offline use is out of scope for this feature.
- Slugs are derived from English titles; collision handling for duplicate or
  near-duplicate titles is a plan-time detail.
- Plan-phase audio research is REQUIRED: the plan MUST evaluate chord
  audio-playback options (browser synthesis, sound libraries, hosted providers)
  in research.md and recommend one for future work before tasks; no audio
  implementation ships in this feature.
- Out of scope: additional courses beyond Ukulele, additional Ukulele topics
  beyond Chords, search across the catalog, and social/sharing features.

## Out of Scope *(optional)*

- Additional courses (Guitar, Piano, etc.) — the catalog pattern MUST support
  them later (FR-012), but only Ukulele ships in this feature.
- Additional Ukulele topics/games beyond Chords.
- Scored quiz or practice game modes for Chords — the Chords topic ships as a
  reference only (FR-011).
- User accounts, saved progress, favorites, or streaks.
- Catalog-wide search, sorting options beyond the chord dropdown, and
  recommendations.
- Content authoring, editing, or moderation interfaces.
- Audio playback, recording, or tuner features — chord interaction is
  detail-display only in this feature (FR-010); the plan MUST evaluate audio
  options and recommend one in research.md, but no audio ships in this feature.
- Native mobile apps; the app is used through a web browser.
- Accessibility targets beyond standard semantic markup and keyboard
  operability of cards, dropdown, and list (to be detailed at plan time).
