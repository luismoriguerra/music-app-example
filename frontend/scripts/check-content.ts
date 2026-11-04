/**
 * Content integrity gate (prebuild). Reads src/content/**\/*.json, parses each
 * entry with the pure Zod schemas, then runs validateCollections(). Exits
 * non-zero naming the broken entry on any failure.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ZodError, type ZodType } from "zod";
import {
  chordSchema,
  courseSchema,
  gameSchema,
  scaleSchema,
  topicSchema,
} from "../src/lib/content/schemas";
import { validateCollections } from "../src/lib/content/validate";

const CONTENT_ROOT = join(process.cwd(), "src", "content");
const failures: string[] = [];

function loadCollection<T>(dir: string, schema: ZodType<T>): T[] {
  let files: string[] = [];
  try {
    files = readdirSync(join(CONTENT_ROOT, dir))
      .filter((f) => f.endsWith(".json"))
      .sort();
  } catch {
    return [];
  }
  const out: T[] = [];
  for (const file of files) {
    const path = join(dir, file);
    try {
      const raw = JSON.parse(readFileSync(join(CONTENT_ROOT, path), "utf8"));
      out.push(schema.parse(raw));
    } catch (err) {
      if (err instanceof ZodError) {
        for (const issue of err.issues) {
          failures.push(
            `${path} [${issue.path.join(".") || "<root>"}]: ${issue.message}`,
          );
        }
      } else {
        failures.push(`${path}: ${(err as Error).message}`);
      }
    }
  }
  return out;
}

const courses = loadCollection("courses", courseSchema);
const topics = loadCollection("topics", topicSchema);
const games = loadCollection("games", gameSchema);
const chords = loadCollection("chords", chordSchema);
const scales = loadCollection("scales", scaleSchema);

if (failures.length === 0) {
  failures.push(
    ...validateCollections({ courses, topics, games, chords, scales }),
  );
}

if (failures.length > 0) {
  console.error(`check-content: ${failures.length} error(s)`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `check-content: OK (${courses.length} courses, ${topics.length} topics, ${games.length} games, ${chords.length} chords, ${scales.length} scales)`,
);
