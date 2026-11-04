import { describe, expect, it } from "vitest";
import { chordDiagramSchema } from "@/lib/content/schemas";
import {
  collectUniqueChordSymbols,
  generateChordDiagram,
  parseChordSymbol,
  resolveSheetChords,
  TRANSPOSE_MAX,
  TRANSPOSE_MIN,
  transposeChordSymbol,
  transposeSheet,
  UKULELE_OPEN_PC,
} from "@/lib/chord-diagrams";
import type { CatalogChord } from "@/lib/sheets";
import { sheetSchema } from "@/lib/sheets/schemas";

const SHEET_BASE = {
  id: "22222222-2222-4222-8222-222222222222",
  query: "Test",
  matched_title: "Test",
  matched_performer: "Tester",
  lyric_source: "chart",
  lyric_source_url: "https://tabs.ultimate-guitar.com/tab/tester/test-1",
  chord_source: "chart",
  chord_source_url: "https://tabs.ultimate-guitar.com/tab/tester/test-1",
  model_id: null,
  source_links: [],
  degraded: [],
  capo: null,
  tuning_note: null,
  created_at: "2026-09-16T00:00:00Z",
} as const;

describe("parseChordSymbol", () => {
  it("parses triads to root pitch + required pitch classes", () => {
    expect(parseChordSymbol("C")).toMatchObject({
      root: "C",
      rootPitch: 0,
      intervals: [0, 4, 7],
    });
    expect(new Set(parseChordSymbol("Am")?.pitchClasses)).toEqual(
      new Set([9, 0, 4]),
    );
  });

  it("parses sevenths and extensions", () => {
    expect(new Set(parseChordSymbol("B7")?.pitchClasses)).toEqual(
      new Set([11, 3, 6, 9]),
    );
    expect(new Set(parseChordSymbol("Dm7")?.pitchClasses)).toEqual(
      new Set([2, 5, 9, 0]),
    );
    expect(new Set(parseChordSymbol("Cmaj7")?.pitchClasses)).toEqual(
      new Set([0, 4, 7, 11]),
    );
    expect(new Set(parseChordSymbol("Gsus4")?.pitchClasses)).toEqual(
      new Set([7, 0, 2]),
    );
  });

  it("merges slash bass notes into the required set", () => {
    const parsed = parseChordSymbol("Am/G");
    expect(parsed?.bassPitch).toBe(7);
    expect(new Set(parsed?.pitchClasses)).toEqual(new Set([9, 0, 4, 7]));
  });

  it("treats enharmonic roots as the same pitch", () => {
    expect(parseChordSymbol("A#")?.rootPitch).toBe(10);
    expect(parseChordSymbol("Bb")?.rootPitch).toBe(10);
  });

  it("returns null for empty, rootless, and marker-less symbols", () => {
    for (const symbol of ["", "   ", "N.C.", "H", "xyz", "CB"]) {
      expect(parseChordSymbol(symbol)).toBeNull();
    }
    expect(parseChordSymbol(123 as unknown as string)).toBeNull();
  });
});

