import { describe, expect, it } from "vitest";
import {
  errorSchema,
  secondVoiceAnalysisSchema,
  secondVoiceAnalyzeResponseSchema,
  secondVoiceGetResponseSchema,
  secondVoiceListResponseSchema,
  secondVoiceOutSchema,
  secondVoiceSnapshotSchema,
  secondVoiceSummarySchema,
} from "@/lib/sheets/schemas";

const snapshotLine = {
  section: 0,
  line: 0,
  chords: [
    { offset: 0, symbol: "C" },
    { offset: 11, symbol: "Am" },
  ],
};

const snapshotRequest = {
  transpose: 5,
  chords_by_line: [snapshotLine, { section: 0, line: 1, chords: [] }],
};

const goldenOut = {
  key: {
    tonic: "C",
    mode: "major",
    justification: "The song uses C, Am, F and G.",
  },
  scale: ["C", "D", "E", "F", "G", "A", "B"],
  diatonic_chords: [
    { degree: "I", chord: "C" },
    { degree: "ii", chord: "Dm" },
    { degree: "iii", chord: "Em" },
    { degree: "IV", chord: "F" },
    { degree: "V", chord: "G" },
    { degree: "vi", chord: "Am" },
    { degree: "vii°", chord: "Bdim" },
  ],
  progression: [
    {
      section: "Verse 1",
      chords: ["C", "Am", "F", "G"],
      degrees: ["I", "vi", "IV", "V"],
    },
  ],
  special_chords: [
    { chord: "E7", function: "Secondary dominant V7/vi leading to Am." },
  ],
  cadences: [
    { name: "V–I", chords: ["G", "C"], location: "End of the chorus." },
  ],
  section_feel: [{ section: "Verse 1", feeling: "Stable and bright." }],
  second_voice: {
    melody_status: "missing",
    strategy: "Use diatonic thirds above where they fit the chord.",
    up: null,
    down: null,
    recommendation: null,
  },
  note_table: [
    {
      section: "Verse 1",
      lyric_snippet: "I've heard there was a secret chord",
      chord: "C",
      first_voice: null,
      second_voice: null,
      interval: null,
      explanation: "No melody, so no exact pitch is proposed.",
    },
  ],
  singing_tips: ["Sing softly and listen to the chord before entering."],
};

const analysisRow = {
  id: "223e4567-e89b-42d3-a456-426614174001",
  sheet_id: "123e4567-e89b-42d3-a456-426614174000",
  transpose: 5,
  model_id: "openrouter/test-model",
  analysis: goldenOut,
  created_at: "2026-09-17T00:00:00Z",
};

const summaryRow = {
  id: analysisRow.id,
  sheet_id: analysisRow.sheet_id,
  transpose: 5,
  model_id: "openrouter/test-model",
  created_at: "2026-09-17T00:00:00Z",
};

