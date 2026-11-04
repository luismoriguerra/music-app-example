// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SecondVoiceTrainer,
  type SecondVoiceTrainerProps,
} from "@/components/SecondVoiceTrainer";
import { playMidiChord } from "@/lib/sound";
import {
  TRAINER_BPM_STORAGE_KEY,
  TRAINER_LOOPS_STORAGE_KEY,
} from "@/lib/trainer-prefs";
import { sequenceProgress, startStepSequence } from "@/lib/trainer-sequence";
import { makeChordSheet, makeLyricsOnlySheet } from "./trainer-fixtures";
import type * as SoundModule from "@/lib/sound";
import type * as TrainerSequenceModule from "@/lib/trainer-sequence";

vi.mock("@/lib/trainer-sequence", async (importOriginal) => {
  const actual = await importOriginal<typeof TrainerSequenceModule>();
  return { ...actual, startStepSequence: vi.fn(), sequenceProgress: vi.fn() };
});

vi.mock("@/lib/sound", async (importOriginal) => {
  const actual = await importOriginal<typeof SoundModule>();
  return { ...actual, playMidiChord: vi.fn() };
});

const startStepSequenceMock = vi.mocked(startStepSequence);
const sequenceProgressMock = vi.mocked(sequenceProgress);
const playMidiChordMock = vi.mocked(playMidiChord);

/** G major through the heuristic (G is the most frequent root). */
const G_SONG = makeChordSheet(["G", "G", "C", "D"]);
const PLAY_3RD_ABOVE = "Play Parallel 3rds above";
const STOP_3RD_ABOVE = "Stop Parallel 3rds above";
const LOOP_3RD_ABOVE = "Loop Parallel 3rds above 3 times";
const STEP_ONE = "Play step 1: lead G, your part B, 3rd above";

function setAudioAvailable(available: boolean): void {
  const target = window as unknown as Record<string, unknown>;
  if (available) target.AudioContext = vi.fn();
  else delete target.AudioContext;
}

function renderTrainer(overrides: Partial<SecondVoiceTrainerProps> = {}) {
  return render(
    <SecondVoiceTrainer
      displaySheet={G_SONG}
      transpose={0}
      analysisKey={null}
      active
      {...overrides}
    />,
  );
}

