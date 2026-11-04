# Feature Specification: Rockstar UX Refresh

**Feature Branch**: `007-rockstar-ux-refresh`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Continue with specify, plan and task. Include a modern rockstar design for this app." Context: UX/UI/design audit of the music course catalog (Home catalog, Ukulele course page, Lyrics + Chords game, Chords / Circles / Scales explorers, Harmonic Circles lesson) on desktop (1280px) and mobile (390px) viewports, with recommendations to improve desktop and mobile experience.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Feel a modern rockstar identity (Priority: P1)

A visitor opens any page of the app — catalog home, course page, topic,
game, or lesson — and immediately perceives a modern rockstar identity:
a bold stage-inspired header with the app name and theme control, a
confident headline style, an energetic accent color used sparingly for
key actions and highlights, warm stage imagery or texture that evokes
live music, and a consistent look across every page in both dark and
light appearances.

**Why this priority**: Identity is the first impression and the frame for
every other improvement. Without a coherent visual system, per-page fixes
look like patches. This story delivers the recognizable "rockstar" feel
on its own, even before navigation or layout changes land.

**Independent Test**: Can be fully tested by opening the home page, a
course page, one explorer, the game, and the lesson in both dark and
light appearances and verifying the header, headline style, accent
color, imagery, and theme control are present and consistent. Delivers
a coherent brand even if no layout changes ship.

**Acceptance Scenarios**:

1. **Given** a visitor on any page, **When** the page loads, **Then** a
   header shows the app identity, a theme control, and navigation back
   to the catalog.
2. **Given** a visitor switching appearance, **When** they choose dark,
   light, or system-following appearance, **Then** every page follows
   the choice immediately and remembers it on the next visit.
3. **Given** a visitor on the Ukulele course card, **When** they look at
   the course visual, **Then** they see a ukulele-appropriate visual
   (not an electric-guitar symbol) with the course title and
   description.
4. **Given** a visitor comparing two pages side by side, **When** they
   look at headlines, buttons, cards, and accent highlights, **Then**
   the same type styles, spacing rhythm, and accent usage appear on
   both pages.

---

### User Story 2 - Discover courses and topics on any screen (Priority: P2)

A visitor on the catalog home page or the Ukulele course page quickly
understands what is offered: a welcoming introduction, a balanced grid
of cards with clear titles, descriptions, and kind labels (Topic vs
Game), where selecting anywhere on a card opens its destination. On a
wide screen the grid fills gracefully with no awkward lone-card rows;
on a narrow phone screen the same cards stack in a single readable
column with large comfortable tap areas.

**Why this priority**: Discovery is the app's front door — catalog to
course to topic/game. The audit found dead whitespace on desktop,
small button-only tap targets, and a 3-plus-2 orphan grid. Fixing
discovery unlocks every learning flow beneath it.

**Independent Test**: Can be fully tested by opening the home page and
the course page on a wide desktop viewport and a narrow phone viewport
and verifying the introduction, balanced grid, full-card selection,
and kind labels. Delivers confident browsing even before explorer or
game changes.

**Acceptance Scenarios**:

1. **Given** a visitor on the catalog home page, **When** the page
   loads, **Then** a welcoming introduction plus one card per course is
   shown, each card showing a visual, title, description, and entry
   affordance.
2. **Given** a visitor on the Ukulele course page, **When** the page
   loads, **Then** a course introduction plus one card per topic and
   game is shown, each card labeled with its kind (Topic vs Game).
3. **Given** a visitor on either page, **When** they select anywhere on
   a card (not only its button), **Then** the card's destination opens.
4. **Given** a visitor on a wide desktop viewport, **When** they view
   the course grid, **Then** cards form balanced rows with even spacing
   and no stranded single-card row feeling.
5. **Given** a visitor on a narrow phone viewport (360px wide), **When**
   they view either page, **Then** cards stack in one column with
   comfortable tap areas and no sideways scrolling.

---

### User Story 3 - Start a song without guessing (Priority: P3)

A learner opens the Lyrics + Chords game and, before typing anything,
understands what to do: a clear explanation, example song suggestions
they can select with one tap to generate immediately, and guidance
about what happens next (search, pick the right match when several
songs share a name, then play the sheet). On a wide screen the input
and suggestions share space sensibly with history or tips beside them
rather than a vast empty area; on a phone the input, action, and
suggestions stack in thumb-friendly order.

