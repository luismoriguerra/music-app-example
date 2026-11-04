// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SheetView } from "@/components/SheetView";
import { makeChordSheet } from "./trainer-fixtures";

/** Enables the audio-availability gate so the loop selects are not disabled. */
function setAudioAvailable(available: boolean): void {
  const target = window as unknown as Record<string, unknown>;
  if (available) target.AudioContext = vi.fn();
  else delete target.AudioContext;
}

function loopSelect(panel: HTMLElement): HTMLElement {
  const [select] = within(panel).getAllByRole("combobox", {
    name: /^Loop rounds for/,
  });
  if (!select) throw new Error("no loop select in the panel");
  return select;
}

beforeEach(() => {
  // Same stub as the trainer-tab suite: history is empty and the generate POST stays pending.
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (_url, init) => {
      if (init?.method === "POST") return new Promise<Response>(() => {});
      return new Response(JSON.stringify({ analyses: [], total: 0 }), {
        headers: { "content-type": "application/json" },
      });
    }),
  );
  window.localStorage.clear();
  setAudioAvailable(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  setAudioAvailable(false);
  window.localStorage.clear();
});

describe("SheetView 2nd-voice trainer mount (013 US2)", () => {
  it("mounts the 2nd-voice trainer in the analyzer tab, above the analysis panel", async () => {
    const user = userEvent.setup();
    render(<SheetView sheet={makeChordSheet(["C", "F", "G"])} catalog={[]} />);
    expect(
      screen.queryByTestId("second-voice-trainer"),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("tab", { name: "AI 2nd voice analyzer" }),
    );
    const trainer = await screen.findByTestId("second-voice-trainer");
    expect(trainer).toHaveTextContent(/C major/);
    const panel = screen.getByRole("region", { name: "AI second voice" });
    expect(
      trainer.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shares tempo and loop count between the two trainers once both are mounted (US4)", async () => {
    const user = userEvent.setup();
    render(<SheetView sheet={makeChordSheet(["C", "F", "G"])} catalog={[]} />);
    const trainerTab = screen.getByRole("tab", { name: "1st-voice trainer" });
    const analysisTab = screen.getByRole("tab", {
      name: "AI 2nd voice analyzer",
    });
    await user.click(trainerTab);
    const first = await screen.findByTestId("trainer-panel");
    await user.click(analysisTab);
    const second = await screen.findByTestId("second-voice-trainer");

    // 1st-voice trainer -> 2nd-voice trainer.
    await user.click(trainerTab);
    fireEvent.change(within(first).getByRole("slider", { name: "Tempo" }), {
      target: { value: "120" },
    });
    await user.selectOptions(loopSelect(first), "5");
    await user.click(analysisTab);
    expect(
      within(second).getByRole("slider", { name: "Tempo" }),
    ).toHaveAttribute("aria-valuetext", "120 beats per minute");
    expect(loopSelect(second)).toHaveValue("5");

    // 2nd-voice trainer -> 1st-voice trainer.
    fireEvent.change(within(second).getByRole("slider", { name: "Tempo" }), {
      target: { value: "90" },
    });
    await user.selectOptions(loopSelect(second), "6");
    await user.click(trainerTab);
    expect(
      within(first).getByRole("slider", { name: "Tempo" }),
    ).toHaveAttribute("aria-valuetext", "90 beats per minute");
    expect(loopSelect(first)).toHaveValue("6");
  });
});
