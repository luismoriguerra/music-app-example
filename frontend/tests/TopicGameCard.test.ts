import { describe, expect, it } from "vitest";
import TopicGameCard from "@/components/TopicGameCard.astro";
import { renderAstro } from "./astro-container";

describe("TopicGameCard (FR-003/FR-004)", () => {
  it("labels a topic and links to the topics route", async () => {
    const html = await renderAstro(TopicGameCard, {
      props: {
        title: "Chords",
        slug: "chords",
        courseSlug: "ukulele",
        kind: "topic",
        description: "Chord reference.",
      },
    });
    expect(html).toContain(">Topic<");
    expect(html).toContain('data-kind="topic"');
    expect(html).toContain('href="/courses/ukulele/topics/chords"');
    expect(html).toContain("Chords");
    expect(html).toContain("Chord reference.");
  });

  it("labels a game and links to the games route", async () => {
    const html = await renderAstro(TopicGameCard, {
      props: {
        title: "Name That Chord",
        slug: "name-that-chord",
        courseSlug: "ukulele",
        kind: "game",
        description: "Quiz.",
      },
    });
    expect(html).toContain(">Game<");
    expect(html).toContain('data-kind="game"');
    expect(html).toContain('href="/courses/ukulele/games/name-that-chord"');
  });
});
