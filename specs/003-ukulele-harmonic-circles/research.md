# Research: Ukulele Harmonic Circles Topic

**Feature**: `003-ukulele-harmonic-circles` | **Date**: 2026-09-15
**Spec**: [spec.md](./spec.md)

Phase 0 output. Every Technical Context unknown is resolved below as
Decision / Rationale / Alternatives considered. No NEEDS CLARIFICATION remains.

**Domain scope**: "Harmonic circles" = Spanish-pedagogy *circulos
armonicos* — per-key repeating chord cycles (circle of C: C–Am–F–G as
I–vi–IV–V). The circle of fifths is a different topic and is out of
scope (at most a sidebar mention). Chord vocabulary is the existing
major/minor reference only (`chordSchema.type` has no sevenths), so
pedagogy variants like G7 appear at most as prose, never as diagrammed
chords — see R4.

---

## R1. Lesson content model (prose sections + progressions)

- **Decision**: Extend the existing `topics` JSON entries with an optional
  `lesson` object: `{ intro: string[], sections: [{ heading, paragraphs:
  string[], progressions?: [{ name, key, degrees: string[], chords:
  string[] }] }] }`. Prose fields are Markdown strings; progression blocks
  stay structured data with chord entries naming the canonical chord
  display name (e.g. `"C major"`, `"A minor"`, `"Bb / A# major"`).
- **Rationale**: One topic stays one file, co-located with its discovery
  metadata, and reuses the proven JSON loader + Zod + `check-content`
  pipeline with minimal new machinery. Markdown strings give the author
  full prose control (emphasis, lists) while progression blocks remain
  machine-validatable, so FR-008 (every chord reference resolves) is a
  build-time check, not a hope. Prose may use compact chord symbols
  ("Am") freely; only structured blocks need canonical names.
- **Alternatives considered**:
  - Markdown/MDX lesson files with frontmatter — rejected: splits one
    chapter across two authoring dialects (frontmatter + body), and
    progression data embedded in Markdown needs a custom parser with new
    failure modes; chord-ref validation becomes string-scraping instead of
    schema validation.
  - New `lessons` collection separate from topics — rejected: extra
    collection plus a join for a 1:1 relationship adds indirection with no
    benefit; topics remain the single discovery unit (FR-001/FR-002).

## R2. Markdown rendering for lesson prose

- **Decision**: `marked` (pinned in `frontend/package.json` at implement
  time), parsing Markdown to HTML in a pure lib helper at build time
  (Astro frontmatter / static render — zero client JS), emitted via
  Astro's `set:html`. Raw HTML in authored prose is forbidden: a schema
  rule rejects prose containing tag-like `<...>` sequences, so the build
  fails loudly on HTML instead of shipping it — output is inherently safe
  with no sanitizer dependency. Sync parse API only.
- **Rationale**: `marked` is tiny, dependency-free, and sync, so it runs
  identically in Vitest and in Astro static rendering. Content is curated
  and built in (FR-007), so forbidding raw HTML loses nothing and removes
  the XSS surface entirely. `set:html` is Astro's long-stable raw-HTML
  directive (verify at implement via container test).
- **Alternatives considered**:
  - `astro:content` `render()` — rejected: only renders Markdown/MDX
    collection entries, not JSON-embedded strings.
  - Hand-rolled Markdown renderer — rejected: re-implements nesting,
    lists, and escaping badly.
  - Allow raw HTML + sanitize (`sanitize-html`) — rejected: extra
    dependency to support a capability curated prose does not need; loud
    build failure is stricter and simpler.
- **Note**: The `astro-docs` MCP server is the stack's live API authority,
  but no MCP tool is mounted in this environment, so `set:html` and static
  React-component rendering are verified at implement time by container
  tests instead (T-tasks pin the behavior).

## R3. Topic view dispatch (chord reference vs lesson reader)

- **Decision**: Explicit `format` discriminator on the topic entry:
  `format: "reference" | "lesson"` (Zod default `"reference"`, so the
  existing Chords entry stays valid untouched). The topic route branches:
  `reference` → existing chord-explorer island; `lesson` → the new static
  lesson reader. Validation: `format: "lesson"` REQUIRES `lesson` content
  present; `reference` topics are unchanged.
