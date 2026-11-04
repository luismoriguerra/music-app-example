import { describe, expect, it } from "vitest";
import {
  candidateSchema,
  errorSchema,
  generateSheetResponseSchema,
  historyEntrySchema,
  historyListResponseSchema,
  regenerateResponseSchema,
  sheetSchema,
  songSearchRequestSchema,
  songSearchResponseSchema,
} from "@/lib/sheets/schemas";

const candidate = {
  title: "Riptide",
  artist: "Vance Joy",
  album: "Dream Your Life Away",
  artwork_url: null,
  provider_refs: { lrclib_id: 969429 },
};

const body = {
  sections: [
    {
      heading: "Chorus",
      lines: [
        {
          text: "Lady, runnin' down to the riptide",
          chords: [
            { offset: 0, symbol: "Am" },
            { offset: 11, symbol: "Dadd9" },
          ],
        },
        { text: "Taken away to the dark side", chords: [] },
      ],
    },
  ],
};

const sheetBase = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  query: "Riptide",
  matched_title: "Riptide",
  matched_performer: "Vance Joy",
  lyric_source: "lrclib",
  lyric_source_url: "https://lrclib.net/api/get/969429",
  body,
  source_links: [
    {
      label: "LRCLIB",
      url: "https://lrclib.net/search/riptide",
      kind: "lyrics",
    },
  ],
  degraded: [],
  capo: null,
  tuning_note: null,
  created_at: "2026-09-16T00:00:00Z",
};

const chartHit = {
  ...sheetBase,
  lyric_source: "chart",
  lyric_source_url: "https://tabs.example.com/tab/1",
  chord_source: "chart",
  chord_source_url: "https://tabs.example.com/tab/1",
  model_id: null,
};

const fallback = {
  ...sheetBase,
  chord_source: "model-generated",
  chord_source_url: null,
  model_id: "openrouter/test-model",
};

const lyricsOnlyBody = {
  sections: [
    {
      heading: null,
      lines: [{ text: "Lady, runnin' down to the riptide", chords: [] }],
    },
  ],
};

const lyricsOnly = {
  ...sheetBase,
  body: lyricsOnlyBody,
  chord_source: "none",
  chord_source_url: null,
  model_id: null,
  degraded: [{ part: "chords", reason: "unavailable" }],
};

