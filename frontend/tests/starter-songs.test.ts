import { describe, expect, it } from "vitest";
import { STARTER_SONGS } from "@/lib/sheets/starter-songs";

describe("STARTER_SONGS (data-model T1)", () => {
  it("holds at least 4 curated entries", () => {
    expect(STARTER_SONGS.length).toBeGreaterThanOrEqual(4);
  });

  it("holds unique non-blank queries of 1-200 chars", () => {
    const seen = new Set<string>();
    for (const query of STARTER_SONGS) {
      expect(query.trim().length).toBeGreaterThanOrEqual(1);
      expect(query.length).toBeLessThanOrEqual(200);
      expect(seen.has(query)).toBe(false);
      seen.add(query);
    }
  });
});
