import { describe, expect, it } from "vitest";
import {
  filterScales,
  NECK_FRETS,
  SCALE_FILTER_GROUPS,
  scaleNeckTones,
  scaleSpelling,
  sortScales,
  SPELLING_TABLE,
  type Scale,
} from "@/lib/scales";

const mkDiagram = (): Scale["diagram"] => ({
  strings: "GCEA",
  positions: [1, 2, 3, 4, 5, 6, 7, 8].map((order) => ({
    string: 1,
    fret: 0,
    order,
    finger: 0,
  })),
  baseFret: 1,
  positionLabel: "fixture",
});

const mk = (
  name: string,
  root: Scale["root"],
  type: Scale["type"],
  rootPitch: number,
  rootAlias?: Scale["rootAlias"],
): Scale => {
  const { displaySpelling, notes } = scaleSpelling(rootPitch, type);
  return {
    name,
    type,
    root,
    rootAlias,
    rootPitch,
    topicSlug: "scales",
    notes: [...notes],
    degrees: ["1", "2", "3", "4", "5", "6", "7", "8"],
    intervals: type === "major" ? "W-W-H-W-W-W-H" : "W-H-W-W-H-W-W",
    displaySpelling,
    diagram: mkDiagram(),
  };
};

describe("SPELLING_TABLE (spec Appendix, R2-validated)", () => {
  it("holds exactly 24 rows keyed by rootPitch/type", () => {
    expect(Object.keys(SPELLING_TABLE)).toHaveLength(24);
    for (let pitch = 0; pitch < 12; pitch++) {
      for (const type of ["major", "minor"] as const) {
        const row = scaleSpelling(pitch, type);
        expect(row.notes).toHaveLength(8);
        expect(row.displaySpelling).toBeTruthy();
      }
    }
  });

  it("spells C major from C", () => {
    expect(scaleSpelling(0, "major")).toEqual({
      displaySpelling: "C",
      notes: ["C", "D", "E", "F", "G", "A", "B", "C"],
    });
  });

  it("respells theoretical flat minors to sharp tonics (DR-005)", () => {
    expect(scaleSpelling(1, "minor")).toEqual({
      displaySpelling: "C#",
      notes: ["C#", "D#", "E", "F#", "G#", "A", "B", "C#"],
    });
    expect(scaleSpelling(6, "minor")).toEqual({
      displaySpelling: "F#",
      notes: ["F#", "G#", "A", "B", "C#", "D", "E", "F#"],
    });
    expect(scaleSpelling(8, "minor")).toEqual({
      displaySpelling: "G#",
      notes: ["G#", "A#", "B", "C#", "D#", "E", "F#", "G#"],
    });
  });

  it("keeps valid flat spellings flat-side (Eb/Bb minor, Gb major)", () => {
    expect(scaleSpelling(3, "minor")).toEqual({
      displaySpelling: "Eb",
      notes: ["Eb", "F", "Gb", "Ab", "Bb", "Cb", "Db", "Eb"],
    });
    expect(scaleSpelling(10, "minor").displaySpelling).toBe("Bb");
    expect(scaleSpelling(6, "major")).toEqual({
      displaySpelling: "Gb",
      notes: ["Gb", "Ab", "Bb", "Cb", "Db", "Eb", "F", "Gb"],
    });
  });

  it("contains zero double-accidentals in all 24 rows (FR-008)", () => {
    for (const [key, row] of Object.entries(SPELLING_TABLE)) {
      for (const note of row.notes) {
        expect(
          note,
          `row ${key} note ${note} must not be double-accidental`,
        ).not.toMatch(/bb|x|##/);
      }
    }
  });
});

const scales: Scale[] = [
  mk("C major", "C", "major", 0),
  mk("C minor", "C", "minor", 0),
  mk("Bb / A# major", "Bb", "major", 10, "A#"),
  mk("Bb / A# minor", "Bb", "minor", 10, "A#"),
  mk("A major", "A", "major", 9),
];

describe("filterScales (FR-004/FR-005)", () => {
  it('"all" is identity', () => {
    expect(filterScales(scales, "all")).toEqual(scales);
  });

  it("major / minor match by type", () => {
    expect(filterScales(scales, "major").every((s) => s.type === "major")).toBe(
      true,
    );
    expect(filterScales(scales, "minor")).toHaveLength(2);
  });

  it("note spelling matches root", () => {
    expect(filterScales(scales, "C")).toHaveLength(2);
    expect(filterScales(scales, "A")).toHaveLength(1);
  });

  it("Bb and A# match the same combined entries", () => {
    const viaBb = filterScales(scales, "Bb");
    const viaSharp = filterScales(scales, "A#");
    expect(viaBb).toHaveLength(2);
    expect(viaSharp).toEqual(viaBb);
  });

  it("unknown spelling yields empty", () => {
    expect(filterScales(scales, "Hb")).toEqual([]);
  });
});

describe("sortScales (FR-010 default order)", () => {
  it("alphabetical by display name, major before minor for same pitch", () => {
    const sorted = sortScales([
      mk("C minor", "C", "minor", 0),
      mk("Bb / A# minor", "Bb", "minor", 10, "A#"),
      mk("A major", "A", "major", 9),
      mk("C major", "C", "major", 0),
      mk("Bb / A# major", "Bb", "major", 10, "A#"),
    ]).map((s) => s.name);
    expect(sorted).toEqual([
      "A major",
      "Bb / A# major",
      "Bb / A# minor",
      "C major",
      "C minor",
    ]);
  });
});

describe("SCALE_FILTER_GROUPS (grouped dropdown contract)", () => {
  it("has all, type, and note groups covering 17 spellings", () => {
    const all = SCALE_FILTER_GROUPS.find((g) => g.label === "All");
    expect(all!.options).toEqual([{ value: "all", label: "All scales" }]);
    const type = SCALE_FILTER_GROUPS.find((g) => g.label === "By type");
    expect(type!.options.map((o) => o.value)).toEqual(["major", "minor"]);
    const notes = SCALE_FILTER_GROUPS.find((g) => g.label === "By note");
    expect(notes).toBeDefined();
    expect(notes!.options).toHaveLength(17);
  });
});

describe("scaleNeckTones (landscape 12-fret model)", () => {
  it("covers frets 0..12 on all 4 strings for C major", () => {
    const { notes } = scaleSpelling(0, "major");
    const tones = scaleNeckTones([...notes], 0);
    expect(NECK_FRETS).toBe(12);
    expect(tones.length).toBeGreaterThan(20);
    for (const t of tones) {
      expect(t.string).toBeGreaterThanOrEqual(0);
      expect(t.string).toBeLessThanOrEqual(3);
      expect(t.fret).toBeGreaterThanOrEqual(0);
      expect(t.fret).toBeLessThanOrEqual(12);
    }
    // every tone spells a C-major note; tonics spell C
    for (const t of tones) {
      expect(notes.slice(0, 7)).toContain(t.spelling);
      if (t.isTonic) expect(t.spelling).toBe("C");
    }
  });

  it("keeps conventional sharp spellings (no Db in C# minor)", () => {
    const { notes } = scaleSpelling(1, "minor");
    const tones = scaleNeckTones([...notes], 1);
    const spellings = new Set(tones.map((t) => t.spelling));
    expect(spellings.has("C#")).toBe(true);
    expect(spellings.has("Db")).toBe(false);
  });

  it("maps 1st-position orders onto matching frets", () => {
    const { notes } = scaleSpelling(0, "major");
    const tones = scaleNeckTones([...notes], 0, [
      { string: 1, fret: 0, order: 1 },
      { string: 1, fret: 2, order: 2 },
    ]);
    const byKey = new Map(tones.map((t) => [`${t.string}:${t.fret}`, t]));
    expect(byKey.get("1:0")?.order).toBe(1);
    expect(byKey.get("1:2")?.order).toBe(2);
    expect(byKey.get("1:12")?.order).toBeUndefined();
  });
});
