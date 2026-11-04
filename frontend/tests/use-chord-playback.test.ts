/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  readChordPlaybackMode,
  useChordPlaybackMode,
} from "../src/lib/use-chord-playback";

const KEY = "second-voice.chordPlayback";

describe("useChordPlaybackMode (shared chord-audio setting)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("reads lazily, defaulting to strum on anything but block", () => {
    expect(readChordPlaybackMode()).toBe("strum");
    window.localStorage.setItem(KEY, "block");
    expect(readChordPlaybackMode()).toBe("block");
    window.localStorage.setItem(KEY, "nonsense");
    expect(readChordPlaybackMode()).toBe("strum");
  });

  it("persists changes to localStorage", () => {
    const { result } = renderHook(() => useChordPlaybackMode());
    expect(result.current[0]).toBe("strum");
    act(() => {
      result.current[1]("block");
    });
    expect(result.current[0]).toBe("block");
    expect(window.localStorage.getItem(KEY)).toBe("block");
  });
});
