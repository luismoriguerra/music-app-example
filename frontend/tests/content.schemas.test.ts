import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  chordSchema,
  courseSchema,
  gameSchema,
  scaleSchema,
  topicSchema,
} from "@/lib/content/schemas";
import { validateCollections } from "@/lib/content/validate";
import { collectLessonCircles } from "@/lib/circles";
import { NOTE_ALIASES, NOTE_ROOTS } from "@/lib/notes";

const validCourse = {
  title: "Ukulele",
  slug: "ukulele",
  description: "Learn the ukulele.",
};
const validTopic = {
  title: "Chords",
  slug: "chords",
  kind: "topic",
  courseSlug: "ukulele",
  description: "Chord reference.",
};
const validGame = {
  title: "Name That Chord",
  slug: "name-that-chord",
  kind: "game",
  courseSlug: "ukulele",
  description: "Quiz.",
};
const validChord = {
  name: "C major",
  type: "major",
  root: "C",
  rootPitch: 0,
  topicSlug: "chords",
  diagram: { strings: "GCEA", frets: [0, 0, 0, 3], fingers: [0, 0, 0, 3] },
};

describe("per-entry schemas", () => {
  it("accepts one valid fixture per collection", () => {
    expect(courseSchema.parse(validCourse).slug).toBe("ukulele");
    expect(topicSchema.parse(validTopic).kind).toBe("topic");
    expect(gameSchema.parse(validGame).kind).toBe("game");
    expect(chordSchema.parse(validChord).rootPitch).toBe(0);
  });

  it("rejects invalid course (bad slug)", () => {
    expect(() =>
      courseSchema.parse({ ...validCourse, slug: "Uku Lele" }),
    ).toThrow();
  });

  it("rejects invalid topic (wrong kind literal)", () => {
    expect(() => topicSchema.parse({ ...validTopic, kind: "game" })).toThrow();
  });

  it("rejects invalid game (description too long)", () => {
    expect(() =>
      gameSchema.parse({ ...validGame, description: "x".repeat(281) }),
    ).toThrow();
  });

  it("rejects chord with bad root spelling like Hb", () => {
    expect(() => chordSchema.parse({ ...validChord, root: "Hb" })).toThrow();
  });

  it("rejects chord with mismatched rootPitch", () => {
    expect(() => chordSchema.parse({ ...validChord, rootPitch: 5 })).toThrow(
      /rootPitch/,
    );
  });

  it("rejects chord with wrong alias pair", () => {
    expect(() =>
      chordSchema.parse({
        ...validChord,
        root: "Bb",
        rootPitch: 10,
        rootAlias: "C#",
      }),
    ).toThrow(/enharmonic/);
  });

  it("applies diagram defaults (baseFret 1, barres [])", () => {
    const parsed = chordSchema.parse(validChord);
    expect(parsed.diagram.baseFret).toBe(1);
    expect(parsed.diagram.barres).toEqual([]);
  });
  it("accepts a valid diminished entry (natural root)", () => {
    const parsed = chordSchema.parse({
      name: "B diminished",
      type: "diminished",
      root: "B",
      rootPitch: 11,
      topicSlug: "chords",
      diagram: {
        strings: "GCEA",
        frets: [4, 2, 1, 2],
        fingers: [3, 2, 1, 2],
      },
    });
    expect(parsed.type).toBe("diminished");
    expect(parsed.rootPitch).toBe(11);
  });

  it("accepts a valid diminished entry (flat-first combined name)", () => {
    const parsed = chordSchema.parse({
      name: "Bb / A# diminished",
      type: "diminished",
      root: "Bb",
      rootAlias: "A#",
      rootPitch: 10,
      topicSlug: "chords",
      diagram: {
        strings: "GCEA",
        frets: [3, 1, 0, 1],
        fingers: [3, 1, 0, 1],
      },
    });
    expect(parsed.name).toBe("Bb / A# diminished");
  });

  it("rejects chord with bad diminished type word", () => {
    expect(() => chordSchema.parse({ ...validChord, type: "dim" })).toThrow();
  });

  it("rejects diminished chord with mismatched rootPitch", () => {
    expect(() =>
      chordSchema.parse({
        name: "B diminished",
        type: "diminished",
        root: "B",
        rootPitch: 5,
        topicSlug: "chords",
        diagram: {
          strings: "GCEA",
          frets: [4, 2, 1, 2],
          fingers: [3, 2, 1, 2],
        },
      }),
    ).toThrow(/rootPitch/);
  });

  it("rejects diminished chord with wrong alias pair", () => {
    expect(() =>
      chordSchema.parse({
        name: "Bb / C# diminished",
        type: "diminished",
        root: "Bb",
        rootAlias: "C#",
        rootPitch: 10,
        topicSlug: "chords",
        diagram: {
          strings: "GCEA",
          frets: [3, 1, 0, 1],
          fingers: [3, 1, 0, 1],
        },
      }),
    ).toThrow(/enharmonic/);
  });
});