describe("generateChordDiagram", () => {
  const playedPcs = (frets: readonly number[]): Set<number> =>
    new Set(frets.map((f, i) => (UKULELE_OPEN_PC[i] + f) % 12));

  it("voices the everyday sheet vocabulary with exact chord tones", () => {
    const battery = [
      "C",
      "G",
      "Am",
      "Em",
      "F",
      "D",
      "A",
      "E",
      "B",
      "Bb",
      "Db",
      "F#",
      "B7",
      "G7",
      "C7",
      "D7",
      "A7",
      "E7",
      "Bb7",
      "Am7",
      "Dm7",
      "Bm7",
      "Em7",
      "Cmaj7",
      "Fmaj7",
      "Csus4",
      "Dsus2",
      "Gsus4",
      "Cadd9",
      "Dadd9",
      "Gdim",
      "Bdim7",
      "Eaug",
      "Caug",
      "G6",
      "Am6",
      "C9",
      "Dm9",
      "G13b9",
      "Em9",
      "Fm9",
      "Am/G",
      "G/B",
      "D/F#",
    ];
    expect(battery.length).toBeGreaterThan(20);
    for (const symbol of battery) {
      const parsed = parseChordSymbol(symbol);
      expect(parsed, `${symbol} parses`).not.toBeNull();
      const diagram = generateChordDiagram(symbol);
      expect(diagram, `${symbol} voices`).not.toBeNull();
      if (!parsed || !diagram) continue;
      // Schema-valid and renderable by ChordDiagram.
      expect(() => chordDiagramSchema.parse(diagram)).not.toThrow();
      expect(diagram.baseFret).toBeGreaterThanOrEqual(1);
      expect(Math.max(...diagram.frets)).toBeLessThanOrEqual(
        diagram.baseFret + 4,
      );
      expect(diagram.frets.every((f) => f >= 0)).toBe(true);
      diagram.frets.forEach((f, i) => {
        if (f === 0) expect(diagram.fingers[i]).toBe(0);
        else {
          expect(diagram.fingers[i]).toBeGreaterThanOrEqual(1);
          expect(diagram.fingers[i]).toBeLessThanOrEqual(4);
        }
      });
      // Every played note is a chord tone; every chord tone sounds except
      // that dense 4-note chords may drop the perfect fifth (standard for
      // 4-string voicings).
      const required = new Set(parsed.pitchClasses);
      const played = playedPcs(diagram.frets);
      for (const pc of played) {
        expect(required.has(pc), `${symbol} has no foreign tones`).toBe(true);
      }
      const missing = [...required].filter((pc) => !played.has(pc));
      expect(missing.length).toBeLessThanOrEqual(1);
      if (missing.length === 1) {
        expect(required.size).toBe(4);
        expect(missing[0]).toBe((parsed.rootPitch + 7) % 12);
      }
    }
  });

  it("matches the standard open shapes players expect", () => {
    expect(generateChordDiagram("C7")?.frets).toEqual([0, 0, 0, 1]);
    expect(generateChordDiagram("A7")?.frets).toEqual([0, 1, 0, 0]);
    expect(generateChordDiagram("G7")?.frets).toEqual([0, 2, 1, 2]);
    expect(generateChordDiagram("C")?.frets).toEqual([0, 0, 0, 3]);
    expect(generateChordDiagram("Am/G")?.frets).toEqual([0, 0, 0, 0]);
    const bm7 = generateChordDiagram("Bm7");
    expect(bm7?.frets).toEqual([2, 2, 2, 2]);
    expect(bm7?.barres).toEqual([{ fret: 2, fromString: 0, toString: 3 }]);
  });

  it("voices enharmonic spellings identically", () => {
    expect(generateChordDiagram("A#")?.frets).toEqual(
      generateChordDiagram("Bb")?.frets,
    );
  });

  it("returns null when nothing can be parsed", () => {
    for (const symbol of ["", "N.C.", "CB"]) {
      expect(generateChordDiagram(symbol)).toBeNull();
    }
  });
});

