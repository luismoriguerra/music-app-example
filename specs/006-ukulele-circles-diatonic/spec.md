# Feature Specification: Ukulele Circles — Diatonic Harmony Focus View

**Feature Branch**: `006-ukulele-circles-diatonic`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "help me update circle type, I want that this topic works similar to 'Courses / Ukulele / Scales' new topic, and circles also include all 'acordes diatonicos'" (with a reference table of the seven diatonic chords of C major: I C · ii Dm · iii Em · IV F · V G · vi Am · vii° Bdim). Pre-spec deliberation (explore session 2026-09-17) settled four scope questions, listed under Clarifications.

## Clarifications

### Session 2026-09-17 (pre-spec explore, user decisions)

- Q: Where does the fingering diagram for the diminished (vii°) chord come from? → A: The Chords reference grows to cover diminished triads for all 12 pitches (36 entries: major, minor, diminished), each with a curated fingering diagram — the same curated-catalog standard as the existing 24. This supersedes the 001 clarification "Major and minor only" and 001 SC-005's 24-entry count; 001 MUST be amended accordingly.
- Q: Where do a circle's seven diatonic chords come from? → A: Derived from the key's conventional scale spelling (the Scales topic's spelling table) plus the fixed major/minor triad-quality pattern — never hand-authored per circle and never stored as a separate circles collection. The lesson's progressions remain the single source of which circles exist.
- Q: How is a selected circle shown? → A: Full-width focus view, mirroring the Scales topic: the list and filter hide, the circle's detail shows full-width with a "Back to all circles" button and Escape return, and includes the key's 12-fret neck reference.
- Q: Major keys only, or major and minor? → A: Both major-key and minor-key circles ship in this feature.

### Session 2026-09-17 (specify validation, user decision)

- Q: How are the minor circles authored? → A: Option B — one canonical minor circle per minor scale key (12 minor circles, e.g. circle of A minor: Am–F–C–G as i–VI–III–VII), each with an authored name and progression, so every Scales minor key has a matching circle (24 circles total across major and minor).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Study a circle's full diatonic harmony (Priority: P1)

A learner in the Circles view selects a circle (for example "Circle in C — the 50s progression") and it opens in a full-width focus view. Besides the circle's own progression (I–vi–IV–V with its chords), the view shows every diatonic chord of that key in scale order — degree, chord name, fingering diagram — with the chords that belong to the circle highlighted, plus the key's scale notes and a landscape 12-fret neck reference of those notes. The learner sees at a glance that C–Am–F–G are four of the seven chords that live in C major, and can play any of the seven from the diagrams.

**Why this priority**: This is the feature's core ask. Today a circle shows only its four chords; learners cannot see the harmonic family the circle is drawn from. Showing all diatonic chords turns the explorer from a lookup card into a harmony reference, and the focus view gives it the room the current inline card lacks.

**Independent Test**: Can be fully tested by opening the Circles view directly, selecting any circle, and verifying that the focus view lists exactly seven diatonic chords in scale order with degree labels, names, and diagrams; that the circle's own chords are marked; that the key's scale notes and neck reference render; and that Back / Escape return to the list. Delivers the harmony reference even before filtering or minor keys are judged.

**Acceptance Scenarios**:

1. **Given** a learner in the Circles view, **When** they select "Circle in C — the 50s progression", **Then** a full-width focus view opens (list and filter hidden) showing the circle's name, key, progression degrees and chords, the key's scale notes, and a diatonic table with exactly seven rows: I C major, ii D minor, iii E minor, IV F major, V G major, vi A minor, vii° B diminished — each with a fingering diagram.
2. **Given** the open C-major focus view, **When** the learner scans the diatonic table, **Then** the rows for C major, A minor, F major, and G major are visibly marked as belonging to the circle and the other three are not.
3. **Given** the open focus view, **When** the learner activates "Back to all circles" or presses Escape, **Then** the focus view closes and the full circle list is restored with the previous filter selection intact.
4. **Given** a learner on a 360px-wide viewport, **When** they open a circle, **Then** the diatonic table, diagrams, and neck reference remain fully visible with no horizontal scrolling.

---

### User Story 2 - Filter circles by type or note (Priority: P2)

A learner in the Circles view uses a grouped dropdown — All circles / by type (Major, Minor) / by note (A–G plus flat and sharp spellings) — to narrow the list, exactly as in the Scales view. Choosing "Db" or "C#" shows the same circle(s) for that pitch.

**Why this priority**: Filter parity with Scales is the second half of "works like Scales". It also removes today's inconsistency where the dropdown offers only the spellings that happen to appear as circle keys (e.g. "F#" but not "Gb").

**Independent Test**: Can be fully tested by opening the Circles view directly, choosing each dropdown option, and verifying the list shows only matching circles; choosing enharmonic partner spellings shows identical results; "All circles" restores the full list.

**Acceptance Scenarios**:

1. **Given** a learner in the Circles view, **When** they select "Major", **Then** only major-key circles are listed; **When** they select "Minor", **Then** only minor-key circles are listed.
2. **Given** a learner in the Circles view, **When** they select "Gb" and then "F#", **Then** both selections list the same circle(s) for that pitch.
3. **Given** a filtered list, **When** the learner selects "All circles", **Then** the full list is restored in default order.
4. **Given** a filter that matches nothing, **When** the list is empty, **Then** a "no matching circles" message with a reset path is shown.

---

### User Story 3 - Diminished chords in the Chords reference (Priority: P3)

A learner in the Chords topic can browse and filter diminished triads (e.g. "B diminished") alongside major and minor chords, each with a fingering diagram, so the vii° (major) and ii° (minor) chords shown in circles are the same curated entries the Chords reference teaches.

**Why this priority**: Enabling increment for Story 1's seventh row and Story 4's second row. Independently valuable: the Chords reference becomes complete for all diatonic triads.

**Independent Test**: Can be fully tested by opening the Chords view directly and verifying that 36 entries are listed, that the type filter offers "Diminished" and shows exactly 12 entries, and that each diminished entry shows a fingering diagram.

**Acceptance Scenarios**:

1. **Given** a visitor in the Chords view, **When** the page loads, **Then** 36 chord entries are listed — one major, one minor, and one diminished per chromatic pitch — with enharmonic pitches combined flat-first (e.g. "Bb / A# diminished").
2. **Given** a visitor in the Chords view, **When** they select "Diminished" in the type filter, **Then** exactly the 12 diminished entries are listed, each opening to a fingering diagram.

---

### User Story 4 - Minor-key circles (Priority: P4)

A learner in the Circles view finds circles in minor keys (for example a circle in A minor) and, on opening one, sees the seven diatonic chords of the natural minor key — i, ii°, III, iv, v, VI, VII — with the circle's own chords marked and the minor scale's notes and neck reference.

**Why this priority**: Extends the harmony reference to the other half of the Scales topic's 24 keys. Ordered last because it depends on new minor progressions entering the course content (see FR-016) as well as on Stories 1–3.

**Independent Test**: Can be fully tested by filtering the Circles view to "Minor", opening any minor circle, and verifying seven natural-minor diatonic rows with correct qualities (minor, diminished, major, minor, minor, major, major) and the minor scale's notes.

**Acceptance Scenarios**:

1. **Given** a learner filtering to "Minor", **When** the list loads, **Then** exactly the 12 minor-key circles are shown (one per minor scale key).
2. **Given** an open A-minor circle focus view, **When** the learner reads the diatonic table, **Then** it shows exactly: i A minor, ii° B diminished, III C major, iv D minor, v E minor, VI F major, VII G major.

---

### Edge Cases

- What happens when a circle's key spells a diatonic note that has no chord under that exact spelling (e.g. Gb major's IV is "Cb")? The diatonic row MUST show the theory spelling from the key's scale ("Cb") as its note/degree label, and the chord name and diagram MUST come from the matching Chords-reference entry for that pitch and quality ("B major"); the row MUST never be blank or missing.
- What happens when a circle's progression contains a chord that is not diatonic to its key? This is a content error: the content check MUST fail naming the circle and the offending chord, and the content MUST NOT ship.
- What happens when the Chords reference lacks the diminished entry a circle needs? The row MUST still appear with its degree, note, and chord name plus a diagram-unavailable placeholder, and the content check MUST flag the missing entry.
- What happens when a filter matches zero circles, or when the course has no circles at all? The view MUST show a friendly empty state (with a reset path when filtered), never a blank page or an error.
- What happens when a circle is titled with a sharp spelling ("Circle in F#") while the Chords reference names the pitch flat-first ("Gb / F# major")? Both the "F#" and "Gb" note filters MUST match the circle, and the focus view MUST display the key with both spellings where they differ.
- What happens when the learner opens a circle, changes nothing, and presses Escape? The list MUST reappear with the same filter and scroll context as before.
- What happens while content is loading or fails to load? The view MUST show a loading indicator while loading and an error state with a retry action when loading fails.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The Circles view MUST list every harmonic circle taught in the course's lessons (name, key, progression degrees, chord names) — unchanged source: lesson progressions remain the single source of which circles exist.
- **FR-002**: The Circles view MUST provide a grouped dropdown filter with the options "All circles", by type ("Major", "Minor"), and by note (naturals A–G plus flat and sharp spellings), mirroring the Scales view. Enharmonic spellings MUST match the same circles (selecting "Gb" and "F#" list identical results). This supersedes the key-only dropdown of 003 FR-012.
- **FR-003**: Changing the filter MUST immediately update the visible list; "All circles" MUST restore the full list in default order (by key pitch, then by name).
- **FR-004**: Selecting a circle MUST open a full-width focus view for that circle — hiding the list and filter — and a "Back to all circles" button and the Escape key MUST return to the list with the prior filter selection preserved. Opening and returning MUST be keyboard-operable and exposed to assistive technology. This supersedes the inline single-open expansion of 003 FR-013.
- **FR-005**: The focus view MUST show the circle's name, key (with both spellings where the pitch has two), key type (major or minor), progression degrees, and progression chord names.
- **FR-006**: The focus view MUST show the key's scale notes in order (seven distinct notes plus the octave), spelled from the Scales topic's conventional spelling table for that key and type.
- **FR-007**: The focus view MUST show a diatonic-chord table with exactly seven rows in scale order. Each row MUST show the scale degree (Roman numeral with case indicating quality and "°" for diminished: I ii iii IV V vi vii° for major; i ii° III iv v VI VII for natural minor), the chord name, and its fingering diagram.
- **FR-008**: Diatonic chords MUST be derived from the key's scale notes and the fixed triad-quality pattern (major: M m m M M m dim; natural minor: m dim M m m M M) — never hand-authored per circle and never stored as a separate collection. Each row MUST resolve to the Chords-reference entry with the same pitch and quality, so that a row's diagram is the curated diagram taught in the Chords topic.
- **FR-009**: Diatonic rows whose scale spelling differs from the Chords-reference naming (e.g. "Cb" vs "B major") MUST show the scale spelling as the note label and the Chords-reference name with the diagram.
- **FR-010**: The diatonic table MUST visibly mark which rows belong to the circle's own progression; every progression chord MUST appear in the table.
- **FR-011**: The focus view MUST include a landscape 12-fret neck reference of the key's scale tones (tonic filled), reusing the Scales topic's neck-reference presentation without change to that topic.
- **FR-012**: The Chords reference MUST cover diminished triads for all 12 chromatic pitches in addition to major and minor (36 entries total), each with a curated fingering diagram. Display names follow the established pattern "{root} diminished" with enharmonic pitches combined flat-first (e.g. "Bb / A# diminished").
- **FR-013**: The Chords view MUST list the diminished entries alongside major and minor, and its type filter MUST offer "Diminished"; default ordering keeps alphabetical-by-name with major, then minor, then diminished for the same pitch.
- **FR-014**: The content check MUST fail (naming the circle and chord) when any lesson progression chord is not diatonic to the circle's key, when any diatonic row cannot resolve to a Chords-reference entry, or when the Chords reference does not contain exactly 36 uniquely named entries.
- **FR-015**: The Circles view MUST handle loading, empty (no circles; no matches with a reset path), and error (message with retry) states, and MUST render the focus view on a 360px-wide viewport with no horizontal scrolling.
- **FR-016**: The course content MUST include one canonical minor-key circle per minor scale key (12 minor circles — e.g. circle of A minor: Am–F–C–G as i–VI–III–VII — each with an authored name and progression), entering the explorer through the same lesson-progression source as major circles, so every Scales minor key has a matching circle (24 circles total across major and minor).
- **FR-017**: Feature 001's specification MUST be amended in the same increment to record the 36-entry Chords reference (superseding the "Major and minor only" clarification and SC-005's 24-entry count); until amended, 001 remains the governing text and this feature MUST NOT ship. *(Converge note 2026-09-17: the "MUST NOT ship until amended" guard was violated — the feature shipped in #13 before 001 was amended. The fast-follow converge branch satisfies the amendment half of this clause; the guard is retrospectively read as "MUST be converged before the increment closes", satisfied by this converge.)*
- **FR-018**: Feature 003's specification MUST be amended in the same increment to record the new Circles explorer contract — the grouped All/by-type/by-note filter with enharmonic matching (superseding FR-012's key-only dropdown and the "dropdown filters by key only" assumption), the full-width focus view with Back/Escape return (superseding FR-013's inline single-open expansion), and the diatonic-chord table including diminished triads (superseding the major/minor-only chord-vocabulary assumption); until amended, 003 remains the governing text for those clauses and this feature MUST NOT ship. *(Converge note 2026-09-17: same guard violation as FR-017 — shipped in #13 before 003 was amended. Satisfied fast-follow by the converge branch amending 003; guard retrospectively read as "MUST be converged before the increment closes".)*

### Key Entities

- **Topic**: Established concept. This feature changes the presentation of the existing "Circles" topic and the content of the existing "Chords" and "Harmonic Circles" topics; no new topic is added.
- **Circle**: A lesson progression surfaced in the Circles explorer (derived, not stored): name, key (pitch plus both spellings where applicable), key type (major or minor), progression degrees and chord names, and — new — its derived diatonic chord set and scale notes.
- **DiatonicChord**: One of the seven triads native to a key (derived): scale degree label, scale-spelled note, triad quality (major, minor, diminished), the resolved Chords-reference entry (name and diagram), and whether it belongs to the circle's progression.
- **Chord**: A ukulele chord entry — now exactly one per pitch and type for three types (12 pitches × major/minor/diminished = 36 entries). Display name "{root} major" / "{root} minor" / "{root} diminished", enharmonic pitches combined flat-first; a type; a root spelling plus enharmonic alias if any; a curated fingering diagram.
- **Scale spelling**: The Scales topic's conventional note spelling per key and type (24 rows), reused as the note source for diatonic derivation; unchanged by this feature.

### Decision records

Recorded in fast-follow converge (the `/speckit-deliberate-record` step was skipped at plan time; the pre-spec explore decisions were written as DRs on the converge branch):

| Record | Settles | Status |
| ------ | ------- | ------ |
| [DR-001](./decisions/DR-001-diminished-catalog.md) | vii°/ii° diagram source — extend the Chords reference to 36 curated entries (rejected: generated diagrams; name-only rows) | Accepted |
| [DR-002](./decisions/DR-002-diatonic-derivation.md) | Diatonic derivation from the Scales spelling table + quality pattern; no circles collection; lesson progressions stay the source of circles | Accepted |
| [DR-003](./decisions/DR-003-circle-focus-view.md) | Focus-view detail with neck reference, superseding 003 FR-013 inline expansion | Accepted |

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: For every circle in the course, the open focus view shows exactly seven diatonic rows, and 100% of the circle's progression chords appear among them (verified by the content check and a task-based walkthrough).
- **SC-002**: 4 out of 5 first-time learners, given "find the diminished chord in the key of G", open the G circle and name "F# diminished" from the diatonic table on their first attempt without guidance (task-based check with 5 learners before release; at least 4 MUST succeed unaided).
- **SC-003**: The Chords reference covers major, minor, and diminished triads for all 12 chromatic pitches (36 entries, enharmonic pitches combined once each); the Chords type filter set to "Diminished" shows exactly 12.
- **SC-004**: Selecting any note filter in the Circles view, in either enharmonic spelling, lists exactly the circles whose key has that pitch (verified for all 17 spellings).
- **SC-005**: Zero content errors ship: every progression chord is diatonic to its circle's key and every diatonic row resolves to a Chords entry (verified by the content check before release).
- **SC-006**: Changing the circle filter updates the list within 2 seconds; opening a circle shows its focus view within 2 seconds on a typical broadband or 4G connection.
- **SC-007**: The focus view (diatonic table, diagrams, neck reference) renders on a 360px-wide viewport with no horizontal scrolling.
- **SC-008**: Returning from a focus view via Back or Escape restores the list with the previously selected filter in 100% of tested cases.

## Assumptions

- "Minor" means natural minor throughout (consistent with the Scales topic); harmonic/melodic minor diatonic sets are out of scope.
- Diatonic rows are triads only (three-note chords); seventh chords and extensions are out of scope.
- Diminished-chord display names follow the existing "{root} {type}" convention, so the type word is "diminished" in full (e.g. "B diminished"), not "Bdim" or "B°"; the degree column carries the "°" symbol.
- Circle names, keys, and progressions authored for the Harmonic Circles lesson are unchanged; the only content additions are the 12 diminished chord entries and 12 canonical minor circles (FR-016).
- Enharmonic key handling reuses the established combined flat-first identity (e.g. a circle keyed "F#" belongs to the "Gb / F#" pitch); no circle is duplicated per spelling.
- The Scales topic's spelling table and neck-reference presentation are reused as-is; this feature makes no change to the Scales topic.
- Standard ukulele tuning (G–C–E–A); alternate tunings are out of scope.
- Content is curated and built in — no authoring/CMS interface is part of this feature.
- No user accounts, progress tracking, or personalization; anonymous browsing.
- User interface copy is in English; the degree labels use Roman-numeral convention, not the Spanish "Grado/Acorde" headings of the reference table.
- Constitution workflow notes: the single specify-phase question (FR-016 minor-circle scope) was answered during validation (Option B: 12 canonical minor circles); no [NEEDS CLARIFICATION] markers remain. Scope was otherwise settled pre-spec through an evidence-backed explore session whose decisions are recorded as DR-001–DR-003 (fast-follow converge; plan-time recording was skipped). `/speckit-analyze` WILL run after `/speckit-tasks` and before implement, per Constitution I: this feature amends two governing specs (001 via FR-017, 003 via FR-018), supersedes 003 FR-012/FR-013, and changes the Chords count/type contract pinned by validate Rule 4, `matchCatalogChord`'s 24-entry assumption, and `content.schemas.test.ts` — exactly the cross-artifact drift analyze exists to catch. Deferral to converge is explicitly NOT taken.

## Out of Scope _(optional)_

- Seventh chords, suspended, augmented, or any non-triad diatonic harmony.
- Harmonic and melodic minor diatonic sets.
- Changes to the Scales topic (its entries, filter, focus view, or neck reference).
- Chord-function teaching prose (tonic/subdominant/dominant roles) — the diatonic table is a reference, not a lesson chapter; a lesson follow-up may build on it.
- Audio playback of circles or chords.
- Modal circles (Dorian, Mixolydian, etc.) and secondary dominants / borrowed chords.
- Additional courses beyond Ukulele.
- User accounts, favorites, saved progress; catalog-wide search; native mobile apps.
