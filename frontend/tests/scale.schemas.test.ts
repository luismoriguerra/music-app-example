import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  chordSchema,
  courseSchema,
  gameSchema,
  scaleSchema,
  topicSchema,
  type Scale,
} from "@/lib/content/schemas";
import { validateCollections } from "@/lib/content/validate";
import { scaleSpelling } from "@/lib/scales";
import { NOTE_ALIASES, NOTE_ROOTS, SPELLING_PITCH } from "@/lib/notes";

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
const scalesTopic = {
  title: "Scales",
  slug: "scales",
  kind: "topic",
  courseSlug: "ukulele",
  description: "Scale reference.",
  format: "scales",
  order: 3,
};

// C major, first-position ground truth (research R4): A|--0--2--3--,
// E string open E + 1st + 3rd, C|--0--2. Strings: 0=G 1=C 2=E 3=A.
const validScale = {
  name: "C major",
  type: "major",
  root: "C",
  rootPitch: 0,
  topicSlug: "scales",
  notes: ["C", "D", "E", "F", "G", "A", "B", "C"],
  degrees: ["1", "2", "3", "4", "5", "6", "7", "8"],
  intervals: "W-W-H-W-W-W-H",
  displaySpelling: "C",
  diagram: {
    strings: "GCEA",
    positions: [
      { string: 1, fret: 0, order: 1, finger: 0 },
      { string: 1, fret: 2, order: 2, finger: 2 },
      { string: 2, fret: 0, order: 3, finger: 0 },
      { string: 2, fret: 1, order: 4, finger: 1 },
      { string: 2, fret: 3, order: 5, finger: 3 },
      { string: 3, fret: 0, order: 6, finger: 0 },
      { string: 3, fret: 2, order: 7, finger: 2 },
      { string: 3, fret: 3, order: 8, finger: 3 },
    ],
    positionLabel: "1st position",
  },
};

describe("scale per-entry schema (rules 19-22)", () => {
  it("accepts a valid scale and applies diagram defaults (baseFret 1)", () => {
    const parsed = scaleSchema.parse(validScale);
    expect(parsed.rootPitch).toBe(0);
    expect(parsed.diagram.baseFret).toBe(1);
    expect(parsed.diagram.positions).toHaveLength(8);
  });

  it('accepts format "scales" on topics and rejects bogus formats', () => {
    expect(topicSchema.parse(scalesTopic).format).toBe("scales");
    expect(() => topicSchema.parse({ ...validTopic, format: "tab" })).toThrow();
  });

  it("rejects notes/degrees length != 8", () => {
    expect(() =>
      scaleSchema.parse({ ...validScale, notes: ["C", "D"] }),
    ).toThrow();
    expect(() =>
      scaleSchema.parse({ ...validScale, degrees: ["1"] }),
    ).toThrow();
  });

  it("rejects intervals that do not match the type pattern", () => {
    expect(() =>
      scaleSchema.parse({ ...validScale, intervals: "W-H-W-W-H-W-W" }),
    ).toThrow(/intervals/);
    expect(() =>
      scaleSchema.parse({
        ...validScale,
        type: "minor",
        intervals: "W-W-H-W-W-W-H",
      }),
    ).toThrow(/intervals/);
  });

  it("rejects displaySpelling that is neither root nor rootAlias", () => {
    expect(() =>
      scaleSchema.parse({ ...validScale, displaySpelling: "D" }),
    ).toThrow(/displaySpelling/);
  });

  it("rejects position order dup/gap", () => {
    const dup = {
      ...validScale.diagram,
      positions: validScale.diagram.positions.map((p, i) =>
        i === 7 ? { ...p, order: 7 } : p,
      ),
    };
    expect(() => scaleSchema.parse({ ...validScale, diagram: dup })).toThrow(
      /order/,
    );
  });

  it("rejects fret out of the 0-12 range", () => {
    const bad = {
      ...validScale.diagram,
      positions: validScale.diagram.positions.map((p, i) =>
        i === 0 ? { ...p, fret: 13 } : p,
      ),
    };
    expect(() => scaleSchema.parse({ ...validScale, diagram: bad })).toThrow();
  });

  it("rejects mismatched rootPitch", () => {
    expect(() => scaleSchema.parse({ ...validScale, rootPitch: 5 })).toThrow(
      /rootPitch/,
    );
  });

  it("rejects a wrong alias pair", () => {
    expect(() =>
      scaleSchema.parse({
        ...validScale,
        root: "Bb",
        rootPitch: 10,
        rootAlias: "C#",
      }),
    ).toThrow(/enharmonic/);
  });

  it("rejects names over 80 chars", () => {
    expect(() =>
      scaleSchema.parse({ ...validScale, name: "x".repeat(81) }),
    ).toThrow();
  });
});

