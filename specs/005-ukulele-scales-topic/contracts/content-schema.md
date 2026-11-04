# Contract: Scale Content Schemas (delta on 001/003)

**Feature**: `005-ukulele-scales-topic` | **Date**: 2026-09-16
**Data model**: [../data-model.md](../data-model.md) |
**Base contracts**: [001 content-schema](../../../001-music-course-catalog/contracts/content-schema.md),
[003 content-schema](../../../003-ukulele-harmonic-circles/contracts/content-schema.md)

No REST/GraphQL API (content is static — R5). These Zod schema deltas +
`validateCollections()` rule additions, defined in the same pure modules
(`frontend/src/lib/content/schemas.ts`,
`frontend/src/lib/content/validate.ts`, lookups in
`frontend/src/lib/notes.ts`, zero Astro imports) and enforced by the same
`content.config.ts` + `frontend/scripts/check-content.ts` `prebuild` gate,
ARE the contract. Base 001/003 schemas and rules 1–18 are unchanged.

## `topics` (extended)

```ts
topicSchema = z
  .object({
    title,
    slug,
    kind: z.literal("topic"),
    courseSlug,
    description, // unchanged
    format: z
      .enum(["reference", "lesson", "circles", "scales"])
      .default("reference"), // + "scales" (rule 19)
    lesson: lessonSchema.optional(),
    order: z.number().default(0),
  })
  .refine((t) => (t.format === "lesson") === (t.lesson !== undefined), {
    message: "lesson content is required iff format is 'lesson'", // unchanged
  });
```

Seed (this feature): `{ title: "Scales", slug: "scales", kind: "topic",
courseSlug: "ukulele", format: "scales", description: "...", order: 3 }`
(no `lesson`; entries live in the `scales` collection — rule 27).

## `scales` (new collection)

```ts
const scalePositionSchema = z.object({
  string: z.number().int().min(0).max(3), // 0=G 1=C 2=E 3=A
  fret: z.number().int().min(0).max(12), // 0 = open
  order: z.number().int().min(1).max(8), // playing order; unique 1-8 (rule 22)
  finger: z.number().int().min(0).max(4), // 0 = open/no finger
});

const scaleDiagramSchema = z.object({
  strings: z.literal("GCEA"),
  positions: z.array(scalePositionSchema).length(8),
  baseFret: z.number().int().min(1).default(1),
  positionLabel: z.string().min(1).max(40), // e.g. "1st position"
});

scaleSchema = z
  .object({
    name: z.string().min(1).max(80), // e.g. "Db / C# minor" (rule 20)
    type: z.enum(["major", "minor"]), // natural minor only (DR-004)
    root: z.enum(NOTE_ROOTS),
    rootAlias: z.enum(NOTE_ALIASES).optional(),
    rootPitch: z.number().int().min(0).max(11),
    topicSlug: z.string().min(1), // "scales" (rule 23)
    notes: z.array(z.string().min(1)).length(8),
    degrees: z.array(z.string().min(1)).length(8),
    intervals: z.string().min(1), // type-expected pattern (rule 21)
    displaySpelling: z.string().min(1), // root or rootAlias (rule 21)
    diagram: scaleDiagramSchema,
  })
  .refine((c) => ROOT_PITCH[c.root] === c.rootPitch, {
    message: "rootPitch must match lookup(root)",
    path: ["rootPitch"],
  })
  .refine((c) => !c.rootAlias || ENHARMONIC_PAIR[c.root] === c.rootAlias, {
    message: "rootAlias must be the enharmonic partner of root",
    path: ["rootAlias"],
  })
  .refine(
    (c) =>
      c.intervals === (c.type === "major" ? "W-W-H-W-W-W-H" : "W-H-W-W-H-W-W"),
    { message: "intervals must match the type pattern", path: ["intervals"] },
  )
  .refine(
    (c) => c.displaySpelling === c.root || c.displaySpelling === c.rootAlias,
    {
      message: "displaySpelling must be root or rootAlias",
      path: ["displaySpelling"],
    },
  )
  .refine(
    (c) => {
      const o = c.diagram.positions.map((p) => p.order).sort();
      return o.every((v, i) => v === i + 1);
    },
    { message: "position order must be exactly 1-8", path: ["diagram"] },
  );
```

