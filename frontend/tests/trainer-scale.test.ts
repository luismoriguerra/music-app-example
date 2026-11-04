import { describe, expect, it } from "vitest";
import { sheetSchema, type Sheet } from "@/lib/sheets/schemas";
import {
  resolveTrainerScale,
  listTrainerScaleOptions,
} from "@/lib/trainer-scale";

const BASE = {
  id: "22222222-2222-4222-8222-222222222222",
  query: "Trainer test",
  matched_title: "Trainer Test Song",
  matched_performer: "Tester",
  lyric_source: "chart",
  lyric_source_url: "https://tabs.ultimate-guitar.com/tab/tester/test-1",
  model_id: null,
  capo: null,
  tuning_note: null,
  created_at: "2026-09-18T00:00:00Z",
} as const;

/** Real parsed sheet carrying the given chord symbols on one line. */
function sheetWithChords(symbols: string[]): Sheet {
  const text = `${"la ".repeat(Math.max(1, symbols.length))}la`;
  return sheetSchema.parse({
    ...BASE,
    chord_source: "chart",
    chord_source_url: "https://tabs.ultimate-guitar.com/tab/tester/test-1",
    body: {
      sections: [
        {
          heading: null,
          lines: [
            {
              text,
              chords: symbols.map((symbol, i) => ({
                symbol,
                offset: Math.min(i * 3, text.length),
              })),
            },
          ],
        },
      ],
    },
    source_links: [],
    degraded: [],
  });
}

function lyricsOnlySheet(): Sheet {
  return sheetSchema.parse({
    ...BASE,
    chord_source: "none",
    chord_source_url: null,
    body: {
      sections: [
        {
          heading: null,
          lines: [{ text: "wordless melody line", chords: [] }],
        },
      ],
    },
    source_links: [],
    degraded: [{ part: "chords", reason: "unavailable" }],
  });
}

