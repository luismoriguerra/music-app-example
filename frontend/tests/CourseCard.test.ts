import { describe, expect, it } from "vitest";
import CourseCard from "@/components/CourseCard.astro";
import { renderAstro } from "./astro-container";

describe("CourseCard (FR-001/FR-002)", () => {
  it("renders title, description, and an entry action to the course route", async () => {
    const html = await renderAstro(CourseCard, {
      props: {
        title: "Ukulele",
        slug: "ukulele",
        description: "Start your ukulele journey.",
      },
    });
    expect(html).toContain("Ukulele");
    expect(html).toContain("Start your ukulele journey.");
    expect(html).toContain('href="/courses/ukulele"');
    expect(html).toContain("Open course");
  });

  it("renders without a cover (falls back to initial)", async () => {
    const html = await renderAstro(CourseCard, {
      props: { title: "Banjo", slug: "banjo", description: "Twang." },
    });
    expect(html).toContain(">B<");
  });
});
