/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as sound from "@/lib/sound";
import { SecondVoiceView } from "@/components/SecondVoiceView";
import type { SecondVoiceOut } from "@/lib/sheets/schemas";

const GOLDEN: SecondVoiceOut = {
  key: { tonic: "G", mode: "major", justification: "Uses G, Em, C and D." },
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
    {
      section: "Verse 1",
      chords: ["G", "Em", "C", "D"],
      degrees: ["I", "vi", "IV", "V"],
    },
    { section: "Chorus", chords: ["G/B", "C", "G"], degrees: ["I", "IV", "I"] },
  ],
  special_chords: [{ chord: "E7", function: "Secondary dominant V7/vi." }],
  cadences: [
    { name: "V–I", chords: ["D", "G"], location: "End of the chorus." },
  ],
  section_feel: [
    { section: "Verse 1", feeling: "Settled." },
    { section: "Chorus", feeling: "Lifted." },
  ],
  second_voice: {
    melody_status: "missing",
    strategy: "Use diatonic thirds above where they fit.",
    up: null,
    down: null,
    recommendation: null,
  },
  note_table: [
    {
      section: "Chorus",
      lyric_snippet: "Hallelujah",
      chord: "G",
      first_voice: null,
      second_voice: null,
      interval: null,
      explanation: "No melody, so no exact pitch is proposed.",
    },
  ],
  singing_tips: ["Listen to the chord before entering.", "Breathe at the end."],
};

