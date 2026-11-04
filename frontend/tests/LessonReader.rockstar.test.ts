import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LessonReader from "@/components/LessonReader.astro";
import { NeckFrame } from "@/components/NeckFrame";
import { TransposeControl } from "@/components/TransposeControl";
import { HELPER_BUTTON_CLASS } from "@/components/TransposeControl";
import type { Chord, Lesson } from "@/lib/content/schemas";
import { sectionSlugs } from "@/lib/lessons";
import { renderAstro } from "./astro-container";

function fixtureLesson(): Lesson {
  return {
    intro: ["Intro prose."],
    sections: [
      {
        heading: "First Section",
        paragraphs: ["First section prose."],
        progressions: [
          {
            name: "Circle in C",
            key: "C",
            type: "major",
            degrees: ["I", "vi", "IV", "V"],
            chords: ["C major", "A minor", "F major", "G major"],
          },
        ],
      },
      {
        heading: "Second Section",
        paragraphs: ["Second section prose."],
        progressions: [],
      },
    ],
    summary: ["Closing summary prose."],
  };
}

const mkChord = (name: string): Chord => ({
  name,
  type: "major",
  root: "C",
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

const resolved = new Map<string, Chord | null>([
  ["C major", mkChord("C major")],
  ["A minor", mkChord("A minor")],
  ["F major", mkChord("F major")],
  ["G major", mkChord("G major")],
]);

const render = () =>
  renderAstro(LessonReader, {
    props: { lesson: fixtureLesson(), resolved },
  });

describe("LessonReader mobile chapter control (FR-015)", () => {
  it("renders a collapsed details control above the text on phones", async () => {
    const html = await render();
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
    const details = html.slice(html.indexOf("<details"));
    expect(details).toContain("lg:hidden");
    expect(html).toContain("In this chapter — 2 sections");
    // Control precedes the article.
    expect(html.indexOf("<details")).toBeLessThan(html.indexOf("<article"));
  });

  it("keeps the sticky desktop index for wide viewports", async () => {
    const html = await render();
    const aside = html.match(/<aside[^>]*>/)?.[0] ?? "";
    expect(aside).toContain("hidden");
    expect(aside).toContain("lg:block");
    expect(aside).toContain("lg:sticky");
    expect(html).toContain('aria-label="In this chapter"');
  });

  it("links both controls to introduction, sections, and summary", async () => {
    const html = await render();
    const slugs = sectionSlugs(["First Section", "Second Section"]);
    for (const anchor of ["introduction", ...slugs, "summary"]) {
      // Once in <details>, once in <aside>.
      expect(
        html.split(`<a href="#${anchor}"`).length - 1,
        `links to #${anchor}`,
      ).toBe(2);
    }
  });

  it("cues the current section via :target mechanics, zero JS", async () => {
    const html = await render();
    const slugs = sectionSlugs(["First Section", "Second Section"]);
    // Every anchor target is focusable (link activation moves AT focus)
    // and clears the sticky header.
    for (const anchor of ["introduction", ...slugs, "summary"]) {
      const tag = html.slice(html.indexOf(`id="${anchor}"`) - 120);
      expect(tag).toContain('tabindex="-1"');
      expect(tag).toContain("scroll-mt-");
    }
    // Per-slug :has(:target) rules highlight the matching chapter link;
    // [aria-current] selector is wired for the deferred scrollspy island.
    expect(html).toContain(":has(#first-section:target)");
    expect(html).toContain(":has(#summary:target)");
    expect(html).toContain('[aria-current="true"]');
    expect(html).not.toContain("<script");
  });
});

describe("LessonReader measure + figures (FR-016)", () => {
  it("retains the 65ch reading measure", async () => {
    const html = await render();
    expect(html).toContain("max-w-[65ch]");
  });

  it("keeps chord figures in a no-overlap grid", async () => {
    const html = await render();
    expect(html).toContain('data-testid="progression"');
    expect(html).toContain("grid-cols-2");
    expect(html).toContain("sm:grid-cols-4");
  });
});

describe("NeckFrame (FR-017)", () => {
  // Single implementation: NeckFrame.tsx (React islands cannot import .astro;
  // see converge note on contracts/components.md naming NeckFrame.astro).
  it("renders a pannable labeled region with a 640px child slot", () => {
    const html = renderToStaticMarkup(
      NeckFrame({ children: "neck-svg" }) as never,
    );
    expect(html).toContain('data-testid="neck-frame"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('role="region"');
    expect(html).toContain("aria-label=");
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("min-w-[640px]");
    expect(html).toContain("neck-svg");
  });

  it("shows a visible swipe hint", () => {
    const html = renderToStaticMarkup(
      NeckFrame({ children: "neck-svg" }) as never,
    );
    expect(html.toLowerCase()).toContain("swipe");
  });
});

describe("Media controls 44px+ (FR-018)", () => {
  it("transpose stepper buttons meet the touch target", () => {
    const html = renderToStaticMarkup(
      TransposeControl({ value: 0, onChange: () => {} }) as never,
    );
    expect(html).toContain("min-h-11");
    expect(html).toContain("min-w-11");
  });

  it("helper/voice action buttons meet the touch target", () => {
    expect(HELPER_BUTTON_CLASS).toContain("min-h-11");
  });
});
