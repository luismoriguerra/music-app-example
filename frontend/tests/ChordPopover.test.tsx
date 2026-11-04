// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import * as sound from "@/lib/sound";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChordPopover } from "@/components/ChordPopover";
import type { ChordDiagram } from "@/lib/content/schemas";

const AM: ChordDiagram = {
  strings: "GCEA",
  frets: [2, 0, 0, 0],
  fingers: [2, 0, 0, 0],
  baseFret: 1,
  barres: [],
};

function trigger() {
  return screen.getByRole("button", { name: /^am chord diagram$/i });
}

describe("ChordPopover", () => {
  it("mouse hover shows the diagram transiently; leaving hides it", () => {
    render(<ChordPopover symbol="Am" diagram={AM} offset={0} />);
    const root = trigger().parentElement as HTMLElement;
    fireEvent.pointerEnter(root, { pointerType: "mouse" });
    expect(screen.getByTestId("chord-popover")).toBeInTheDocument();
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    fireEvent.pointerLeave(root, { pointerType: "mouse" });
    expect(screen.queryByTestId("chord-popover")).toBeNull();
  });

  it("Escape dismisses hover-shown content without moving the pointer (WCAG 1.4.13)", () => {
    render(<ChordPopover symbol="Am" diagram={AM} offset={0} />);
    const root = trigger().parentElement as HTMLElement;
    fireEvent.pointerEnter(root, { pointerType: "mouse" });
    expect(screen.getByTestId("chord-popover")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("chord-popover")).toBeNull();
    // Re-arms on the next hover.
    fireEvent.pointerLeave(root, { pointerType: "mouse" });
    fireEvent.pointerEnter(root, { pointerType: "mouse" });
    expect(screen.getByTestId("chord-popover")).toBeInTheDocument();
  });

  it("touch hover is ignored so a tap does not open-then-close", async () => {
    render(<ChordPopover symbol="Am" diagram={AM} offset={0} />);
    const root = trigger().parentElement as HTMLElement;
    fireEvent.pointerEnter(root, { pointerType: "touch" });
    expect(screen.queryByTestId("chord-popover")).toBeNull();
    const user = userEvent.setup();
    await user.click(trigger());
    expect(screen.getByTestId("chord-popover")).toBeInTheDocument();
    // A later pointer-leave (finger moved on) must not dismiss a pinned one.
    fireEvent.pointerLeave(root, { pointerType: "touch" });
    expect(screen.getByTestId("chord-popover")).toBeInTheDocument();
  });

  it("click pins across mouse-leave; second click, Escape, and outside tap close", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ChordPopover symbol="Am" diagram={AM} offset={0} />
        <p>elsewhere</p>
      </>,
    );
    const root = trigger().parentElement as HTMLElement;
    fireEvent.pointerEnter(root, { pointerType: "mouse" });
    await user.click(trigger());
    fireEvent.pointerLeave(root, { pointerType: "mouse" });
    expect(screen.getByTestId("chord-popover")).toBeInTheDocument();
    await user.click(trigger());
    expect(screen.queryByTestId("chord-popover")).toBeNull();

    await user.click(trigger());
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("chord-popover")).toBeNull();

    await user.click(trigger());
    fireEvent.pointerDown(screen.getByText("elsewhere"));
    expect(screen.queryByTestId("chord-popover")).toBeNull();
  });

  it("keyboard: Enter toggles and the panel is wired via aria-controls", async () => {
    const user = userEvent.setup();
    render(<ChordPopover symbol="Am" diagram={AM} offset={0} />);
    trigger().focus();
    await user.keyboard("{Enter}");
    const panel = screen.getByTestId("chord-popover");
    expect(trigger().getAttribute("aria-controls")).toBe(panel.id);
    expect(panel).toHaveAccessibleName(/am fingering/i);
  });

  it("click sounds the exact fretted voicing while toggling the pin", async () => {
    const playMidiSpy = vi
      .spyOn(sound, "playMidiChord")
      .mockImplementation(() => {});
    const user = userEvent.setup();
    render(<ChordPopover symbol="Am" diagram={AM} offset={0} />);
    await user.click(trigger());
    // Am [2,0,0,0] on re-entrant GCEA: A4 C4 E4 A4
    expect(playMidiSpy).toHaveBeenCalledWith(
      [69, 60, 64, 69],
      expect.objectContaining({ mode: "strum" }),
    );
    expect(screen.getByTestId("chord-popover")).toBeInTheDocument();
  });

  it("honors the shared block playback mode", async () => {
    const playMidiSpy = vi
      .spyOn(sound, "playMidiChord")
      .mockImplementation(() => {});
    const user = userEvent.setup();
    render(
      <ChordPopover symbol="Am" diagram={AM} offset={0} playbackMode="block" />,
    );
    await user.click(trigger());
    expect(playMidiSpy).toHaveBeenCalledWith(
      [69, 60, 64, 69],
      expect.objectContaining({ mode: "block" }),
    );
  });
});