describe("SecondVoiceView (T027, 006)", () => {
  it("renders only the practical sections, in order", () => {
    render(<SecondVoiceView analysis={GOLDEN} />);
    const headings = screen.getAllByRole("heading").map((h) => h.textContent);
    expect(headings).toEqual([
      "Recommended second voice",
      "Note-by-note table",
      "Singing tips",
    ]);
  });

  it("drops the harmony-theory sections", () => {
    render(<SecondVoiceView analysis={GOLDEN} />);
    for (const removed of [
      "Key",
      "Scale",
      "Diatonic chords",
      "Roman-numeral progression",
      "Special chords",
      "Important cadences",
      "Section-by-section feel",
    ]) {
      expect(screen.queryByRole("heading", { name: removed })).toBeNull();
    }
  });

  it("renders symbols verbatim without re-spelling", () => {
    render(<SecondVoiceView analysis={GOLDEN} />);
    expect(screen.getAllByText("G/B").length).toBeGreaterThanOrEqual(1);
  });

  it("missing melody shows notice + strategy with dashed pitch cells", () => {
    render(<SecondVoiceView analysis={GOLDEN} />);
    const voice = screen.getByText("Recommended second voice").parentElement!;
    expect(
      within(voice as HTMLElement).getByText(/melody.*not.*available|missing/i),
    ).toBeInTheDocument();
    expect(
      within(voice as HTMLElement).getByText(/diatonic thirds/),
    ).toBeInTheDocument();
    const table = screen.getByText("Note-by-note table").parentElement!;
    const dashes = within(table as HTMLElement).getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
    expect(
      within(table as HTMLElement).getByText(
        "No melody, so no exact pitches are invented (FR-010).",
      ),
    ).toBeInTheDocument();
  });

  it("renders singing tips", () => {
    render(<SecondVoiceView analysis={GOLDEN} />);
    expect(
      screen.getByText("Listen to the chord before entering."),
    ).toBeInTheDocument();
    expect(screen.getByText("Breathe at the end.")).toBeInTheDocument();
  });

  it("renders vocal harmony lanes and the chord harmony guide", () => {
    render(<SecondVoiceView analysis={GOLDEN} />);
    expect(screen.getByText(/vocal harmony lanes/i)).toBeInTheDocument();
    expect(screen.getByText(/bright lane/i)).toBeInTheDocument();
    expect(screen.getByText(/warm lane/i)).toBeInTheDocument();
    expect(screen.getByText(/possible tones by chord/i)).toBeInTheDocument();
    // Checks unique chords derived from progression: G, Em, C, D, G/B
    expect(screen.getByText("Safe Blend Tones")).toBeInTheDocument();
    expect(screen.getByText("Color / Leading Tone")).toBeInTheDocument();
  });

  it("allows tapping chord and note buttons to play audio tones, with strum vs block toggle", async () => {
    const user = userEvent.setup();
    const playNoteSpy = vi
      .spyOn(sound, "playNote")
      .mockImplementation(() => {});
    const playChordSpy = vi
      .spyOn(sound, "playChord")
      .mockImplementation(() => {});

    render(<SecondVoiceView analysis={GOLDEN} />);

    // Find and click chord button (default: strum)
    const chordBtn = screen.getByRole("button", {
      name: /play g chord/i,
    });
    await user.click(chordBtn);
    expect(playChordSpy).toHaveBeenCalledWith(
      ["G", "B", "D"],
      expect.objectContaining({ mode: "strum" }),
    );

    // Switch to Block mode
    const blockSwitch = screen.getByRole("radio", { name: /block/i });
    await user.click(blockSwitch);
    const chordBlockBtn = await screen.findByRole("button", {
      name: /play g chord \(block\)/i,
    });
    await user.click(chordBlockBtn);
    expect(playChordSpy).toHaveBeenLastCalledWith(
      ["G", "B", "D"],
      expect.objectContaining({ mode: "block" }),
    );

    // Find and click a safe tone button (e.g. note "B", default octave 4)
    const noteBtns = screen.getAllByRole("button", { name: "Play note B" });
    await user.click(noteBtns[0]);
    expect(playNoteSpy).toHaveBeenCalledWith("B", { octave: 4 });
  });

  it("uses the shared playback mode when controlled by SheetView", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const playChordSpy = vi
      .spyOn(sound, "playChord")
      .mockImplementation(() => {});
    render(
      <SecondVoiceView
        analysis={GOLDEN}
        chordPlayback="block"
        onChordPlaybackChange={onChange}
      />,
    );
    expect(screen.getByRole("radio", { name: /block/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.click(
      screen.getByRole("button", { name: /play g chord \(block\)/i }),
    );
    expect(playChordSpy).toHaveBeenLastCalledWith(
      ["G", "B", "D"],
      expect.objectContaining({ mode: "block" }),
    );
    await user.click(screen.getByRole("radio", { name: /strum/i }));
    expect(onChange).toHaveBeenCalledWith("strum");
  });

  it("harmony octave selector shifts Possible Tones table only", async () => {
    const user = userEvent.setup();
    const playNoteSpy = vi
      .spyOn(sound, "playNote")
      .mockImplementation(() => {});
    const playChordSpy = vi
      .spyOn(sound, "playChord")
      .mockImplementation(() => {});
    render(<SecondVoiceView analysis={GOLDEN} />);

    const octave = screen.getByRole("combobox", { name: "Harmony octave" });
    expect(octave).toHaveValue("4");

    // Drop to octave 3: chords + single tones follow.
    await user.selectOptions(octave, "3");
    await user.click(
      screen.getByRole("button", { name: /play g chord \(strum\)/i }),
    );
    expect(playChordSpy).toHaveBeenLastCalledWith(
      ["G", "B", "D"],
      expect.objectContaining({ mode: "strum", baseOctave: 3 }),
    );
    const safeB = screen.getAllByRole("button", { name: "Play note B" });
    await user.click(safeB[0]);
    expect(playNoteSpy).toHaveBeenLastCalledWith("B", { octave: 3 });
    await user.click(screen.getByRole("button", { name: "Play color note D" }));
    expect(playNoteSpy).toHaveBeenLastCalledWith("D", { octave: 3 });

    // Up to octave 5.
    await user.selectOptions(octave, "5");
    await user.click(
      screen.getByRole("button", { name: /play g chord \(strum\)/i }),
    );
    expect(playChordSpy).toHaveBeenLastCalledWith(
      ["G", "B", "D"],
      expect.objectContaining({ mode: "strum", baseOctave: 5 }),
    );
  });
});
