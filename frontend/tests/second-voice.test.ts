import { describe, expect, it } from "vitest";
import { buildSnapshot, isAnalysisStale } from "@/lib/second-voice";
import type { Sheet } from "@/lib/sheets/schemas";

const sheet = {
  body: {
    sections: [
      {
        heading: "Verse 1",
        lines: [
          {
            text: "I've heard there was a secret chord",
            chords: [
              { offset: 0, symbol: "C" },
              { offset: 11, symbol: "G/B" },
            ],
          },
          { text: "That David played and it pleased the Lord", chords: [] },
        ],
      },
      {
        heading: null,
        lines: [{ text: "Hallelujah", chords: [{ offset: 0, symbol: "F" }] }],
      },
    ],
  },
} as unknown as Sheet;

describe("second-voice pure helpers (T005, 006)", () => {
  it("builds chords_by_line from the displayed sheet in order", () => {
    expect(buildSnapshot(sheet, 5)).toEqual({
      transpose: 5,
      chords_by_line: [
        {
          section: 0,
          line: 0,
          chords: [
            { offset: 0, symbol: "C" },
            { offset: 11, symbol: "G/B" },
          ],
        },
        { section: 0, line: 1, chords: [] },
        { section: 1, line: 0, chords: [{ offset: 0, symbol: "F" }] },
      ],
    });
  });

  it("preserves offsets and slash-bass symbols verbatim (no re-spelling)", () => {
    const snapshot = buildSnapshot(sheet, -3);
    expect(snapshot.transpose).toBe(-3);
    expect(snapshot.chords_by_line[0].chords[1]).toEqual({
      offset: 11,
      symbol: "G/B",
    });
  });

  it("never includes lyric text in the snapshot", () => {
    const raw = JSON.stringify(buildSnapshot(sheet, 0));
    expect(raw).not.toContain("Hallelujah");
    expect(raw).not.toContain("David");
  });

  it("flags stale when the open analysis offset differs (null-safe)", () => {
    expect(isAnalysisStale({ transpose: 5 }, 5)).toBe(false);
    expect(isAnalysisStale({ transpose: 5 }, 3)).toBe(true);
    expect(isAnalysisStale({ transpose: 0 }, 1)).toBe(true);
    expect(isAnalysisStale(null, 5)).toBe(false);
    expect(isAnalysisStale(undefined, 5)).toBe(false);
  });
});
