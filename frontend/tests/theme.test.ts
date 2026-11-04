import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_STORAGE_KEY,
  effectiveTheme,
  resolveTheme,
  type ThemePreference,
} from "@/lib/theme";

describe("ThemePreference type (contracts/theme.md)", () => {
  it("is exactly dark | light | system", () => {
    const all: ThemePreference[] = ["dark", "light", "system"];
    expect(all).toHaveLength(3);
  });

  it("defaults to dark (dark-first per spec Assumptions)", () => {
    expect(DEFAULT_THEME_PREFERENCE).toBe("dark");
  });
});

describe("THEME_STORAGE_KEY", () => {
  it("is exactly music-app-example:theme", () => {
    expect(THEME_STORAGE_KEY).toBe("music-app-example:theme");
  });
});

describe("resolveTheme (stored -> preference)", () => {
  it("resolves null/undefined to the dark default", () => {
    expect(resolveTheme(null)).toBe("dark");
    expect(resolveTheme(undefined)).toBe("dark");
  });

  it("keeps valid stored preferences", () => {
    expect(resolveTheme("dark")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("system")).toBe("system");
  });

  it("falls back to dark on unknown stored values", () => {
    expect(resolveTheme("midnight")).toBe("dark");
    expect(resolveTheme("")).toBe("dark");
  });
});

describe("effectiveTheme (preference + media -> dark | light)", () => {
  it("tracks the OS when preference is system", () => {
    expect(effectiveTheme("system", true)).toBe("dark");
    expect(effectiveTheme("system", false)).toBe("light");
  });

  it("lets explicit dark/light win over media", () => {
    expect(effectiveTheme("dark", false)).toBe("dark");
    expect(effectiveTheme("dark", true)).toBe("dark");
    expect(effectiveTheme("light", true)).toBe("light");
    expect(effectiveTheme("light", false)).toBe("light");
  });
});
