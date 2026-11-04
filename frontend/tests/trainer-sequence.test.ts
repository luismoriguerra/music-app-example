import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  sequenceProgress,
  startSequence,
  startStepSequence,
  trainerAudioAvailable,
} from "@/lib/trainer-sequence";
import { midiToFrequency } from "@/lib/sound";

interface FakeVoice {
  frequency: number | null;
  startedAt: number | null;
  stoppedAt: number | null;
  disconnected: boolean;
}

/** Minimal AudioContext double: frozen clock, recorded voices. */
class FakeAudioContext {
  static voices: FakeVoice[] = [];
  readonly state = "running";
  readonly currentTime = 100;
  readonly destination = {};
  createOscillator() {
    const voice: FakeVoice = {
      frequency: null,
      startedAt: null,
      stoppedAt: null,
      disconnected: false,
    };
    FakeAudioContext.voices.push(voice);
    return {
      type: "sine",
      frequency: {
        setValueAtTime: (value: number) => {
          voice.frequency = value;
        },
      },
      connect: () => {},
      start: (when?: number) => {
        voice.startedAt = when ?? this.currentTime;
      },
      stop: (when?: number) => {
        voice.stoppedAt = when ?? this.currentTime;
      },
    };
  }
  createGain() {
    // The sequencer creates one gain per oscillator in order, so the most
    // recent voice owns this gain node.
    const owner =
      FakeAudioContext.voices[FakeAudioContext.voices.length - 1] ?? null;
    return {
      gain: {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      },
      connect: () => {},
      disconnect: () => {
        if (owner) owner.disconnected = true;
      },
    };
  }
}

describe("startSequence without audio (008 FR-008)", () => {
  it("reports audio unavailable and no-ops safely", async () => {
    expect(trainerAudioAvailable()).toBe(false);
    const handle = startSequence([60, 62, 64], { bpm: 120 });
    expect(() => handle.stop()).not.toThrow();
    await expect(handle.finished).resolves.toBeUndefined();
  });
});

