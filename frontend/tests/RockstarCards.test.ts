import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import CourseCard from "@/components/CourseCard.astro";
import TopicGameCard from "@/components/TopicGameCard.astro";
import { renderAstro } from "./astro-container";
import { SHEET_GAME_SLUG } from "@/lib/routes";

const PAGES = join(process.cwd(), "src", "pages");
const source = (file: string) => readFileSync(join(PAGES, file), "utf8");
const countLinks = (html: string) => html.split("<a ").length - 1;

const BALANCED_GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr";

describe("RockstarCards: CourseCard (FR-005/FR-007)", () => {
  const props = {
    title: "Ukulele",
    slug: "ukulele",
    description: "Start strumming today.",
    cover: "ukulele",
  };

  it("renders badge visual, title, description, and entry affordance", async () => {
    const html = await renderAstro(CourseCard, { props });
    expect(html).toContain('data-testid="ukulele-badge"');
    expect(html).toContain("Ukulele");
    expect(html).toContain("Start strumming today.");
    expect(html).toContain('href="/courses/ukulele"');
    expect(html).toContain("Open course");
  });

  it("is one stretched link: whole surface, single Tab stop, visible focus", async () => {
    const html = await renderAstro(CourseCard, { props });
    expect(countLinks(html)).toBe(1);
    expect(html).toContain("after:absolute after:inset-0");
    expect(html).toContain("relative");
    expect(html).toContain("has-[a:focus-visible]");
  });

  it("carries balanced-grid and 44px+ affordance classes", async () => {
    const html = await renderAstro(CourseCard, { props });
    expect(html).toContain("h-full");
    expect(html).toContain("min-h-11");
  });

  it("keeps today's fallback for unknown covers", async () => {
    const html = await renderAstro(CourseCard, {
      props: { title: "Banjo", slug: "banjo", description: "Twang." },
    });
    expect(html).toContain(">B<");
    expect(countLinks(html)).toBe(1);
  });
});

describe("RockstarCards: TopicGameCard (FR-006/FR-007)", () => {
  const props = {
    title: "Chords",
    slug: "chords",
    courseSlug: "ukulele",
    kind: "topic" as const,
    description: "Every chord you need.",
  };

  it("renders kind label, title, description, and entry affordance", async () => {
    const html = await renderAstro(TopicGameCard, { props });
    expect(html).toContain("Topic");
    expect(html).toContain("Chords");
    expect(html).toContain("Every chord you need.");
    expect(html).toContain('href="/courses/ukulele/topics/chords"');
    expect(html).toContain("Open topic");
  });

  it("is one stretched link: whole surface, single Tab stop, visible focus", async () => {
    const html = await renderAstro(TopicGameCard, { props });
    expect(countLinks(html)).toBe(1);
    expect(html).toContain("after:absolute after:inset-0");
    expect(html).toContain("relative");
    expect(html).toContain("has-[a:focus-visible]");
  });

  it("carries balanced-grid and 44px+ affordance classes", async () => {
    const html = await renderAstro(TopicGameCard, { props });
    expect(html).toContain("h-full");
    expect(html).toContain("min-h-11");
  });
});

describe("RockstarCards: page grids (FR-008)", () => {
  it("home composes Hero above a balanced grid", () => {
    const src = source("index.astro");
    expect(src).toContain("<Hero");
    expect(src).toContain(BALANCED_GRID);
    expect(src).toContain('data-testid="course-grid"');
  });

  it("home quick access resolves the shipped Lyrics + Chords game (FR-001a)", () => {
    // index.astro hides Quick access when no game has SHEET_GAME_SLUG, so a
    // renamed slug would silently drop the card without a build error.
    const game = JSON.parse(
      readFileSync(
        join(process.cwd(), "src", "content", "games", "lyrics-chords.json"),
        "utf8",
      ),
    ) as { slug: string };
    expect(game.slug).toBe(SHEET_GAME_SLUG);
  });

  it("course page composes Hero above a balanced grid", () => {
    const src = source("courses/[course].astro");
    expect(src).toContain("<Hero");
    expect(src).toContain(BALANCED_GRID);
    expect(src).toContain('data-testid="topic-game-grid"');
  });

  it("grids stay mobile-first single column (no page sideways scroll)", () => {
    for (const file of ["index.astro", "courses/[course].astro"]) {
      const src = source(file);
      expect(src).toContain("grid gap-4 sm:grid-cols-2");
      expect(src).not.toContain("overflow-x-auto");
    }
  });
});
