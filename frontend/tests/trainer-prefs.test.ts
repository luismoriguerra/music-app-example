// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  persistBpm,
  persistLoopCount,
  readPersistedBpm,
  readPersistedLoopCount,
  TRAINER_BPM_STORAGE_KEY,
  TRAINER_LOOPS_STORAGE_KEY,
} from "@/lib/trainer-prefs";

describe("trainer prefs (008 T022, 013 FR-011)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("returns the caller's fallback tempo when nothing is stored", () => {
    expect(readPersistedBpm(120)).toBe(120);
  });

  it("round-trips the tempo through the shared key", () => {
    persistBpm(132);
    expect(window.localStorage.getItem(TRAINER_BPM_STORAGE_KEY)).toBe("132");
    expect(readPersistedBpm(120)).toBe(132);
  });

  it("returns the fallback when the stored tempo is not a number", () => {
    window.localStorage.setItem(TRAINER_BPM_STORAGE_KEY, "fast");
    expect(readPersistedBpm(120)).toBe(120);
  });

  it("defaults the loop count to 3 when nothing is stored (FR-005a)", () => {
    expect(readPersistedLoopCount()).toBe(3);
  });

  it("round-trips an offered loop count through the shared key", () => {
    persistLoopCount(5);
    expect(window.localStorage.getItem(TRAINER_LOOPS_STORAGE_KEY)).toBe("5");
    expect(readPersistedLoopCount()).toBe(5);
  });

  it("falls back to the default loop count for a count outside the options", () => {
    window.localStorage.setItem(TRAINER_LOOPS_STORAGE_KEY, "4");
    expect(readPersistedLoopCount()).toBe(3);
  });

  it("returns the caller's loop count when nothing is stored", () => {
    expect(readPersistedLoopCount(6)).toBe(6);
  });

  it("keeps the caller's loop count when storage is blocked", () => {
    const blocked = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    try {
      expect(readPersistedLoopCount(5)).toBe(5);
    } finally {
      blocked.mockRestore();
    }
  });
});
