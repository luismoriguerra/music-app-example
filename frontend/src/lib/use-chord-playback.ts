import { useEffect, useState } from "react";
import type { ChordPlaybackMode } from "./sound";

const STORAGE_KEY = "second-voice.chordPlayback";

/**
 * Reads the persisted chord playback mode. Anything but "block" (including
 * missing storage, SSR, or denied access) falls back to the strum default.
 */
export function readChordPlaybackMode(): ChordPlaybackMode {
  try {
    if (typeof window === "undefined") return "strum";
    return window.localStorage.getItem(STORAGE_KEY) === "block"
      ? "block"
      : "strum";
  } catch {
    return "strum";
  }
}

/**
 * Shared chord playback setting (strum default, block opt-in), persisted to
 * localStorage so the choice survives reloads. Own it once in SheetViewInner
 * and pass it down to the sheet chords and the analysis table — never mount
 * it twice (two instances would diverge within the same tab).
 */
export function useChordPlaybackMode(): [
  ChordPlaybackMode,
  (mode: ChordPlaybackMode) => void,
] {
  const [mode, setMode] = useState<ChordPlaybackMode>(readChordPlaybackMode);
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Private mode / denied storage: the in-memory choice still works.
    }
  }, [mode]);
  return [mode, setMode];
}
