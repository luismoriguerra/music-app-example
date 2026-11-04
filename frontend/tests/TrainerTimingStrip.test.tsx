// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrainerTimingStrip } from "@/components/TrainerTimingStrip";

describe("TrainerTimingStrip (008 US3)", () => {
  it("renders standalone with slider, readout, presets, and octave", () => {
    render(
      <TrainerTimingStrip
        bpm={84}
        onBpmChange={vi.fn()}
        octave={4}
        onOctaveChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("trainer-timing-strip")).toBeInTheDocument();
    const slider = screen.getByRole("slider", { name: /tempo/i });
    expect(slider).toHaveAttribute("min", "60");
    expect(slider).toHaveAttribute("max", "240");
    expect(slider).toHaveValue("84");
    expect(slider).toHaveAttribute("aria-valuetext", "84 beats per minute");
    expect(screen.getByTestId("trainer-tempo-readout")).toHaveTextContent(
      "♩= 84",
    );
    for (const preset of [
      "Slow",
      "Steady",
      "Brisk",
      "Fast",
      "Melisma",
      "Blaze",
    ]) {
      expect(screen.getByRole("button", { name: preset })).toBeInTheDocument();
    }
    for (const octave of ["3", "4", "5"]) {
      expect(
        screen.getByRole("button", { name: `Octave ${octave}` }),
      ).toBeInTheDocument();
    }
  });

  it("emits slider moves through onBpmChange", () => {
    const onBpmChange = vi.fn();
    render(
      <TrainerTimingStrip
        bpm={84}
        onBpmChange={onBpmChange}
        octave={4}
        onOctaveChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId("trainer-tempo-slider"), {
      target: { value: "100" },
    });
    expect(onBpmChange).toHaveBeenCalledWith(100);
  });

  it("presets set the slider and stay in sync via aria-pressed", async () => {
    const user = userEvent.setup();
    const onBpmChange = vi.fn();
    const { rerender } = render(
      <TrainerTimingStrip
        bpm={84}
        onBpmChange={onBpmChange}
        octave={4}
        onOctaveChange={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Brisk" }));
    expect(onBpmChange).toHaveBeenCalledWith(120);
    rerender(
      <TrainerTimingStrip
        bpm={120}
        onBpmChange={onBpmChange}
        octave={4}
        onOctaveChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("trainer-tempo-slider")).toHaveValue("120");
    expect(screen.getByRole("button", { name: "Brisk" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Slow" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Steady" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("shows the selected preset's practice tips and none on a custom tempo", () => {
    const { rerender } = render(
      <TrainerTimingStrip
        bpm={200}
        onBpmChange={vi.fn()}
        octave={4}
        onOctaveChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("trainer-tempo-tips")).toHaveAccessibleName(
      "Melisma practice tips",
    );
    rerender(
      <TrainerTimingStrip
        bpm={72}
        onBpmChange={vi.fn()}
        octave={4}
        onOctaveChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("trainer-tempo-tips")).toBeNull();
  });

  it("leaves every preset unpressed on a custom tempo", () => {
    render(
      <TrainerTimingStrip
        bpm={72}
        onBpmChange={vi.fn()}
        octave={4}
        onOctaveChange={vi.fn()}
      />,
    );
    for (const preset of [
      "Slow",
      "Steady",
      "Brisk",
      "Fast",
      "Melisma",
      "Blaze",
    ]) {
      expect(screen.getByRole("button", { name: preset })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
  });

  it("emits octave changes and marks the active octave", async () => {
    const user = userEvent.setup();
    const onOctaveChange = vi.fn();
    const { rerender } = render(
      <TrainerTimingStrip
        bpm={84}
        onBpmChange={vi.fn()}
        octave={4}
        onOctaveChange={onOctaveChange}
      />,
    );
    expect(screen.getByRole("button", { name: "Octave 4" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Octave 5" }));
    expect(onOctaveChange).toHaveBeenCalledWith(5);
    rerender(
      <TrainerTimingStrip
        bpm={84}
        onBpmChange={vi.fn()}
        octave={5}
        onOctaveChange={onOctaveChange}
      />,
    );
    expect(screen.getByRole("button", { name: "Octave 5" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Octave 4" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