**Why this priority**: The game page is the app's interactive flagship,
and the audit found it launches into an empty form with an empty lower
two-thirds. Quick-start suggestions turn a blank form into an
invitation and prove the game works in one tap.

**Independent Test**: Can be fully tested by opening the game view with
no prior history on desktop and phone viewports and verifying the
explanation, selectable example songs, and balanced layout appear, and
that selecting an example starts generation. Delivers a welcoming game
even before explorer or lesson changes.

**Acceptance Scenarios**:

1. **Given** a learner opening the game with no history, **When** the
   page loads, **Then** a short explanation plus at least four
   selectable example songs is shown.
2. **Given** a learner viewing the examples, **When** they select one,
   **Then** generation starts for that song as if they had typed and
   submitted it.
3. **Given** a learner on a wide desktop viewport, **When** they view
   the game, **Then** the input area and the history/tips area sit
   side by side with no vast empty region.
4. **Given** a learner on a narrow phone viewport, **When** they view
   the game, **Then** the input, action, and examples stack vertically
   in reading order with comfortable tap areas.
5. **Given** a learner anywhere in the game, **When** they read the
   location trail, **Then** it shows the real course name (for
   example "Courses / Ukulele / Lyrics + Chords"), never a generic
   "Course" placeholder.

---

### User Story 4 - Filter and open reference entries in one tap (Priority: P4)

A learner in the Chords, Circles, or Scales explorer narrows the list
with a single selection: on wide screens the filter choices appear as
a visible row of options with counts (for example "All (36)",
"Major (12)"); on narrow screens the same choices remain reachable
without confusion. Selecting a filter updates the list immediately;
selecting an entry opens its detail (diagram, notes, neck reference);
returning restores the list position and filter.

**Why this priority**: Explorers are the daily practice tool — dozens
of entries filtered constantly. The audit found a two-step dropdown as
the only path on desktop and tall cards with unclear tap behavior.
One-tap filters cut every lookup from two actions to one.

**Independent Test**: Can be fully tested by opening each explorer
directly on desktop and phone viewports, selecting each filter option,
opening one entry, and returning. Delivers faster lookup even before
lesson or fretboard refinements.

**Acceptance Scenarios**:

1. **Given** a learner in any explorer on a wide viewport, **When**
   the page loads, **Then** the filter choices are visible as a row of
   selectable options with entry counts.
2. **Given** a learner in any explorer, **When** they select a filter
   option, **Then** the visible list updates immediately to matching
   entries only, and selecting "All" restores the full list.
3. **Given** a learner viewing an explorer list, **When** they select
   an entry, **Then** its detail opens (diagram and supporting
   information) with a clear way back.
4. **Given** a learner returning from a detail view, **When** they go
   back, **Then** the previous filter and approximate scroll position
   are preserved.
5. **Given** a learner on a narrow phone viewport, **When** they use
   the filter and list, **Then** every control and entry is comfortably
   tappable with no sideways scrolling of the page itself.

---

### User Story 5 - Read lessons and fretboards comfortably on mobile (Priority: P5)

A learner opens the Harmonic Circles lesson or a scale/circle
fretboard view on a phone and reads without strain: the chapter list
collapses into a compact control instead of pushing the lesson far
down; body text stays at a comfortable line length; chord figures and
the wide fretboard view remain legible through sideways panning inside
their own frame (with a hint that more lies to the side) rather than
breaking the page layout; audio and diagram controls are large enough
to tap while holding an instrument.

**Why this priority**: Lessons and fretboards are the deep-study
surfaces where learners spend the most continuous time, often with a
ukulele in hand. The audit found the mobile chapter list dominating
the first screen and 12-fret diagrams shrinking to unreadable size.
Comfort here determines whether practice sessions happen on the phone
at all.

**Independent Test**: Can be fully tested by opening the lesson and one
scale detail plus one circle detail on a 360px-wide viewport and
verifying the collapsed chapter control, readable text, pannable
fretboard with hint, and large media controls. Delivers comfortable
mobile study even as a standalone check.

**Acceptance Scenarios**:

