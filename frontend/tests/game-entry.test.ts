import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gameSchema, type Game } from "@/lib/content/schemas";
import { validateCollections } from "@/lib/content/validate";

const COURSES = [
  { slug: "ukulele", title: "Ukulele", description: "d", cover: "x", order: 0 },
] as never;

const validGame = {
  title: "Lyrics + Chords",
  slug: "lyrics-chords",
  kind: "game",
  courseSlug: "ukulele",
  description: "Type a song name to generate its lyrics with ukulele chords.",
  rules: "Enter a song name and submit.",
  order: 10,
};

describe("game entry contract (T013)", () => {
  it("accepts a valid lyrics-chords entry", () => {
    expect(gameSchema.parse(validGame)).toMatchObject({ kind: "game" });
  });

  it("accepts the real shipped JSON", () => {
    const raw = JSON.parse(
      readFileSync(
        join(process.cwd(), "src/content/games/lyrics-chords.json"),
        "utf8",
      ),
    );
    const parsed = gameSchema.parse(raw);
    expect(parsed.slug).toBe("lyrics-chords");
    expect(parsed.kind).toBe("game");
    const errors = validateCollections({
      courses: COURSES,
      topics: [],
      games: [parsed],
      chords: [],
      scales: [],
    });
    // Only chord/scales-count rules may fire with empty lists; no game errors.
    expect(errors.filter((e) => e.startsWith("games/"))).toEqual([]);
  });

  it("rejects a non-game kind literal", () => {
    expect(() => gameSchema.parse({ ...validGame, kind: "topic" })).toThrow();
  });

  it("rejects bad slug shapes and over-long slugs", () => {
    for (const slug of ["Lyrics Chords", "UPPER", "x".repeat(65), ""]) {
      expect(() => gameSchema.parse({ ...validGame, slug })).toThrow();
    }
  });

  it("names duplicate game slugs within a course (rule 2)", () => {
    const games = [validGame, { ...validGame }] as Game[];
    const errors = validateCollections({
      courses: COURSES,
      topics: [],
      games,
      chords: [],
      scales: [],
    });
    expect(errors.some((e) => e.includes("duplicate game slug"))).toBe(true);
    expect(errors.some((e) => e.includes("ukulele/lyrics-chords"))).toBe(true);
  });

  it("names games pointing at an unknown course (rule 3)", () => {
    const games = [{ ...validGame, courseSlug: "banjo" }] as Game[];
    const errors = validateCollections({
      courses: COURSES,
      topics: [],
      games,
      chords: [],
      scales: [],
    });
    expect(errors.some((e) => e.includes("banjo"))).toBe(true);
  });
});