describe("sheets REST contract schemas (T007)", () => {
  it("accepts a valid song-search request", () => {
    expect(songSearchRequestSchema.parse({ query: "Riptide" })).toEqual({
      query: "Riptide",
    });
  });

  it("rejects empty/blank/over-long search queries", () => {
    for (const query of ["", "   ", "x".repeat(201)]) {
      expect(() => songSearchRequestSchema.parse({ query })).toThrow();
    }
  });

  it("accepts a valid song-search response incl. empty candidates", () => {
    expect(
      songSearchResponseSchema.parse({ candidates: [candidate] }),
    ).toBeTruthy();
    expect(songSearchResponseSchema.parse({ candidates: [] })).toEqual({
      candidates: [],
    });
  });

  it("rejects candidates with empty provider_refs", () => {
    expect(() =>
      songSearchResponseSchema.parse({
        candidates: [{ ...candidate, provider_refs: {} }],
      }),
    ).toThrow();
  });

  it("accepts the chart-hit sheet shape", () => {
    expect(sheetSchema.parse(chartHit)).toBeTruthy();
  });

  it("accepts the model-fallback sheet shape", () => {
    expect(sheetSchema.parse(fallback)).toBeTruthy();
  });

  it("accepts the lyrics-only shape (chord_source none + degraded)", () => {
    expect(sheetSchema.parse(lyricsOnly)).toBeTruthy();
  });

  it("rejects cross-shape chord_source combinations", () => {
    // chart with a model id
    expect(() =>
      sheetSchema.parse({ ...chartHit, model_id: "openrouter/x" }),
    ).toThrow();
    // fallback without a model id
    expect(() => sheetSchema.parse({ ...fallback, model_id: null })).toThrow();
    // none without the degraded chords entry
    expect(() => sheetSchema.parse({ ...lyricsOnly, degraded: [] })).toThrow();
    // none with chords on a line
    expect(() => sheetSchema.parse({ ...lyricsOnly, body })).toThrow();
  });

  it("rejects non-https link-backs and >8 source links", () => {
    expect(() =>
      sheetSchema.parse({
        ...chartHit,
        lyric_source_url: "http://example.com/x",
      }),
    ).toThrow();
    const links = Array.from({ length: 9 }, (_, i) => ({
      label: `L${i}`,
      url: `https://example.com/${i}`,
      kind: "lyrics" as const,
    }));
    expect(() =>
      sheetSchema.parse({ ...chartHit, source_links: links }),
    ).toThrow();
  });

  it("rejects bad chord offsets/symbols in the body", () => {
    const badOffset = {
      ...chartHit,
      body: {
        sections: [
          {
            heading: null,
            lines: [{ text: "abc", chords: [{ offset: 99, symbol: "Am" }] }],
          },
        ],
      },
    };
    expect(() => sheetSchema.parse(badOffset)).toThrow();
    const badSymbol = {
      ...chartHit,
      body: {
        sections: [
          {
            heading: null,
            lines: [{ text: "abc", chords: [{ offset: 0, symbol: "H" }] }],
          },
        ],
      },
    };
    expect(() => sheetSchema.parse(badSymbol)).toThrow();
  });

  it("accepts degraded part/reason enums and rejects the rest", () => {
    const degraded = {
      ...fallback,
      degraded: [
        { part: "video", reason: "quota" },
        { part: "chords", reason: "timeout" },
      ],
    };
    expect(sheetSchema.parse(degraded)).toBeTruthy();
    expect(() =>
      sheetSchema.parse({
        ...fallback,
        degraded: [{ part: "lyrics", reason: "quota" }],
      }),
    ).toThrow();
  });

  it("accepts the generate + history envelopes", () => {
    const entry = {
      id: "123e4567-e89b-42d3-a456-426614174001",
      query: "Riptide",
      matched_title: "Riptide",
      matched_performer: "Vance Joy",
      sheet_id: "123e4567-e89b-42d3-a456-426614174000",
      created_at: "2026-09-16T00:00:00Z",
      favorite: false,
    };
    expect(historyEntrySchema.parse(entry)).toBeTruthy();
    expect(
      generateSheetResponseSchema.parse({
        entry_id: entry.id,
        sheet: chartHit,
      }),
    ).toBeTruthy();
    expect(
      historyListResponseSchema.parse({ entries: [entry], total: 1 }),
    ).toBeTruthy();
    expect(
      regenerateResponseSchema.parse({ entry_id: entry.id, sheet: fallback }),
    ).toBeTruthy();
  });

  it("accepts the 4-code error taxonomy and rejects the rest", () => {
    for (const code of [
      "VALIDATION_ERROR",
      "NO_MATCH",
      "NOT_FOUND",
      "PROVIDER_ERROR",
    ]) {
      expect(errorSchema.parse({ error: { code, message: "m" } })).toBeTruthy();
    }
    expect(() =>
      errorSchema.parse({ error: { code: "QUOTA_EXHAUSTED", message: "m" } }),
    ).toThrow();
  });

  it("validates candidateSchema standalone incl. nullable album/artwork", () => {
    expect(candidateSchema.parse(candidate)).toBeTruthy();
    expect(
      candidateSchema.parse({ ...candidate, album: null, artwork_url: null }),
    ).toBeTruthy();
  });

  it("accepts duckduckgo provider ref in candidate and search response (US1, FR-001)", () => {
    const ddgCandidate = {
      title: "Creep",
      artist: "Radiohead",
      album: null,
      artwork_url: null,
      provider_refs: { duckduckgo: "creep|radiohead" },
    };
    expect(candidateSchema.parse(ddgCandidate)).toBeTruthy();
    expect(
      songSearchResponseSchema.parse({ candidates: [ddgCandidate] }),
    ).toBeTruthy();
  });
});
