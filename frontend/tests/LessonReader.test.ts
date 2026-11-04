import { describe, expect, it } from "vitest";
import LessonReader from "@/components/LessonReader.astro";
import type { Chord, Lesson } from "@/lib/content/schemas";
import { renderAstro } from "./astro-container";

function fixtureLesson(): Lesson {
  return {
    intro: ["Intro *emphasis* and **strong** text."],
    sections: [
      {
        heading: "First Section",
        paragraphs: ["First section prose.", "Points:\n\n- tension\n- release"],
        progressions: [],
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

const emptyResolved = new Map<string, Chord | null>();

/** Article slice: the chapter index repeats headings before the prose. */
function articleHtml(html: string): string {
  const start = html.indexOf("<article");
  const end = html.indexOf("</article>");
  return start === -1 || end === -1 ? html : html.slice(start, end);
}

function headingTexts(html: string): string[] {
  return [...articleHtml(html).matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map(
    (m) => m[1],
  );
}

describe("LessonReader prose (FR-003/FR-006/FR-009)", () => {
  it("renders intro, sections, and summary in reading order", async () => {
    const html = await renderAstro(LessonReader, {
      props: { lesson: fixtureLesson(), resolved: emptyResolved },
    });
    const order = [
      "Intro",
      "First Section",
      "First section prose.",
      "Second Section",
      "Second section prose.",
      "Closing summary prose.",
    ];
    // Order is asserted within the article: the chapter index repeats
    // headings before the prose by design.
    const article = articleHtml(html);
    let last = -1;
    for (const text of order) {
      const at = article.indexOf(text);
      expect(at, `expected "${text}" in output`).toBeGreaterThan(last);
      last = at;
    }
  });

  it("renders Markdown emphasis and lists", async () => {
    const html = await renderAstro(LessonReader, {
      props: { lesson: fixtureLesson(), resolved: emptyResolved },
    });
    expect(html).toContain("<em>emphasis</em>");
    expect(html).toContain("<strong>strong</strong>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>tension</li>");
    expect(html).toContain("<li>release</li>");
  });

  it("renders section headings as h2 in section order", async () => {
    const html = await renderAstro(LessonReader, {
      props: { lesson: fixtureLesson(), resolved: emptyResolved },
    });
    expect(headingTexts(html)).toEqual(["First Section", "Second Section"]);
  });

  it("renders a friendly empty state when the chapter has no sections", async () => {
    const html = await renderAstro(LessonReader, {
      props: {
        lesson: { ...fixtureLesson(), sections: [] },
        resolved: emptyResolved,
      },
    });
    expect(html).toContain("This lesson has no sections yet.");
    expect(html).not.toContain('data-testid="lesson-reader"');
    expect(html).not.toContain('data-testid="lesson-toc"');
  });

  it("constrains the chapter to a readable measure", async () => {
    const html = await renderAstro(LessonReader, {
      props: { lesson: fixtureLesson(), resolved: emptyResolved },
    });
    const article = html.match(
      /<article[^>]*data-testid="lesson-reader"[^>]*>/,
    );
    expect(article?.[0]).toContain("max-w-[65ch]");
  });

  it("gives section headings a book-scale style", async () => {
    const html = await renderAstro(LessonReader, {
      props: { lesson: fixtureLesson(), resolved: emptyResolved },
    });
    const firstH2 = html.match(/<h2[^>]*>/);
    expect(firstH2?.[0]).toContain("text-2xl");
  });
});

function makeChord(name: string, overrides: Partial<Chord> = {}): Chord {
  return {
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
    ...overrides,
  };
}

describe("LessonReader progressions (FR-004/FR-005/FR-008)", () => {
  const progressionLesson: Lesson = {
    intro: ["Intro."],
    sections: [
      {
        heading: "Circle in C",
        paragraphs: ["Prose."],
        progressions: [
          {
            name: "Circle in C — the 50s progression",
            key: "C",
            type: "major",
            degrees: ["I", "vi", "IV", "V"],
            chords: ["C major", "A minor", "F major", "G major"],
          },
        ],
      },
      {
        heading: "Circle in F",
        paragraphs: ["Prose."],
        progressions: [
          {
            name: "Circle in F — meeting B flat",
            key: "F",
            type: "major",
            degrees: ["I", "vi", "IV", "V"],
            chords: ["F major", "D minor", "Bb / A# major", "C major"],
          },
        ],
      },
    ],
    summary: ["Summary."],
  };

  const library = new Map<string, Chord | null>([
    ["C major", makeChord("C major")],
    [
      "A minor",
      makeChord("A minor", { type: "minor", root: "A", rootPitch: 9 }),
    ],
    ["F major", makeChord("F major", { root: "F", rootPitch: 5 })],
    ["G major", makeChord("G major", { root: "G", rootPitch: 7 })],
    [
      "D minor",
      makeChord("D minor", { type: "minor", root: "D", rootPitch: 2 }),
    ],
    [
      "Bb / A# major",
      makeChord("Bb / A# major", {
        root: "Bb",
        rootAlias: "A#",
        rootPitch: 10,
      }),
    ],
  ]);

  it("renders the progression name, key, and scale degrees", async () => {
    const html = await renderAstro(LessonReader, {
      props: { lesson: progressionLesson, resolved: library },
    });
    expect(html).toContain("Circle in C — the 50s progression");
    expect(html).toContain("Key of C");
    expect(html).toContain("I – vi – IV – V");
  });

  it("shows every chord with its name and a static diagram", async () => {
    const html = await renderAstro(LessonReader, {
      props: { lesson: progressionLesson, resolved: library },
    });
    for (const name of ["C major", "A minor", "F major", "G major"]) {
      expect(html).toContain(name);
    }
    const diagrams = html.match(/<svg/g) ?? [];
    expect(diagrams.length).toBeGreaterThanOrEqual(8);
  });

  it("resolves combined enharmonic names", async () => {
    const html = await renderAstro(LessonReader, {
      props: { lesson: progressionLesson, resolved: library },
    });
    expect(html).toContain("Bb / A# major");
  });

  it("renders unresolved references safely without crashing", async () => {
    const lesson: Lesson = {
      ...progressionLesson,
      sections: [
        {
          heading: "Broken",
          paragraphs: ["Prose."],
          progressions: [
            {
              name: "Broken circle",
              key: "C",
              type: "major",
              degrees: ["I", "V", "I"],
              chords: ["C major", "H major", "C major"],
            },
          ],
        },
      ],
    };
    const resolved = new Map<string, Chord | null>([
      ["C major", makeChord("C major")],
      ["H major", null],
    ]);
    let html = "";
    await expect(
      (async () => {
        html = await renderAstro(LessonReader, { props: { lesson, resolved } });
      })(),
    ).resolves.not.toThrow();
    expect(html).toContain("H major");
    expect(html).toContain("Diagram unavailable");
  });
});

describe("LessonReader chapter index", () => {
  it("renders a labelled index linking intro, sections, and summary", async () => {
    const html = await renderAstro(LessonReader, {
      props: { lesson: fixtureLesson(), resolved: emptyResolved },
    });
    expect(html).toContain('data-testid="lesson-toc"');
    expect(html).toContain('aria-label="In this chapter"');
    expect(html).toContain('href="#introduction"');
    expect(html).toContain('href="#first-section"');
    expect(html).toContain('href="#second-section"');
    expect(html).toContain('href="#summary"');
  });

  it("anchors every index link to a matching id in the article", async () => {
    const html = await renderAstro(LessonReader, {
      props: { lesson: fixtureLesson(), resolved: emptyResolved },
    });
    expect(html).toContain('id="introduction"');
    expect(html).toContain('id="first-section"');
    expect(html).toContain('id="second-section"');
    expect(html).toContain('id="summary"');
  });

  it("places the index before the article for keyboard readers", async () => {
    const html = await renderAstro(LessonReader, {
      props: { lesson: fixtureLesson(), resolved: emptyResolved },
    });
    expect(html.indexOf("<aside")).toBeGreaterThan(-1);
    expect(html.indexOf("<aside")).toBeLessThan(html.indexOf("<article"));
  });

  it("docks the index beside the article on wide screens", async () => {
    const html = await renderAstro(LessonReader, {
      props: { lesson: fixtureLesson(), resolved: emptyResolved },
    });
    expect(html).toContain('data-testid="lesson-layout"');
    const aside = html.match(/<aside[^>]*>/);
    expect(aside?.[0]).toContain("lg:order-2");
    expect(aside?.[0]).toContain("lg:sticky");
  });
});
