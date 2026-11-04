import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_STORAGE_KEY,
  effectiveTheme,
  resolveTheme,
  type ThemePreference,
} from "@/lib/theme";

const CYCLE_ORDER: readonly ThemePreference[] = ["dark", "light", "system"];

const ICONS = { dark: Moon, light: Sun, system: Monitor } as const;

function readStoredPreference(): ThemePreference {
  try {
    return resolveTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

function prefersDarkOS(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function applyPreference(preference: ThemePreference): void {
  const dark = effectiveTheme(preference, prefersDarkOS()) === "dark";
  document.documentElement.classList.toggle("dark", dark);
}

/**
 * Theme island (FR-001/FR-003): cycles dark → light → system, persists
 * every change, and applies the effective appearance immediately.
 * Renders the dark default on the server; stored choice syncs on mount.
 */
export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>(
    DEFAULT_THEME_PREFERENCE,
  );

  useEffect(() => {
    setPreference(readStoredPreference());
  }, []);

  useEffect(() => {
    applyPreference(preference);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Private mode: appearance still applies for this session.
    }
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyPreference(preference);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const Icon = ICONS[preference];
  const next =
    CYCLE_ORDER[(CYCLE_ORDER.indexOf(preference) + 1) % CYCLE_ORDER.length] ??
    DEFAULT_THEME_PREFERENCE;

  return (
    <button
      type="button"
      aria-label={`Theme: ${preference} (activate for ${next})`}
      title={`Theme: ${preference}`}
      onClick={() => setPreference(next)}
      className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors"
    >
      <Icon aria-hidden="true" className="size-5" />
    </button>
  );
}

export default ThemeToggle;
