import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { experimental_AstroContainer as AstroContainer } from "astro/container";
import SheetGenerator from "@/components/SheetGenerator";
import { STARTER_SONGS } from "@/lib/sheets/starter-songs";
import { renderAstro } from "./astro-container";

type AstroComponent = Parameters<AstroContainer["renderToString"]>[0];
// React islands render through the container at runtime; the factory type
// only covers .astro components, hence the cast.
const GeneratorIsland = SheetGenerator as unknown as AstroComponent;

const GAME_ROUTE = join(
  process.cwd(),
  "src",
  "pages",
  "courses",
  "[course]",
  "games",
  "[game].astro",
);
const ISLAND_SRC = join(
  process.cwd(),
  "src",
  "components",
  "SheetGenerator.tsx",
);
const routeSrc = readFileSync(GAME_ROUTE, "utf8");

describe("RockstarGame: breadcrumb (FR-011)", () => {
  it("renders Courses / {course} / {game} with the real course title", () => {
    expect(routeSrc).toContain("course?.title");
    expect(routeSrc).toContain("getCollection(");
    expect(routeSrc).toContain('"courses"');
    const lines = routeSrc.split("\n").map((line) => line.trim());
    expect(lines).not.toContain("Course");
  });
});

describe("RockstarGame: quick-start SSR shell (FR-009)", () => {
  it("renders explanation + starter chips before hydration", async () => {
    const html = await renderAstro(GeneratorIsland, {
      props: { catalog: [] },
    });
    expect(html).toContain("Start with an example");
    expect(html).toContain("no typing needed");
    expect(STARTER_SONGS.length).toBeGreaterThanOrEqual(4);
    for (const starter of STARTER_SONGS) {
      expect(html).toContain(starter);
    }
  });
});

describe("RockstarGame: two-column shell + unchanged routes (FR-010/FR-023)", () => {
  it("composes input/results/history beside tips on wide screens", () => {
    const src = readFileSync(ISLAND_SRC, "utf8");
    expect(src).toContain("lg:grid lg:grid-cols-[1fr_320px]");
  });

  it("keeps getStaticPaths and addresses untouched", () => {
    expect(routeSrc).toContain("gameStaticPaths((await getCollection");
  });
});
