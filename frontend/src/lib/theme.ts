/** Learner appearance choice (contracts/theme.md). Default is dark (dark-first). */
export type ThemePreference = "dark" | "light" | "system";

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "dark";

/** Exact storage key shared by the Layout init script + ThemeToggle island. */
export const THEME_STORAGE_KEY = "music-app-example:theme";

export type EffectiveTheme = "dark" | "light";

/**
 * Stored string → preference (`stored ?? "dark"`).
 * Missing or unknown values resolve to the dark default.
 */
export function resolveTheme(
  stored: string | null | undefined,
): ThemePreference {
  if (stored === "dark" || stored === "light" || stored === "system") {
    return stored;
  }
  return DEFAULT_THEME_PREFERENCE;
}

/** Preference + OS media → concrete appearance (explicit wins, system tracks OS). */
export function effectiveTheme(
  preference: ThemePreference,
  prefersDark: boolean,
): EffectiveTheme {
  if (preference === "system") {
    return prefersDark ? "dark" : "light";
  }
  return preference;
}