const PITCH: Record<string, number> = {
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
const ALIAS_OF: Record<string, string> = {
  Bb: "A#",
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
};

function fullScaleSet(): Scale[] {
  const out: Scale[] = [];
  for (const root of NOTE_ROOTS) {
    for (const type of ["major", "minor"] as const) {
      const pitch = PITCH[root];
      const alias = ALIAS_OF[root];
      const { displaySpelling, notes } = scaleSpelling(pitch, type);
      out.push(
        scaleSchema.parse({
          name: `${alias ? `${root} / ${alias}` : root} ${type}`,
          type,
          root,
          ...(alias ? { rootAlias: alias } : {}),
          rootPitch: pitch,
          topicSlug: "scales",
          notes: [...notes],
          degrees: ["1", "2", "3", "4", "5", "6", "7", "8"],
          intervals: type === "major" ? "W-W-H-W-W-W-H" : "W-H-W-W-H-W-W",
          displaySpelling,
          diagram: {
            strings: "GCEA",
            // Programmatic pitch-valid fixture (all on the C string):
            // fret = note pitch class, so rule 26 holds by construction.
            positions: notes.map((n, i) => {
              const fret = SPELLING_PITCH[n] ?? 0;
              return {
                string: 1,
                fret,
                order: i + 1,
                finger: Math.min(fret, 4),
              };
            }),
            positionLabel: "fixture position",
          },
        }),
      );
    }
  }
  return out;
}

describe("validateCollections scales rules (23-26)", () => {
  const base = () => ({
    courses: [courseSchema.parse(validCourse)],
    topics: [topicSchema.parse(validTopic), topicSchema.parse(scalesTopic)],
    games: [] as Array<ReturnType<typeof gameSchema.parse>>,
    chords: [] as Array<ReturnType<typeof chordSchema.parse>>,
    scales: fullScaleSet(),
  });
  // Chord rules fire on the empty chords list by design; scales assertions
  // filter to scales errors only (same idiom as game-entry.test.ts).
  const scaleErrors = (g: ReturnType<typeof base>) =>
    validateCollections(g).filter((e) => e.startsWith("scales"));

  it("returns no scales errors for a valid graph", () => {
    expect(base().scales).toHaveLength(24);
    expect(scaleErrors(base())).toEqual([]);
  });

  it("names a scale with a dangling topicSlug (rule 23)", () => {
    const g = base();
    g.scales[0] = { ...g.scales[0], topicSlug: "banjo" };
    const errors = scaleErrors(g);
    expect(
      errors.some((e) => e.includes("scales/") && e.includes("banjo")),
    ).toBe(true);
  });

  it("flags scale count != 24 (rule 23)", () => {
    const g = base();
    g.scales = g.scales.slice(0, 23);
    expect(scaleErrors(g).some((e) => /24/.test(e))).toBe(true);
  });

  it("names duplicate scale names (rule 23)", () => {
    const g = base();
    g.scales[1] = { ...g.scales[1], name: g.scales[0].name };
    const errors = scaleErrors(g);
    expect(
      errors.some((e) => /dup/i.test(e) && e.includes(g.scales[0].name)),
    ).toBe(true);
  });

  it("flags duplicate (rootPitch,type) pairs (rule 23)", () => {
    const g = base();
    g.scales[1] = {
      ...g.scales[1],
      rootPitch: g.scales[0].rootPitch,
      type: g.scales[0].type,
    };
    expect(scaleErrors(g).some((e) => e.includes("(rootPitch,type)"))).toBe(
      true,
    );
  });

  it("flags an unmatched filter spelling (rule 24)", () => {
    const g = base();
    // Remove Bb's alias so A# has no match.
    g.scales = g.scales.map((s) =>
      s.root === "Bb" ? { ...s, rootAlias: undefined } : s,
    );
    const errors = scaleErrors(g);
    expect(errors.some((e) => e.includes("A#"))).toBe(true);
    expect(NOTE_ALIASES).toContain("A#");
  });

  it("names spelling-table divergence with entry + degree (rule 25)", () => {
    const g = base();
    const victim = g.scales.find((s) => s.name === "C major")!;
    victim.notes = [...victim.notes];
    victim.notes[2] = "Eb";
    const errors = scaleErrors(g);
    expect(
      errors.some(
        (e) =>
          e.includes("scales/C major") &&
          e.includes("degree") &&
          e.includes("Eb"),
      ),
    ).toBe(true);
  });

  it("rejects double-accidental notes (rule 25)", () => {
    const g = base();
    const victim = g.scales.find((s) => s.name === "C major")!;
    victim.notes = [...victim.notes];
    victim.notes[1] = "Bbb";
    const errors = scaleErrors(g);
    expect(
      errors.some(
        (e) => e.includes("scales/C major") && /double accidental/.test(e),
      ),
    ).toBe(true);
  });

  it("names pitch-agreement failures with entry + order (rule 26)", () => {
    const g = base();
    const victim = g.scales.find((s) => s.name === "C major")!;
    const positions = victim.diagram.positions.map((p) => ({ ...p }));
    positions[0] = { ...positions[0], fret: 5 };
    victim.diagram = { ...victim.diagram, positions };
    const errors = scaleErrors(g);
    expect(
      errors.some(
        (e) => e.includes("scales/C major") && e.includes("position 1"),
      ),
    ).toBe(true);
  });
});

describe("scales content integrity (real src/content JSON)", () => {
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

  it("real scales content parses and validates with zero errors", () => {
    const courses = load("courses").map((c) => courseSchema.parse(c));
    const topics = load("topics").map((t) => topicSchema.parse(t));
    const games = load("games").map((g) => gameSchema.parse(g));
    const chords = load("chords").map((c) => chordSchema.parse(c));
    const scales = load("scales").map((s) => scaleSchema.parse(s));
    expect(
      validateCollections({ courses, topics, games, chords, scales }),
    ).toEqual([]);
    // Rule 27 — the Scales topic ships with 24 entries (FR-001/SC-004).
    const scalesTopicEntry = topics.find((t) => t.slug === "scales");
    expect(scalesTopicEntry?.format).toBe("scales");
    expect(scalesTopicEntry?.lesson).toBeUndefined();
    expect(scales).toHaveLength(24);
  });
});
