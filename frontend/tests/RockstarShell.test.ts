import { describe, expect, it } from "vitest";
import Layout from "@/layouts/Layout.astro";
import Hero from "@/components/Hero.astro";
import UkuleleBadge from "@/components/UkuleleBadge.astro";
import ViewStates from "@/components/ViewStates.astro";
import NotFound from "@/pages/404.astro";
import { renderAstro } from "./astro-container";

describe("RockstarShell: Layout (FR-001)", () => {
  it("renders a sticky header with identity, Courses nav, and toggle mount", async () => {
    const html = await renderAstro(Layout, {
      props: { title: "Shell check" },
    });
    expect(html).toContain("<header");
    expect(html).toContain("sticky");
    expect(html).toContain('aria-label="Music Courses home"');
    expect(html).toContain('href="/"');
    expect(html).toContain(">Courses<");
    expect(html).toContain("Theme:");
  });

  it("SSR-defaults html.dark with a blocking theme init script", async () => {
    const html = await renderAstro(Layout, {
      props: { title: "Shell check" },
    });
    expect(html).toContain("<html");
    expect(html).toContain('class="dark"');
    expect(html).toContain("music-app-example:theme");
    expect(html).toContain("localStorage.getItem");
    expect(html).toContain("documentElement");
  });

  it("renders a minimal footer with catalog links", async () => {
    const html = await renderAstro(Layout, {
      props: { title: "Shell check" },
    });
    expect(html).toContain("<footer");
    expect(html).toContain("Music Courses");
  });
});

describe("RockstarShell: Hero + UkuleleBadge (FR-002/FR-004)", () => {
  it("renders eyebrow, headline, and subcopy", async () => {
    const html = await renderAstro(Hero, {
      props: {
        eyebrow: "Music courses",
        title: "Learn ukulele",
        subcopy: "Start strumming today.",
      },
    });
    expect(html).toContain("Music courses");
    expect(html).toContain("Learn ukulele");
    expect(html).toContain("Start strumming today.");
  });

  it("renders the ukulele SVG badge with an accessible label", async () => {
    const html = await renderAstro(UkuleleBadge, {
      props: { title: "Ukulele" },
    });
    expect(html).toContain("<svg");
    expect(html).toContain('aria-label="Ukulele"');
    expect(html).not.toContain("🎸");
  });
});

describe("RockstarShell: ViewStates + 404 keep behavior (FR-022)", () => {
  it("keeps loading/empty/error semantics with rockstar styling", async () => {
    const loading = await renderAstro(ViewStates, {
      props: { state: "loading" },
    });
    expect(loading).toContain('role="status"');
    expect(loading).toContain("animate-spin");

    const empty = await renderAstro(ViewStates, {
      props: { state: "empty", message: "No matches" },
    });
    expect(empty).toContain("No matches");

    const error = await renderAstro(ViewStates, {
      props: { state: "error", retryHref: "/retry", retryLabel: "Retry" },
    });
    expect(error).toContain('role="alert"');
    expect(error).toContain('href="/retry"');
    expect(error).toContain("h-11");
  });

  it("keeps the not-found page with a rockstar headline and back link", async () => {
    const html = await renderAstro(NotFound, { props: {} });
    expect(html).toContain('data-testid="not-found"');
    expect(html).toContain("font-display");
    expect(html).toContain("Back to catalog");
    expect(html).toContain('href="/"');
  });
});