Wiring: `content.config.ts` registers
`scales = defineCollection({ loader: glob({ pattern: "**/*.json", base: "./src/content/scales" }), schema: scaleSchema })`;
`check-content.ts` loads the `scales/` dir through `scaleSchema` and passes
the entries to `validateCollections()`.

## Collection-level validation (pure, unit-tested additions)

```ts
// validateCollections({ courses, topics, games, chords, scales }): string[] — add:
Rule 23: every scale topicSlug MUST resolve to a topic; scales.length MUST be 24;
  no duplicate scale name; no duplicate (rootPitch,type) pair.
  Errors: `scales/<name>: topicSlug "<slug>" does not resolve to a topic`,
  `scales: expected exactly 24 entries, found <n>`,
  `scales/<name>: duplicate scale name`,
  `scales: duplicate (rootPitch,type) pair <key>`.
Rule 24: every NOTE_ROOTS + NOTE_ALIASES spelling MUST match ≥1 scale via root/alias.
  Error: `scales: no scale matches filter spelling "<s>"`.
Rule 25: every scale notes[] MUST exactly equal SPELLING_TABLE[(rootPitch,type)].notes;
  no note may contain a double accidental.
  Errors: `scales/<name>: notes diverge from spelling table at degree <i> ("<have>" vs "<want>")`,
  `scales/<name>: note "<n>" contains a double accidental`.
Rule 26: every position pitch MUST equal ROOT_PITCH[notes[order-1]] (pitch-class compare).
  Error: `scales/<name>: position <order> pitch <p> != note "<n>" pitch <q>`.

Rule 27 is enforced by the content-integrity test (like rules 16-17): the `scales`
topic exists with format "scales" and no `lesson`, and the scales collection
holds exactly 24 entries (FR-001/SC-004).
```

`Collections` gains `scales: Scale[]`; existing call sites pass the new
field (empty array where scales are out of scope for the test).

## Scales helpers (pure functions, unit-tested)

```ts
// frontend/src/lib/scales.ts (imports note/chord types only; zero Astro imports)
SPELLING_TABLE: Readonly<Record<string, { displaySpelling: string; notes: readonly string[] }>>;
// Key: `${rootPitch}/${type}`; 24 rows transcribed 1:1 from the spec Appendix (R2-validated).
scaleSpelling(rootPitch: number, type: "major" | "minor"): { displaySpelling: string; notes: readonly string[] };
filterScales(scales: readonly Scale[], option: ScaleFilterOption): Scale[];
// "all" → identity; "major"|"minor" → type match; spelling → root OR rootAlias (mirrors filterChords).
sortScales(scales: readonly Scale[]): Scale[];
// Alphabetical by display name; major before minor per pitch (mirrors sortChords).
SCALE_FILTER_GROUPS: readonly FilterGroup[]; // All scales / By type / By note (mirrors FILTER_GROUPS)
```

Contract tests MUST cover: one valid scale + invalid fixtures (missing
`notes`; notes/degrees length ≠ 8; wrong `intervals` for type;
`displaySpelling` neither root nor alias; position order dup/gap; fret out
of range; `rootPitch` mismatch; bad `rootAlias`) asserting Zod throws;
referential invalid (dangling topicSlug, count ≠ 24, dup name, dup
(rootPitch,type), spelling-table divergence, double accidental,
pitch-agreement failure) asserting `validateCollections()` returns the
naming error; helper tests (24 table rows, enharmonic match, major-first
sort); island tests (grouped dropdown, focus-view open/Back/Escape,
empty/error in jsdom); diagram tests (8 numbered dots in order, open
marks, placeholder on null); neck tests (tones across frets 0–12, tonic
fill, order badges).