1. **Given** a learner opening the lesson on a narrow phone viewport,
   **When** the page loads, **Then** the chapter list appears as a
   collapsed control (not a full-length list) above the lesson text.
2. **Given** a learner reading the lesson on any viewport, **When**
   they scroll through sections with chord figures, **Then** each
   figure's chord names and diagrams stay legible with no overlap.
3. **Given** a learner viewing a 12-fret neck reference on a narrow
   phone viewport, **When** the diagram loads, **Then** it pans
   sideways inside its own frame with a visible hint, while the page
   itself never scrolls sideways.
4. **Given** a learner holding an instrument, **When** they tap audio
   playback, diagram reveal, or transpose controls, **Then** every
   target is large enough to hit reliably with a thumb.
5. **Given** a learner deep in the lesson, **When** they select a
   chapter link, **Then** the chosen section is indicated in the
   chapter control; live position tracking while scrolling is not required.

---

### Edge Cases

- What happens when only one course exists? The catalog MUST still
  feel welcoming (introduction plus balanced presentation) rather than
  a single card stranded in empty space.
- What happens when a course has an uneven card count (for example 5
  cards in a 3-column grid)? The grid MUST balance gracefully (even
  spacing, no orphaned-feeling row) rather than leaving a jarring gap.
- What happens when the game has no history yet? The page MUST show
  the explanation, example songs, and guidance — never a bare form
  above empty space.
- What happens when a filter matches zero entries? The explorer MUST
  show a friendly "no matches" message with a one-tap path back to
  the full list, preserving the rockstar styling.
- What happens when a chord or scale entry lacks diagram data? The
  entry MUST still render with its name and a styled placeholder, and
  the list MUST NOT break.
- What happens when a learner follows a deep link to an unknown
  course, topic, or game address? The app MUST show a styled not-found
  page identifying the missing content with a way back to the catalog.
- What happens while content loads or fails to load? Every refreshed
  view MUST keep its loading indicator and error-with-retry behavior,
  restyled to the new identity.
- What happens when a learner prefers reduced motion? Decorative
  motion (gradients, glows, transitions) MUST respect that preference
  and render a calm static equivalent.
- What happens when images or decorative textures fail to load? The
  layout MUST remain complete and readable on flat background colors
  alone.
- What happens on a slow connection? Primary content (headings, text,
  navigation, entry points) MUST appear first and stay usable while
  secondary interactivity prepares; the page MUST NOT sit blank
  waiting for everything at once.
- What happens when the learner moves quickly between pages? Each
  destination MUST begin preparing as soon as intent is visible
  (hovering or scrolling a card into view) so navigation feels
  instant rather than loading from zero on every selection.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every page MUST present a shared header showing the app
  identity, a theme control (dark, light, system-following), and
  navigation back to the catalog.
- **FR-002**: The app MUST ship a dark stage-inspired appearance and a
  light appearance sharing one accent color family, one headline
  style, and one spacing rhythm across all pages.
- **FR-003**: The learner's appearance choice MUST apply immediately
  and persist across visits; the system-following option MUST track
  the device preference.
- **FR-004**: Course visuals MUST depict the correct instrument family
  (ukulele-appropriate for the Ukulele course; generic stringed
  visuals MUST NOT misrepresent the course).
- **FR-005**: The catalog home page MUST show a welcoming introduction
  plus one card per course, each card showing a visual, title,
  description, and entry affordance.
- **FR-006**: A course page MUST show a course introduction plus one
  card per topic and game, each card labeled with its explicitly
  declared kind (Topic vs Game), title, and description.
- **FR-007**: Selecting anywhere on a catalog or course card MUST open
  its destination; keyboard users MUST reach and activate every card
  with the same result as pointer users.
- **FR-008**: Card grids MUST balance on wide viewports (even spacing,
  no stranded single-card rows dominating the layout) and stack to a
  single column on narrow phone viewports with no page-level sideways
  scrolling.
- **FR-009**: The Lyrics + Chords game MUST show, before any search, a
  short explanation plus at least four selectable example songs; each
  example MUST start generation for that song on selection.
- **FR-010**: The game layout MUST place input and history/tips side
  by side on wide viewports and stack them (input, action, examples,
  history) on narrow viewports.