function fullChordSet() {
  const chords: Array<ReturnType<typeof chordSchema.parse>> = [];
  const aliasOf: Record<string, string> = {
    Bb: "A#",
    Db: "C#",
    Eb: "D#",
    Gb: "F#",
    Ab: "G#",
  };
  const pitch: Record<string, number> = {
    C: 0,
    Db: 1,
    D: 2,
    Eb: 3,
    E: 4,
    F: 5,
    Gb: 6,
    G: 7,
    Ab: 8,
    A: 9,
    Bb: 10,
    B: 11,
  };
  // Programmatic pitch-valid fixtures (rule 28 holds by construction):
  // strings 0-2 voice the triad tones, string 3 doubles the root.
  const OPEN = [7, 0, 4, 9]; // G C E A
  const INTERVALS: Record<string, readonly [number, number, number]> = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    diminished: [0, 3, 6],
  };
  for (const root of NOTE_ROOTS) {
    for (const type of ["major", "minor", "diminished"] as const) {
      const alias = aliasOf[root];
      const display = alias ? `${root} / ${alias}` : root;
      const rootPitch = pitch[root];
      const tones = [
        INTERVALS[type][0],
        INTERVALS[type][1],
        INTERVALS[type][2],
        INTERVALS[type][0],
      ];
      const frets = tones.map(
        (interval, string) => (rootPitch + interval - OPEN[string] + 12) % 12,
      );
      chords.push(
        chordSchema.parse({
          name: `${display} ${type}`,
          type,
          root,
          ...(alias ? { rootAlias: alias } : {}),
          rootPitch,
          topicSlug: "chords",
          diagram: {
            strings: "GCEA",
            frets,
            fingers: frets.map((fret) => Math.min(fret, 4)),
          },
        }),
      );
    }
  }
  return chords;
}
describe("validateCollections (cross-collection)", () => {
  const base = () => ({
    courses: [courseSchema.parse(validCourse)],
    topics: [topicSchema.parse(validTopic)],
    games: [] as Array<ReturnType<typeof gameSchema.parse>>,
    chords: fullChordSet(),
    scales: [],
  });

  it("returns no errors for a valid graph", () => {
    // Scales rules fire on the empty scales list by design; this file asserts
    // non-scales rules (scales graphs are covered in scale.schemas.test.ts).
    expect(
      validateCollections(base()).filter((e) => !e.startsWith("scales")),
    ).toEqual([]);
  });

  it("names a topic with a dangling courseSlug", () => {
    const g = base();
    g.topics = [topicSchema.parse({ ...validTopic, courseSlug: "banjo" })];
    const errors = validateCollections(g);
    expect(
      errors.some((e) => e.includes("topics/chords") && e.includes("banjo")),
    ).toBe(true);
  });

  it("names a chord with a dangling topicSlug", () => {
    const g = base();
    g.chords[0] = { ...g.chords[0], topicSlug: "scales" };
    const errors = validateCollections(g);
    expect(
      errors.some((e) => e.includes("chords/") && e.includes("scales")),
    ).toBe(true);
  });

  it("names duplicate course slugs", () => {
    const g = base();
    g.courses.push(courseSchema.parse({ ...validCourse, title: "Ukulele 2" }));
    const errors = validateCollections(g);
    expect(
      errors.some((e) => e.includes("courses/ukulele") && /dup/i.test(e)),
    ).toBe(true);
  });

  it("flags chord count != 36", () => {
    const g = base();
    g.chords = g.chords.slice(0, 35);
    const errors = validateCollections(g);
    expect(errors.some((e) => /36/.test(e))).toBe(true);
  });

  it("builds a pitch-valid 36-entry fixture set (rule 28 holds)", () => {
    const g = base();
    expect(g.chords).toHaveLength(36);
    expect(
      validateCollections(g).filter((e) => !e.startsWith("scales")),
    ).toEqual([]);
  });

  it("names the entry whose diagram breaks triad pitch agreement (rule 28)", () => {
    const g = base();
    const idx = g.chords.findIndex((c) => c.name === "C major");
    g.chords[idx] = {
      ...g.chords[idx],
      diagram: {
        ...g.chords[idx].diagram,
        frets: [0, 0, 0, 0] as [number, number, number, number],
      },
    };
    const errors = validateCollections(g);
    expect(
      errors.some((e) => e.includes("chords/C major") && /triad/.test(e)),
    ).toBe(true);
  });

  it("names duplicate chord names", () => {
    const g = base();
    g.chords[1] = { ...g.chords[1], name: g.chords[0].name };
    const errors = validateCollections(g);
    expect(
      errors.some((e) => /dup/i.test(e) && e.includes(g.chords[0].name)),
    ).toBe(true);
  });

  it("flags an unmatched filter spelling", () => {
    const g = base();
    // Remove Bb's alias so A# has no match.
    g.chords = g.chords.map((c) =>
      c.root === "Bb" ? { ...c, rootAlias: undefined } : c,
    );
    const errors = validateCollections(g);
    expect(errors.some((e) => e.includes("A#"))).toBe(true);
    expect(NOTE_ALIASES).toContain("A#");
  });
});

