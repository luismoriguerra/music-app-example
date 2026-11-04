import { marked } from "marked";
import type { Chord, Lesson } from "./content/schemas";

/**
 * Pure lesson helpers (R4, contracts/content-schema.md). Zero Astro imports:
 * the topic route passes collection data in; the reader renders it out.
 */

/**
 * Map every progression chord name in the lesson to its Chords reference
 * entry by exact `name` match (names are globally unique). Unresolvable
 * names map to null — a content error per validateCollections rule 15;
 * callers must handle null without crashing.
 */
export function resolveLessonChords(
  lesson: Lesson,
  chords: readonly Chord[],
): Map<string, Chord | null> {
  const byName = new Map(chords.map((c) => [c.name, c]));
  const out = new Map<string, Chord | null>();
  for (const section of lesson.sections) {
    for (const progression of section.progressions) {
      for (const name of progression.chords) {
        if (!out.has(name)) {
          out.set(name, byName.get(name) ?? null);
        }
      }
    }
  }
  return out;
}

/**
 * Render one Markdown prose string to HTML at build time (sync only).
 * Input is schema-guaranteed free of raw HTML (R2); output is emitted
 * via Astro `set:html` in the lesson reader.
 */
export function renderProse(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string;
}

/**
 * Slugify a section heading into an anchor id: lowercase, diacritics
 * stripped, runs of non-alphanumerics collapsed to single dashes.
 */
export function slugifyHeading(heading: string): string {
  const slug = heading
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "section";
}

/**
 * One anchor id per heading, deduplicated (`overview`, `overview-2`, …)
 * so repeated headings still link unambiguously from the chapter index.
 * `reserved` ids (default: the hardcoded `introduction`/`summary` anchors
 * in LessonReader) are treated as already taken, so a section titled
 * e.g. "Summary" yields `summary-2` instead of a duplicate id.
 */
export function sectionSlugs(
  headings: readonly string[],
  reserved: readonly string[] = ["introduction", "summary"],
): string[] {
  const used = new Set<string>(reserved.map((r) => slugifyHeading(r)));
  const counts = new Map<string, number>();
  return headings.map((heading) => {
    const base = slugifyHeading(heading);
    let suffix = counts.get(base) ?? 0;
    let candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    while (used.has(candidate)) {
      suffix = suffix === 0 ? 1 : suffix + 1;
      candidate = `${base}-${suffix + 1}`;
    }
    counts.set(base, suffix === 0 ? 1 : suffix + 1);
    used.add(candidate);
    return candidate;
  });
}