- **Rationale**: Explicit beats inferred — mirrors the `kind: "topic" |
  "game"` precedent (001 clarification #7): a topic declares what it is,
  and the route honors the declaration. A forgotten `lesson` object fails
  the build instead of silently rendering the wrong view.
- **Alternatives considered**:
  - Presence-based dispatch (has `lesson` → lesson view) — rejected:
    implicit; an authoring omission renders the wrong view silently.
  - Slug-conditional in the page (`if slug === "harmonic-circles"`) —
    rejected: magic string in view code, breaks the FR-012-style
    "new content without layout changes" extensibility the catalog was
    built for.

## R4. Chord reference resolution for inline diagrams

- **Decision**: Progression `chords[]` entries MUST exactly equal a chord
  `name` from the Chords reference (e.g. `"A minor"`, `"Bb / A# major"`).
  A pure helper (`resolveLessonChords(lesson, chords)`, zero Astro
  imports) maps each reference to its chord entry for inline diagram
  rendering; `validateCollections()` reports any unresolvable reference
  naming topic + progression + chord (FR-008).
- **Rationale**: Exact-name matching is unambiguous (names are unique per
  topic) and needs no alias parser. All progression chords in this lesson
  use every entry of the 24-entry reference (12 majors as I/IV/V, 12
  minors as vi), so no chord-vocabulary change is needed.
  Seventh-chord variants (e.g. G7) have no reference entries
  (`chordSchema.type` is major|minor only) and therefore MUST NOT appear
  as diagrammed progression chords — any mention is prose-only.
- **Alternatives considered**:
  - Compact symbols (`"Am"`, `"Bb"`) with an alias parser — rejected: new
    parsing surface (case, `m` vs `min`, enharmonic choice) for zero
    authoring gain; canonical names are already short.
  - `(rootPitch, type)` tuples — rejected: unreadable in authored JSON,
    error-prone, harder to audit in review.

## R5. Backend role

- **Decision**: No backend involvement — zero feature traffic, no
  `backend/` changes, no migration, no new endpoint. Same posture as 001.
- **Rationale**: The lesson is static curated content (FR-007) with
  anonymous reading; no dynamic state exists to justify backend work.

## R6. LLM / model selection

- **Decision**: No hosted inference in this feature — no agents, chat,
  search, tagging, or recommendations ship. No model is chosen and no
  `openrouter-model-eval` run is required; this section is the decision
  record Principle V requires ("no model selected, nothing to evaluate").
- **Rationale**: Reading a static chapter needs no LLM; adding one would
  be scope creep. Consistent with 001 R6.

## R7. Testing strategy

- **Decision**:
  - Frontend (Vitest, existing setup): lesson schema fixtures (one valid
    chapter + invalid: missing `lesson` on `format: "lesson"`, raw HTML in
    prose, `degrees`/`chords` length mismatch, unknown chord name);
    resolver tests (`resolveLessonChords`: exact match incl. combined
    `"Bb / A# major"` name, unresolved → null); `validateCollections`
    tests (dangling lesson chord ref names topic/progression/chord;
    lesson-without-content and content-without-lesson-format errors);
    container tests for the lesson reader component and the topic-route
    branch (lesson topic renders chapter + diagrams; reference topic still
    renders the explorer); content-integrity over the real JSON (new topic
    parses, all refs resolve); explorer tests (pure collector/resolver/
    filter/sort unit tests; jsdom island tests for dropdown filter,
    single-open expansion, empty + error states).
  - Backend (pytest): untouched — no backend change, existing suite must
    stay green.
  - Validation: `quickstart.md` scenarios map 1:1 to user stories and run
    via `npm run dev` + Vitest + `npm run check-content`.
- **Rationale**: Satisfies Principle III (test-first) with the idiomatic
  runner; schema + resolver + container tests give the static-lesson
  architecture the same contract safety the Chords explorer has.
- **Alternatives considered**:
  - Playwright E2E — deferred (same as 001): unit + schema + quickstart
    covers the static-content risk surface without the flake/CI cost.

## R8. Book typography and readability

- **Decision**: Hand-rolled prose styles (single column, ~65ch measure,
  clear heading scale, comfortable line-height, theme tokens) scoped to
  the lesson reader component — no new CSS dependency. Static HTML:
  real `<h2>`/`<p>`/`<ul>` hierarchy from the Markdown, so semantic
  structure and keyboard operability come free.
- **Rationale**: One reading page does not justify the
  `@tailwindcss/typography` dependency and its version surface; ~40 lines
  of scoped CSS give full control over the book feel and stay green under
  the existing Prettier gate. SC-005 (360px, no horizontal scroll) is
  verified by a container/DOM assertion plus quickstart inspection.
- **Alternatives considered**:
  - `@tailwindcss/typography` `prose` plugin — rejected: dependency +
    config for a single page; hand-rolled styles are smaller and fully
    controlled.
  - Unstyled Markdown output — rejected: fails the "book material" bar
    (FR-003/FR-006) on measure, rhythm, and heading hierarchy.

## R9. Circles explorer (follow-up)

- **Decision**: New `format: "circles"` topic entry ("Circles", slug
  `circles`, `order: 2`) rendered by a `CircleList` React island
  (`client:load`) mirroring the Chords explorer: native `<select>`
  dropdown (All + one option per key present), single-open inline
  expansion showing each chord's name + `ChordDiagram`, count badge,
  empty state with reset, error state with retry. Explorer entries are
  derived at page-frontmatter time from every `format: "lesson"` topic
  in the same course via pure `lib/circles.ts` (`collectLessonCircles`
  at page-frontmatter time; the island resolves, filters, and sorts
  from props via `resolveCircleChords`/`filterCircles`/`sortCircles`),
  receiving the collected circles plus the Chords reference — no
  fetching.
- **Rationale**: Reuses the proven explorer UX (same a11y contract:
  label + select, `aria-expanded`/`aria-controls`, keyboard-togglable
  buttons) and the exact-name resolution already validated by rule 15,
  so no new chord vocabulary or collection is needed. Deriving from
  lesson progressions keeps one source of truth: authoring a new circle
  updates lesson + explorer together. Key-only dropdown matches the
  content shape (12 keys) — type/note groups would be empty chrome.
- **Alternatives considered**:
  - Separate `circles` JSON collection — rejected: duplicates the
    progression data and can drift from the lesson; derivation is ~20
    lines of pure code.
  - Static zero-JS list — rejected: the Chords-style dropdown filter
    needs client state.
  - Slug-conditional dispatch — rejected (same as R3): the `format`
    discriminator keeps dispatch data-driven.

## Toolchain pins (verified 2026-09-15)

- Reuse the 001 scaffold: Node 22, Astro 7.x, React 19 islands,
  Tailwind CSS v4, Vitest 5 + Testing Library, ESLint 9 + Prettier,
  `tsx` check-content runner. New dependency: `marked` (latest at
  implement time, exact version pinned in `frontend/package.json`).
