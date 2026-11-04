import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ViewStates from "@/components/ViewStates.astro";
import LessonReader from "@/components/LessonReader.astro";
import CourseCard from "@/components/CourseCard.astro";
import { ChordList } from "@/components/ChordList";
import { CircleList } from "@/components/CircleList";
import { ScaleList } from "@/components/ScaleList";
import { SheetGenerator } from "@/components/SheetGenerator";
import { HistoryList } from "@/components/HistoryList";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CandidateList } from "@/components/CandidateList";
import { chordDisplayName, type Chord } from "@/lib/chords";
import { scaleSpelling, type Scale } from "@/lib/scales";
import type {
  Chord as SchemaChord,
  Lesson,
  Progression,
} from "@/lib/content/schemas";
import type { Candidate, HistoryEntry } from "@/lib/sheets/schemas";
import { renderAstro } from "./astro-container";

const css = readFileSync(
  join(process.cwd(), "src", "styles", "global.css"),
  "utf8",
);

/** 44px+ touch target markers (R8/FR-018/SC-006). */
const has44 = (classAttr: string): boolean =>
  /(?:min-h-11|h-11|size-11|min-w-11)/.test(classAttr);

/** class attribute of the first tag matching the marker. */
const clsOf = (html: string, marker: string): string => {
  const at = html.indexOf(marker);
  expect(at, `marker ${marker} present`).toBeGreaterThan(-1);
  const tag = html.slice(html.lastIndexOf("<", at), at + 400);
  return tag.match(/class="([^"]*)"/)?.[1] ?? "";
};

// --- Minimal fixtures ---

const mkChord = (root: Chord["root"], type: Chord["type"]): Chord => ({
  name: chordDisplayName(root, type),
  type,
  root,
  rootPitch: 0,
  topicSlug: "chords",
  diagram: {
    strings: "GCEA",
    frets: [0, 0, 0, 3],
    fingers: [0, 0, 0, 3],
    baseFret: 1,
    barres: [],
  },
});

const mkScale = (name: string, type: Scale["type"]): Scale => {
  const { displaySpelling, notes } = scaleSpelling(0, type);
  return {
    name,
    type,
    root: "C",
    rootPitch: 0,
    topicSlug: "scales",
    notes: [...notes],
    degrees: ["1", "2", "3", "4", "5", "6", "7", "8"],
    intervals: "W-W-H-W-W-W-H",
    displaySpelling,
    diagram: {
      strings: "GCEA",
      positions: [1, 2, 3, 4, 5, 6, 7, 8].map((order) => ({
        string: 1,
        fret: 0,
        order,
        finger: 0,
      })),
      baseFret: 1,
      positionLabel: "fixture",
    },
  };
};

const CIRCLE: Progression = {
  name: "Circle in C",
  key: "C",
  type: "major",
  degrees: ["I", "vi", "IV", "V"],
  chords: ["C major", "A minor", "F major", "G major"],
};

const LIBRARY: SchemaChord[] = [
  {
    name: "C major",
    type: "major",
    root: "C",
    rootPitch: 0,
    topicSlug: "chords",
    diagram: {
      strings: "GCEA",
      frets: [0, 0, 0, 3],
      fingers: [0, 0, 0, 3],
      baseFret: 1,
      barres: [],
    },
  },
];

const LESSON: Lesson = {
  intro: ["Intro."],
  sections: [
    { heading: "Only Section", paragraphs: ["Prose."], progressions: [] },
  ],
  summary: ["Summary."],
};

const HISTORY: HistoryEntry[] = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    query: "Imagine",
    matched_title: "Imagine",
    matched_performer: "John Lennon",
    sheet_id: "44444444-4444-4444-8444-444444444444",
    created_at: "2026-09-16T00:02:00Z",
    favorite: false,
  },
];

const CANDIDATES: Candidate[] = [
  {
    title: "Riptide",
    artist: "Vance Joy",
    album: "Dream Your Life Away",
    artwork_url: null,
    provider_refs: { lrclib_id: 969430 },
  },
];

describe("RockstarA11y: global focus + tokens (FR-020/FR-021/SC-005)", () => {
  it("exposes a visible global focus ring via the rock accent", () => {
    expect(css).toContain(":focus-visible");
    expect(css).toContain("outline: 2px solid var(--rock)");
  });

  it("carries contrast-fixed muted tokens in both appearances", () => {
    expect(css).toContain("--muted-foreground: oklch(0.47 0 0)");
    expect(css).toContain("--muted-foreground: oklch(0.73 0 0)");
    expect(css).toContain("--rock: oklch(");
  });

  it("flattens motion under prefers-reduced-motion", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("transition-duration: 0.01ms");
  });
});

