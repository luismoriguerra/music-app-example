// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SheetView } from "@/components/SheetView";
import { sheetSchema, type Sheet } from "@/lib/sheets/schemas";
import type { CatalogChord } from "@/lib/sheets";

const BASE_SHEET = {
  id: "11111111-1111-4111-8111-111111111111",
  query: "Riptide",
  matched_title: "Riptide",
  matched_performer: "Vance Joy",
  lyric_source: "chart",
  lyric_source_url: "https://tabs.ultimate-guitar.com/tab/vance-joy/riptide-1",
  chord_source: "chart",
  chord_source_url: "https://tabs.ultimate-guitar.com/tab/vance-joy/riptide-1",
  model_id: null,
  body: {
    sections: [
      {
        heading: "Chorus",
        lines: [
          {
            text: "Lady, runnin' down to the riptide",
            chords: [
              { offset: 0, symbol: "Am" },
              { offset: 11, symbol: "Dadd9" },
            ],
          },
          { text: "Taken away to the dark side", chords: [] },
        ],
      },
    ],
  },
  source_links: [
    { label: "LRCLIB", url: "https://lrclib.net/api/get/1", kind: "lyrics" },
  ],
  degraded: [],
  capo: "2",
  tuning_note: null,
  created_at: "2026-09-16T00:00:00Z",
} as const;

const CHART_SHEET: Sheet = sheetSchema.parse(BASE_SHEET);

const CATALOG = [
  {
    root: "A",
    type: "minor",
    diagram: {
      strings: "GCEA",
      frets: [2, 0, 0, 0],
      fingers: [2, 0, 0, 0],
      baseFret: 1,
      barres: [],
    },
  },
] as unknown as readonly CatalogChord[];

beforeEach(() => {
  // The analysis panel auto-loads history on first tab visit (and
  // auto-generates when empty): history is empty, and the generate POST
  // stays pending so tab tests never hit the network or a model.
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (_url, init) => {
      if (init?.method === "POST") return new Promise<Response>(() => {});
      return new Response(JSON.stringify({ analyses: [], total: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SheetView tabs (Lyrics + Chords / 1st-voice trainer / AI 2nd voice analyzer)", () => {
  it("renders all three tabs with Lyrics + Chords selected by default", () => {
    render(<SheetView sheet={CHART_SHEET} catalog={CATALOG} />);
    const tablist = screen.getByRole("tablist", { name: /sheet views/i });
    expect(tablist).toBeInTheDocument();
    const sheetTab = screen.getByRole("tab", { name: "Lyrics + Chords" });
    const analysisTab = screen.getByRole("tab", {
      name: "AI 2nd voice analyzer",
    });
    expect(sheetTab).toHaveAttribute("aria-selected", "true");
    expect(analysisTab).toHaveAttribute("aria-selected", "false");
    // Sheet content visible; analysis panel not mounted until visited.
    expect(
      screen.getByText("Am", { selector: "[data-offset]" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /generate ai 2nd voice/i }),
    ).toBeNull();
  });

  it("opening the analyzer tab auto-generates with a generating status", async () => {
    const user = userEvent.setup();
    render(<SheetView sheet={CHART_SHEET} catalog={CATALOG} />);
    await user.click(
      screen.getByRole("tab", { name: "AI 2nd voice analyzer" }),
    );
    expect(
      screen.getByRole("tab", { name: "AI 2nd voice analyzer" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tab", { name: "Lyrics + Chords" }),
    ).toHaveAttribute("aria-selected", "false");
    expect(
      await screen.findByRole("status", { name: /analyzing at tr\. 0/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate ai 2nd voice/i }),
    ).toBeDisabled();
  });

  it("keeps the shared transpose across tab switches", async () => {
    const user = userEvent.setup();
    render(<SheetView sheet={CHART_SHEET} catalog={CATALOG} />);
    await user.click(screen.getByTestId("transpose-plus-3"));
    expect(screen.getByTestId("transpose-value")).toHaveTextContent("Tr. +3");
    await user.click(
      screen.getByRole("tab", { name: "AI 2nd voice analyzer" }),
    );
    // The auto-generate status names the shared transpose.
    await screen.findByRole("status", { name: /analyzing at tr\. \+3/i });
    await user.click(screen.getByRole("tab", { name: "Lyrics + Chords" }));
    expect(screen.getByTestId("transpose-value")).toHaveTextContent("Tr. +3");
    expect(
      screen.getByText("Cm", { selector: "[data-offset]" }),
    ).toBeInTheDocument();
  });

  it("supports ArrowLeft/ArrowRight keyboard switching", () => {
    render(<SheetView sheet={CHART_SHEET} catalog={CATALOG} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Lyrics + Chords" }), {
      key: "ArrowRight",
    });
    expect(
      screen.getByRole("tab", { name: "1st-voice trainer" }),
    ).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "1st-voice trainer" }), {
      key: "ArrowLeft",
    });
    expect(
      screen.getByRole("tab", { name: "Lyrics + Chords" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("resets to the Lyrics + Chords tab when a different sheet loads", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <SheetView sheet={CHART_SHEET} catalog={CATALOG} />,
    );
    await user.click(
      screen.getByRole("tab", { name: "AI 2nd voice analyzer" }),
    );
    expect(
      screen.getByRole("tab", { name: "AI 2nd voice analyzer" }),
    ).toHaveAttribute("aria-selected", "true");
    // Settle the panel's initial load before switching sheets.
    await screen.findByRole("status", { name: /analyzing at/i });
    const other: Sheet = sheetSchema.parse({
      ...BASE_SHEET,
      id: "33333333-3333-4333-8333-333333333333",
    });
    rerender(<SheetView sheet={other} catalog={CATALOG} />);
    expect(
      screen.getByRole("tab", { name: "Lyrics + Chords" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("shows Lyrics + Chords + Trainer tabs (no analysis) when the sheet has no chords", () => {
    const sheet: Sheet = sheetSchema.parse({
      ...BASE_SHEET,
      chord_source: "none",
      chord_source_url: null,
      body: {
        sections: [
          {
            heading: null,
            lines: [{ text: "Lady, runnin' down to the riptide", chords: [] }],
          },
        ],
      },
      degraded: [{ part: "chords", reason: "unavailable" }],
    });
    render(<SheetView sheet={sheet} catalog={CATALOG} />);
    // 008: lyrics-only sheets keep Sheet + Trainer tabs; only the
    // chord-gated analysis tab stays hidden.
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(
      screen.getByRole("tab", { name: "Lyrics + Chords" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "1st-voice trainer" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("sheet-tab-analysis")).toBeNull();
    expect(
      screen.getByText(/lady, runnin' down to the riptide/i),
    ).toBeInTheDocument();
  });
});
