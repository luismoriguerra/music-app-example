import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { experimental_AstroContainer as AstroContainer } from "astro/container";
import CircleList from "@/components/CircleList";
import {
  collectLessonCircles,
  diatonicChords,
  filterCircles,
} from "@/lib/circles";
import {
  chordSchema,
  courseSchema,
  gameSchema,
  scaleSchema,
  topicSchema,
} from "@/lib/content/schemas";
import { validateCollections } from "@/lib/content/validate";
import { renderAstro } from "./astro-container";
type AstroComponent = Parameters<AstroContainer["renderToString"]>[0];
// React islands render through the container at runtime; the factory type
// only covers .astro components, hence the cast.
const CircleListIsland = CircleList as unknown as AstroComponent;

const CONTENT = join(process.cwd(), "src", "content");
const load = (dir: string) => {
  try {
    return readdirSync(join(CONTENT, dir))
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(CONTENT, dir, f), "utf8")));
  } catch {
    return [];
  }
};

/** Mirror the [topic].astro circles branch: same-course lessons + full chord reference. */
const circlesProps = () => {
  const topics = load("topics").map((t) => topicSchema.parse(t));
  const chords = load("chords").map((c) => chordSchema.parse(c));
  const circles = collectLessonCircles(
    topics.filter((t) => t.courseSlug === "ukulele"),
  );
  return { circles, chords };
};

describe("CirclesTopic container (US1)", () => {
  it("renders the reworked explorer for the circles route (FR-001/FR-005)", async () => {
    const { circles, chords } = circlesProps();
    expect(circles).toHaveLength(24);
    expect(chords).toHaveLength(36);
    const html = await renderAstro(CircleListIsland, {
      props: { circles, chords },
    });
    expect(html).toContain("Circles");
    expect(html).toContain("(<!-- -->24<!-- -->)");
    expect(html).toContain('data-testid="circle-filter"');
    expect(html).toContain('data-testid="circle-list"');
    for (const circle of circles) {
      expect(html).toContain(circle.name.replace(/'/g, "&#x27;"));
    }
    // Reworked cards carry key + type + progression (FR-005).
    expect(html).toContain("Key of");
    expect(html).toContain("Major");
    expect(html).toContain("I – vi – IV – V");
  });

  it("opens via focus view, not inline expansion (FR-004)", async () => {
    const { circles, chords } = circlesProps();
    const html = await renderAstro(CircleListIsland, {
      props: { circles, chords },
    });
    // No inline-expansion affordances survive the rework.
    expect(html).not.toContain("aria-expanded");
    expect(html).not.toContain("circle-detail");
  });

  it("keeps the responsive grid so 360px never overflows (SC-007)", async () => {
    const { circles, chords } = circlesProps();
    const html = await renderAstro(CircleListIsland, {
      props: { circles, chords },
    });
    expect(html).toContain("sm:grid-cols-2");
    expect(html).toContain("lg:grid-cols-3");
  });
});
describe("CirclesTopic minor circles (US4)", () => {
  it("ships exactly 24 circles, 12 per type (FR-016)", () => {
    const { circles } = circlesProps();
    expect(circles).toHaveLength(24);
    expect(circles.filter((c) => c.type === "major")).toHaveLength(12);
    expect(circles.filter((c) => c.type === "minor")).toHaveLength(12);
  });

  it("lists exactly the 12 minor circles on the Minor filter (FR-002/FR-016)", () => {
    const { circles } = circlesProps();
    const minors = filterCircles(circles, "minor");
    expect(minors).toHaveLength(12);
    expect(minors.every((c) => c.type === "minor")).toBe(true);
  });

  it("derives exact A-minor diatonic rows (FR-007/FR-016)", () => {
    const { circles, chords } = circlesProps();
    const aMinor = circles.find((c) => c.key === "A" && c.type === "minor")!;
    const rows = diatonicChords(aMinor, chords);
    expect(rows.map((r) => [r.degree, r.note, r.chord?.name])).toEqual([
      ["i", "A", "A minor"],
      ["ii°", "B", "B diminished"],
      ["III", "C", "C major"],
      ["iv", "D", "D minor"],
      ["v", "E", "E minor"],
      ["VI", "F", "F major"],
      ["VII", "G", "G major"],
    ]);
  });

  it("validates the full real graph with zero errors (FR-014/FR-016)", () => {
    const courses = load("courses").map((c) => courseSchema.parse(c));
    const topics = load("topics").map((t) => topicSchema.parse(t));
    const games = load("games").map((g) => gameSchema.parse(g));
    const chords = load("chords").map((c) => chordSchema.parse(c));
    const scales = load("scales").map((s) => scaleSchema.parse(s));
    expect(
      validateCollections({ courses, topics, games, chords, scales }),
    ).toEqual([]);
  });
});