describe("SecondVoiceTrainer (013 US2 to US4)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setAudioAvailable(true);
    startStepSequenceMock.mockReturnValue({
      stop: vi.fn(),
      finished: Promise.withResolvers<void>().promise,
    });
    sequenceProgressMock.mockReturnValue(0);
  });

  afterEach(() => {
    setAudioAvailable(false);
    vi.clearAllMocks();
  });

  it("opens on the Basic tab, labelled with the scale from the song chords", () => {
    renderTrainer();
    expect(screen.getByTestId("second-voice-scale-label")).toHaveTextContent(
      "G major · from song chords",
    );
    expect(screen.getByRole("tab", { name: "Basic" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("button", { name: PLAY_3RD_ABOVE }),
    ).toBeInTheDocument();
  });

  it("Play sounds lead and your part together on every step at the chosen tempo", async () => {
    const user = userEvent.setup();
    renderTrainer();
    await user.click(screen.getByRole("button", { name: PLAY_3RD_ABOVE }));
    expect(startStepSequenceMock).toHaveBeenCalledTimes(1);
    const [steps, options] = startStepSequenceMock.mock.calls[0] ?? [];
    expect(steps).toHaveLength(9);
    // G4 (the tonic at octave 4) with B4, a 3rd above, at the default 84 BPM.
    expect(steps?.[0]).toEqual([67, 71]);
    expect(options).toEqual({ bpm: 84 });
  });

  it("Lead only sounds only the lead on each step", async () => {
    const user = userEvent.setup();
    renderTrainer();
    await user.click(screen.getByRole("radio", { name: "Lead only" }));
    await user.click(screen.getByRole("button", { name: PLAY_3RD_ABOVE }));
    expect(startStepSequenceMock.mock.calls[0]?.[0]?.[0]).toEqual([67]);
  });

  it("Your part only sounds only the part on each step", async () => {
    const user = userEvent.setup();
    renderTrainer();
    await user.click(screen.getByRole("radio", { name: "Your part" }));
    await user.click(screen.getByRole("button", { name: PLAY_3RD_ABOVE }));
    expect(startStepSequenceMock.mock.calls[0]?.[0]?.[0]).toEqual([71]);
  });

  it("Loop runs the default three rounds as one session", async () => {
    const user = userEvent.setup();
    renderTrainer();
    await user.click(screen.getByRole("button", { name: LOOP_3RD_ABOVE }));
    expect(startStepSequenceMock).toHaveBeenCalledTimes(1);
    expect(startStepSequenceMock.mock.calls[0]?.[0]).toHaveLength(27);
  });

  it("Stop halts the running session and returns the card to Play", async () => {
    const user = userEvent.setup();
    renderTrainer();
    await user.click(screen.getByRole("button", { name: PLAY_3RD_ABOVE }));
    const session = startStepSequenceMock.mock.results[0]?.value;
    await user.click(screen.getByRole("button", { name: STOP_3RD_ABOVE }));
    expect(session?.stop).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: PLAY_3RD_ABOVE }),
    ).toBeInTheDocument();
  });

  it("Escape halts the running session", async () => {
    const user = userEvent.setup();
    renderTrainer();
    await user.click(screen.getByRole("button", { name: PLAY_3RD_ABOVE }));
    const session = startStepSequenceMock.mock.results[0]?.value;
    fireEvent.keyDown(document, { key: "Escape" });
    expect(session?.stop).toHaveBeenCalledTimes(1);
  });

  it("switching difficulty tabs halts the running session", async () => {
    const user = userEvent.setup();
    renderTrainer();
    await user.click(screen.getByRole("button", { name: PLAY_3RD_ABOVE }));
    const session = startStepSequenceMock.mock.results[0]?.value;
    await user.click(screen.getByRole("tab", { name: "Intermediate" }));
    expect(session?.stop).toHaveBeenCalledTimes(1);
  });

  it("hiding the analyzer tab halts playback", async () => {
    const user = userEvent.setup();
    const view = renderTrainer();
    await user.click(screen.getByRole("button", { name: PLAY_3RD_ABOVE }));
    const session = startStepSequenceMock.mock.results[0]?.value;
    view.rerender(
      <SecondVoiceTrainer
        displaySheet={G_SONG}
        transpose={0}
        analysisKey={null}
        active={false}
      />,
    );
    expect(session?.stop).toHaveBeenCalledTimes(1);
  });

  it("a tapped step previews that step in the chosen reference mix", async () => {
    const user = userEvent.setup();
    renderTrainer();
    await user.click(screen.getByRole("button", { name: STEP_ONE }));
    expect(playMidiChordMock).toHaveBeenLastCalledWith([67, 71], {
      mode: "block",
    });
    await user.click(screen.getByRole("radio", { name: "Your part" }));
    await user.click(screen.getByRole("button", { name: STEP_ONE }));
    expect(playMidiChordMock).toHaveBeenLastCalledWith([71], { mode: "block" });
  });

  it("changing the round count mid-loop keeps the running loop and persists the choice", async () => {
    const user = userEvent.setup();
    renderTrainer();
    await user.click(screen.getByRole("button", { name: LOOP_3RD_ABOVE }));
    const session = startStepSequenceMock.mock.results[0]?.value;
    await user.selectOptions(
      screen.getByLabelText("Loop rounds for Parallel 3rds above"),
      "5",
    );
    expect(session?.stop).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(TRAINER_LOOPS_STORAGE_KEY)).toBe("5");
  });

  it("a tempo change persists for the next visit and applies to the next run", async () => {
    const user = userEvent.setup();
    renderTrainer();
    fireEvent.change(screen.getByRole("slider", { name: "Tempo" }), {
      target: { value: "120" },
    });
    expect(window.localStorage.getItem(TRAINER_BPM_STORAGE_KEY)).toBe("120");
    await user.click(screen.getByRole("button", { name: PLAY_3RD_ABOVE }));
    expect(startStepSequenceMock.mock.calls[0]?.[1]).toEqual({ bpm: 120 });
  });

  it("disables playback and explains why when audio is unavailable", () => {
    setAudioAvailable(false);
    renderTrainer();
    expect(
      screen.getByTestId("second-voice-audio-unavailable"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: PLAY_3RD_ABOVE })).toBeDisabled();
  });

  it("offers a scale picker when no scale can be read, then plays in the picked key", async () => {
    const user = userEvent.setup();
    renderTrainer({ displaySheet: makeLyricsOnlySheet() });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Choose a scale" }),
      "D major",
    );
    expect(screen.getByTestId("second-voice-scale-label")).toHaveTextContent(
      "D major · from your pick",
    );
  });

  it("the analysis key sets the scale when it applies at this transpose", () => {
    renderTrainer({
      analysisKey: {
        tonic: "D",
        mode: "major",
        scale: ["D", "E", "F#", "G", "A", "B", "C#"],
      },
    });
    expect(screen.getByTestId("second-voice-scale-label")).toHaveTextContent(
      "D major · from AI analysis",
    );
  });

  it("a transposed song re-derives the scale and the next run's notes", async () => {
    const user = userEvent.setup();
    const view = renderTrainer();
    view.rerender(
      <SecondVoiceTrainer
        displaySheet={makeChordSheet(["A", "A", "D", "E"])}
        transpose={2}
        analysisKey={null}
        active
      />,
    );
    expect(screen.getByTestId("second-voice-scale-label")).toHaveTextContent(
      "A major · from song chords",
    );
    await user.click(
      screen.getByRole("button", { name: "Play Parallel 3rds above" }),
    );
    // A4 (the tonic) with C#5, a 3rd above.
    expect(startStepSequenceMock.mock.calls[0]?.[0]?.[0]).toEqual([69, 73]);
  });

  it("changing the reference mix mid-run leaves the running session untouched", async () => {
    const user = userEvent.setup();
    renderTrainer();
    await user.click(screen.getByRole("button", { name: PLAY_3RD_ABOVE }));
    const session = startStepSequenceMock.mock.results[0]?.value;
    await user.click(screen.getByRole("radio", { name: "Lead only" }));
    expect(session?.stop).not.toHaveBeenCalled();
    expect(startStepSequenceMock).toHaveBeenCalledTimes(1);
  });

  it("changing the tempo mid-run leaves the running session untouched", async () => {
    const user = userEvent.setup();
    renderTrainer();
    await user.click(screen.getByRole("button", { name: PLAY_3RD_ABOVE }));
    const session = startStepSequenceMock.mock.results[0]?.value;
    fireEvent.change(screen.getByRole("slider", { name: "Tempo" }), {
      target: { value: "120" },
    });
    expect(session?.stop).not.toHaveBeenCalled();
    expect(startStepSequenceMock).toHaveBeenCalledTimes(1);
  });

  it("pressing Play on another exercise halts the running one", async () => {
    const user = userEvent.setup();
    renderTrainer();
    await user.click(screen.getByRole("button", { name: PLAY_3RD_ABOVE }));
    const first = startStepSequenceMock.mock.results[0]?.value;
    await user.click(
      screen.getByRole("button", { name: "Play Parallel 3rds below" }),
    );
    expect(first?.stop).toHaveBeenCalledTimes(1);
    expect(startStepSequenceMock).toHaveBeenCalledTimes(2);
  });

  it("unmounting the trainer halts a running session", async () => {
    const user = userEvent.setup();
    const view = renderTrainer();
    await user.click(screen.getByRole("button", { name: PLAY_3RD_ABOVE }));
    const session = startStepSequenceMock.mock.results[0]?.value;
    view.unmount();
    expect(session?.stop).toHaveBeenCalledTimes(1);
  });

  it("the octave choice sets the register of the next run", async () => {
    const user = userEvent.setup();
    renderTrainer();
    await user.click(screen.getByRole("button", { name: "Octave 5" }));
    await user.click(screen.getByRole("button", { name: PLAY_3RD_ABOVE }));
    // G5 (the tonic at octave 5) with B5, a 3rd above.
    expect(startStepSequenceMock.mock.calls[0]?.[0]?.[0]).toEqual([79, 83]);
  });

  it("opening and closing the how-to guide leaves a running session untouched (FR-017)", async () => {
    const user = userEvent.setup();
    renderTrainer();
    await user.click(screen.getByRole("button", { name: PLAY_3RD_ABOVE }));
    const session = startStepSequenceMock.mock.results[0]?.value;
    const guide = screen.getByTestId("second-voice-howto");
    expect(guide).not.toHaveAttribute("open");
    await user.click(screen.getByText("How to practice"));
    expect(guide).toHaveAttribute("open");
    await user.click(screen.getByText("How to practice"));
    expect(session?.stop).not.toHaveBeenCalled();
    expect(startStepSequenceMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: STOP_3RD_ABOVE }),
    ).toBeInTheDocument();
  });
});