describe("collectUniqueChordSymbols / resolveSheetChords", () => {
  const sheet = sheetSchema.parse({
    ...SHEET_BASE,
    body: {
      sections: [
        {
          heading: null,
          lines: [
            {
              text: "line one here",
              chords: [
                { offset: 0, symbol: "Am" },
                { offset: 5, symbol: "B7" },
              ],
            },
            {
              text: "line two here",
              chords: [
                { offset: 0, symbol: "Am" },
                { offset: 5, symbol: "CB" },
              ],
            },
          ],
        },
      ],
    },
  });

  it("dedupes by symbol keeping first-appearance order", () => {
    expect(collectUniqueChordSymbols(sheet)).toEqual(["Am", "B7", "CB"]);
  });

  it("prefers catalog diagrams, then generated, else none", () => {
    const catalog = [
      {
        root: "A",
        type: "minor",
        diagram: {
          strings: "GCEA",
          frets: [2, 0, 0, 0],
          fingers: [2, 0, 0, 0],
          baseFret: 1,
          barres: [],
        },
      },
    ] as unknown as readonly CatalogChord[];
    const resolved = resolveSheetChords(sheet, catalog);
    expect(resolved.map((r) => [r.symbol, r.source])).toEqual([
      ["Am", "catalog"],
      ["B7", "generated"],
      ["CB", "none"],
    ]);
    expect(resolved[0].diagram).toBe(catalog[0].diagram);
    expect(resolved[1].diagram).not.toBeNull();
    expect(resolved[2].diagram).toBeNull();
  });
});

describe("transposeChordSymbol", () => {
  it("returns the symbol unchanged for 0 semitones", () => {
    expect(transposeChordSymbol("Am", 0)).toBe("Am");
    expect(transposeChordSymbol("Dadd9", 0)).toBe("Dadd9");
  });

  it("moves natural roots with octave wraparound", () => {
    expect(transposeChordSymbol("C", 1)).toBe("C#");
    expect(transposeChordSymbol("B", 1)).toBe("C");
    expect(transposeChordSymbol("C", -1)).toBe("B");
    expect(transposeChordSymbol("E", 1)).toBe("F");
    expect(transposeChordSymbol("F", -1)).toBe("E");
  });

  it("spells accidentals by direction: sharps up, flats down", () => {
    expect(transposeChordSymbol("G", 1)).toBe("G#");
    expect(transposeChordSymbol("A", -1)).toBe("Ab");
    expect(transposeChordSymbol("D", 1)).toBe("D#");
    expect(transposeChordSymbol("E", -1)).toBe("Eb");
    expect(transposeChordSymbol("Bb", 1)).toBe("B");
    expect(transposeChordSymbol("F#", -1)).toBe("F");
  });

  it("accepts an explicit preferSharps override for key-aware callers", () => {
    expect(transposeChordSymbol("Am", 1, false)).toBe("Bbm");
    expect(transposeChordSymbol("A", -1, true)).toBe("G#");
    // Default (no override) keeps the direction heuristic.
    expect(transposeChordSymbol("Am", 1)).toBe("A#m");
  });

  it("preserves the quality tail verbatim", () => {
    expect(transposeChordSymbol("Am", 2)).toBe("Bm");
    expect(transposeChordSymbol("Dadd9", 1)).toBe("D#add9");
    expect(transposeChordSymbol("Bdim", -1)).toBe("Bbdim");
    expect(transposeChordSymbol("Cmaj7", 2)).toBe("Dmaj7");
    expect(transposeChordSymbol("Gsus4", -2)).toBe("Fsus4");
    expect(transposeChordSymbol("F#m7", 1)).toBe("Gm7");
  });

  it("transposes slash bass notes together with the root", () => {
    expect(transposeChordSymbol("Am/G", 2)).toBe("Bm/A");
    expect(transposeChordSymbol("G/B", -2)).toBe("F/A");
  });

  it("leaves extension slashes like 6/9 untouched", () => {
    expect(transposeChordSymbol("C6/9", 2)).toBe("D6/9");
  });

  it("wraps intervals beyond the octave", () => {
    expect(transposeChordSymbol("C", 12)).toBe("C");
    expect(transposeChordSymbol("C", 13)).toBe("C#");
    expect(transposeChordSymbol("C", -12)).toBe("C");
  });

  it("passes unparsable symbols through unchanged", () => {
    for (const symbol of ["", "   ", "N.C.", "H", "xyz", "CB"]) {
      expect(transposeChordSymbol(symbol, 3)).toBe(symbol);
    }
  });

  it("clamps the stepper bounds to ±11 (an octave is the identity)", () => {
    expect(TRANSPOSE_MIN).toBe(-11);
    expect(TRANSPOSE_MAX).toBe(11);
  });
});

