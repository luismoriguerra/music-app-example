// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { TrainerPanel } from "@/components/TrainerPanel";
import { transposeSheet } from "@/lib/chord-diagrams";
import { makeChordSheet, makeLyricsOnlySheet } from "./trainer-fixtures";

describe("TrainerPanel states (008 US1)", () => {
  it("renders a loading skeleton with reserved space when loading", () => {
    render(
      <TrainerPanel
        displaySheet={makeChordSheet(["C", "F", "G"])}
        transpose={0}
        active
        isLoading
      />,
    );
    const panel = screen.getByTestId("trainer-panel");
    expect(panel).toHaveAttribute("data-state", "loading");
    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
  });

  it("renders a tablist of 4 difficulty groups, starting on Basic", () => {
    render(
      <TrainerPanel
        displaySheet={makeChordSheet(["C", "F", "G"])}
        transpose={0}
        active
      />,
    );
    const panel = screen.getByTestId("trainer-panel");
    expect(panel).toHaveAttribute("data-state", "ready");
    const tablist = screen.getByRole("tablist", {
      name: "Exercise difficulty",
    });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "Basic",
      "Intermediate",
      "Advanced",
      "Master",
    ]);
    expect(screen.getByTestId("trainer-difficulty-tab-basic")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const label = screen.getByTestId("trainer-scale-label");
    expect(label).toHaveTextContent(/C major/);
    expect(label).toHaveTextContent(/song chords/);

    // Basic tab is visible by default; its own exercises render.
    const basic = within(screen.getByTestId("trainer-group-basic"));
    const run = basic.getByTestId("trainer-exercise-agility-run-1");
    expect(within(run).getByText("Stepwise Run")).toBeInTheDocument();
    expect(within(run).getAllByTestId("trainer-note")).toHaveLength(9);
    // Technique survives as a badge; difficulty owns the grouping.
    expect(within(run).getByTestId("trainer-category")).toHaveTextContent(
      "Agility",
    );
    expect(
      basic.getByTestId("trainer-exercise-flexibility-triad-1"),
    ).toBeInTheDocument();

    // Other groups are mounted but hidden until their tab is selected.
    expect(screen.getByTestId("trainer-group-intermediate")).toHaveAttribute(
      "hidden",
    );
    fireEvent.click(screen.getByTestId("trainer-difficulty-tab-intermediate"));
    expect(
      screen.getByTestId("trainer-difficulty-tab-intermediate"),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("trainer-group-basic")).toHaveAttribute("hidden");
    const intermediate = within(
      screen.getByTestId("trainer-group-intermediate"),
    );
    expect(
      intermediate.getByTestId("trainer-exercise-flexibility-siren-1"),
    ).toBeInTheDocument();
    expect(
      intermediate.getByTestId("trainer-exercise-tonality-octave-run-1"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("trainer-difficulty-tab-advanced"));
    const advanced = within(screen.getByTestId("trainer-group-advanced"));
    expect(
      advanced.getByTestId("trainer-exercise-agility-thirds-1"),
    ).toBeInTheDocument();
    expect(
      advanced.getByTestId("trainer-exercise-flexibility-melisma-1"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("trainer-difficulty-tab-master"));
    const master = within(screen.getByTestId("trainer-group-master"));
    expect(
      master.getByTestId("trainer-exercise-tonality-cadence-1"),
    ).toBeInTheDocument();
  });

  it("arrow keys rove between difficulty tabs and stop any running session", () => {
    (window as unknown as Record<string, unknown>).AudioContext = vi.fn();
    render(
      <TrainerPanel
        displaySheet={makeChordSheet(["C", "F", "G"])}
        transpose={0}
        active
      />,
    );
    fireEvent.click(screen.getByTestId("trainer-play-agility-run-1"));
    expect(
      screen.getByTestId("trainer-exercise-agility-run-1"),
    ).toHaveAttribute("aria-busy", "true");
    const basicTab = screen.getByTestId("trainer-difficulty-tab-basic");
    fireEvent.keyDown(basicTab, { key: "ArrowRight" });
    expect(
      screen.getByTestId("trainer-difficulty-tab-intermediate"),
    ).toHaveAttribute("aria-selected", "true");
    // Switching the group tab halts any running session (no orphaned audio
    // behind a hidden panel).
    expect(
      screen.getByTestId("trainer-exercise-agility-run-1"),
    ).toHaveAttribute("aria-busy", "false");
    fireEvent.keyDown(
      screen.getByTestId("trainer-difficulty-tab-intermediate"),
      { key: "ArrowLeft" },
    );
    expect(basicTab).toHaveAttribute("aria-selected", "true");
    delete (window as unknown as Record<string, unknown>).AudioContext;
  });

  it("labels a picker override as the scale source", () => {
    render(
      <TrainerPanel
        displaySheet={makeChordSheet(["C", "F", "G"])}
        transpose={0}
        active
        scaleOverride={{ tonic: "D", mode: "major" }}
      />,
    );
    const label = screen.getByTestId("trainer-scale-label");
    expect(label).toHaveTextContent(/D major/);
    expect(label).toHaveTextContent(/your pick/);
  });

  it("updates every sequence when the transpose changes", () => {
    const sheet = makeChordSheet(["C", "F", "G"]);
    const { rerender } = render(
      <TrainerPanel displaySheet={sheet} transpose={0} active />,
    );
    const firstNoteLabel = () =>
      within(screen.getByTestId("trainer-exercise-agility-run-1"))
        .getAllByTestId("trainer-note")[0]
        ?.getAttribute("aria-label");
    expect(firstNoteLabel()).toBe("Play note C (degree 1)");
    rerender(
      <TrainerPanel
        displaySheet={transposeSheet(sheet, 2)}
        transpose={2}
        active
      />,
    );
    expect(firstNoteLabel()).toBe("Play note D (degree 1)");
    expect(screen.getByTestId("trainer-scale-label")).toHaveTextContent(
      /D major/,
    );
  });

  it("offers a scale picker with an explanation on lyrics-only sheets", () => {
    const onScaleOverrideChange = vi.fn();
    render(
      <TrainerPanel
        displaySheet={makeLyricsOnlySheet()}
        transpose={0}
        active
        onScaleOverrideChange={onScaleOverrideChange}
      />,
    );
    expect(screen.getByTestId("trainer-panel")).toHaveAttribute(
      "data-state",
      "empty",
    );
    expect(screen.getByText(/no chords/i)).toBeInTheDocument();
    const picker = screen.getByRole("combobox", { name: /choose a scale/i });
    fireEvent.change(picker, { target: { value: "D major" } });
    expect(onScaleOverrideChange).toHaveBeenCalledWith({
      tonic: "D",
      mode: "major",
    });
    expect(screen.getByTestId("trainer-panel")).toHaveAttribute(
      "data-state",
      "ready",
    );
    expect(screen.getByTestId("trainer-scale-label")).toHaveTextContent(
      /your pick/,
    );
  });

  it("shows an error with retry that clears a bad override", () => {
    const onScaleOverrideChange = vi.fn();
    render(
      <TrainerPanel
        displaySheet={makeChordSheet(["C", "F", "G"])}
        transpose={0}
        active
        scaleOverride={{ tonic: "H", mode: "major" }}
        onScaleOverrideChange={onScaleOverrideChange}
      />,
    );
    expect(screen.getByTestId("trainer-panel")).toHaveAttribute(
      "data-state",
      "error",
    );
    expect(screen.getByText(/couldn't load/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onScaleOverrideChange).toHaveBeenCalledWith(null);
    expect(screen.getByTestId("trainer-panel")).toHaveAttribute(
      "data-state",
      "ready",
    );
  });

  it("persists the last-used tempo across remounts", () => {
    window.localStorage.clear();
    const sheet = makeChordSheet(["C", "F", "G"]);
    const first = render(
      <TrainerPanel displaySheet={sheet} transpose={0} active />,
    );
    fireEvent.change(screen.getByTestId("trainer-tempo-slider"), {
      target: { value: "100" },
    });
    expect(screen.getByTestId("trainer-tempo-readout")).toHaveTextContent(
      "♩= 100",
    );
    first.unmount();
    render(<TrainerPanel displaySheet={sheet} transpose={0} active />);
    expect(screen.getByTestId("trainer-tempo-readout")).toHaveTextContent(
      "♩= 100",
    );
    window.localStorage.clear();
  });

  it("renders every note as a preview button", () => {
    render(
      <TrainerPanel
        displaySheet={makeChordSheet(["C", "F", "G"])}
        transpose={0}
        active
      />,
    );
    const run = within(screen.getByTestId("trainer-exercise-agility-run-1"));
    const notes = run.getAllByTestId("trainer-note");
    expect(notes).toHaveLength(9);
    for (const note of notes) {
      expect(note.tagName).toBe("BUTTON");
      expect(note).toHaveAttribute(
        "aria-label",
        expect.stringMatching(/^Play note /),
      );
    }
    expect(notes[0]).toHaveAttribute("aria-label", "Play note C (degree 1)");
  });

  it("labels the open AI analysis key as the scale source (008 FR-004)", () => {
    render(
      <TrainerPanel
        displaySheet={makeChordSheet(["Am", "Am", "F", "C", "G"])}
        transpose={0}
        active
        analysisKey={{
          tonic: "G",
          mode: "major",
          scale: ["G", "A", "B", "C", "D", "E", "F#", "G"],
        }}
      />,
    );
    const label = screen.getByTestId("trainer-scale-label");
    expect(label).toHaveTextContent(/G major/);
    expect(label).toHaveTextContent(/from AI analysis/);
  });
});
