import { sheetSchema, type Sheet } from "@/lib/sheets/schemas";

const BASE = {
  id: "33333333-3333-4333-8333-333333333333",
  query: "Trainer fixture",
  matched_title: "Trainer Fixture Song",
  matched_performer: "Tester",
  lyric_source: "chart",
  lyric_source_url: "https://tabs.ultimate-guitar.com/tab/tester/fixture-1",
  model_id: null,
  capo: null,
  tuning_note: null,
  created_at: "2026-09-18T00:00:00Z",
} as const;

/** Real parsed sheet carrying the given chord symbols on one line. */
export function makeChordSheet(symbols: string[]): Sheet {
  const text = `${"la ".repeat(Math.max(1, symbols.length))}la`;
  return sheetSchema.parse({
    ...BASE,
    chord_source: "chart",
    chord_source_url: "https://tabs.ultimate-guitar.com/tab/tester/fixture-1",
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

export function makeLyricsOnlySheet(): Sheet {
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