describe("RockstarA11y: 44px+ primary targets (FR-018/SC-006)", () => {
  it("explorer error retries meet the target", () => {
    const chord = renderToStaticMarkup(
      createElement(ChordList, { chords: [], error: "boom" }),
    );
    expect(has44(clsOf(chord, ">Try again<"))).toBe(true);
    const circle = renderToStaticMarkup(
      createElement(CircleList, { circles: [], chords: [], error: "boom" }),
    );
    expect(has44(clsOf(circle, ">Try again<"))).toBe(true);
    const scale = renderToStaticMarkup(
      createElement(ScaleList, { scales: [], error: "boom" }),
    );
    expect(has44(clsOf(scale, ">Try again<"))).toBe(true);
  });

  it("generator input, submit, and starters meet the target", () => {
    const html = renderToStaticMarkup(
      createElement(SheetGenerator, {
        gamePath: "/courses/ukulele/games/lyrics-chords",
      }),
    );
    expect(has44(clsOf(html, 'type="submit"'))).toBe(true);
    for (const starter of ["Riptide", "Stand by Me"]) {
      expect(has44(clsOf(html, `>${starter}<`))).toBe(true);
    }
  });

  it("history, dialog, and candidate actions meet the target", () => {
    const history = renderToStaticMarkup(
      createElement(HistoryList, {
        entries: HISTORY,
        entryHref: () => "/x",
        onRegenerate: () => {},
        onDelete: () => {},
        onToggleFavorite: () => {},
      }),
    );
    expect(has44(clsOf(history, 'aria-label="Regenerate Imagine"'))).toBe(true);
    expect(has44(clsOf(history, 'aria-label="Delete Imagine"'))).toBe(true);

    const dialog = renderToStaticMarkup(
      createElement(ConfirmDialog, {
        title: "Delete?",
        description: "Sure?",
        confirmLabel: "Confirm delete",
        onConfirm: () => {},
        onCancel: () => {},
      }),
    );
    expect(has44(clsOf(dialog, ">Confirm delete<"))).toBe(true);
    expect(has44(clsOf(dialog, ">Cancel<"))).toBe(true);

    const candidates = renderToStaticMarkup(
      createElement(CandidateList, {
        candidates: CANDIDATES,
        onPick: () => {},
      }),
    );
    expect(has44(clsOf(candidates, ">Use this song<"))).toBe(true);
    const candidateError = renderToStaticMarkup(
      createElement(CandidateList, {
        candidates: [],
        onPick: () => {},
        error: "nope",
        onRetry: () => {},
      }),
    );
    expect(has44(clsOf(candidateError, ">Try again<"))).toBe(true);
  });

  it("chapter summary control meets the target", async () => {
    const html = await renderAstro(LessonReader, {
      props: { lesson: LESSON, resolved: new Map() },
    });
    const summary = html.match(/<summary[^>]*>/)?.[0] ?? "";
    expect(has44(summary)).toBe(true);
  });
});

describe("RockstarA11y: roles + states (FR-020)", () => {
  it("cards expose a named full-surface link", async () => {
    const html = await renderAstro(CourseCard, {
      props: {
        title: "Ukulele",
        slug: "ukulele",
        description: "Strum.",
        cover: "ukulele",
      },
    });
    expect(html).toContain("<a ");
    expect(html).toContain('aria-label="Open Ukulele course"');
  });

  it("chapter controls expose details/summary/nav landmarks", async () => {
    const html = await renderAstro(LessonReader, {
      props: { lesson: LESSON, resolved: new Map() },
    });
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain('aria-label="In this chapter"');
  });
});

describe("RockstarA11y: view states per routes.md (FR-022)", () => {
  it("ViewStates renders loading/empty/error with the retry path", async () => {
    const loading = await renderAstro(ViewStates, {
      props: { state: "loading" },
    });
    expect(loading).toContain('role="status"');
    expect(loading).toContain("animate-spin");

    const empty = await renderAstro(ViewStates, {
      props: { state: "empty", message: "Nothing yet." },
    });
    expect(empty).toContain('data-state="empty"');
    expect(empty).toContain("Nothing yet.");

    const error = await renderAstro(ViewStates, {
      props: { state: "error", retryHref: "/retry" },
    });
    expect(error).toContain('role="alert"');
    expect(error).toContain('href="/retry"');
    expect(has44(clsOf(error, 'href="/retry"'))).toBe(true);
  });

  it("explorers render empty + error + ready (sync: no loading branch)", () => {
    // Sync props-driven islands: the SSR shell IS the loading view —
    // loading applies to async views (ViewStates/SheetGenerator) only.
    const empty = renderToStaticMarkup(
      createElement(ChordList, { chords: [] }),
    );
    expect(empty).toContain('data-state="empty"');
    expect(empty).toContain("Show all chords");

    const error = renderToStaticMarkup(
      createElement(ChordList, { chords: [], error: "boom" }),
    );
    expect(error).toContain('role="alert"');

    const ready = renderToStaticMarkup(
      createElement(ChordList, { chords: [mkChord("C", "major")] }),
    );
    expect(ready).toContain('data-testid="chord-list"');

    const circleReady = renderToStaticMarkup(
      createElement(CircleList, { circles: [CIRCLE], chords: LIBRARY }),
    );
    expect(circleReady).toContain('data-testid="circle-list"');

    const scaleReady = renderToStaticMarkup(
      createElement(ScaleList, { scales: [mkScale("C major", "major")] }),
    );
    expect(scaleReady).toContain('data-testid="scale-list"');
  });

  it("generator renders a ready search shell with quick start", () => {
    const html = renderToStaticMarkup(
      createElement(SheetGenerator, {
        gamePath: "/courses/ukulele/games/lyrics-chords",
      }),
    );
    expect(html).toContain('aria-label="Lyrics and chords generator"');
    expect(html).toContain('data-testid="quick-start"');
  });
});
