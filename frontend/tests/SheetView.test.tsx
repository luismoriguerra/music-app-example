// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SheetView } from "@/components/SheetView";
import { TransposeControl } from "@/components/TransposeControl";
import { getChordHarmony } from "@/lib/chord-harmony";
import * as sound from "@/lib/sound";
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

// Minimal catalog slice: Am resolves via catalog; Dadd9 skips the catalog
// (extension → null per M2) and resolves via generated diagrams instead.
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
  {
    root: "G",
    type: "major",
    diagram: {
      strings: "GCEA",
      frets: [0, 2, 3, 2],
      fingers: [0, 1, 3, 2],
      baseFret: 1,
      barres: [],
    },
  },
  { root: "C", type: "major" },
] as unknown as readonly CatalogChord[];

describe("SheetView (T026)", () => {
  it("renders the matched identity plus sections in order", () => {
    render(<SheetView sheet={CHART_SHEET} catalog={CATALOG} />);
    expect(
      screen.getByRole("heading", { name: /riptide/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/vance joy/i)).toBeInTheDocument();
    expect(screen.getByText("Chorus")).toBeInTheDocument();
    expect(
      screen.getByText("Lady, runnin' down to the riptide"),
    ).toBeInTheDocument();
  });

  it("renders chord symbols above their offsets", () => {
    render(<SheetView sheet={CHART_SHEET} catalog={CATALOG} />);
    const am = screen.getByText("Am", { selector: "[data-offset]" });
    expect(am).toHaveAttribute("data-offset", "0");
    expect(
      screen.getByText("Dadd9", { selector: "[data-offset]" }),
    ).toHaveAttribute("data-offset", "11");
  });

  it("shows the per-part lyrics:/chords: attribution block with link-backs (FR-012)", () => {
    render(<SheetView sheet={CHART_SHEET} catalog={CATALOG} />);
    const block = screen.getByTestId("sheet-attribution");
    expect(block).toHaveTextContent(/lyrics:/i);
    expect(block).toHaveTextContent(/chords:/i);
    const links = screen.getAllByRole("link", {
      name: /ultimate guitar|source/i,
    });
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links.slice(0, 2)) {
      expect(link).toHaveAttribute(
        "href",
        "https://tabs.ultimate-guitar.com/tab/vance-joy/riptide-1",
      );
    }
  });

  it("labels model fallback chords without a chords link-back", () => {
    const sheet: Sheet = sheetSchema.parse({
      ...BASE_SHEET,
      lyric_source: "lrclib",
      lyric_source_url: "https://lrclib.net/api/get/969429",
      chord_source: "model-generated",
      chord_source_url: null,
      model_id: "openrouter/test-model",
    });
    render(<SheetView sheet={sheet} catalog={CATALOG} />);
    const block = screen.getByTestId("sheet-attribution");
    expect(block).toHaveTextContent(/chords:\s*model-generated/i);
    expect(block).toHaveTextContent(/openrouter\/test-model/);
  });

  it("keys the chords-missing notice off chord_source none (lyrics-only)", () => {
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
    expect(screen.getByRole("status")).toHaveTextContent(/no chords/i);
  });

  it("inline chords reveal their diagram in place instead of linking away; unresolvable ones are tagged (M2)", async () => {
    const sheet: Sheet = sheetSchema.parse({
      ...BASE_SHEET,
      body: {
        sections: [
          {
            heading: "Chorus",
            lines: [
              {
                text: "Lady, runnin' down to the riptide",
                chords: [
                  { offset: 0, symbol: "Am" },
                  { offset: 11, symbol: "B7" },
                ],
              },
              {
                text: "Taken away to the dark side",
                chords: [
                  { offset: 0, symbol: "Dadd9" },
                  { offset: 11, symbol: "CB" },
                ],
              },
            ],
          },
        ],
      },
    });
    render(<SheetView sheet={sheet} catalog={CATALOG} />);
    // No inline symbol navigates anywhere.
    expect(screen.queryByRole("link", { name: /^am$/i })).toBeNull();
    for (const symbol of ["Am", "B7", "Dadd9"]) {
      const trigger = screen.getByRole("button", {
        name: new RegExp(`^${symbol} chord diagram$`, "i"),
      });
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger.closest("[data-chord]")?.textContent).not.toMatch(
        /no diagram/i,
      );
    }
    // Tap pins the catalog diagram open; the popover carries the real SVG.
    const user = userEvent.setup();
    const am = screen.getByRole("button", { name: /^am chord diagram$/i });
    await user.click(am);
    expect(am).toHaveAttribute("aria-expanded", "true");
    const popover = screen.getByTestId("chord-popover");
    expect(within(popover).getByTestId("chord-diagram")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("chord-popover")).toBeNull();
    // CB passes notation validation but carries no chord quality, so neither
    // the catalog nor the generator can voice it (source "none").
    const degenerate = screen
      .getByText("CB", { selector: "[data-offset]" })
      .closest("[data-chord]");
    expect(degenerate?.textContent).toMatch(/no diagram/i);
    expect(
      screen.queryByRole("button", { name: /^cb chord diagram$/i }),
    ).toBeNull();
  });

  it("reference rail falls back to abstract tones for unvoiceable symbols (source none)", async () => {
    window.localStorage.clear();
    const playChordSpy = vi
      .spyOn(sound, "playChord")
      .mockImplementation(() => {});
    const playMidiSpy = vi
      .spyOn(sound, "playMidiChord")
      .mockImplementation(() => {});
    try {
      const sheet: Sheet = sheetSchema.parse({
        ...BASE_SHEET,
        body: {
          sections: [
            {
              heading: "Chorus",
              lines: [
                {
                  text: "Lady, runnin' down to the riptide",
                  chords: [
                    { offset: 0, symbol: "Am" },
                    { offset: 11, symbol: "CB" },
                  ],
                },
              ],
            },
          ],
        },
      });
      render(<SheetView sheet={sheet} catalog={CATALOG} />);
      const rail = screen.getByTestId("chord-reference");
      const cbButton = within(rail).getByRole("button", {
        name: /play cb chord/i,
      });
      expect(
        cbButton.closest("[data-chord-ref]")?.getAttribute("data-source"),
      ).toBe("none");
      await userEvent.setup().click(cbButton);
      // Null diagram must never reach diagramToMidis (c1fc71f TypeError);
      // the rail falls back to abstract chord tones instead.
      expect(playChordSpy).toHaveBeenCalledWith(
        getChordHarmony("CB").tones,
        expect.objectContaining({ mode: "strum" }),
      );
      expect(playMidiSpy).not.toHaveBeenCalled();
    } finally {
      playChordSpy.mockRestore();
      playMidiSpy.mockRestore();
    }
  });

  it("stacks every unique song chord with its diagram in the reference column", () => {
    render(<SheetView sheet={CHART_SHEET} catalog={CATALOG} />);
    const aside = screen.getByTestId("chord-reference");
    expect(aside).toHaveTextContent(/chords in this song \(2\)/i);
    expect(within(aside).getAllByTestId("chord-diagram")).toHaveLength(2);
    const refs = aside.querySelectorAll("[data-chord-ref]");
    expect([...refs].map((el) => el.getAttribute("data-chord-ref"))).toEqual([
      "Am",
      "Dadd9",
    ]);
    expect(refs[0].getAttribute("data-source")).toBe("catalog");
    expect(refs[1].getAttribute("data-source")).toBe("generated");
  });

  it("dedupes repeated chords in the reference column", () => {
    const sheet: Sheet = sheetSchema.parse({
      ...BASE_SHEET,
      body: {
        sections: [
          {
            heading: null,
            lines: [
              {
                text: "line one here",
                chords: [
                  { offset: 0, symbol: "G" },
                  { offset: 5, symbol: "B7" },
                ],
              },
              {
                text: "line two here",
                chords: [
                  { offset: 0, symbol: "B7" },
                  { offset: 5, symbol: "G" },
                ],
              },
            ],
          },
        ],
      },
    });
    render(<SheetView sheet={sheet} catalog={CATALOG} />);
    const aside = screen.getByTestId("chord-reference");
    expect(aside).toHaveTextContent(/chords in this song \(2\)/i);
    const refs = aside.querySelectorAll("[data-chord-ref]");
    expect([...refs].map((el) => el.getAttribute("data-chord-ref"))).toEqual([
      "G",
      "B7",
    ]);
  });

  it("hides the reference column when the sheet has no chords", () => {
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
    expect(screen.queryByTestId("chord-reference")).not.toBeInTheDocument();
  });

  it("shows a placeholder in the reference column for unresolvable symbols", () => {
    const sheet: Sheet = sheetSchema.parse({
      ...BASE_SHEET,
      body: {
        sections: [
          {
            heading: null,
            lines: [
              {
                text: "line one here",
                chords: [{ offset: 0, symbol: "CB" }],
              },
            ],
          },
        ],
      },
    });
    render(<SheetView sheet={sheet} catalog={CATALOG} />);
    const aside = screen.getByTestId("chord-reference");
    expect(
      within(aside).getByTestId("chord-diagram-placeholder"),
    ).toBeInTheDocument();
    expect(
      aside.querySelector("[data-chord-ref='CB']")?.getAttribute("data-source"),
    ).toBe("none");
  });

  it("displays capo and tuning notes when present", () => {
    render(<SheetView sheet={CHART_SHEET} catalog={CATALOG} />);
    expect(screen.getByText(/capo\s*2/i)).toBeInTheDocument();
  });
});

