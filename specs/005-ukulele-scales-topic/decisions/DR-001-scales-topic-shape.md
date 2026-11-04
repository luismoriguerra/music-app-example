# Decision: Scales topic shape

> Scope note: decided pre-spec under `004-lyrics-chords-generator` (active feature at the time); moved to `005-ukulele-scales-topic` on 2026-09-16 when the Scales spec was created.

> Correction 2026-09-16 (pre-push amend, user-approved): the original Evidence overstated route/schema reuse. Corrected below — decision unchanged.

## Status

**Accepted**

## Context

The Ukulele course gains one new topic card, "Scales", teaching major and minor scales. The repo already ships two topic shapes — browsable explorers (`reference`/`circles` formats with a React island) and long-form lessons (`lesson` format) — and the topic route dispatches on `format`, so the shape decision fixes the spec scope, content schema, and implementation plan.

**Question:** Should the Scales topic ship first as a browsable explorer, a lesson chapter, or both?

**Constraints that matter:**

- `001` FR-003/FR-004 — course card plus a view opened by selection.
- `001` FR-015 — stable human-readable slug (`scales`).
- `001` FR-016 — every view handles loading, empty, and error states.
- User scope — exactly one topic card named "Scales" (rules out a two-card pair).

## Options Considered

- **Option A — Explorer-first single reference topic.** (chosen) New scale entries plus a `ScaleList` island mirroring `ChordList`: grouped filter (All / by type / by note), sorted list, single-open inline expansion with a scale diagram. Lesson prose deferred as a follow-up increment.
- **Option B — Lesson-first book chapter.** `format: lesson` with intro + sections + summary teaching scale theory, with inline scale diagrams.
- **Option C — Lesson + explorer pair.** Two cards sharing content, the `003` pattern (Harmonic Circles + Circles).

## Assumptions

- [medium risk] Learners reach for scales by key ("show me G major"), so lookup-first fits the same need the Chords explorer serves.
- [low risk] The scale diagram built for the explorer can be reused inline when the lesson follow-up lands.
- [low risk] One-octave first-position fingerings are enough for v1 entries (movable shapes later).

## Evidence

- `frontend/src/pages/courses/[course]/topics/[topic].astro:62-81` — route dispatches on `format`: lesson / circles / chords-by-topicSlug default; the default branch renders `ChordList` or the "No chords have been added to this topic yet." empty state, so Scales needs a new `format` value plus a new dispatch branch (not the `reference` default).
- `frontend/src/lib/content/schemas.ts:62` — `format: z.enum(["reference", "lesson", "circles"])`; no `scales` value exists yet.
- `frontend/src/content.config.ts:32` — `collections = { courses, topics, games, chords }`; no `scales` collection wired yet.
- `frontend/src/lib/content/validate.ts:4-8` — `Collections` is `{courses,topics,games,chords}`; `:62,71-75` — Rule 4 hard-codes `CHORD_COUNT_V1` with chord-specific dup rules, so Scales needs parallel validate work.
- `frontend/src/content/topics/chords.json:1-8` — Chords ships as a format-default reference topic; `circles.json:1-9` shows the explorer-card precedent with `order` sequencing.
- `frontend/src/components/ChordList.tsx:23-31` — shipped island interaction pattern (filter + sort + single-open expansion) the Scales explorer clones.
- `specs/001-music-course-catalog/spec.md:88-90` — the Chords explorer "proves the Topic pattern end to end" as the first learning content; Scales repeats that proven increment.
- `specs/003-ukulele-harmonic-circles/spec.md:105-116` — US4 circles explorer is the honest implementation precedent: new enum value + new dispatch branch + new island, not a file-for-file Chords clone.

## Decision

**Option A.** Ship "Scales" as one explorer-first reference topic. Option B rejected: prose without a scale visual teaches weakly, and the visual has to be built either way — building it inside the higher-leverage explorer first keeps v1 interactive and consistent with the Chords/Circles cards beside it. Option C rejected: directly contradicts the fixed single-card scope.

## Confidence

Medium — the explorer-first decision stands and the interaction pattern clones cleanly, but sizing was originally understated: new `format` value, dispatch branch, `scales` collection, and validate parallels are required (003 circles precedent).

## Consequences

**Easier:** Reuses explorer interaction patterns, tests shape, and empty/error-state idioms; no prose authoring blocks v1; filter/sort logic clones from `lib/chords.ts`.
**Harder:** New work beyond content + island: `scales` `format` enum value, `[topic].astro` dispatch branch, `scales` collection wiring in `content.config.ts`, parallel validate rules + content-gate fixtures — plus the scale diagram component (see DR-002); scale theory teaching waits for the lesson follow-up.
**Risks that remain:** Explorer-only may under-teach theory — mitigated by carrying scale degrees + interval pattern on every entry, with the lesson as the tracked follow-up.

## Revisit Trigger

Reopen if: the `005` specify walkthrough shows learners need prose-first teaching, the course adds a second Scales card (lesson), or usage shows lookup-only behavior with no learning transfer.