describe("second-voice REST contract schemas (T003, 006)", () => {
  it("accepts a valid analyze snapshot incl. lyric-only lines", () => {
    expect(secondVoiceSnapshotSchema.parse(snapshotRequest)).toEqual(
      snapshotRequest,
    );
  });

  it("accepts transpose 0 and the ±11 bounds", () => {
    for (const transpose of [0, -11, 11]) {
      expect(
        secondVoiceSnapshotSchema.parse({ ...snapshotRequest, transpose }),
      ).toBeTruthy();
    }
  });

  it("rejects out-of-range or non-integer transpose", () => {
    for (const transpose of [-12, 12, 2.5, "5"]) {
      expect(() =>
        secondVoiceSnapshotSchema.parse({ ...snapshotRequest, transpose }),
      ).toThrow();
    }
  });

  it("rejects snapshots with bad shape", () => {
    // empty line list
    expect(() =>
      secondVoiceSnapshotSchema.parse({ transpose: 0, chords_by_line: [] }),
    ).toThrow();
    // negative section / line indexes
    expect(() =>
      secondVoiceSnapshotSchema.parse({
        transpose: 0,
        chords_by_line: [{ ...snapshotLine, section: -1 }],
      }),
    ).toThrow();
    // negative / non-integer offsets
    expect(() =>
      secondVoiceSnapshotSchema.parse({
        transpose: 0,
        chords_by_line: [
          { section: 0, line: 0, chords: [{ offset: -1, symbol: "C" }] },
        ],
      }),
    ).toThrow();
    // non-FR-013 symbol
    expect(() =>
      secondVoiceSnapshotSchema.parse({
        transpose: 0,
        chords_by_line: [
          { section: 0, line: 0, chords: [{ offset: 0, symbol: "H" }] },
        ],
      }),
    ).toThrow();
    // lyric text must never ride the wire
    expect(() =>
      secondVoiceSnapshotSchema.parse({
        transpose: 0,
        chords_by_line: [{ section: 0, line: 0, chords: [], text: "lyrics!" }],
      }),
    ).toThrow();
  });

  it("accepts a valid SecondVoiceOut incl. empty special_chords", () => {
    expect(secondVoiceOutSchema.parse(goldenOut)).toBeTruthy();
    expect(
      secondVoiceOutSchema.parse({ ...goldenOut, special_chords: [] }),
    ).toBeTruthy();
  });

  it("rejects diatonic sets that are short or mis-ordered", () => {
    const six = {
      ...goldenOut,
      diatonic_chords: goldenOut.diatonic_chords.slice(0, 6),
    };
    expect(() => secondVoiceOutSchema.parse(six)).toThrow();
    const swapped = {
      ...goldenOut,
      diatonic_chords: [
        goldenOut.diatonic_chords[1],
        goldenOut.diatonic_chords[0],
        ...goldenOut.diatonic_chords.slice(2),
      ],
    };
    expect(() => secondVoiceOutSchema.parse(swapped)).toThrow();
  });

  it("minor keys validate against the natural-minor degree set", () => {
    const minorDiatonics = [
      { degree: "i", chord: "Am" },
      { degree: "ii°", chord: "Bdim" },
      { degree: "III", chord: "C" },
      { degree: "iv", chord: "Dm" },
      { degree: "v", chord: "Em" },
      { degree: "VI", chord: "F" },
      { degree: "VII", chord: "G" },
    ];
    const minorKey = { tonic: "A", mode: "minor", justification: "Am home." };
    expect(() =>
      secondVoiceOutSchema.parse({
        ...goldenOut,
        key: minorKey,
        diatonic_chords: minorDiatonics,
      }),
    ).not.toThrow();
    expect(() =>
      secondVoiceOutSchema.parse({ ...goldenOut, key: minorKey }),
    ).toThrow(/minor key/);
    expect(() =>
      secondVoiceOutSchema.parse({
        ...goldenOut,
        diatonic_chords: minorDiatonics,
      }),
    ).toThrow(/major key/);
  });

  it("rejects progression rows whose degrees do not match chords", () => {
    const bad = {
      ...goldenOut,
      progression: [
        { section: "Verse 1", chords: ["C", "Am"], degrees: ["I"] },
      ],
    };
    expect(() => secondVoiceOutSchema.parse(bad)).toThrow();
  });

  it("rejects lyric snippets longer than 120 chars", () => {
    const bad = {
      ...goldenOut,
      note_table: [
        { ...goldenOut.note_table[0], lyric_snippet: "x".repeat(121) },
      ],
    };
    expect(() => secondVoiceOutSchema.parse(bad)).toThrow();
  });

  it("rejects missing-melody rows that invent any pitches (FR-010, F3)", () => {
    const cases = [
      { first_voice: "G" },
      { second_voice: "E" },
      { interval: "3rd" },
    ] as const;
    for (const invented of cases) {
      const bad = {
        ...goldenOut,
        note_table: [{ ...goldenOut.note_table[0], ...invented }],
      };
      expect(() => secondVoiceOutSchema.parse(bad)).toThrow();
    }
  });

  it("rejects missing-melody proposals in up/down/recommendation (FR-010)", () => {
    for (const field of ["up", "down", "recommendation"] as const) {
      const bad = {
        ...goldenOut,
        second_voice: {
          ...goldenOut.second_voice,
          [field]: "Sing a third above.",
        },
      };
      expect(() => secondVoiceOutSchema.parse(bad)).toThrow();
    }
  });
  it("rejects non-FR-013 symbols anywhere in the analysis", () => {
    const badDiatonic = {
      ...goldenOut,
      diatonic_chords: goldenOut.diatonic_chords.map((d, i) =>
        i === 0 ? { ...d, chord: "H" } : d,
      ),
    };
    expect(() => secondVoiceOutSchema.parse(badDiatonic)).toThrow();
    const badTable = {
      ...goldenOut,
      note_table: [{ ...goldenOut.note_table[0], chord: "Z9" }],
    };
    expect(() => secondVoiceOutSchema.parse(badTable)).toThrow();
  });

  it("rejects an empty note_table with an empty strategy", () => {
    const bad = {
      ...goldenOut,
      note_table: [],
      second_voice: { ...goldenOut.second_voice, strategy: "  " },
    };
    expect(() => secondVoiceOutSchema.parse(bad)).toThrow();
  });

  it("rejects verbose prose and oversized lists (concise caps)", () => {
    const longFeeling = {
      ...goldenOut,
      section_feel: [{ section: "Verse 1", feeling: "x".repeat(481) }],
    };
    expect(() => secondVoiceOutSchema.parse(longFeeling)).toThrow();
    const manyTips = {
      ...goldenOut,
      singing_tips: [
        "Sing.",
        "Breathe.",
        "Listen.",
        "Smile.",
        "Relax.",
        "Extra.",
      ],
    };
    expect(() => secondVoiceOutSchema.parse(manyTips)).toThrow();
    const longTip = { ...goldenOut, singing_tips: ["x".repeat(321)] };
    expect(() => secondVoiceOutSchema.parse(longTip)).toThrow();
  });
  it("accepts the analyze/get response envelopes", () => {
    expect(
      secondVoiceAnalyzeResponseSchema.parse({ analysis: analysisRow }),
    ).toBeTruthy();
    expect(
      secondVoiceGetResponseSchema.parse({ analysis: analysisRow }),
    ).toBeTruthy();
  });

  it("rejects analysis rows with bad ids, transpose, or model", () => {
    expect(() =>
      secondVoiceAnalysisSchema.parse({ ...analysisRow, id: "nope" }),
    ).toThrow();
    expect(() =>
      secondVoiceAnalysisSchema.parse({ ...analysisRow, transpose: 12 }),
    ).toThrow();
    expect(() =>
      secondVoiceAnalysisSchema.parse({ ...analysisRow, model_id: "  " }),
    ).toThrow();
  });

  it("accepts summary rows and the newest-first list envelope", () => {
    expect(secondVoiceSummarySchema.parse(summaryRow)).toEqual(summaryRow);
    expect(
      secondVoiceListResponseSchema.parse({ analyses: [summaryRow], total: 1 }),
    ).toBeTruthy();
    expect(
      secondVoiceListResponseSchema.parse({ analyses: [], total: 0 }),
    ).toBeTruthy();
  });

  it("summaries never carry the full analysis JSON", () => {
    expect(() =>
      secondVoiceSummarySchema.parse({ ...summaryRow, analysis: goldenOut }),
    ).toThrow();
  });

  it("reuses the 004 error envelope for the analysis taxonomy", () => {
    for (const code of ["VALIDATION_ERROR", "NOT_FOUND", "PROVIDER_ERROR"]) {
      expect(
        errorSchema.parse({ error: { code, message: "msg" } }),
      ).toBeTruthy();
    }
  });
});
