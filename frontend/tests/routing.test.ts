import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import NotFound from "@/pages/404.astro";
import { renderAstro } from "./astro-container";
import { courseSchema, gameSchema, topicSchema } from "@/lib/content/schemas";
import {
  courseStaticPaths,
  gameStaticPaths,
  sheetEntryShellStaticPaths,
  topicStaticPaths,
} from "@/lib/routes";
import { uniqueSlugs } from "@/lib/slug";

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

describe("routing (FR-014/SC-006)", () => {
  it("static paths cover exactly the seeded course/topic/game slugs", () => {
    const courses = load("courses").map((c) => courseSchema.parse(c));
    const topics = load("topics").map((t) => topicSchema.parse(t));
    const games = load("games").map((g) => gameSchema.parse(g));

    expect(courseStaticPaths(courses).map((p) => p.params.course)).toEqual([
      "ukulele",
    ]);
    expect(
      topicStaticPaths(topics)
        .map((p) => p.params)
        .sort((a, b) => a.topic.localeCompare(b.topic)),
    ).toEqual([
      { course: "ukulele", topic: "chords" },
      { course: "ukulele", topic: "circles" },
      { course: "ukulele", topic: "harmonic-circles" },
      { course: "ukulele", topic: "scales" },
    ]);
    // 004 ships the first game: the reserved route produces exactly the
    // seeded game page (contracts/game-route.md); unknown slugs still 404.
    expect(gameStaticPaths(games).map((p) => p.params)).toEqual([
      { course: "ukulele", game: "lyrics-chords" },
    ]);
  });

  it("sheet entry shell paths exist only for courses owning the lyrics-chords game", () => {
    const game = (slug: string, courseSlug: string) =>
      ({ slug, courseSlug }) as Parameters<typeof gameStaticPaths>[0][number];
    const lyrics = game("lyrics-chords", "ukulele");
    const paths = sheetEntryShellStaticPaths([
      game("other-game", "guitar"),
      lyrics,
    ]);
    expect(paths).toEqual([
      { params: { course: "ukulele" }, props: { game: lyrics } },
    ]);
  });

  it("static paths forward entry data as props keyed by route kind", () => {
    const course = courseSchema.parse({
      title: "Banjo",
      slug: "banjo",
      description: "Twang.",
    });
    const [path] = courseStaticPaths([course]);
    expect(path.props.course).toBe(course);
    expect(courseStaticPaths([])).toEqual([]);
  });

  it("404 page renders a not-found message and a working link back to the catalog", async () => {
    const html = await renderAstro(NotFound);
    expect(html).toContain('data-testid="not-found"');
    expect(html).toContain("404");
    expect(html).toContain('href="/"');
    expect(html).toContain("Back to catalog");
  });

  it("duplicate titles resolve to -2 suffix loudly (no silent overwrite)", () => {
    const slugs = uniqueSlugs(["Chords", "Chords"]);
    expect(slugs).toEqual(["chords", "chords-2"]);
    expect(new Set(slugs).size).toBe(2);
  });
});