- **FR-011**: The game location trail MUST show the real course name
  (for example "Courses / Ukulele / Lyrics + Chords") on every game
  view.
- **FR-012**: Each explorer (Chords, Circles, Scales) MUST present its
  filter choices as a visible one-selection row with entry counts on
  wide viewports, and an equally reachable compact control on narrow
  viewports covering the same options.
- **FR-013**: Changing the filter MUST immediately update the visible
  list to matching entries; the "show everything" option MUST restore
  the full list in its established default order.
- **FR-014**: Selecting an explorer entry MUST open its detail
  (diagram plus supporting information) with a clear labeled way back
  that preserves the previous filter and approximate scroll position.
- **FR-015**: On narrow phone viewports the lesson chapter list MUST
  render as a collapsed control above the lesson text, indicating the
  current section and expanding on demand.
- **FR-016**: Lesson body text MUST stay within a comfortable reading
  measure on all viewports, and chord figures MUST keep names and
  diagrams legible with no overlap at 360px width and above.
- **FR-017**: The 12-fret neck reference MUST pan sideways inside its
  own frame on viewports where it cannot fit, with a visible hint that
  more content lies to the side; the page itself MUST NOT scroll
  sideways.
- **FR-018**: All interactive targets (search input, primary actions,
  cards, filter options, entry rows, audio/diagram/transpose controls)
  MUST be comfortably tappable for thumbs and while holding an
  instrument (no tiny tap-only buttons).
- **FR-019**: Body text and secondary text MUST meet standard
  readability contrast in both appearances; the location trail and
  card descriptions MUST NOT render in low-contrast grey-on-white
  that fails readability checks.
- **FR-020**: Every interactive element MUST show a visible focus
  indicator for keyboard users, and all refreshed controls (cards,
  filters, examples, chapter control, fretboard frame, theme control)
  MUST be fully keyboard-operable with their state exposed to
  assistive technology.
- **FR-021**: Decorative motion and glow effects MUST respect the
  reduced-motion preference by rendering a calm static equivalent.
- **FR-022**: Empty, loading, error-with-retry, and not-found states
  on every refreshed page MUST keep their existing behavior while
  adopting the new visual identity.
- **FR-023**: The refreshed catalog, course, explorer, game, and
  lesson views MUST preserve all existing navigation addresses —
  no established link may break.
- **FR-024**: Every refreshed view MUST prioritize primary content:
  headings, text, imagery placeholders, and navigation render before
  non-essential interactivity, so a learner can read and move on even
  while secondary features are still preparing.
- **FR-025**: Moving between catalog, course, topic, and game views
  MUST feel instant on typical connections: destinations begin
  preparing as soon as the learner shows intent, without waiting for
  the selection itself.
- **FR-026**: Refreshed views MUST NOT visibly jump or shift while
  loading: cards, diagrams, heroes, and lists reserve their space so
  content appears in place — controls and text MUST NOT move under
  the learner's pointer.
- **FR-027**: Decorative imagery and textures MUST NOT delay primary
  content: if art is slow or fails, the page stays complete and
  readable on flat background colors alone.

### Key Entities

- **Visual Theme**: The shared identity across pages — appearance
  options (dark stage-inspired, light, system-following), accent
  color family, headline and body type styles, spacing rhythm,
  imagery/texture direction, and card/button treatments.
- **Discovery Card**: A catalog or course entry point — visual, title,
  description, kind label where applicable (Topic vs Game), and a
  full-surface selection affordance opening its destination.
- **Quick-start Suggestion**: An example song on the game view —
  display title (and performer where known) that starts generation
  for that song when selected.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 9 out of 10 first-time visitors can name the app's
  purpose (music courses starting with ukulele) and reach the Chords
  explorer from the home page within 3 selections (verified by a
  task-based check with 10 first-time visitors before release; at
  least 9 MUST succeed unaided).
- **SC-002**: A first-time learner can start a song generation from
  the game view within 2 selections of landing there (select an
  example or submit a typed song), including on a phone viewport.
- **SC-003**: Changing any explorer filter updates the visible list
  within 2 seconds and requires exactly 1 selection on wide
  viewports (down from 2 with the previous dropdown-only control).