describe("validateCollections rule 15 (lesson chord references)", () => {
  const lessonTopic = (chords: string[]) =>
    topicSchema.parse({
      title: "Harmonic Circles",
      slug: "harmonic-circles",
      kind: "topic",
      courseSlug: "ukulele",
      description: "Circles.",
      format: "lesson",
      order: 1,
      lesson: {
        intro: ["Intro."],
        sections: [
          {
            heading: "Circle in C",
            paragraphs: ["Prose."],
            progressions: [
              {
                name: "Circle in C",
                key: "C",
                degrees: chords.map((_, i) => `d${i}`),
                chords,
              },
            ],
          },
          { heading: "S2", paragraphs: ["Prose."] },
          { heading: "S3", paragraphs: ["Prose."] },
          { heading: "S4", paragraphs: ["Prose."] },
        ],
        summary: ["Summary."],
      },
    });

  const base = () => ({
    courses: [courseSchema.parse(validCourse)],
    topics: [topicSchema.parse(validTopic)],
    games: [] as Array<ReturnType<typeof gameSchema.parse>>,
    chords: fullChordSet(),
    scales: [],
  });

  it("passes when every lesson chord name resolves", () => {
    const g = base();
    g.topics.push(lessonTopic(["C major", "A minor", "F major"]));
    expect(
      validateCollections(g).filter((e) => !e.startsWith("scales")),
    ).toEqual([]);
  });

  it("names topic + progression + chord for a dangling reference", () => {
    const g = base();
    g.topics.push(lessonTopic(["C major", "A minor", "H major"]));
    const errors = validateCollections(g);
    expect(
      errors.some(
        (e) =>
          e.includes("topics/harmonic-circles") &&
          e.includes("Circle in C") &&
          e.includes("H major"),
      ),
    ).toBe(true);
  });
});

describe("validateCollections rule 29 (diatonic membership)", () => {
  const lessonTopic = (key: string, type: string, chords: string[]) =>
    topicSchema.parse({
      title: "Harmonic Circles",
      slug: "harmonic-circles",
      kind: "topic",
      courseSlug: "ukulele",
      description: "Circles.",
      format: "lesson",
      order: 1,
      lesson: {
        intro: ["Intro."],
        sections: [
          {
            heading: "Circle",
            paragraphs: ["Prose."],
            progressions: [
              {
                name: "Circle in C",
                key,
                type,
                degrees: chords.map((_, i) => `d${i}`),
                chords,
              },
            ],
          },
          { heading: "S2", paragraphs: ["Prose."] },
          { heading: "S3", paragraphs: ["Prose."] },
          { heading: "S4", paragraphs: ["Prose."] },
        ],
        summary: ["Summary."],
      },
    });

  const base = () => ({
    courses: [courseSchema.parse(validCourse)],
    topics: [topicSchema.parse(validTopic)],
    games: [] as Array<ReturnType<typeof gameSchema.parse>>,
    chords: fullChordSet(),
    scales: [],
  });

  it("passes when every progression chord is diatonic to a major key", () => {
    const g = base();
    g.topics.push(
      lessonTopic("C", "major", ["C major", "A minor", "F major", "G major"]),
    );
    expect(
      validateCollections(g).filter((e) => !e.startsWith("scales")),
    ).toEqual([]);
  });

  it("passes when every progression chord is diatonic to a minor key", () => {
    const g = base();
    g.topics.push(
      lessonTopic("A", "minor", ["A minor", "F major", "C major", "G major"]),
    );
    expect(
      validateCollections(g).filter((e) => !e.startsWith("scales")),
    ).toEqual([]);
  });

  it("names circle + chord for a non-diatonic progression chord", () => {
    const g = base();
    g.topics.push(
      lessonTopic("C", "major", ["C major", "A minor", "Bb / A# major"]),
    );
    const errors = validateCollections(g);
    expect(
      errors.some(
        (e) =>
          e.includes("topics/harmonic-circles") &&
          e.includes("Circle in C") &&
          e.includes("Bb / A# major") &&
          /diatonic/.test(e),
      ),
    ).toBe(true);
  });
});

