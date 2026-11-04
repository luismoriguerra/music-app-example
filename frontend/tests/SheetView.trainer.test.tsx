// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SheetView } from "@/components/SheetView";
import { makeChordSheet, makeLyricsOnlySheet } from "./trainer-fixtures";

beforeEach(() => {
  // The analysis panel auto-loads history on first tab visit (and
  // auto-generates when empty): history is empty, and the generate POST
  // stays pending so tab tests never hit the network or a model.
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (_url, init) => {
      if (init?.method === "POST") return new Promise<Response>(() => {});
      return new Response(JSON.stringify({ analyses: [], total: 0 }), {
        headers: { "content-type": "application/json" },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const TRAINER_SHEET_ID = "33333333-3333-4333-8333-333333333333";
const TRAINER_ANALYSIS_ID = "423e4567-e89b-42d3-a456-426614174003";

/** G-major analysis: deliberately different from the C/F/G heuristic (C major). */
const G_MAJOR_OUT = {
  key: { tonic: "G", mode: "major", justification: "Centers on G major." },
  scale: ["G", "A", "B", "C", "D", "E", "F#"],
  diatonic_chords: [
    { degree: "I", chord: "G" },
    { degree: "ii", chord: "Am" },
    { degree: "iii", chord: "Bm" },
    { degree: "IV", chord: "C" },
    { degree: "V", chord: "D" },
    { degree: "vi", chord: "Em" },
    { degree: "vii°", chord: "F#dim" },
  ],
  progression: [
    { section: "Verse 1", chords: ["G", "C"], degrees: ["I", "IV"] },
  ],
  special_chords: [],
  cadences: [],
  section_feel: [{ section: "Verse 1", feeling: "Stable." }],
  second_voice: {
    melody_status: "missing",
    strategy: "Use thirds above.",
    up: null,
    down: null,
    recommendation: null,
  },
  note_table: [],
  singing_tips: ["Listen to the chord."],
};

describe("SheetView trainer tab (008 US1)", () => {
  it("orders the tabs Lyrics + Chords, 1st-voice trainer, AI 2nd voice analyzer", () => {
    render(<SheetView sheet={makeChordSheet(["C", "F", "G"])} catalog={[]} />);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Lyrics + Chords",
      "1st-voice trainer",
      "AI 2nd voice analyzer",
    ]);
    expect(screen.getByTestId("sheet-tab-sheet")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("tab", { name: "1st-voice trainer" }),
    ).toHaveAttribute("aria-selected", "false");
  });

  it("lazy-mounts the trainer panel and keeps it mounted while hidden", async () => {
    const user = userEvent.setup();
    render(<SheetView sheet={makeChordSheet(["C", "F", "G"])} catalog={[]} />);
    expect(screen.queryByTestId("trainer-panel")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "1st-voice trainer" }));
    expect(await screen.findByTestId("trainer-panel")).toBeInTheDocument();
    expect(screen.getByTestId("trainer-scale-label")).toHaveTextContent(
      /C major/,
    );
    await user.click(screen.getByRole("tab", { name: "Lyrics + Chords" }));
    const panel = screen.getByTestId("trainer-panel");
    expect(panel.closest('[role="tabpanel"]')).toHaveAttribute("hidden");
  });

  it("cycles all three tabs with arrow-key roving including wrap", () => {
    render(<SheetView sheet={makeChordSheet(["C", "F", "G"])} catalog={[]} />);
    const sheet = screen.getByRole("tab", { name: "Lyrics + Chords" });
    const trainer = screen.getByRole("tab", { name: "1st-voice trainer" });
    const analysis = screen.getByRole("tab", { name: "AI 2nd voice analyzer" });
    fireEvent.keyDown(sheet, { key: "ArrowRight" });
    expect(trainer).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(trainer);
    fireEvent.keyDown(trainer, { key: "ArrowRight" });
    expect(analysis).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(analysis);
    // Wrap forward to the first tab and back.
    fireEvent.keyDown(analysis, { key: "ArrowRight" });
    expect(sheet).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(sheet);
    fireEvent.keyDown(sheet, { key: "ArrowLeft" });
    expect(analysis).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(analysis);
  });

  it("shows Lyrics + Chords + Trainer (no analysis) for lyrics-only songs", async () => {
    const user = userEvent.setup();
    render(<SheetView sheet={makeLyricsOnlySheet()} catalog={[]} />);
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.queryByTestId("sheet-tab-analysis")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "1st-voice trainer" }));
    expect(await screen.findByTestId("trainer-panel")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /choose a scale/i }),
    ).toBeInTheDocument();
  });

  it("uses the open AI analysis key and falls back when transpose moves (008 FR-004)", async () => {
    const user = userEvent.setup();
    const summary = {
      id: TRAINER_ANALYSIS_ID,
      sheet_id: TRAINER_SHEET_ID,
      transpose: 0,
      model_id: "openrouter/test-model",
      created_at: "2026-09-17T00:00:00Z",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (url, init) => {
        const path = new URL(String(url), "http://test").pathname;
        const method = init?.method ?? "GET";
        if (
          path === `/api/v1/sheets/${TRAINER_SHEET_ID}/second-voice` &&
          method === "GET"
        ) {
          return new Response(
            JSON.stringify({ analyses: [summary], total: 1 }),
            { headers: { "content-type": "application/json" } },
          );
        }
        if (
          path === `/api/v1/second-voice/${TRAINER_ANALYSIS_ID}` &&
          method === "GET"
        ) {
          return new Response(
            JSON.stringify({
              analysis: { ...summary, analysis: G_MAJOR_OUT },
            }),
            { headers: { "content-type": "application/json" } },
          );
        }
        throw new Error(`unmocked ${method} ${path}`);
      }),
    );
    render(<SheetView sheet={makeChordSheet(["C", "F", "G"])} catalog={[]} />);
    await user.click(
      screen.getByRole("tab", { name: "AI 2nd voice analyzer" }),
    );
    await screen.findByTestId("second-voice-analysis");
    await user.click(screen.getByRole("tab", { name: "1st-voice trainer" }));
    await screen.findByTestId("trainer-panel");
    // The heuristic alone would say C major from song chords; the open
    // G-major analysis at the same transpose wins.
    const label = screen.getByTestId("trainer-scale-label");
    expect(label).toHaveTextContent(/G major/);
    expect(label).toHaveTextContent(/from AI analysis/);
    // Moving the stepper stales the analysis → heuristic fallback.
    await user.click(
      screen.getByRole("button", { name: "Transpose up half a tone" }),
    );
    const fallback = screen.getByTestId("trainer-scale-label");
    expect(fallback).toHaveTextContent(/from song chords/);
    expect(fallback).not.toHaveTextContent(/G major/);
  });
});
