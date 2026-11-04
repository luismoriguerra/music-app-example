// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChordList } from "@/components/ChordList";
import { FILTER_GROUPS, chordDisplayName, type Chord } from "@/lib/chords";

const mk = (
  root: Chord["root"],
  type: Chord["type"],
  rootPitch: number,
  rootAlias?: Chord["rootAlias"],
): Chord => ({
  name: chordDisplayName(root, type, rootAlias),
  type,
  root,
  rootAlias,
  rootPitch,
  topicSlug: "chords",
  diagram: {
    strings: "GCEA",
    frets: [0, 0, 0, 3],
    fingers: [0, 0, 0, 3],
    baseFret: 1,
    barres: [],
  },
});

const chords: Chord[] = [
  mk("C", "major", 0),
  mk("C", "minor", 0),
  mk("Bb", "major", 10, "A#"),
  mk("Bb", "minor", 10, "A#"),
  mk("A", "major", 9),
];

const FULL_ROOTS: Array<{
  root: Chord["root"];
  pitch: number;
  alias?: Chord["rootAlias"];
}> = [
  { root: "C", pitch: 0 },
  { root: "Db", pitch: 1, alias: "C#" },
  { root: "D", pitch: 2 },
  { root: "Eb", pitch: 3, alias: "D#" },
  { root: "E", pitch: 4 },
  { root: "F", pitch: 5 },
  { root: "Gb", pitch: 6, alias: "F#" },
  { root: "G", pitch: 7 },
  { root: "Ab", pitch: 8, alias: "G#" },
  { root: "A", pitch: 9 },
  { root: "Bb", pitch: 10, alias: "A#" },
  { root: "B", pitch: 11 },
];

/** Full 36-entry catalog: 12 pitches × major/minor/diminished. */
const fullLibrary: Chord[] = FULL_ROOTS.flatMap(({ root, pitch, alias }) =>
  (["major", "minor", "diminished"] as const).map((type) =>
    mk(root, type, pitch, alias),
  ),
);

const count = () => screen.getByTestId("visible-count").textContent;
const pillFor = (value: string): HTMLElement => {
  const label = FILTER_GROUPS.flatMap((g) => g.options).find(
    (o) => o.value === value,
  )?.label;
  const pill = screen
    .getAllByRole("radio")
    .find((p) => p.textContent?.startsWith(`${label} (`));
  if (!pill) throw new Error(`no pill for filter value "${value}"`);
  return pill;
};

describe("ChordList island (US3)", () => {
  it("renders one-tap pills with every option + counts (FR-012)", () => {
    render(<ChordList chords={chords} />);
    const group = screen.getByRole("radiogroup", { name: "Filter" });
    expect(group).toHaveAttribute("data-testid", "chord-filter");
    const pills = within(group).getAllByRole("radio");
    expect(pills).toHaveLength(FILTER_GROUPS.flatMap((g) => g.options).length);
    expect(
      within(group).getByRole("radio", { name: "All chords (5)" }),
    ).toBeInTheDocument();
  });

  it("renders a Diminished pill with its count (FR-013)", () => {
    render(<ChordList chords={fullLibrary} />);
    expect(
      within(screen.getByTestId("chord-filter")).getByRole("radio", {
        name: "Diminished (12)",
      }),
    ).toBeInTheDocument();
  });

  it("selecting Diminished shows exactly the 12 diminished entries (FR-013/SC-003)", async () => {
    const user = userEvent.setup();
    render(<ChordList chords={fullLibrary} />);
    expect(count()).toBe("(36)");
    await user.click(pillFor("diminished"));
    expect(count()).toBe("(12)");
    const names = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(names).toHaveLength(12);
    expect(names.every((n) => n!.includes("diminished"))).toBe(true);
  });

  it("filters via pills and restores on All (FR-009/FR-013)", async () => {
    const user = userEvent.setup();
    render(<ChordList chords={chords} />);
    expect(count()).toBe("(5)");

    await user.click(pillFor("major"));
    expect(count()).toBe("(3)");

    await user.click(pillFor("minor"));
    expect(count()).toBe("(2)");

    await user.click(pillFor("Bb"));
    expect(count()).toBe("(2)");
    const viaBb = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);

    await user.click(pillFor("A#"));
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    ).toEqual(viaBb);

    await user.click(pillFor("all"));
    expect(count()).toBe("(5)");
  });

  it("expands one entry in place, collapses on reselect, single-open (FR-010)", async () => {
    const user = userEvent.setup();
    render(<ChordList chords={chords} />);
    const buttons = screen.getAllByRole("button", { expanded: false });
    expect(screen.queryByTestId("chord-detail")).toBeNull();

    await user.click(buttons[0]);
    expect(buttons[0]).toHaveAttribute("aria-expanded", "true");
    const detail = screen.getByTestId("chord-detail");
    expect(detail).toHaveTextContent("Name");
    expect(detail).toHaveTextContent("Type");
    expect(detail).toHaveTextContent("Root");

    await user.click(buttons[1]);
    expect(buttons[0]).toHaveAttribute("aria-expanded", "false");
    expect(buttons[1]).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByTestId("chord-detail")).toHaveLength(1);

    await user.click(buttons[1]);
    expect(screen.queryByTestId("chord-detail")).toBeNull();
  });

  it("is keyboard operable (Enter toggles aria-expanded)", async () => {
    const user = userEvent.setup();
    render(<ChordList chords={chords} />);
    const first = screen.getAllByRole("button", { expanded: false })[0];
    first.focus();
    await user.keyboard("{Enter}");
    expect(first).toHaveAttribute("aria-expanded", "true");
  });

  it("shows empty state + reset path on zero matches (FR-013)", async () => {
    const user = userEvent.setup();
    render(<ChordList chords={[mk("C", "major", 0)]} />);
    await user.click(pillFor("minor"));
    expect(screen.getByText(/no matching chords/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /show all chords/i }));
    expect(count()).toBe("(1)");
  });

  it("shows error state with retry (FR-016)", () => {
    render(<ChordList chords={chords} error="Could not load chords." />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load chords.",
    );
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });

  it("updates within 2s (SC-002 sanity)", async () => {
    const user = userEvent.setup();
    render(<ChordList chords={chords} />);
    const start = performance.now();
    await user.click(pillFor("major"));
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
