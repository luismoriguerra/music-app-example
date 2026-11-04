# Contract: Lesson Content Schemas (delta on 001)

**Feature**: `003-ukulele-harmonic-circles` | **Date**: 2026-09-15
**Data model**: [../data-model.md](../data-model.md) |
**Base contract**: [001 content-schema](../../../001-music-course-catalog/contracts/content-schema.md)

No REST/GraphQL API (content is static — R5). These Zod schema deltas +
`validateCollections()` rule additions, defined in the same pure modules
(`frontend/src/lib/content/schemas.ts`,
`frontend/src/lib/content/validate.ts`, lookups in
`frontend/src/lib/notes.ts`, zero Astro imports) and enforced by the same
`content.config.ts` + `frontend/scripts/check-content.ts` `prebuild` gate,
ARE the contract. Base 001 schemas and rules 1–9 are unchanged.

## `topics` (extended)

```ts
const NO_TAG_RE = /<[a-zA-Z\/!]/; // R2: no raw HTML in prose
const prose = z.string().min(1).refine(s => !NO_TAG_RE.test(s), {
  message: "prose must not contain raw HTML",
});

progressionSchema = z.object({
  name: z.string().min(1).max(80),
  key: z.enum([...NOTE_ROOTS, ...NOTE_ALIASES]), // valid note spelling
  degrees: z.array(z.string().min(1)).min(3),
  chords: z.array(z.string().min(1)).min(3), // each MUST equal a chords[].name (rule 15)
}).refine(p => p.degrees.length === p.chords.length, {
  message: "degrees and chords must have equal lengths",
});

lessonSectionSchema = z.object({
  heading: z.string().min(1).max(80),
  paragraphs: z.array(prose).min(1),
  progressions: z.array(progressionSchema).default([]),
});

lessonSchema = z.object({
  intro: z.array(prose).min(1),
  sections: z.array(lessonSectionSchema).min(4),
  summary: z.array(prose).min(1),
});

topicSchema = z.object({
  title, slug, kind: z.literal("topic"), courseSlug, description, // unchanged
  format: z.enum(["reference", "lesson", "circles"]).default("reference"),
  lesson: lessonSchema.optional(),
  order: z.number().default(0),
}).refine(t => (t.format === "lesson") === (t.lesson !== undefined), {
  message: "lesson content is required iff format is 'lesson'",
});
```

Seed (this feature): `{ title: "Harmonic Circles", slug:
"harmonic-circles", kind: "topic", courseSlug: "ukulele", format: "lesson",
description: "...", order: 1, lesson: { intro, sections[15], summary } }`
(12 progressions: all major keys — see data-model.md).
Plus: `{ title: "Circles", slug: "circles", kind: "topic", courseSlug:
"ukulele", format: "circles", description: "...", order: 2 }` (no
`lesson`; explorer entries derive from the lesson — rule 17).

## Collection-level validation (pure, unit-tested additions)

```ts
// validateCollections({ courses, topics, games, chords }): string[] — add:
Rule 15: for every topic with format "lesson", for every section
  progression, every chords[] name MUST exactly match a chords[].name;
  else error: `topics/<slug> [<progression name>]: chord "<name>" does
  not resolve to the Chords reference`.
Rule 18: progression names MUST be unique within each course's lessons;
  else error per carrying topic: `topics/<slug>: duplicate progression
  name "<name>"` (guards CircleList's key-on-name identity, FR-013).

Rule 17 is enforced by the content-integrity test (not
`validateCollections`, same as rule 16): the `circles` topic exists
with format "circles" and no `lesson`, and
`collectLessonCircles(topics).length` equals the lesson's progression
count (FR-012/SC-007).
```

The `check-content.ts` runner needs no changes: it already loads `topics`
through `topicSchema` and runs `validateCollections()` over all four
collections — the extended schema and new rules flow through untouched.

## Lesson resolver (pure function, unit-tested)

```ts
// frontend/src/lib/lessons.ts (imports chord/note types only; zero Astro imports)
resolveLessonChords(
  lesson: Lesson,
  chords: readonly Chord[],
): Map<string, Chord | null>;
// Key: progression chord name → matched Chord entry, or null when no
// chords[].name equals it (nulls are content errors per rule 15; the
// reader renders only resolved entries and never crashes on null).
```

## Circles collector (pure functions, unit-tested)

```ts
// frontend/src/lib/circles.ts (imports chord/progression types only; zero Astro imports)
collectLessonCircles(topics: readonly Topic[]): Progression[];
// Every progression from every format:"lesson" topic, lesson reading
// order preserved (single source of truth for the explorer).
resolveCircleChords(
  circle: Progression,
  chords: readonly Chord[],
): Array<{ name: string; degree: string; chord: Chord | null }>;
// Exact-name resolution per rule 15; nulls never render.
filterCircles(circles: readonly Progression[], key: "all" | string): Progression[];
// "all" → identity; otherwise exact key match.
sortCircles(circles: readonly Progression[]): Progression[];
// By key pitch (ROOT_PITCH), then name.
```

## Markdown rendering (pure helper, unit-tested)

```ts
// frontend/src/lib/lessons.ts (marked, sync, build-time only)
renderProse(markdown: string): string; // marked.parse(md, { async: false })
// Input is schema-guaranteed HTML-free; output is emitted via set:html.
```

Contract tests MUST cover: one valid chapter + invalid fixtures
(missing `lesson` on `format: "lesson"`; `lesson` on `"reference"`;
raw-HTML prose; degrees/chords length mismatch; invalid key spelling)
asserting Zod throws; referential invalid (unknown chord name, duplicate
progression name within a course) asserting `validateCollections()`
returns the naming error; resolver tests
(exact match incl. `"Bb / A# major"`, unresolved → null); explorer tests
(collector preserves lesson order; filter shows exactly the chosen key;
sort by key pitch then name; island dropdown/expansion/empty/error in
jsdom).