describe("transposeSheet", () => {
  const sheet = sheetSchema.parse({
    ...SHEET_BASE,
    body: {
      sections: [
        {
          heading: "Chorus",
          lines: [
            {
              text: "line one here",
              chords: [
                { offset: 0, symbol: "Am" },
                { offset: 5, symbol: "G/B" },
              ],
            },
            { text: "line two here", chords: [] },
          ],
        },
      ],
    },
  });

  it("returns the input reference unchanged for 0 semitones", () => {
    expect(transposeSheet(sheet, 0)).toBe(sheet);
  });

  it("transposes every symbol without touching offsets, lyrics, or metadata", () => {
    const out = transposeSheet(sheet, 2);
    expect(out).not.toBe(sheet);
    expect(out.matched_title).toBe(sheet.matched_title);
    expect(out.body.sections[0].lines[0].text).toBe("line one here");
    expect(out.body.sections[0].lines[0].chords).toEqual([
      { offset: 0, symbol: "Bm" },
      { offset: 5, symbol: "A/C#" },
    ]);
    expect(out.body.sections[0].lines[1].chords).toEqual([]);
    // Input untouched (pure).
    expect(sheet.body.sections[0].lines[0].chords[0].symbol).toBe("Am");
  });

  it("spells accidentals from the transposed tonic: Am +1 -> Bbm", () => {
    const out = transposeSheet(sheet, 1);
    expect(out.body.sections[0].lines[0].chords).toEqual([
      { offset: 0, symbol: "Bbm" },
      { offset: 5, symbol: "Ab/C" },
    ]);
  });

  it("spells an E-major sheet +1 with flats: F Bb C Dm", () => {
    const eMajor = sheetSchema.parse({
      ...SHEET_BASE,
      body: {
        sections: [
          {
            heading: null,
            lines: [
              {
                text: "line one here",
                chords: [
                  { offset: 0, symbol: "E" },
                  { offset: 2, symbol: "A" },
                  { offset: 4, symbol: "B" },
                  { offset: 6, symbol: "C#m" },
                ],
              },
            ],
          },
        ],
      },
    });
    const out = transposeSheet(eMajor, 1);
    expect(out.body.sections[0].lines[0].chords.map((c) => c.symbol)).toEqual([
      "F",
      "Bb",
      "C",
      "Dm",
    ]);
  });

  it("lets the most-frequent root win over the first chord", () => {
    const freq = sheetSchema.parse({
      ...SHEET_BASE,
      body: {
        sections: [
          {
            heading: null,
            lines: [
              {
                text: "line one here",
                chords: [
                  { offset: 0, symbol: "Bb" },
                  { offset: 2, symbol: "A" },
                  { offset: 4, symbol: "A" },
                  { offset: 6, symbol: "A" },
                ],
              },
            ],
          },
        ],
      },
    });
    // Tonic proxy is A (3 votes over Bb's 1); A +1 lands on Bb -> flats.
    const out = transposeSheet(freq, 1);
    expect(out.body.sections[0].lines[0].chords.map((c) => c.symbol)).toEqual([
      "B",
      "Bb",
      "Bb",
      "Bb",
    ]);
  });

  it("overrides direction downward too: C-major -1 spells C# (B major)", () => {
    const cMajor = sheetSchema.parse({
      ...SHEET_BASE,
      body: {
        sections: [
          {
            heading: null,
            lines: [
              {
                text: "line",
                chords: [
                  { offset: 0, symbol: "C" },
                  { offset: 2, symbol: "D" },
                ],
              },
            ],
          },
        ],
      },
    });
    const out = transposeSheet(cMajor, -1);
    expect(out.body.sections[0].lines[0].chords.map((c) => c.symbol)).toEqual([
      "B",
      "C#",
    ]);
  });
});
