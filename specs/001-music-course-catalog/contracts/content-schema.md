# Contract: Content Schemas

**Feature**: `001-music-course-catalog` | **Date**: 2026-09-15
**Data model**: [../data-model.md](../data-model.md)

V1 has no REST/GraphQL API (content is static — see research R1). These Zod
schemas + the `validateCollections()` check, defined in
`frontend/src/lib/content/schemas.ts` + `frontend/src/lib/content/validate.ts`
(note lookups in `frontend/src/lib/notes.ts`, all zero Astro imports) and wired in
`frontend/src/content.config.ts` via `defineCollection({ loader, schema })` (per-entry
validation at `astro sync`/build) + `frontend/scripts/check-content.ts` running
`validateCollections` over `src/content/**/*.json` as the `prebuild` gate,
ARE the contract: any content entry violating them MUST fail the build, and
contract tests MUST cover one valid + one invalid fixture per collection
(per-entry invalid asserts Zod throws; referential/collection invalid asserts
`validateCollections()` returns errors naming the broken entry).
(`Chord` type = `z.infer<typeof chordSchema>` from the pure schema module.)

## `courses`

```ts
courseSchema = z.object({
  title: z.string().min(1).max(80),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(64),
  description: z.string().min(1).max(280),
  cover: z.string().optional(),
  order: z.number().default(0),
});
// + validateCollections: slugs unique across courses
```

Seed (v1): `{ title: "Ukulele", slug: "ukulele", description: "...", order: 0 }`

## `topics`

```ts
topicSchema = z.object({
  title: z.string().min(1).max(80),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(64),
  kind: z.literal("topic"),
  courseSlug: z.string().min(1), // + validateCollections: must resolve to a course
  description: z.string().min(1).max(280),
  order: z.number().default(0),
});
// + validateCollections: slugs unique within parent course
```

Seed (v1): `{ title: "Chords", slug: "chords", kind: "topic",
courseSlug: "ukulele", description: "..." }`

## `games`

```ts
gameSchema = z.object({
  title: z.string().min(1).max(80),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(64),
  kind: z.literal("game"),
  courseSlug: z.string().min(1), // + validateCollections: must resolve to a course
  description: z.string().min(1).max(280),
  rules: z.string().optional(), // REQUIRED before any game ships
  order: z.number().default(0),
});
```

Seed (v1): none (collection + route reserved).

## `chords`

```ts
chordDiagramSchema = z.object({
  strings: z.literal("GCEA"),
  frets: z.tuple([z.number().int().min(-1), z.number().int().min(-1),
                  z.number().int().min(-1), z.number().int().min(-1)]),
  fingers: z.tuple([z.number().int().min(0).max(4), z.number().int().min(0).max(4),
                    z.number().int().min(0).max(4), z.number().int().min(0).max(4)]),
  baseFret: z.number().int().min(1).default(1),
  barres: z.array(z.object({
    fret: z.number().int().min(1),
    fromString: z.number().int().min(0).max(3),
    toString: z.number().int().min(0).max(3),
  })).default([]),
});

// --- frontend/src/lib/notes.ts (zero-import leaf) ---
const NOTE_ROOTS = ["A", "B", "C", "D", "E", "F", "G", "Bb", "Db", "Eb", "Gb", "Ab"] as const;
const NOTE_ALIASES = ["A#", "C#", "D#", "F#", "G#"] as const;
const ROOT_PITCH: Record<string, number> = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const ENHARMONIC_PAIR: Record<string, string> = { Bb: "A#", Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#" };

// --- frontend/src/lib/content/schemas.ts (imports zod + ../notes only) ---
chordSchema = z.object({
  name: z.string().min(1),            // display name, combined flat-first (test)
  type: z.enum(["major", "minor"]),  // v1 only (FR-007)
  root: z.enum(NOTE_ROOTS),          // 12 primary spellings (flat-first enharmonics)
  rootAlias: z.enum(NOTE_ALIASES).optional(), // 2nd spelling, only if enharmonic
  rootPitch: z.number().int().min(0).max(11), // MUST equal ROOT_PITCH[root] (refine below)
  topicSlug: z.string().min(1),      // + validateCollections: must resolve to topics.slug
  diagram: chordDiagramSchema,       // invalid → placeholder path, never crash
}).refine(c => ROOT_PITCH[c.root] === c.rootPitch, { message: "rootPitch must match lookup(root)" })
 .refine(c => !c.rootAlias || ENHARMONIC_PAIR[c.root] === c.rootAlias, { message: "rootAlias must be the enharmonic partner of root" });
// + validateCollections: exactly 24 entries (12 pitches × 2 types), unique names,
//   one entry per (rootPitch,type), every filter spelling matches via root or rootAlias.
// + per-entry invalid fixtures ("Hb" root, mismatched rootPitch, wrong alias pair) MUST throw.
```

## Collection-level validation (pure, unit-tested)

```ts
// frontend/src/lib/content/validate.ts (imports types + ../notes only)
validateCollections({ courses, topics, games, chords }): string[];
// Returns errors naming the broken entry (collection + slug/name + rule);
// empty array = valid. frontend/scripts/check-content.ts runs it over
// src/content/**/*.json and exits non-zero on errors (wired as `prebuild`).
// Checks: dangling courseSlug/topicSlug refs,
// slug uniqueness per scope (courses global; topics/games per course), chords
// exactly 24 + unique names + one entry per (rootPitch,type), every
// NOTE_ROOTS/NOTE_ALIASES spelling matches ≥1 chord via root or rootAlias.
```

## Filter contract (pure function, unit-tested)

```ts
type FilterOption = "all" | "major" | "minor" | string; // string = root spelling
filterChords(chords: Chord[], option: FilterOption): Chord[];
// "all" → identity; "major"/"minor" → type match;
// note spelling → matches `root` OR `rootAlias` (Bb and A# match the same entry).
```

Dropdown options (FR-008): `all`, `major`, `minor`, naturals A–G, flats
(Bb, Db, Eb, Gb, Ab), sharps (A#, C#, D#, F#, G#) — presented grouped
(all / by type / by note) in a native `<select>` + `<optgroup>`
(shadcn NativeSelect primitive or Tailwind-styled select).
