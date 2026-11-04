import { describe, expect, it } from "vitest";
import {
  renderProse,
  resolveLessonChords,
  sectionSlugs,
  slugifyHeading,
} from "@/lib/lessons";
import type { Chord, Lesson } from "@/lib/content/schemas";

function makeChord(name: string): Chord {
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
  };
}

function makeLesson(progressions: string[][]): Lesson {
  return {
    intro: ["Intro."],
    sections: progressions.map((chords, i) => ({
      heading: `Section ${i + 1}`,
      paragraphs: ["Prose."],
      progressions: [
        {
          name: `Circle ${i + 1}`,
          key: "C",
          type: "major",
          degrees: chords.map((_, j) => `d${j}`),
          chords,
        },
      ],
    })),
    summary: ["Summary."],
  };
}

const library = [
  makeChord("C major"),
  makeChord("A minor"),
  makeChord("Bb / A# major"),
];

describe("resolveLessonChords", () => {
  it("matches references by exact chord name", () => {
    const lesson = makeLesson([["C major", "A minor"]]);
    const resolved = resolveLessonChords(lesson, library);
    expect(resolved.get("C major")).toMatchObject({ name: "C major" });
    expect(resolved.get("A minor")).toMatchObject({ name: "A minor" });
  });

  it("matches combined enharmonic names", () => {
    const lesson = makeLesson([["Bb / A# major"]]);
    const resolved = resolveLessonChords(lesson, library);
    expect(resolved.get("Bb / A# major")).toMatchObject({
      name: "Bb / A# major",
    });
  });

  it("maps unresolved names to null without throwing", () => {
    const lesson = makeLesson([["C major", "H major"]]);
    const resolved = resolveLessonChords(lesson, library);
    expect(resolved.get("C major")).not.toBeNull();
    expect(resolved.get("H major")).toBeNull();
  });

  it("covers every progression across sections", () => {
    const lesson = makeLesson([["C major"], ["A minor", "Bb / A# major"]]);
    const resolved = resolveLessonChords(lesson, library);
    expect([...resolved.keys()].sort()).toEqual([
      "A minor",
      "Bb / A# major",
      "C major",
    ]);
  });
});

describe("renderProse", () => {
  it("returns an HTML string synchronously", () => {
    const html = renderProse("Hello.");
    expect(typeof html).toBe("string");
    expect(html).toContain("<p>Hello.</p>");
  });

  it("renders emphasis", () => {
    expect(renderProse("A *loop* of **chords**.")).toContain("<em>loop</em>");
    expect(renderProse("A *loop* of **chords**.")).toContain(
      "<strong>chords</strong>",
    );
  });

  it("renders lists", () => {
    const html = renderProse("Points:\n\n- tension\n- release");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>tension</li>");
    expect(html).toContain("<li>release</li>");
  });
});

describe("slugifyHeading", () => {
  it("lowercases and dashes headings", () => {
    expect(slugifyHeading("What Is a Harmonic Circle?")).toBe(
      "what-is-a-harmonic-circle",
    );
  });

  it("collapses punctuation and dashes", () => {
    expect(slugifyHeading("Circle in C — the 50s Progression")).toBe(
      "circle-in-c-the-50s-progression",
    );
  });

  it("strips diacritics", () => {
    expect(slugifyHeading("Círculos Armónicos")).toBe("circulos-armonicos");
  });

  it("falls back for empty slugs", () => {
    expect(slugifyHeading("???")).toBe("section");
  });
});

describe("sectionSlugs", () => {
  it("dedupes repeated headings", () => {
    expect(sectionSlugs(["Overview", "Drills", "Overview"])).toEqual([
      "overview",
      "drills",
      "overview-2",
    ]);
  });

  it("avoids the reserved introduction/summary ids", () => {
    expect(sectionSlugs(["Summary"])).toEqual(["summary-2"]);
    expect(sectionSlugs(["Introduction"])).toEqual(["introduction-2"]);
  });
});
