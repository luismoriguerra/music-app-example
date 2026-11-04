import { describe, expect, it } from "vitest";
import ViewStates from "@/components/ViewStates.astro";
import { renderAstro } from "./astro-container";

describe("ViewStates (FR-016)", () => {
  it("renders loading with live-region status", async () => {
    const html = await renderAstro(ViewStates, { props: { state: "loading" } });
    expect(html).toContain('role="status"');
    expect(html).toContain('data-state="loading"');
    expect(html).toContain("Loading");
  });

  it("renders a friendly empty state", async () => {
    const html = await renderAstro(ViewStates, {
      props: { state: "empty", message: "No courses yet." },
    });
    expect(html).toContain('data-state="empty"');
    expect(html).toContain("No courses yet.");
  });

  it("renders error with a retry action", async () => {
    const html = await renderAstro(ViewStates, {
      props: { state: "error", retryHref: "/", retryLabel: "Retry" },
    });
    expect(html).toContain('role="alert"');
    expect(html).toContain('href="/"');
    expect(html).toContain("Retry");
  });
});
