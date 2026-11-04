// Thin Astro wiring only: collections + pure schemas from lib/.
// Cross-collection checks run in scripts/check-content.ts (prebuild gate).
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import {
  chordSchema,
  courseSchema,
  gameSchema,
  scaleSchema,
  topicSchema,
} from "./lib/content/schemas";

const courses = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/courses" }),
  schema: courseSchema,
});

const topics = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/topics" }),
  schema: topicSchema,
});

const games = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/games" }),
  schema: gameSchema,
});

const chords = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/chords" }),
  schema: chordSchema,
});

const scales = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/scales" }),
  schema: scaleSchema,
});

export const collections = { courses, topics, games, chords, scales };
