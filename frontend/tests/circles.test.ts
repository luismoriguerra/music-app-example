import { describe, expect, it } from "vitest";
import {
  CIRCLE_FILTER_ALL,
  CIRCLE_FILTER_GROUPS,
  collectLessonCircles,
  diatonicChords,
  filterCircles,
  resolveCircleChords,
  sortCircles,
} from "@/lib/circles";
import type { Chord, Progression, Topic } from "@/lib/content/schemas";
import {
  FLAT_NOTES,
  NATURAL_NOTES,
  NOTE_ALIASES,
  NOTE_ROOTS,
  ROOT_PITCH,
  SHARP_NOTES,
} from "@/lib/notes";

function makeProgression(
  name: string,
  key: Progression["key"],
  chords: string[] = ["C major", "A minor", "F major", "G major"],
  degrees: string[] = ["I", "vi", "IV", "V"],
  type: Progression["type"] = "major",
): Progression {
  return { name, key, type, degrees, chords };
}

const CATALOG_ROOTS = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

/** 36-entry catalog: 12 pitches × major/minor/diminished. */
function makeCatalog(): Chord[] {
  const out: Chord[] = [];
  for (let pitch = 0; pitch < 12; pitch++) {
    for (const quality of ["major", "minor", "diminished"] as const) {
      out.push({
        name: `${CATALOG_ROOTS[pitch]} ${quality}`,
        type: quality,
        root: "C",
        rootPitch: pitch,
        topicSlug: "chords",
        diagram: {
          strings: "GCEA",
          frets: [0, 0, 0, 0],
          fingers: [0, 0, 0, 0],
          baseFret: 1,
          barres: [],
        },
      });
    }
  }
  return out;
}

function makeLessonTopic(
  slug: string,
  sections: Progression[][],
  format: Topic["format"] = "lesson",
): Topic {
  return {
    title: slug,
    slug,
    kind: "topic",
    courseSlug: "ukulele",
    description: "Lesson.",
    format,
    lesson: {
      intro: ["Intro."],
      sections: sections.map((progressions, i) => ({
        heading: `Section ${i + 1}`,
        paragraphs: ["Prose."],
        progressions,
      })),
      summary: ["Summary."],
    },
    order: 0,
  };
}

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

describe("collectLessonCircles (FR-012)", () => {
  it("collects progressions across sections in reading order", () => {
    const a = makeProgression("Circle A", "C");
    const b = makeProgression("Circle B", "G");
    const c = makeProgression("Circle C", "F");
    const topic = makeLessonTopic("harmonic-circles", [[a, b], [c]]);
    expect(collectLessonCircles([topic])).toEqual([a, b, c]);
  });

  it("concatenates progressions across lesson topics in topic order", () => {
    const first = makeLessonTopic("first", [[makeProgression("One", "C")]]);
    const second = makeLessonTopic("second", [[makeProgression("Two", "G")]]);
    expect(collectLessonCircles([first, second]).map((p) => p.name)).toEqual([
      "One",
      "Two",
    ]);
  });

  it("skips topics without lesson content", () => {
    const lesson = makeLessonTopic("harmonic-circles", [
      [makeProgression("One", "C")],
    ]);
    const reference: Topic = {
      title: "Chords",
      slug: "chords",
      kind: "topic",
      courseSlug: "ukulele",
      description: "Reference.",
      format: "reference",
      order: 0,
    };
    expect(
      collectLessonCircles([reference, lesson]).map((p) => p.name),
    ).toEqual(["One"]);
  });

  it("returns an empty list when no lesson topics exist", () => {
    expect(collectLessonCircles([])).toEqual([]);
  });
});

describe("resolveCircleChords (FR-013)", () => {
  const library = [
    makeChord("C major"),
    makeChord("A minor"),
    makeChord("Bb / A# major"),
  ];

  it("pairs each chord name with its degree and reference entry", () => {
    const circle = makeProgression(
      "Circle in C",
      "C",
      ["C major", "A minor"],
      ["I", "vi"],
    );
    expect(resolveCircleChords(circle, library)).toEqual([
      { name: "C major", degree: "I", chord: library[0] },
      { name: "A minor", degree: "vi", chord: library[1] },
    ]);
  });

  it("resolves combined enharmonic names", () => {
    const circle = makeProgression(
      "Circle in F",
      "F",
      ["Bb / A# major"],
      ["IV"],
    );
    expect(resolveCircleChords(circle, library)).toEqual([
      { name: "Bb / A# major", degree: "IV", chord: library[2] },
    ]);
  });

  it("maps unresolved names to null without throwing", () => {
    const circle = makeProgression(
      "Broken",
      "C",
      ["C major", "H major"],
      ["I", "V"],
    );
    expect(resolveCircleChords(circle, library)).toEqual([
      { name: "C major", degree: "I", chord: library[0] },
      { name: "H major", degree: "V", chord: null },
    ]);
  });
});

