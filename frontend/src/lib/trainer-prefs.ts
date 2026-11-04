/**
 * Persisted trainer settings shared by the 1st-voice and 2nd-voice trainers
 * (008 T022, 013 FR-011): the last-used tempo and the Loop round count. One
 * owner for the storage keys, defaults, and parsing. Storage access is
 * best-effort: a blocked or unreadable store falls back to the defaults and
 * never throws. Zero UI imports (Principle VIII).
 */
export const DEFAULT_BPM = 84;
export const TRAINER_BPM_STORAGE_KEY = "trainer.bpm";

/** Round counts the Loop action offers (FR-005 amendment); first = default. */
export const LOOP_OPTIONS = [3, 5, 6] as const;
export type LoopCount = (typeof LOOP_OPTIONS)[number];
export const DEFAULT_LOOP_COUNT: LoopCount = 3;
export const TRAINER_LOOPS_STORAGE_KEY = "trainer.loops";

export function isLoopCount(value: number): value is LoopCount {
  return (LOOP_OPTIONS as readonly number[]).includes(value);
}

/** Last-used tempo, mirroring the chordMode persistence in SheetView. */
export function readPersistedBpm(fallback: number): number {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(TRAINER_BPM_STORAGE_KEY);
    if (raw === null) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function persistBpm(bpm: number): void {
  try {
    window.localStorage.setItem(TRAINER_BPM_STORAGE_KEY, String(bpm));
  } catch {
    // Private mode / denied storage: the in-memory tempo still works.
  }
}

/**
 * Last-used loop round count; a missing, blocked, or unoffered value yields
 * `fallback` (the default at mount, the in-memory choice when re-reading).
 */
export function readPersistedLoopCount(
  fallback: LoopCount = DEFAULT_LOOP_COUNT,
): LoopCount {
  try {
    if (typeof window === "undefined") return fallback;
    const parsed = Number(
      window.localStorage.getItem(TRAINER_LOOPS_STORAGE_KEY),
    );
    return isLoopCount(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function persistLoopCount(count: LoopCount): void {
  try {
    window.localStorage.setItem(TRAINER_LOOPS_STORAGE_KEY, String(count));
  } catch {
    // Private mode / denied storage: the in-memory count still works.
  }
}
