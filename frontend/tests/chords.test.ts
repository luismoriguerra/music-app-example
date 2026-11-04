import { describe, expect, it } from "vitest";
import {
  chordDisplayName,
  filterChords,
  FILTER_GROUPS,
  sortChords,
  type Chord,
} from "@/lib/chords";

const mk = (
  root: Chord["root"],
  type: Chord["type"],
  rootPitch: number,
  rootAlias?: Chord["rootAlias"],
): Chord => ({
  name: chordDisplayName(root, type, rootAlias),
  type,
  root,
  rootAlias,
  rootPitch,
  topicSlug: "chords",
  diagram: {
    strings: "GCEA",
    frets: [0, 0, 0, 0],
    fingers: [0, 0, 0, 0],
    baseFret: 1,
    barres: [],
  },
});

const chords: Chord[] = [
  mk("C", "major", 0),
  mk("C", "minor", 0),
  mk("Bb", "major", 10, "A#"),
  mk("Bb", "minor", 10, "A#"),
  mk("A", "major", 9),
];

describe("filterChords (FR-008/FR-009)", () => {
  it('"all" is identity', () => {
    expect(filterChords(chords, "all")).toEqual(chords);
  });

  it("major / minor match by type", () => {
    expect(filterChords(chords, "major").every((c) => c.type === "major")).toBe(
      true,
    );
    expect(filterChords(chords, "minor")).toHaveLength(2);
  });

  it("diminished matches by type (FR-013)", () => {
    const withDim: Chord[] = [
      ...chords,
      mk("C", "diminished", 0),
      mk("Bb", "diminished", 10, "A#"),
    ];
    expect(filterChords(withDim, "diminished").map((c) => c.name)).toEqual([
      "C diminished",
      "Bb / A# diminished",
    ]);
  });

  it("note spelling matches root", () => {
    expect(filterChords(chords, "C")).toHaveLength(2);
    expect(filterChords(chords, "A")).toHaveLength(1);
  });

  it("Bb and A# match the same combined entries", () => {
    const viaBb = filterChords(chords, "Bb");
    const viaSharp = filterChords(chords, "A#");
    expect(viaBb).toHaveLength(2);
    expect(viaSharp).toEqual(viaBb);
  });

  it("unknown spelling yields empty", () => {
    expect(filterChords(chords, "Hb")).toEqual([]);
  });
});

describe("chordDisplayName (flat-first combined)", () => {
  it("plain root", () => {
    expect(chordDisplayName("C", "major")).toBe("C major");
  });
  it("combined enharmonic, flat first", () => {
    expect(chordDisplayName("Bb", "minor", "A#")).toBe("Bb / A# minor");
  });
});

describe("sortChords (FR-017 default order)", () => {
  it("alphabetical by display name, major before minor for same pitch", () => {
    const sorted = sortChords([
      mk("C", "minor", 0),
      mk("Bb", "minor", 10, "A#"),
      mk("A", "major", 9),
      mk("C", "major", 0),
      mk("Bb", "major", 10, "A#"),
    ]).map((c) => c.name);
    expect(sorted).toEqual([
      "A major",
      "Bb / A# major",
      "Bb / A# minor",
      "C major",
      "C minor",
    ]);
  });

  it("tiers same-pitch entries major → minor → diminished (FR-013)", () => {
    const sorted = sortChords([
      mk("C", "diminished", 0),
      mk("C", "minor", 0),
      mk("C", "major", 0),
    ]).map((c) => c.name);
    expect(sorted).toEqual(["C major", "C minor", "C diminished"]);
  });
});

describe("FILTER_GROUPS (grouped dropdown contract)", () => {
  it("has all, type, and note groups covering 17 spellings", () => {
    const notes = FILTER_GROUPS.find((g) => g.label === "By note");
    expect(notes).toBeDefined();
    expect(notes!.options).toHaveLength(17);
    const type = FILTER_GROUPS.find((g) => g.label === "By type");
    expect(type!.options.map((o) => o.value)).toEqual([
      "major",
      "minor",
      "diminished",
    ]);
  });
});