describe("filterCircles grouped (FR-002)", () => {
  const circles = [
    makeProgression("Circle in C", "C"),
    makeProgression("Circle in G", "G"),
    makeProgression("Circle in F", "F"),
    makeProgression("Circle in F minor", "F", [], [], "minor"),
    makeProgression("Circle in F#", "F#"),
    makeProgression("Circle in Gb minor", "Gb", [], [], "minor"),
  ];

  it("exposes All/by-type/by-note groups mirroring Scales (FR-002)", () => {
    expect(CIRCLE_FILTER_GROUPS.map((g) => g.label)).toEqual([
      "All",
      "By type",
      "By note",
    ]);
    const byLabel = (label: string) =>
      CIRCLE_FILTER_GROUPS.find((g) => g.label === label)!.options;
    expect(byLabel("All")).toEqual([{ value: "all", label: "All circles" }]);
    expect(byLabel("By type")).toEqual([
      { value: "major", label: "Major" },
      { value: "minor", label: "Minor" },
    ]);
    expect(byLabel("By note").map((o) => o.value)).toEqual([
      ...NATURAL_NOTES,
      ...FLAT_NOTES,
      ...SHARP_NOTES,
    ]);
  });

  it("returns every circle for the All option", () => {
    expect(filterCircles(circles, CIRCLE_FILTER_ALL)).toEqual(circles);
    expect(filterCircles(circles, CIRCLE_FILTER_ALL)).not.toBe(circles);
  });

  it("matches type options on circle.type", () => {
    expect(filterCircles(circles, "major").map((p) => p.name)).toEqual([
      "Circle in C",
      "Circle in G",
      "Circle in F",
      "Circle in F#",
    ]);
    expect(filterCircles(circles, "minor").map((p) => p.name)).toEqual([
      "Circle in F minor",
      "Circle in Gb minor",
    ]);
  });

  it("matches note options by pitch for all 17 spellings", () => {
    for (const spelling of [...NOTE_ROOTS, ...NOTE_ALIASES]) {
      expect(filterCircles(circles, spelling).map((p) => p.name)).toEqual(
        circles
          .filter((c) => ROOT_PITCH[c.key] === ROOT_PITCH[spelling])
          .map((c) => c.name),
      );
    }
  });

  it("lists identical circles for enharmonic spellings (Gb/F#)", () => {
    expect(filterCircles(circles, "Gb").map((p) => p.name)).toEqual([
      "Circle in F#",
      "Circle in Gb minor",
    ]);
    expect(filterCircles(circles, "F#").map((p) => p.name)).toEqual([
      "Circle in F#",
      "Circle in Gb minor",
    ]);
  });

  it("returns an empty list for a pitch with no circles", () => {
    expect(filterCircles(circles, "D")).toEqual([]);
  });
});

describe("sortCircles", () => {
  it("orders by key pitch, then by name", () => {
    const g = makeProgression("Circle in G", "G");
    const c = makeProgression("Circle in C", "C");
    const f = makeProgression("Circle in F", "F");
    expect(sortCircles([g, c, f])).toEqual([c, f, g]);
  });

  it("orders same-key circles alphabetically", () => {
    const b = makeProgression("Zebra circle", "C");
    const a = makeProgression("Alpha circle", "C");
    expect(sortCircles([b, a])).toEqual([a, b]);
  });

  it("orders same-pitch pairs major-first (FR-003)", () => {
    const minor = makeProgression("Alpha minor", "C", [], [], "minor");
    const major = makeProgression("Zebra major", "C");
    expect(sortCircles([minor, major])).toEqual([major, minor]);
  });
});
describe("diatonicChords (FR-007/FR-008)", () => {
  const MAJOR_DEGREES = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
  const MINOR_DEGREES = ["i", "ii°", "III", "iv", "v", "VI", "VII"];
  const MAJOR_QUALITIES = [
    "major",
    "minor",
    "minor",
    "major",
    "major",
    "minor",
    "diminished",
  ];
  const MINOR_QUALITIES = [
    "minor",
    "diminished",
    "major",
    "minor",
    "minor",
    "major",
    "major",
  ];

  it("yields exactly 7 rows with exact degrees and qualities for all 24 keys", () => {
    const catalog = makeCatalog();
    for (let pitch = 0; pitch < 12; pitch++) {
      for (const type of ["major", "minor"] as const) {
        const circle = makeProgression(
          `Circle ${pitch} ${type}`,
          CATALOG_ROOTS[pitch] as Progression["key"],
          [],
          [],
          type,
        );
        const rows = diatonicChords(circle, catalog);
        expect(rows).toHaveLength(7);
        expect(rows.map((r) => r.degree)).toEqual(
          type === "major" ? MAJOR_DEGREES : MINOR_DEGREES,
        );
        expect(rows.map((r) => r.quality)).toEqual(
          type === "major" ? MAJOR_QUALITIES : MINOR_QUALITIES,
        );
        expect(rows.every((r) => r.chord !== null)).toBe(true);
      }
    }
  });

  it("carries both the Cb spelling and the B major catalog entry (FR-009)", () => {
    const rows = diatonicChords(
      makeProgression("Circle in Gb", "Gb", [], []),
      makeCatalog(),
    );
    expect(rows[3].note).toBe("Cb");
    expect(rows[3].chord?.name).toBe("B major");
  });

  it("marks exactly the progression chords in-circle (FR-010)", () => {
    const rows = diatonicChords(
      makeProgression("Circle in C", "C"),
      makeCatalog(),
    );
    expect(rows.map((r) => r.inCircle)).toEqual([
      true,
      false,
      false,
      true,
      true,
      true,
      false,
    ]);
  });

  it("maps unresolvable rows to null chords without throwing", () => {
    const catalog = makeCatalog().filter((c) => c.name !== "B diminished");
    const rows = diatonicChords(makeProgression("Circle in C", "C"), catalog);
    expect(rows[6].chord).toBeNull();
    expect(rows[6].inCircle).toBe(false);
    expect(rows.slice(0, 6).every((r) => r.chord !== null)).toBe(true);
  });
});
