// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrainerPanel } from "@/components/TrainerPanel";
import { sequenceProgress, startSequence } from "@/lib/trainer-sequence";
import { playNote } from "@/lib/sound";
import { makeChordSheet } from "./trainer-fixtures";

vi.mock("@/lib/trainer-sequence", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/trainer-sequence")>();
  return { ...actual, startSequence: vi.fn(), sequenceProgress: vi.fn() };
});

vi.mock("@/lib/sound", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sound")>();
  return { ...actual, playNote: vi.fn() };
});

const startSequenceMock = vi.mocked(startSequence);
const sequenceProgressMock = vi.mocked(sequenceProgress);
const playNoteMock = vi.mocked(playNote);

function neverEndingSession() {
  return { stop: vi.fn(), finished: new Promise<void>(() => {}) };
}

describe("TrainerPanel playback (008 US2)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    (window as unknown as Record<string, unknown>).AudioContext = vi.fn();
    startSequenceMock.mockReturnValue(neverEndingSession());
    sequenceProgressMock.mockReturnValue(0);
    playNoteMock.mockClear();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).AudioContext;
    vi.restoreAllMocks();
  });

  function renderPlaying() {
    render(
      <TrainerPanel
        displaySheet={makeChordSheet(["C", "F", "G"])}
        transpose={0}
        active
      />,
    );
    return screen.getByTestId("trainer-exercise-agility-run-1");
  }

  /** G major via the heuristic (G most frequent): C/D sit BELOW the tonic's pitch class. */
  function renderInG() {
    render(
      <TrainerPanel
        displaySheet={makeChordSheet(["G", "G", "C", "D"])}
        transpose={0}
        active
      />,
    );
    expect(screen.getByTestId("trainer-scale-label")).toHaveTextContent(
      /G major/,
    );
  }

  it("Play starts the frozen run with progress and highlight", async () => {
    const user = userEvent.setup();
    const card = renderPlaying();
    await user.click(within(card).getByTestId("trainer-play-agility-run-1"));
    expect(startSequenceMock).toHaveBeenCalledTimes(1);
    expect(startSequenceMock).toHaveBeenCalledWith(
      [60, 62, 64, 65, 67, 65, 64, 62, 60],
      { bpm: 84 },
    );
    expect(card).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("trainer-progress")).toHaveTextContent(
      "Note 1 of 9",
    );
    const chips = within(card).getAllByTestId("trainer-note");
    expect(chips[0]).toHaveAttribute("aria-current", "true");
  });

  it("Stop halts playback and returns the card to idle", async () => {
    const user = userEvent.setup();
    const card = renderPlaying();
    await user.click(within(card).getByTestId("trainer-play-agility-run-1"));
    const session = startSequenceMock.mock.results[0]?.value as {
      stop: () => void;
    };
    await user.click(screen.getByTestId("trainer-stop"));
    expect(session.stop).toHaveBeenCalledTimes(1);
    expect(card).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByTestId("trainer-progress")).toBeNull();
    expect(
      within(card).getByTestId("trainer-play-agility-run-1"),
    ).toBeInTheDocument();
  });

  it("Escape halts playback", async () => {
    const user = userEvent.setup();
    const card = renderPlaying();
    await user.click(within(card).getByTestId("trainer-play-agility-run-1"));
    const session = startSequenceMock.mock.results[0]?.value as {
      stop: () => void;
    };
    fireEvent.keyDown(screen.getByTestId("trainer-panel"), { key: "Escape" });
    expect(session.stop).toHaveBeenCalledTimes(1);
    expect(
      within(card).getByTestId("trainer-play-agility-run-1"),
    ).toBeInTheDocument();
  });

  it("re-pressing Play restarts a single session without overlap", async () => {
    const user = userEvent.setup();
    const card = renderPlaying();
    const play = () => within(card).getByTestId("trainer-play-agility-run-1");
    await user.click(play());
    const first = startSequenceMock.mock.results[0]?.value as {
      stop: () => void;
    };
    // Second press targets another exercise to prove stop-then-restart.
    await user.click(screen.getByTestId("trainer-play-tonality-drone-1"));
    expect(startSequenceMock).toHaveBeenCalledTimes(2);
    expect(first.stop).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId("trainer-exercise-tonality-drone-1"),
    ).toHaveAttribute("aria-busy", "true");
    expect(card).toHaveAttribute("aria-busy", "false");
    expect(screen.getAllByTestId("trainer-stop")).toHaveLength(1);
  });

  it("Loop ×3 schedules three back-to-back rounds as one frozen session", async () => {
    const user = userEvent.setup();
    const card = renderPlaying();
    await user.click(within(card).getByTestId("trainer-loop-agility-run-1"));
    expect(startSequenceMock).toHaveBeenCalledTimes(1);
    expect(startSequenceMock).toHaveBeenCalledWith(
      [
        60, 62, 64, 65, 67, 65, 64, 62, 60, 60, 62, 64, 65, 67, 65, 64, 62, 60,
        60, 62, 64, 65, 67, 65, 64, 62, 60,
      ],
      { bpm: 84 },
    );
    expect(card).toHaveAttribute("aria-busy", "true");
    expect(within(card).getByTestId("trainer-stop")).toBeInTheDocument();
    // Loop flips to Stop; Play stays untouched (independent buttons).
    expect(
      within(card).getByTestId("trainer-play-agility-run-1"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("trainer-progress")).toHaveTextContent(
      "Round 1 of 3 · Note 1 of 9",
    );
  });

  it("loop dropdown sets the round count; changing it mid-run keeps the running loop", async () => {
    const user = userEvent.setup();
    const card = renderPlaying();
    const select = within(card).getByTestId("trainer-loop-count-agility-run-1");
    await user.selectOptions(select, "5");
    expect(
      within(card).getByTestId("trainer-loop-agility-run-1"),
    ).toHaveTextContent("Loop ×5");
    await user.click(within(card).getByTestId("trainer-loop-agility-run-1"));
    expect(startSequenceMock.mock.calls[0]?.[0]).toHaveLength(9 * 5);
    expect(screen.getByTestId("trainer-progress")).toHaveTextContent(
      "Round 1 of 5",
    );
    await user.selectOptions(select, "6");
    expect(within(card).getByTestId("trainer-stop")).toBeInTheDocument();
    expect(screen.getByTestId("trainer-progress")).toHaveTextContent(
      "Round 1 of 5",
    );
    expect(window.localStorage.getItem("trainer.loops")).toBe("6");
  });

  it("uke fretboard is collapsed by default and toggles the exercise's notes on the neck", async () => {
    const user = userEvent.setup();
    const card = renderPlaying();
    const toggle = within(card).getByTestId(
      "trainer-fretboard-toggle-agility-run-1",
    );
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(card).queryByTestId("scale-neck")).toBeNull();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const tones = within(card).getAllByTestId("scale-neck-tone");
    expect(new Set(tones.map((t) => t.dataset.note))).toEqual(
      new Set(["C", "D", "E", "F", "G"]),
    );
    expect(
      new Set(
        tones
          .filter((t) => t.dataset.tonic === "true")
          .map((t) => t.dataset.note),
      ),
    ).toEqual(new Set(["C"]));
    await user.click(toggle);
    expect(within(card).queryByTestId("scale-neck")).toBeNull();
  });

  it("uke fretboard shows notes that first appear after the 7th position", async () => {
    const user = userEvent.setup();
    renderPlaying();
    await user.click(screen.getByTestId("trainer-difficulty-tab-master"));
    const card = screen.getByTestId("trainer-exercise-tonality-pedal-1");
    await user.click(
      within(card).getByTestId("trainer-fretboard-toggle-tonality-pedal-1"),
    );
    const notes = new Set(
      within(card)
        .getAllByTestId("scale-neck-tone")
        .map((t) => t.dataset.note),
    );
    expect(notes).toEqual(new Set(["C", "D", "E", "F", "G", "A", "B"]));
  });

  it("Loop ×3 progress advances rounds and wraps the note index", () => {
    vi.useFakeTimers();
    try {
      const card = renderPlaying();
      fireEvent.click(within(card).getByTestId("trainer-loop-agility-run-1"));
      // Position 12 = round 2 (index 12 / 9 = 1 -> round 2), note index 3.
      sequenceProgressMock.mockReturnValue(12);
      act(() => {
        vi.advanceTimersByTime(60);
      });
      // Guards against a regression passing the un-repeated midis.length (9)
      // instead of the true repeated run.length (27) into sequenceProgress.
      expect(sequenceProgressMock).toHaveBeenLastCalledWith(
        27,
        expect.any(Number),
        expect.any(Number),
      );
      expect(screen.getByTestId("trainer-progress")).toHaveTextContent(
        "Round 2 of 3 · Note 4 of 9",
      );
      const chips = within(card).getAllByTestId("trainer-note");
      expect(chips[3]).toHaveAttribute("aria-current", "true");
    } finally {
      vi.useRealTimers();
    }
  });

  it("Stop halts a looping run and restores the Loop button", async () => {
    const user = userEvent.setup();
    const card = renderPlaying();
    await user.click(within(card).getByTestId("trainer-loop-agility-run-1"));
    const session = startSequenceMock.mock.results[0]?.value as {
      stop: () => void;
    };
    await user.click(within(card).getByTestId("trainer-stop"));
    expect(session.stop).toHaveBeenCalledTimes(1);
    expect(card).toHaveAttribute("aria-busy", "false");
    expect(
      within(card).getByTestId("trainer-loop-agility-run-1"),
    ).toBeInTheDocument();
    expect(
      within(card).getByTestId("trainer-play-agility-run-1"),
    ).toBeInTheDocument();
  });

  it("Play and Loop never overlap: pressing the other stops the running one", async () => {
    const user = userEvent.setup();
    const card = renderPlaying();
    await user.click(within(card).getByTestId("trainer-play-agility-run-1"));
    const first = startSequenceMock.mock.results[0]?.value as {
      stop: () => void;
    };
    await user.click(within(card).getByTestId("trainer-loop-agility-run-1"));
    expect(first.stop).toHaveBeenCalledTimes(1);
    expect(startSequenceMock).toHaveBeenCalledTimes(2);
    expect(screen.getAllByTestId("trainer-stop")).toHaveLength(1);
    expect(
      within(card).getByTestId("trainer-play-agility-run-1"),
    ).toBeInTheDocument();
  });

  it("a naturally finishing run returns to idle without stopping", async () => {
    const user = userEvent.setup();
    let resolveFinished = () => {};
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });
    const stop = vi.fn();
    startSequenceMock.mockReturnValue({ stop, finished });
    const card = renderPlaying();
    await user.click(within(card).getByTestId("trainer-play-agility-run-1"));
    resolveFinished();
    await screen.findByTestId("trainer-play-agility-run-1");
    expect(stop).not.toHaveBeenCalled();
    expect(card).toHaveAttribute("aria-busy", "false");
  });

  it("unmounting stops the running session (song change)", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <TrainerPanel
        displaySheet={makeChordSheet(["C", "F", "G"])}
        transpose={0}
        active
      />,
    );
    await user.click(screen.getByTestId("trainer-play-agility-run-1"));
    const session = startSequenceMock.mock.results[0]?.value as {
      stop: () => void;
    };
    unmount();
    expect(session.stop).toHaveBeenCalledTimes(1);
  });

  it("hiding the tab (active=false) stops playback immediately", async () => {
    const user = userEvent.setup();
    const sheet = makeChordSheet(["C", "F", "G"]);
    const { rerender } = render(
      <TrainerPanel displaySheet={sheet} transpose={0} active />,
    );
    await user.click(screen.getByTestId("trainer-play-agility-run-1"));
    const session = startSequenceMock.mock.results[0]?.value as {
      stop: () => void;
    };
    rerender(
      <TrainerPanel displaySheet={sheet} transpose={0} active={false} />,
    );
    expect(session.stop).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId("trainer-play-agility-run-1"),
    ).toBeInTheDocument();
  });

  it("degrades gracefully when audio is unavailable", async () => {
    const user = userEvent.setup();
    delete (window as unknown as Record<string, unknown>).AudioContext;
    render(
      <TrainerPanel
        displaySheet={makeChordSheet(["C", "F", "G"])}
        transpose={0}
        active
      />,
    );
    expect(screen.getByTestId("trainer-audio-unavailable")).toBeInTheDocument();
    const play = screen.getByTestId("trainer-play-agility-run-1");
    expect(play).toBeDisabled();
    await user.click(play);
    expect(startSequenceMock).not.toHaveBeenCalled();
  });

  it("moves the highlight as sequenceProgress advances", () => {
    vi.useFakeTimers();
    try {
      const card = renderPlaying();
      fireEvent.click(within(card).getByTestId("trainer-play-agility-run-1"));
      sequenceProgressMock.mockReturnValue(3);
      act(() => {
        vi.advanceTimersByTime(60);
      });
      expect(screen.getByTestId("trainer-progress")).toHaveTextContent(
        "Note 4 of 9",
      );
      const chips = within(card).getAllByTestId("trainer-note");
      expect(chips[3]).toHaveAttribute("aria-current", "true");
    } finally {
      vi.useRealTimers();
    }
  });

  it("applies mid-run tempo edits to the next Play, not the running one", async () => {
    const user = userEvent.setup();
    renderPlaying();
    await user.click(screen.getByTestId("trainer-play-agility-run-1"));
    fireEvent.change(screen.getByTestId("trainer-tempo-slider"), {
      target: { value: "120" },
    });
    expect(screen.getByTestId("trainer-tempo-readout")).toHaveTextContent(
      "♩= 120",
    );
    // The running session keeps its frozen 84 BPM snapshot.
    expect(startSequenceMock).toHaveBeenLastCalledWith(expect.any(Array), {
      bpm: 84,
    });
    await user.click(screen.getByTestId("trainer-play-tonality-drone-1"));
    expect(startSequenceMock).toHaveBeenLastCalledWith(expect.any(Array), {
      bpm: 120,
    });
  });

  it("applies octave changes to the next Play", async () => {
    const user = userEvent.setup();
    renderPlaying();
    await user.click(screen.getByRole("button", { name: "Octave 5" }));
    await user.click(screen.getByTestId("trainer-play-agility-run-1"));
    expect(startSequenceMock).toHaveBeenCalledWith(
      [72, 74, 76, 77, 79, 77, 76, 74, 72],
      { bpm: 84 },
    );
  });

  it("sounds degree 8 one octave up (siren leaps, not unisons)", async () => {
    const user = userEvent.setup();
    renderPlaying();
    await user.click(screen.getByTestId("trainer-difficulty-tab-intermediate"));
    await user.click(screen.getByTestId("trainer-play-flexibility-siren-1"));
    expect(startSequenceMock).toHaveBeenCalledWith([60, 72, 60], { bpm: 84 });
  });

  it("places every note relative to the tonic in G major (no octave drop)", async () => {
    // Regression: absolute noteToMidi put C/D (pitch class < G) an octave
    // too low, so G A B C D sagged a seventh. C major can never catch this.
    const user = userEvent.setup();
    renderInG();
    await user.click(screen.getByTestId("trainer-play-agility-run-1"));
    expect(startSequenceMock).toHaveBeenCalledWith(
      [67, 69, 71, 72, 74, 72, 71, 69, 67],
      { bpm: 84 },
    );
  });

  it("keeps the arpeggio and drone ascending in G major", async () => {
    const user = userEvent.setup();
    renderInG();
    await user.click(screen.getByTestId("trainer-play-tonality-drone-1"));
    // G B D G' — D (pc 2) must sit above B, not drop to 62.
    expect(startSequenceMock).toHaveBeenLastCalledWith([67, 71, 74, 79], {
      bpm: 84,
    });
    await user.click(screen.getByTestId("trainer-difficulty-tab-intermediate"));
    await user.click(screen.getByTestId("trainer-play-flexibility-arpeggio-1"));
    expect(startSequenceMock).toHaveBeenLastCalledWith(
      [67, 71, 74, 79, 74, 71, 67],
      { bpm: 84 },
    );
  });

  it("note preview in G major matches Play-all pitch placement", async () => {
    const user = userEvent.setup();
    renderInG();
    const run = screen.getByTestId("trainer-exercise-agility-run-1");
    const chips = within(run).getAllByTestId("trainer-note");
    // Index 3 is C (degree 4): must preview as C5 (72), not C4 (60).
    const c = chips[3];
    if (!c) throw new Error("expected C chip");
    await user.click(c);
    expect(playNoteMock).toHaveBeenLastCalledWith("C", { octave: 5 });
  });

  it("note chip previews its single pitch without starting a session", async () => {
    const user = userEvent.setup();
    const card = renderPlaying();
    const first = within(card).getAllByTestId("trainer-note")[0];
    if (!first) throw new Error("expected note chips");
    await user.click(first);
    expect(playNoteMock).toHaveBeenCalledTimes(1);
    expect(playNoteMock).toHaveBeenCalledWith("C", { octave: 4 });
    expect(startSequenceMock).not.toHaveBeenCalled();
    expect(card).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByTestId("trainer-progress")).toBeNull();
  });

  it("note preview sounds degree 8 one octave up", async () => {
    const user = userEvent.setup();
    renderPlaying();
    await user.click(screen.getByTestId("trainer-difficulty-tab-intermediate"));
    const siren = screen.getByTestId("trainer-exercise-flexibility-siren-1");
    const middle = within(siren).getAllByTestId("trainer-note")[1];
    if (!middle) throw new Error("expected siren chips");
    await user.click(middle);
    expect(playNoteMock).toHaveBeenCalledWith("C", { octave: 5 });
  });

  it("note preview stops a running sequence (never overlaps)", async () => {
    const user = userEvent.setup();
    const card = renderPlaying();
    await user.click(within(card).getByTestId("trainer-play-agility-run-1"));
    const session = startSequenceMock.mock.results[0]?.value as {
      stop: () => void;
    };
    const first = within(card).getAllByTestId("trainer-note")[0];
    if (!first) throw new Error("expected note chips");
    await user.click(first);
    expect(session.stop).toHaveBeenCalledTimes(1);
    expect(startSequenceMock).toHaveBeenCalledTimes(1);
    expect(playNoteMock).toHaveBeenCalledWith("C", { octave: 4 });
    expect(card).toHaveAttribute("aria-busy", "false");
  });

  it("note previews follow the octave control", async () => {
    const user = userEvent.setup();
    const card = renderPlaying();
    await user.click(screen.getByRole("button", { name: "Octave 5" }));
    const first = within(card).getAllByTestId("trainer-note")[0];
    if (!first) throw new Error("expected note chips");
    await user.click(first);
    expect(playNoteMock).toHaveBeenCalledWith("C", { octave: 5 });
  });

  it("note buttons disable when audio is unavailable", async () => {
    const user = userEvent.setup();
    delete (window as unknown as Record<string, unknown>).AudioContext;
    renderPlaying();
    const first = within(
      screen.getByTestId("trainer-exercise-agility-run-1"),
    ).getAllByTestId("trainer-note")[0] as HTMLButtonElement;
    expect(first.disabled).toBe(true);
    await user.click(first);
    expect(playNoteMock).not.toHaveBeenCalled();
  });
});
