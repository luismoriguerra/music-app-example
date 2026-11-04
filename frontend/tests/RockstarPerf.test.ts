import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Layout from "@/layouts/Layout.astro";
import Hero from "@/components/Hero.astro";
import CourseCard from "@/components/CourseCard.astro";
import TopicGameCard from "@/components/TopicGameCard.astro";
import UkuleleBadge from "@/components/UkuleleBadge.astro";
import LessonReader from "@/components/LessonReader.astro";
import { FilterPills } from "@/components/FilterPills";
import { ChordList } from "@/components/ChordList";
import { CircleList } from "@/components/CircleList";
import { SheetGenerator } from "@/components/SheetGenerator";
import { SourceLinks } from "@/components/SourceLinks";
import { NeckFrame } from "@/components/NeckFrame";
import { chordDisplayName, type Chord } from "@/lib/chords";
import type { Lesson, Progression } from "@/lib/content/schemas";
import { renderAstro } from "./astro-container";

const src = (file: string) =>
  readFileSync(join(process.cwd(), "src", file), "utf8");
const root = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

const mkChord = (root: Chord["root"], type: Chord["type"]): Chord => ({
  name: chordDisplayName(root, type),
  type,
  root,
  rootPitch: 0,
  topicSlug: "chords",
  diagram: {
    strings: "GCEA",
    frets: [0, 0, 0, 3],
    fingers: [0, 0, 0, 3],
    baseFret: 1,
    barres: [],
  },
});

const CIRCLE: Progression = {
  name: "Circle in C",
  key: "C",
  type: "major",
  degrees: ["I", "vi", "IV", "V"],
  chords: ["C major", "A minor", "F major", "G major"],
};

const LESSON: Lesson = {
  intro: ["Intro."],
  sections: [
    {
      heading: "First Section",
      paragraphs: ["Prose."],
      progressions: [
        {
          name: "Circle in C",
          key: "C",
          type: "major",
          degrees: ["I"],
          chords: ["C major"],
        },
      ],
    },
  ],
  summary: ["Summary."],
};

describe("RockstarPerf: deferred hydration (FR-024)", () => {
  it("explorer islands hydrate on-visible", () => {
    const page = src("pages/courses/[course]/topics/[topic].astro");
    expect(page).toMatch(/<CircleList\s+client:visible/);
    expect(page).toMatch(/<ScaleList\s+client:visible/);
    expect(page).toMatch(/<ChordList\s+client:visible/);
    expect(page).not.toContain("client:load");
  });

  it("SheetGenerator hydrates on-visible", () => {
    const page = src("pages/courses/[course]/games/[game].astro");
    expect(page).toMatch(/<SheetGenerator\s+client:visible/);
    expect(page).not.toContain("client:load");
  });

  it("ThemeToggle hydrates on-idle", () => {
    expect(src("layouts/Layout.astro")).toContain("<ThemeToggle client:idle");
  });

  it("islands render readable SSR shells pre-hydration", () => {
    const chords = renderToStaticMarkup(
      createElement(ChordList, { chords: [mkChord("C", "major")] }),
    );
    expect(chords).toContain("Chords");
    expect(chords).toContain("C major");

    const circles = renderToStaticMarkup(
      createElement(CircleList, { circles: [CIRCLE], chords: [] }),
    );
    expect(circles).toContain("Circles");
    expect(circles).toContain("Circle in C");

    const generator = renderToStaticMarkup(
      createElement(SheetGenerator, {
        gamePath: "/courses/ukulele/games/lyrics-chords",
      }),
    );
    expect(generator).toContain("Lyrics and chords generator");
    expect(generator).toContain("quick-start");
  });

  it("shell renders header, nav, and footer pre-hydration", async () => {
    const html = await renderAstro(Layout, { props: { title: "Perf" } });
    expect(html).toContain("<header");
    expect(html).toContain(">Courses<");
    expect(html).toContain("<footer");
  });
});

describe("RockstarPerf: intent prefetching (FR-025)", () => {
  it("enables prefetch in config", () => {
    expect(root("astro.config.mjs")).toContain("prefetch");
  });

  it("opts header nav into hover prefetch", async () => {
    const html = await renderAstro(Layout, { props: { title: "Perf" } });
    const header = html.slice(
      html.indexOf("<header"),
      html.indexOf("</header>"),
    );
    expect(header).toContain("data-astro-prefetch");
  });

  it("opts card links into viewport prefetch", async () => {
    const course = await renderAstro(CourseCard, {
      props: { title: "Uke", slug: "ukulele", description: "Strum." },
    });
    expect(course).toContain('data-astro-prefetch="viewport"');
    const topic = await renderAstro(TopicGameCard, {
      props: {
        title: "Circles",
        slug: "circles",
        courseSlug: "ukulele",
        kind: "topic",
        description: "Rings.",
      },
    });
    expect(topic).toContain('data-astro-prefetch="viewport"');
  });

  it("never prefetches external/source links", () => {
    const html = renderToStaticMarkup(
      createElement(SourceLinks, {
        links: [{ url: "https://example.com/x", label: "X", kind: "lyrics" }],
      }),
    );
    expect(html).not.toContain("data-astro-prefetch");
  });
});

describe("RockstarPerf: reserved space (FR-026/FR-027)", () => {
  it("heroes, cards, pills, figures, and frames hold stable slots", async () => {
    const hero = await renderAstro(Hero, {
      props: { eyebrow: "E", title: "T", subcopy: "S" },
    });
    expect(hero).toContain("rock-reserve-hero");

    const card = await renderAstro(CourseCard, {
      props: { title: "Uke", slug: "ukulele", description: "Strum." },
    });
    expect(card).toContain("rock-reserve-card");

    const gameCard = await renderAstro(TopicGameCard, {
      props: {
        title: "G",
        slug: "g",
        courseSlug: "ukulele",
        kind: "game",
        description: "Play.",
      },
    });
    expect(gameCard).toContain("rock-reserve-card");

    const pills = renderToStaticMarkup(
      createElement(FilterPills, {
        groups: [{ label: "All", options: [{ value: "all", label: "All" }] }],
        value: "all",
        counts: new Map([["all", 1]]),
        onChange: () => {},
        id: "perf",
      }),
    );
    expect(pills).toContain("rock-reserve-pills");

    const lesson = await renderAstro(LessonReader, {
      props: { lesson: LESSON, resolved: new Map() },
    });
    expect(lesson).toContain("rock-reserve-figure");

    const frame = renderToStaticMarkup(
      createElement(NeckFrame, { children: "neck" }),
    );
    expect(frame).toContain("rock-reserve-frame");
  });

  it("defines reserved-space helpers in global.css", () => {
    expect(root("src/styles/global.css")).toContain("min-height");
  });
});

describe("RockstarPerf: decorative art never gates content (FR-027)", () => {
  it("renders hero/badge art as CSS/SVG with no blocking images", async () => {
    const hero = await renderAstro(Hero, {
      props: { eyebrow: "E", title: "T", subcopy: "S", art: "stage" },
    });
    expect(hero).not.toContain("<img");
    expect(hero).toContain("rock-stage");

    const badge = await renderAstro(UkuleleBadge, {
      props: { title: "Ukulele" },
    });
    expect(badge).not.toContain("<img");
    expect(badge).toContain("<svg");
  });

  it("keeps the stage wash a pure CSS gradient", () => {
    const css = root("src/styles/global.css");
    expect(css).toContain(".rock-stage");
    expect(css).toContain("radial-gradient");
  });
});