describe("validateCollections rule 18 (progression name uniqueness)", () => {
  const lessonTopic = (slug: string, names: string[]) =>
    topicSchema.parse({
      title: slug,
      slug,
      kind: "topic",
      courseSlug: "ukulele",
      description: "Lesson.",
      format: "lesson",
      order: 1,
      lesson: {
        intro: ["Intro."],
        sections: [
          {
            heading: "Circles",
            paragraphs: ["Prose."],
            progressions: names.map((name) => ({
              name,
              key: "C",
              degrees: ["I", "vi", "IV"],
              chords: ["C major", "A minor", "F major"],
            })),
          },
          { heading: "S2", paragraphs: ["Prose."] },
          { heading: "S3", paragraphs: ["Prose."] },
          { heading: "S4", paragraphs: ["Prose."] },
        ],
        summary: ["Summary."],
      },
    });

  const base = () => ({
    courses: [courseSchema.parse(validCourse)],
    topics: [topicSchema.parse(validTopic)],
    games: [] as Array<ReturnType<typeof gameSchema.parse>>,
    chords: fullChordSet(),
    scales: [],
  });

  it("names every topic carrying a duplicate progression name within the course", () => {
    const g = base();
    g.topics.push(
      lessonTopic("lesson-one", ["Circle in C"]),
      lessonTopic("lesson-two", ["Circle in C"]),
    );
    const errors = validateCollections(g);
    for (const slug of ["lesson-one", "lesson-two"]) {
      expect(
        errors.some(
          (e) =>
            e.includes(`topics/${slug}`) &&
            e.includes('duplicate progression name "Circle in C"'),
        ),
      ).toBe(true);
    }
  });
});

describe("content integrity (real src/content JSON)", () => {
  const root = join(process.cwd(), "src", "content");
  const load = (dir: string) => {
    let files: string[] = [];
    try {
      files = readdirSync(join(root, dir)).filter((f) => f.endsWith(".json"));
    } catch {
      return [];
    }
    return files.map((f) =>
      JSON.parse(readFileSync(join(root, dir, f), "utf8")),
    );
  };

  it("real content parses and validates with zero errors", () => {
    const courses = load("courses").map((c) => courseSchema.parse(c));
    const topics = load("topics").map((t) => topicSchema.parse(t));
    const games = load("games").map((g) => gameSchema.parse(g));
    const chords = load("chords").map((c) => chordSchema.parse(c));
    const scales = load("scales").map((s) => scaleSchema.parse(s));
    expect(courses.length).toBeGreaterThan(0);
    expect(
      validateCollections({ courses, topics, games, chords, scales }),
    ).toEqual([]);
    // Rule 16 — the Harmonic Circles lesson ships complete (FR-004).
    const lesson = topics.find((t) => t.slug === "harmonic-circles");
    expect(lesson?.format).toBe("lesson");
    const progressions =
      lesson?.lesson?.sections.flatMap((s) => s.progressions) ?? [];
    expect(progressions.length).toBeGreaterThanOrEqual(3);
    // Rule 17 — the Circles explorer topic ships with entry parity (FR-012/SC-007).
    const explorer = topics.find((t) => t.slug === "circles");
    expect(explorer?.format).toBe("circles");
    expect(explorer?.lesson).toBeUndefined();
    expect(collectLessonCircles(topics).length).toBe(progressions.length);
  });
});
