import { describe, expect, it } from "vitest";
import { slugify, uniqueSlugs } from "@/lib/slug";

describe("slugify (FR-015)", () => {
  it("lowercases ASCII and joins with single hyphens", () => {
    expect(slugify("Ukulele Chords")).toBe("ukulele-chords");
    expect(slugify("  Name   That  Chord ")).toBe("name-that-chord");
  });

  it("strips punctuation and collapses hyphens", () => {
    expect(slugify("C# / Db  --  Major!")).toBe("c-db-major");
  });

  it("caps at 64 chars without trailing hyphen", () => {
    const long = "a ".repeat(60).trim();
    const s = slugify(long);
    expect(s.length).toBeLessThanOrEqual(64);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("uniqueSlugs (per-scope collision suffixes)", () => {
  it("appends -2, -3 on collisions in order", () => {
    expect(uniqueSlugs(["Chords", "Chords", "Chords"])).toEqual([
      "chords",
      "chords-2",
      "chords-3",
    ]);
  });

  it("leaves distinct titles untouched", () => {
    expect(uniqueSlugs(["Chords", "Scales"])).toEqual(["chords", "scales"]);
  });
});