describe("startSequence scheduling (008 FR-005/FR-006)", () => {
  beforeEach(() => {
    FakeAudioContext.voices = [];
    vi.stubGlobal("window", { AudioContext: FakeAudioContext });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports audio available once a constructor exists", () => {
    expect(trainerAudioAvailable()).toBe(true);
  });

  it("schedules upfront at stepSeconds = 60 / bpm", () => {
    startSequence([60, 64, 67], { bpm: 120 });
    expect(FakeAudioContext.voices).toHaveLength(3);
    expect(FakeAudioContext.voices.map((v) => v.startedAt)).toEqual([
      100, 100.5, 101,
    ]);
    expect(FakeAudioContext.voices.map((v) => v.frequency)).toEqual([
      midiToFrequency(60),
      midiToFrequency(64),
      midiToFrequency(67),
    ]);
  });

  it("freezes the snapshot at press time", () => {
    const midis = [60, 62];
    startSequence(midis, { bpm: 120 });
    midis.push(99);
    midis[0] = 1;
    expect(FakeAudioContext.voices).toHaveLength(2);
    expect(FakeAudioContext.voices.map((v) => v.frequency)).toEqual([
      midiToFrequency(60),
      midiToFrequency(62),
    ]);
  });

  it("stop() cancels future notes while ringing notes decay", async () => {
    const handle = startSequence([60, 62, 64, 65], { bpm: 120 });
    handle.stop();
    const [first, ...rest] = FakeAudioContext.voices;
    // Started at the frozen now: left ringing with only its scheduled end.
    expect(first?.disconnected).toBe(false);
    expect(first?.stoppedAt).toBeGreaterThan(100);
    // Future notes: stopped immediately and disconnected.
    for (const voice of rest) {
      expect(voice.stoppedAt).toBe(100);
      expect(voice.disconnected).toBe(true);
    }
    await expect(handle.finished).resolves.toBeUndefined();
    expect(() => handle.stop()).not.toThrow();
  });

  it("finished resolves at the natural end of the run", async () => {
    vi.useFakeTimers();
    try {
      const handle = startSequence([60, 62], { bpm: 120 });
      let settled = false;
      void handle.finished.then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await handle.finished;
      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("no-ops on an empty snapshot", async () => {
    const handle = startSequence([], { bpm: 120 });
    handle.stop();
    await expect(handle.finished).resolves.toBeUndefined();
    expect(FakeAudioContext.voices).toHaveLength(0);
  });

  it("sanitizes out-of-range tempos instead of throwing", () => {
    startSequence([60, 62], { bpm: Number.NaN });
    const [first, second] = FakeAudioContext.voices;
    expect((second?.startedAt ?? 0) - (first?.startedAt ?? 0)).toBeCloseTo(
      60 / 84,
      10,
    );
  });

  it("plays up to 240 BPM and trims ringing so fast runs stay distinct", () => {
    startSequence([60, 62], { bpm: 240 });
    const [first, second] = FakeAudioContext.voices;
    expect((second?.startedAt ?? 0) - (first?.startedAt ?? 0)).toBeCloseTo(
      0.25,
      10,
    );
    // Two steps (0.5 s) instead of the full 1.1 s ring.
    expect((first?.stoppedAt ?? 0) - (first?.startedAt ?? 0)).toBeCloseTo(
      0.5,
      10,
    );
  });

  it("keeps the full note ring at slow tempos", () => {
    startSequence([60], { bpm: 60 });
    const [first] = FakeAudioContext.voices;
    expect((first?.stoppedAt ?? 0) - (first?.startedAt ?? 0)).toBeCloseTo(
      1.1,
      10,
    );
  });
});

describe("sequenceProgress (008 FR-006)", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts at 0 and advances one index per step", () => {
    expect(sequenceProgress(9, 1000, 500)).toBe(0);
    vi.mocked(Date.now).mockReturnValue(1400);
    expect(sequenceProgress(9, 1000, 500)).toBe(0);
    vi.mocked(Date.now).mockReturnValue(1600);
    expect(sequenceProgress(9, 1000, 500)).toBe(1);
  });

  it("clamps to the last index past the end and to 0 before the start", () => {
    vi.mocked(Date.now).mockReturnValue(99999);
    expect(sequenceProgress(9, 1000, 500)).toBe(8);
    vi.mocked(Date.now).mockReturnValue(500);
    expect(sequenceProgress(9, 1000, 500)).toBe(0);
  });

  it("returns -1 for an empty run and guards bad step sizes", () => {
    expect(sequenceProgress(0, 1000, 500)).toBe(-1);
    expect(sequenceProgress(9, 1000, 0)).toBe(0);
  });
});

describe("startStepSequence simultaneous voices (013 FR-009)", () => {
  beforeEach(() => {
    FakeAudioContext.voices = [];
    vi.stubGlobal("window", { AudioContext: FakeAudioContext });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sounds every pitch of a beat at one instant and spaces beats by 60 / bpm", () => {
    startStepSequence([[60, 64], [62], []], { bpm: 120 });
    expect(FakeAudioContext.voices.map((v) => v.startedAt)).toEqual([
      100, 100, 100.5,
    ]);
    expect(FakeAudioContext.voices.map((v) => v.frequency)).toEqual([
      midiToFrequency(60),
      midiToFrequency(64),
      midiToFrequency(62),
    ]);
  });

  it("skips a non-finite pitch without silencing its beat-mates", () => {
    startStepSequence([[Number.NaN, 64]], { bpm: 120 });
    expect(FakeAudioContext.voices.map((v) => v.frequency)).toEqual([
      midiToFrequency(64),
    ]);
  });

  it("resolves at once for an empty step list", async () => {
    const handle = startStepSequence([], { bpm: 120 });
    expect(FakeAudioContext.voices).toHaveLength(0);
    await expect(handle.finished).resolves.toBeUndefined();
  });

  it("stop cancels future pitches of a multi-pitch beat and lets ringing ones decay", async () => {
    const handle = startStepSequence(
      [
        [60, 64],
        [62, 65],
      ],
      { bpm: 120 },
    );
    handle.stop();
    // The clock is frozen at 100: beat 0 is already ringing, beat 1 is in the future.
    expect(FakeAudioContext.voices.map((v) => v.disconnected)).toEqual([
      false,
      false,
      true,
      true,
    ]);
    await expect(handle.finished).resolves.toBeUndefined();
  });
});