- **SC-004**: On a 360px-wide viewport, the catalog, course, game,
  explorer, and lesson pages show their primary content with no
  page-level sideways scrolling; the neck reference pans only inside
  its own frame.
- **SC-005**: All body text meets 4.5:1 contrast and all large text
  and essential controls meet 3:1 contrast in both dark and light
  appearances (verified by an automated contrast audit before
  release with zero failures on primary flows).
- **SC-006**: Every interactive target on primary flows meets or
  exceeds 44px in its smallest dimension on phone viewports
  (verified by measurement audit; zero undersized primary targets).
- **SC-007**: A keyboard-only user can complete the core journey
  (catalog to course to explorer entry detail and back; game example
  selection; lesson chapter navigation; theme switch) with every
  action reachable and visibly focused and no keyboard trap.
- **SC-008**: The refreshed views show their primary content within
  2 seconds of navigation on a typical broadband or 4G connection,
  matching or beating the pre-refresh baseline.
- **SC-009**: All established navigation addresses continue to
  resolve after the refresh (zero broken deep links across the
  catalog, course, topic, game, and not-found routes).
- **SC-010**: On a mid-tier phone over a 4G connection, the largest
  content element on each primary view appears within 2.5 seconds of
  navigation (verified by measurement before release on every
  refreshed surface).
- **SC-011**: Visible layout movement during load stays at or below a
  0.1 shift score on primary flows — no buttons or text jumping under
  the pointer (verified by measurement before release).
- **SC-012**: Every refreshed view stays responsive while loading and
  interacting: filtering, theme switching, and chapter navigation
  visibly respond within 200 milliseconds of the action (verified by
  measurement before release).

## Assumptions

- The rockstar direction means a modern stage-inspired identity
  (bold display headlines, one energetic accent family, subtle stage
  texture/gradient, instrument-appropriate imagery) — not a parody
  or grunge treatment; it stays readable and welcoming for
  beginners.
- Dark stage-inspired appearance is the default; light appearance is
  a full equal citizen, not an afterthought.
- The Ukulele course keeps its current content (Chords, Harmonic
  Circles lesson, Circles, Scales, Lyrics + Chords game); this
  feature refreshes presentation and interaction, not curriculum.
- Example songs on the game view are well-known ukulele-friendly
  songs already generatable by the existing pipeline; no new
  song-data sourcing is part of this feature.
- Filter option sets and default orderings stay as currently
  specified (all / by type / by note groupings with combined
  enharmonic entries); this feature changes their presentation to
  one-tap options, not their semantics.
- No user accounts, progress tracking, or personalization ship in
  this feature; appearance choice is stored on the device only.
- Interface copy stays in English; localization is out of scope.
- Visitors use a modern browser with network connectivity; offline
  use is out of scope.
- Performance budgets (SC-008, SC-010–SC-012) are measured on a
  mid-tier phone over simulated 4G and on desktop over broadband,
  across all five refreshed surfaces in both appearances.
- No new heavy third-party libraries ship for the refresh; visual
  richness comes from styling and lightweight vector art, not
  downloads that compete with primary content.
- `/speckit-clarify` is skipped: the audit evidence plus the owner's
  explicit "modern rockstar" direction resolve the material
  ambiguities, and remaining presentation details are plan-time
  design decisions. `/speckit-analyze` before implement SHOULD run
  unless the converge review explicitly justifies skipping it.

## Out of Scope *(optional)*

- New courses, topics, games, chords, scales, circles, or lesson
  chapters — content catalog is unchanged.
- Changes to song generation, second-voice analysis, history
  persistence, or any backend behavior — presentation only.
- Audio engine changes (new voices, effects, tuner, recording) —
  existing playback controls are restyled and enlarged, not rebuilt.
- Catalog-wide search, sorting beyond established filter semantics,
  recommendations, or social/sharing features.
- Content authoring, editing, or moderation interfaces.
- Native mobile apps; the app remains a web app used through a
  browser.
- Full motion-design system (animated page transitions, scroll
  cinematics) beyond tasteful hover/focus transitions and
  reduced-motion-safe accents.
- Server- or hosting-level tuning (caching headers, edge rendering,
  CDN configuration) — the budgets cover app behavior, not the
  hosting layer.
