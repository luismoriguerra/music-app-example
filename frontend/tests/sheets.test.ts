import { describe, expect, it } from "vitest";
import {
  CHORD_SYMBOL_RE,
  dedupeCandidates,
  dedupeSourceLinks,
  isChordSymbol,
  matchCatalogChord,
  normalizeChordPositions,
  normalizeIdentity,
  type CatalogChord,
  type SheetLine,
} from "@/lib/sheets";

const mkCandidate = (title: string, artist: string, id: number) => ({
  title,
  artist,
  album: null,
  artwork_url: null,
  provider_refs: { lrclib_id: id },
});

const mkChord = (
  name: string,
  type: "major" | "minor",
  root: string,
  rootAlias?: string,
): CatalogChord =>
  ({
    name,
    type,
    root,
    rootAlias,
    rootPitch: 0,
    topicSlug: "chords",
    diagram: {
      strings: "GCEA",
      frets: [0, 0, 0, 0],
      fingers: [0, 0, 0, 0],
      baseFret: 1,
      barres: [],
    },
  }) as CatalogChord;

const catalog: CatalogChord[] = [
  mkChord("C major", "major", "C"),
  mkChord("C minor", "minor", "C"),
  mkChord("Bb / A# major", "major", "Bb", "A#"),
] as CatalogChord[];

describe("sheets pure helpers (T009)", () => {
  it("normalizes title+artist by lowercase/punctuation folding", () => {
    expect(normalizeIdentity("Riptide", "Vance Joy")).toBe(
      normalizeIdentity("  riptide! ", "vance-joy"),
    );
    expect(normalizeIdentity("Riptide", "Vance Joy")).not.toBe(
      normalizeIdentity("Riptide", "Sick Puppies"),
    );
  });

  it("dedupes candidates keeping the first occurrence", () => {
    const out = dedupeCandidates([
      mkCandidate("Riptide", "Vance Joy", 1),
      mkCandidate("riptide!", "vance joy", 2),
      mkCandidate("Riptide", "Sick Puppies", 3),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].provider_refs).toEqual({ lrclib_id: 1 });
    expect(out[1].artist).toBe("Sick Puppies");
  });

  it("sorts chord positions and drops out-of-range offsets", () => {
    const line: SheetLine = {
      text: "abcdef",
      chords: [
        { offset: 4, symbol: "G" },
        { offset: 0, symbol: "Am" },
        { offset: 99, symbol: "C" },
      ],
    };
    expect(normalizeChordPositions(line)).toEqual([
      { offset: 0, symbol: "Am" },
      { offset: 4, symbol: "G" },
    ]);
  });

  it("dedupes chords sharing an offset, keeping the first", () => {
    const line: SheetLine = {
      text: "abcdef",
      chords: [
        { offset: 0, symbol: "Am" },
        { offset: 0, symbol: "G" },
      ],
    };
    expect(normalizeChordPositions(line)).toEqual([
      { offset: 0, symbol: "Am" },
    ]);
  });

  it("leaves zero-chord lines legal", () => {
    expect(normalizeChordPositions({ text: "abc", chords: [] })).toEqual([]);
  });

  it("matches catalog triads incl. enharmonic spellings", () => {
    expect(matchCatalogChord("C", catalog)?.name).toBe("C major");
    expect(matchCatalogChord("Cm", catalog)?.name).toBe("C minor");
    expect(matchCatalogChord("Bb", catalog)?.name).toBe("Bb / A# major");
    expect(matchCatalogChord("A#", catalog)?.name).toBe("Bb / A# major");
    expect(matchCatalogChord("Cmin", catalog)?.name).toBe("C minor");
  });

  it("returns null for off-catalog symbols (M2)", () => {
    for (const symbol of [
      "Am7",
      "Dadd9",
      "Csus4",
      "C/G",
      "Ddim",
      "Eaug",
      "H",
      "",
    ]) {
      expect(matchCatalogChord(symbol, catalog)).toBeNull();
    }
  });

  it("dedupes source links against attribution URLs + each other", () => {
    const links = [
      { label: "a", url: "https://example.com/1", kind: "lyrics" as const },
      { label: "b", url: "https://example.com/1", kind: "chords" as const },
      {
        label: "c",
        url: "https://attribution.example/x",
        kind: "video" as const,
      },
    ];
    const out = dedupeSourceLinks(links, ["https://attribution.example/x"]);
    expect(out).toEqual([links[0]]);
  });

  it("validates the shared chord-symbol vocabulary", () => {
    for (const symbol of [
      "Em",
      "Dadd9",
      "Am7",
      "F#m",
      "Bbsus4",
      "A7sus4",
      "D9sus4",
      "Cmaj7",
      "G/B",
      "C7(#9)",
      "Eaug",
      "C",
    ]) {
      expect(isChordSymbol(symbol)).toBe(true);
      expect(CHORD_SYMBOL_RE.test(symbol)).toBe(true);
    }
    for (const symbol of ["H", "C maj7!", "", "Z#m"]) {
      expect(isChordSymbol(symbol)).toBe(false);
    }
  });

  it("does not import Astro (Principle VIII)", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/lib/sheets.ts", "utf8"),
    );
    expect(source).not.toMatch(/from ["']astro/);
    expect(source).not.toMatch(/from ["']@\/components\//);
  });
});
