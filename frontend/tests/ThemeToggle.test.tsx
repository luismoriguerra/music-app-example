// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "@/components/ThemeToggle";
import { THEME_STORAGE_KEY } from "@/lib/theme";

type MediaListener = (event: { matches: boolean }) => void;

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<MediaListener>();
  const mql = {
    matches,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_type: string, cb: MediaListener) => {
      listeners.add(cb);
    },
    removeEventListener: (_type: string, cb: MediaListener) => {
      listeners.delete(cb);
    },
    dispatch: (next: boolean) => {
      mql.matches = next;
      for (const cb of listeners) cb({ matches: next });
    },
  };
  window.matchMedia = vi.fn().mockReturnValue(mql);
  return mql;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  mockMatchMedia(false);
});

describe("ThemeToggle island (FR-001/FR-003)", () => {
  it("defaults to dark with nothing stored and applies .dark", async () => {
    render(<ThemeToggle />);
    const button = await screen.findByRole("button", { name: /theme: dark/i });
    expect(button).toBeInTheDocument();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("honors a stored value on mount", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    render(<ThemeToggle />);
    await screen.findByRole("button", { name: /theme: light/i });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("cycles dark -> light -> system, persisting every change", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const button = await screen.findByRole("button", { name: /theme: dark/i });

    await user.click(button);
    expect(button).toHaveAccessibleName(/theme: light/i);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await user.click(button);
    expect(button).toHaveAccessibleName(/theme: system/i);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await user.click(button);
    expect(button).toHaveAccessibleName(/theme: dark/i);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("tracks the OS preference while set to system", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "system");
    const mql = mockMatchMedia(true);
    render(<ThemeToggle />);
    await screen.findByRole("button", { name: /theme: system/i });
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    mql.dispatch(false);
    await screen.findByRole("button", { name: /theme: system/i });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("is keyboard-operable", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const button = await screen.findByRole("button", { name: /theme: dark/i });
    button.focus();
    await user.keyboard("{Enter}");
    expect(button).toHaveAccessibleName(/theme: light/i);
  });

  it("exposes a 44px+ target", async () => {
    render(<ThemeToggle />);
    const button = await screen.findByRole("button", { name: /theme/i });
    expect(button.className).toContain("size-11");
  });
});