describe("SheetView transpose stepper", () => {
  it("renders the stepper at the original key with reset disabled", () => {
    render(<SheetView sheet={CHART_SHEET} catalog={CATALOG} />);
    expect(screen.getByTestId("transpose-control")).toBeInTheDocument();
    expect(screen.getByTestId("transpose-value")).toHaveTextContent("Tr. 0");
    expect(
      screen.getByRole("button", { name: /reset transpose/i }),
    ).toBeDisabled();
  });
  it("transposes up a half tone with key-aware flats (Bbm, not A#m)", async () => {
    const user = userEvent.setup();
    render(<SheetView sheet={CHART_SHEET} catalog={CATALOG} />);
    await user.click(
      screen.getByRole("button", { name: "Transpose up half a tone" }),
    );
    expect(screen.getByTestId("transpose-value")).toHaveTextContent("Tr. +1");
    expect(
      screen.getByText("Bbm", { selector: "[data-offset]" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ebadd9", { selector: "[data-offset]" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Am", { selector: "[data-offset]" }),
    ).not.toBeInTheDocument();
    const aside = screen.getByTestId("chord-reference");
    const refs = aside.querySelectorAll("[data-chord-ref]");
    expect([...refs].map((el) => el.getAttribute("data-chord-ref"))).toEqual([
      "Bbm",
      "Ebadd9",
    ]);
    expect(screen.getByText(/transposed \+1 semitone/i)).toBeInTheDocument();
  });

  it("a transposed inline symbol discloses the transposed diagram; ids stay unique with the rail", async () => {
    const user = userEvent.setup();
    render(<SheetView sheet={CHART_SHEET} catalog={CATALOG} />);
    await user.click(
      screen.getByRole("button", { name: "Transpose up half a tone" }),
    );
    await user.click(
      screen.getByRole("button", { name: /^bbm chord diagram$/i }),
    );
    const popover = screen.getByTestId("chord-popover");
    expect(popover).toHaveAccessibleName(/bbm fingering/i);
    expect(within(popover).getByTestId("chord-diagram")).toHaveAccessibleName(
      /bbm/i,
    );
    // The rail shows the same chord at the same time: every id on the page
    // must still be unique (SVG title id is per instance, not per name).
    const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("transposes down a half tone with flat spellings", async () => {
    const user = userEvent.setup();
    render(<SheetView sheet={CHART_SHEET} catalog={CATALOG} />);
    await user.click(
      screen.getByRole("button", { name: "Transpose down half a tone" }),
    );
    expect(screen.getByTestId("transpose-value")).toHaveTextContent("Tr. -1");
    expect(
      screen.getByText("Abm", { selector: "[data-offset]" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Dbadd9", { selector: "[data-offset]" }),
    ).toBeInTheDocument();
  });

  it("resets to the original key via the center label", async () => {
    const user = userEvent.setup();
    render(<SheetView sheet={CHART_SHEET} catalog={CATALOG} />);
    await user.click(
      screen.getByRole("button", { name: "Transpose up half a tone" }),
    );
    await user.click(screen.getByRole("button", { name: /reset transpose/i }));
    expect(screen.getByTestId("transpose-value")).toHaveTextContent("Tr. 0");
    expect(
      screen.getByText("Am", { selector: "[data-offset]" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Dadd9", { selector: "[data-offset]" }),
    ).toBeInTheDocument();
  });

  it("jumps +3 semitones via the helper and updates chords everywhere", async () => {
    const user = userEvent.setup();
    render(<SheetView sheet={CHART_SHEET} catalog={CATALOG} />);
    await user.click(screen.getByTestId("transpose-plus-3"));
    expect(screen.getByTestId("transpose-value")).toHaveTextContent("Tr. +3");
    expect(
      screen.getByText("Cm", { selector: "[data-offset]" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Fadd9", { selector: "[data-offset]" }),
    ).toBeInTheDocument();
    const aside = screen.getByTestId("chord-reference");
    const refs = aside.querySelectorAll("[data-chord-ref]");
    expect([...refs].map((el) => el.getAttribute("data-chord-ref"))).toEqual([
      "Cm",
      "Fadd9",
    ]);
    expect(screen.getByText(/transposed \+3 semitones/i)).toBeInTheDocument();
  });

  it("jumps -3 semitones via the helper with flat spellings", async () => {
    const user = userEvent.setup();
    render(<SheetView sheet={CHART_SHEET} catalog={CATALOG} />);
    await user.click(screen.getByTestId("transpose-minus-3"));
    expect(screen.getByTestId("transpose-value")).toHaveTextContent("Tr. -3");
    expect(
      screen.getByText("Gbm", { selector: "[data-offset]" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Badd9", { selector: "[data-offset]" }),
    ).toBeInTheDocument();
  });

  it("resets to the original key via the Reset helper", async () => {
    const user = userEvent.setup();
    render(<SheetView sheet={CHART_SHEET} catalog={CATALOG} />);
    expect(screen.getByTestId("transpose-reset")).toBeDisabled();
    await user.click(screen.getByTestId("transpose-plus-3"));
    expect(screen.getByTestId("transpose-value")).toHaveTextContent("Tr. +3");
    await user.click(screen.getByTestId("transpose-reset"));
    expect(screen.getByTestId("transpose-value")).toHaveTextContent("Tr. 0");
    expect(
      screen.getByText("Am", { selector: "[data-offset]" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Dadd9", { selector: "[data-offset]" }),
    ).toBeInTheDocument();
  });

  it("resets the transpose when a different sheet loads", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <SheetView sheet={CHART_SHEET} catalog={CATALOG} />,
    );
    await user.click(
      screen.getByRole("button", { name: "Transpose up half a tone" }),
    );
    expect(screen.getByTestId("transpose-value")).toHaveTextContent("Tr. +1");
    const other: Sheet = sheetSchema.parse({
      ...BASE_SHEET,
      id: "33333333-3333-4333-8333-333333333333",
    });
    rerender(<SheetView sheet={other} catalog={CATALOG} />);
    expect(screen.getByTestId("transpose-value")).toHaveTextContent("Tr. 0");
    expect(
      screen.getByText("Am", { selector: "[data-offset]" }),
    ).toBeInTheDocument();
  });

  it("hides the stepper when the sheet has no chords", () => {
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
    expect(screen.queryByTestId("transpose-control")).not.toBeInTheDocument();
  });
});

describe("TransposeControl", () => {
  it("disables the steppers at the ±11 bounds", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TransposeControl value={11} onChange={onChange} />,
    );
    expect(screen.getByTestId("transpose-value")).toHaveTextContent("Tr. +11");
    expect(
      screen.getByRole("button", { name: "Transpose up half a tone" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Transpose down half a tone" }),
    ).toBeEnabled();
    rerender(<TransposeControl value={-11} onChange={onChange} />);
    expect(screen.getByTestId("transpose-value")).toHaveTextContent("Tr. -11");
    expect(
      screen.getByRole("button", { name: "Transpose down half a tone" }),
    ).toBeDisabled();
  });

  it("jumps +-3 semitones via the helpers and clamps to +-11", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <TransposeControl value={0} onChange={onChange} />,
    );
    await user.click(screen.getByTestId("transpose-plus-3"));
    expect(onChange).toHaveBeenLastCalledWith(3);
    await user.click(screen.getByTestId("transpose-minus-3"));
    expect(onChange).toHaveBeenLastCalledWith(-3);
    rerender(<TransposeControl value={10} onChange={onChange} />);
    await user.click(screen.getByTestId("transpose-plus-3"));
    expect(onChange).toHaveBeenLastCalledWith(11);
    rerender(<TransposeControl value={-10} onChange={onChange} />);
    await user.click(screen.getByTestId("transpose-minus-3"));
    expect(onChange).toHaveBeenLastCalledWith(-11);
  });

  it("resets via the helper and disables it at the original key", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <TransposeControl value={0} onChange={onChange} />,
    );
    expect(screen.getByTestId("transpose-reset")).toBeDisabled();
    rerender(<TransposeControl value={4} onChange={onChange} />);
    expect(screen.getByTestId("transpose-reset")).toBeEnabled();
    await user.click(screen.getByTestId("transpose-reset"));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("disables the +-3 helpers at the bounds", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TransposeControl value={11} onChange={onChange} />,
    );
    expect(screen.getByTestId("transpose-plus-3")).toBeDisabled();
    expect(screen.getByTestId("transpose-minus-3")).toBeEnabled();
    rerender(<TransposeControl value={-11} onChange={onChange} />);
    expect(screen.getByTestId("transpose-minus-3")).toBeDisabled();
    expect(screen.getByTestId("transpose-plus-3")).toBeEnabled();
  });
});

describe("SheetView song context (US3, FR-006)", () => {
  it("renders song context block when context is present", () => {
    const sheetWithContext = sheetSchema.parse({
      ...BASE_SHEET,
      context: {
        text: "Riptide is an indie folk song by Vance Joy.",
        source: "wikipedia",
        source_url: "https://en.wikipedia.org/wiki/Riptide_(Vance_Joy_song)",
      },
    });
    render(<SheetView sheet={sheetWithContext} catalog={CATALOG} />);
    const section = screen.getByTestId("song-context-block");
    expect(section).toBeInTheDocument();
    expect(within(section).getByText(/indie folk song/i)).toBeInTheDocument();
    expect(
      within(section).getByRole("link", { name: /wikipedia/i }),
    ).toHaveAttribute(
      "href",
      "https://en.wikipedia.org/wiki/Riptide_(Vance_Joy_song)",
    );
  });

  it("omits song context block when context is null", () => {
    render(<SheetView sheet={CHART_SHEET} catalog={CATALOG} />);
    expect(screen.queryByTestId("song-context-block")).not.toBeInTheDocument();
  });
});
