import { z } from "zod";
import {
  ENHARMONIC_PAIR,
  NOTE_ALIASES,
  NOTE_ROOTS,
  ROOT_PITCH,
} from "../notes";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const slug = z.string().regex(SLUG_RE).max(64);
const title = z.string().min(1).max(80);
const description = z.string().min(1).max(280);

export const courseSchema = z.object({
  title,
  slug,
  description,
  cover: z.string().optional(),
  order: z.number().default(0),
});

const NO_TAG_RE = /<[a-zA-Z/!]/; // R2: no raw HTML in lesson prose
const prose = z
  .string()
  .min(1)
  .refine((s) => !NO_TAG_RE.test(s), {
    message: "prose must not contain raw HTML",
  });

const NOTE_SPELLINGS = [...NOTE_ROOTS, ...NOTE_ALIASES] as const;

export const progressionSchema = z
  .object({
    name: z.string().min(1).max(80),
    key: z.enum(NOTE_SPELLINGS),
    type: z.enum(["major", "minor"]).default("major"),
    degrees: z.array(z.string().min(1)).min(3),
    chords: z.array(z.string().min(1)).min(3),
  })
  .refine((p) => p.degrees.length === p.chords.length, {
    message: "degrees and chords must have equal lengths",
  });

export const lessonSectionSchema = z.object({
  heading: z.string().min(1).max(80),
  paragraphs: z.array(prose).min(1),
  progressions: z.array(progressionSchema).default([]),
});

export const lessonSchema = z.object({
  intro: z.array(prose).min(1),
  sections: z.array(lessonSectionSchema).min(4),
  summary: z.array(prose).min(1),
});

export const topicSchema = z
  .object({
    title,
    slug,
    kind: z.literal("topic"),
    courseSlug: z.string().min(1),
    description,
    format: z
      .enum(["reference", "lesson", "circles", "scales"])
      .default("reference"),
    lesson: lessonSchema.optional(),
    order: z.number().default(0),
  })
  .refine((t) => (t.format === "lesson") === (t.lesson !== undefined), {
    message: "lesson content is required iff format is 'lesson'",
  });

export const gameSchema = z.object({
  title,
  slug,
  kind: z.literal("game"),
  courseSlug: z.string().min(1),
  description,
  rules: z.string().optional(),
  order: z.number().default(0),
});

const fret = z.number().int().min(-1);
const finger = z.number().int().min(0).max(4);

export const chordDiagramSchema = z.object({
  strings: z.literal("GCEA"),
  frets: z.tuple([fret, fret, fret, fret]),
  fingers: z.tuple([finger, finger, finger, finger]),
  baseFret: z.number().int().min(1).default(1),
  barres: z
    .array(
      z.object({
        fret: z.number().int().min(1),
        fromString: z.number().int().min(0).max(3),
        toString: z.number().int().min(0).max(3),
      }),
    )
    .default([]),
});

export const chordSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(["major", "minor", "diminished"]),
    root: z.enum(NOTE_ROOTS),
    rootAlias: z.enum(NOTE_ALIASES).optional(),
    rootPitch: z.number().int().min(0).max(11),
    topicSlug: z.string().min(1),
    diagram: chordDiagramSchema,
  })
  .refine((c) => ROOT_PITCH[c.root] === c.rootPitch, {
    message: "rootPitch must match lookup(root)",
    path: ["rootPitch"],
  })
  .refine((c) => !c.rootAlias || ENHARMONIC_PAIR[c.root] === c.rootAlias, {
    message: "rootAlias must be the enharmonic partner of root",
    path: ["rootAlias"],
  });

export const scalePositionSchema = z.object({
  string: z.number().int().min(0).max(3), // 0=G 1=C 2=E 3=A
  fret: z.number().int().min(0).max(12), // 0 = open
  order: z.number().int().min(1).max(8), // playing order; unique 1-8 (rule 22)
  finger: z.number().int().min(0).max(4), // 0 = open/no finger
});

export const scaleDiagramSchema = z.object({
  strings: z.literal("GCEA"),
  positions: z.array(scalePositionSchema).length(8),
  baseFret: z.number().int().min(1).default(1),
  positionLabel: z.string().min(1).max(40), // e.g. "1st position"
});

export const scaleSchema = z
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
  .refine((s) => ROOT_PITCH[s.root] === s.rootPitch, {
    message: "rootPitch must match lookup(root)",
    path: ["rootPitch"],
  })
  .refine((s) => !s.rootAlias || ENHARMONIC_PAIR[s.root] === s.rootAlias, {
    message: "rootAlias must be the enharmonic partner of root",
    path: ["rootAlias"],
  })
  .refine(
    (s) =>
      s.intervals === (s.type === "major" ? "W-W-H-W-W-W-H" : "W-H-W-W-H-W-W"),
    {
      message: "intervals must match the type pattern",
      path: ["intervals"],
    },
  )
  .refine(
    (s) => s.displaySpelling === s.root || s.displaySpelling === s.rootAlias,
    {
      message: "displaySpelling must be root or rootAlias",
      path: ["displaySpelling"],
    },
  )
  .refine(
    (s) => {
      const orders = s.diagram.positions.map((pos) => pos.order).sort();
      return orders.every((value, index) => value === index + 1);
    },
    {
      message: "position order must be exactly 1-8",
      path: ["diagram"],
    },
  );

export type Course = z.infer<typeof courseSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type Game = z.infer<typeof gameSchema>;
export type ChordDiagram = z.infer<typeof chordDiagramSchema>;
export type Chord = z.infer<typeof chordSchema>;
export type ScaleDiagram = z.infer<typeof scaleDiagramSchema>;
export type Scale = z.infer<typeof scaleSchema>;
export type Progression = z.infer<typeof progressionSchema>;
export type LessonSection = z.infer<typeof lessonSectionSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