describe("resolveTrainerScale (008 FR-004)", () => {
  it("prefers the picker override over analysis and heuristic", () => {
    const sheet = sheetWithChords(["Am", "Am", "F", "C", "G"]);
    const resolved = resolveTrainerScale({
      displaySheet: sheet,
      transpose: 0,
      analysisKey: {
        tonic: "G",
        mode: "major",
        scale: ["G", "A", "B", "C", "D", "E", "F#", "G"],
      },
      override: { tonic: "D", mode: "major" },
    });
    expect(resolved.source).toBe("picker");
    expect(resolved.tonic).toBe("D");
    expect(resolved.mode).toBe("major");
    expect(resolved.rootPitch).toBe(2);
    expect(resolved.notes).toEqual(["D", "E", "F#", "G", "A", "B", "C#", "D"]);
    expect(resolved.transpose).toBe(0);
  });

  it("uses the analysis key when no override is set", () => {
    const sheet = sheetWithChords(["Am", "Am", "F", "C", "G"]);
    const resolved = resolveTrainerScale({
      displaySheet: sheet,
      transpose: 0,
      analysisKey: {
        tonic: "G",
        mode: "major",
        scale: ["G", "A", "B", "C", "D", "E", "F#", "G"],
      },
    });
    expect(resolved.source).toBe("analysis");
    expect(resolved.tonic).toBe("G");
    expect(resolved.notes).toEqual(["G", "A", "B", "C", "D", "E", "F#", "G"]);
  });

  it("falls back to the most-frequent-root heuristic with quality-aware mode", () => {
    const sheet = sheetWithChords(["Am", "Am", "F", "C", "G"]);
    const resolved = resolveTrainerScale({
      displaySheet: sheet,
      transpose: 0,
    });
    expect(resolved.source).toBe("heuristic");
    expect(resolved.tonic).toBe("A");
    expect(resolved.mode).toBe("minor");
    expect(resolved.rootPitch).toBe(9);
    expect(resolved.notes).toEqual(["A", "B", "C", "D", "E", "F", "G", "A"]);
  });

  it("breaks heuristic root ties by first appearance", () => {
    const sheet = sheetWithChords(["G", "C"]);
    const resolved = resolveTrainerScale({
      displaySheet: sheet,
      transpose: 0,
    });
    expect(resolved.tonic).toBe("G");
    expect(resolved.mode).toBe("major");
  });

  it("defaults the heuristic mode to major on tied quality votes", () => {
    const sheet = sheetWithChords(["C", "Cm"]);
    const resolved = resolveTrainerScale({
      displaySheet: sheet,
      transpose: 0,
    });
    expect(resolved.tonic).toBe("C");
    expect(resolved.mode).toBe("major");
  });

  it("spells heuristic tonics conventionally (flats for flat keys)", () => {
    const sheet = sheetWithChords(["Bb", "Eb", "F"]);
    const resolved = resolveTrainerScale({
      displaySheet: sheet,
      transpose: 0,
    });
    expect(resolved.tonic).toBe("Bb");
    expect(resolved.notes).toEqual(["Bb", "C", "D", "Eb", "F", "G", "A", "Bb"]);
  });

  it("records the transpose as provenance without re-shifting the sheet", () => {
    const sheet = sheetWithChords(["D", "G", "A"]);
    const resolved = resolveTrainerScale({
      displaySheet: sheet,
      transpose: 2,
    });
    expect(resolved.transpose).toBe(2);
    expect(resolved.tonic).toBe("D");
  });

  it("normalizes enharmonic overrides to the conventional spelling", () => {
    const sheet = sheetWithChords(["C"]);
    const resolved = resolveTrainerScale({
      displaySheet: sheet,
      transpose: 0,
      override: { tonic: "A#", mode: "major" },
    });
    expect(resolved.rootPitch).toBe(10);
    expect(resolved.tonic).toBe("Bb");
  });

  it("falls through a degenerate (empty-scale) analysis to the heuristic", () => {
    const sheet = sheetWithChords(["C", "F", "G"]);
    const resolved = resolveTrainerScale({
      displaySheet: sheet,
      transpose: 0,
      analysisKey: { tonic: "G", mode: "major", scale: [] },
    });
    expect(resolved.source).toBe("heuristic");
    expect(resolved.tonic).toBe("C");
  });

  it("skips unparseable symbols when counting roots", () => {
    // "CB" is schema-valid Western notation the chord parser rejects.
    const sheet = sheetWithChords(["CB", "C", "C", "F"]);
    const resolved = resolveTrainerScale({
      displaySheet: sheet,
      transpose: 0,
    });
    expect(resolved.tonic).toBe("C");
  });

  it.each([12, -12, 1.5, Number.NaN])(
    "rejects out-of-range transpose %s",
    (transpose) => {
      const sheet = sheetWithChords(["C"]);
      expect(() =>
        resolveTrainerScale({ displaySheet: sheet, transpose }),
      ).toThrow(/transpose/i);
    },
  );

  it.each([11, -11])("accepts boundary transpose %s", (transpose) => {
    const sheet = sheetWithChords(["C"]);
    expect(
      resolveTrainerScale({ displaySheet: sheet, transpose }).transpose,
    ).toBe(transpose);
  });

  it("throws on an unknown override tonic", () => {
    const sheet = sheetWithChords(["C"]);
    expect(() =>
      resolveTrainerScale({
        displaySheet: sheet,
        transpose: 0,
        override: { tonic: "H", mode: "major" },
      }),
    ).toThrow(/unknown tonic/i);
  });

  it("falls through an unknown analysis tonic to the heuristic", () => {
    const sheet = sheetWithChords(["C", "F", "G"]);
    const resolved = resolveTrainerScale({
      displaySheet: sheet,
      transpose: 0,
      analysisKey: { tonic: "H", mode: "major", scale: ["H"] },
    });
    expect(resolved.source).toBe("heuristic");
    expect(resolved.tonic).toBe("C");
  });

  it("falls through a schema-valid but unspellable analysis tonic (E#)", () => {
    // E# passes NOTE_NAME_RE but SPELLING_PITCH doesn't know it.
    const sheet = sheetWithChords(["C", "F", "G"]);
    const resolved = resolveTrainerScale({
      displaySheet: sheet,
      transpose: 0,
      analysisKey: { tonic: "E#", mode: "major", scale: ["E#"] },
    });
    expect(resolved.source).toBe("heuristic");
    expect(resolved.tonic).toBe("C");
  });

  it("throws on a lyrics-only sheet so the caller shows the picker fallback", () => {
    expect(() =>
      resolveTrainerScale({ displaySheet: lyricsOnlySheet(), transpose: 0 }),
    ).toThrow(/no scale/i);
  });
});

describe("listTrainerScaleOptions (008 FR-004 picker)", () => {
  it("lists 24 unique conventionally-spelled scales", () => {
    const options = listTrainerScaleOptions();
    expect(options).toHaveLength(24);
    const labels = options.map((o) => o.label);
    expect(new Set(labels).size).toBe(24);
    expect(labels).toContain("C major");
    expect(labels).toContain("A minor");
    // Flat-side tonics use flats, never sharps (Db, not C# major).
    expect(labels).toContain("Db major");
    expect(labels).not.toContain("C# major");
  });

  it("emits options every one of which resolves", () => {
    const sheet = sheetWithChords(["C"]);
    for (const option of listTrainerScaleOptions()) {
      const resolved = resolveTrainerScale({
        displaySheet: sheet,
        transpose: 0,
        override: { tonic: option.tonic, mode: option.mode },
      });
      expect(resolved.source).toBe("picker");
      expect(resolved.notes).toHaveLength(8);
    }
  });
});
