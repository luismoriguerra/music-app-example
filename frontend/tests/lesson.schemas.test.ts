import { describe, expect, it } from "vitest";
import {
  lessonSchema,
  progressionSchema,
  topicSchema,
} from "@/lib/content/schemas";

const validProgression = {
  name: "Circle in C",
  key: "C",
  degrees: ["I", "vi", "IV", "V"],
  chords: ["C major", "A minor", "F major", "G major"],
};

const validSection = {
  heading: "What Is a Harmonic Circle?",
  paragraphs: [
    "A harmonic circle is a *loop* of chords that repeats.",
    "Highlights:\n\n- tension\n- release",
  ],
  progressions: [validProgression],
};

const plainSection = (heading: string) => ({
  heading,
  paragraphs: ["Plain prose paragraph."],
});

const validLesson = {
  intro: ["Four chords, hundreds of songs."],
  sections: [
    validSection,
    plainSection("Second"),
    plainSection("Third"),
    plainSection("Fourth"),
  ],
  summary: ["Practice one circle every day."],
};

const lessonTopic = {
  title: "Harmonic Circles",
  slug: "harmonic-circles",
  kind: "topic",
  courseSlug: "ukulele",
  description: "Learn the chord circles behind hundreds of songs.",
  format: "lesson",
  lesson: validLesson,
  order: 1,
};

describe("lesson schemas", () => {
  it("parses a valid chapter", () => {
    expect(() => lessonSchema.parse(validLesson)).not.toThrow();
    expect(() => topicSchema.parse(lessonTopic)).not.toThrow();
  });

  it("rejects format lesson without lesson content", () => {
    const rest: Record<string, unknown> = { ...lessonTopic };
    delete rest.lesson;
    expect(() => topicSchema.parse(rest)).toThrow();
  });

  it("rejects lesson content on format reference", () => {
    expect(() =>
      topicSchema.parse({ ...lessonTopic, format: "reference" }),
    ).toThrow();
  });

  it("rejects raw HTML in prose", () => {
    expect(() =>
      lessonSchema.parse({
        ...validLesson,
        intro: ["Hello <b>world</b>"],
      }),
    ).toThrow(/raw HTML/);
  });

  it("rejects degrees/chords length mismatch", () => {
    expect(() =>
      lessonSchema.parse({
        ...validLesson,
        sections: [
          {
            ...validSection,
            progressions: [{ ...validProgression, degrees: ["I", "vi"] }],
          },
          plainSection("Second"),
          plainSection("Third"),
          plainSection("Fourth"),
        ],
      }),
    ).toThrow(/equal lengths/);
  });

  it("rejects an invalid key spelling", () => {
    expect(() =>
      lessonSchema.parse({
        ...validLesson,
        sections: [
          {
            ...validSection,
            progressions: [{ ...validProgression, key: "Hb" }],
          },
          plainSection("Second"),
          plainSection("Third"),
          plainSection("Fourth"),
        ],
      }),
    ).toThrow();
  });

  it("rejects fewer than four sections", () => {
    expect(() =>
      lessonSchema.parse({
        ...validLesson,
        sections: [plainSection("Only")],
      }),
    ).toThrow();
  });

  it("parses format circles without lesson content", () => {
    const rest: Record<string, unknown> = { ...lessonTopic };
    delete rest.lesson;
    expect(() =>
      topicSchema.parse({
        ...rest,
        title: "Circles",
        slug: "circles",
        format: "circles",
        order: 2,
      }),
    ).not.toThrow();
  });

  it("rejects lesson content on format circles", () => {
    expect(() =>
      topicSchema.parse({ ...lessonTopic, format: "circles" }),
    ).toThrow(/required iff format is 'lesson'/);
  });

  it("defaults progression type to major when absent", () => {
    const parsed = progressionSchema.parse(validProgression);
    expect(parsed.type).toBe("major");
  });

  it("accepts explicit minor progression type", () => {
    const parsed = progressionSchema.parse({
      ...validProgression,
      type: "minor",
    });
    expect(parsed.type).toBe("minor");
  });

  it("rejects invalid progression type", () => {
    expect(() =>
      progressionSchema.parse({ ...validProgression, type: "dorian" }),
    ).toThrow();
  });
});
