// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChordList } from "@/components/ChordList";
import { CircleList } from "@/components/CircleList";
import { ScaleList } from "@/components/ScaleList";
import {
  FILTER_GROUPS,
  chordDisplayName,
  filterChords,
  type Chord,
} from "@/lib/chords";
import {
  CIRCLE_FILTER_GROUPS,
  filterCircles,
  type CircleFilter,
} from "@/lib/circles";
import {
  SCALE_FILTER_GROUPS,
  filterScales,
  scaleSpelling,
  type Scale,
  type ScaleFilterOption,
} from "@/lib/scales";
import type { Chord as SchemaChord, Progression } from "@/lib/content/schemas";

// --- Fixtures (mirror tests/ChordList.test.tsx + ScaleList.test.tsx shapes) ---

const mkChord = (
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
  mkChord("C", "major", 0),
  mkChord("C", "minor", 0),
  mkChord("Bb", "major", 10, "A#"),
  mkChord("Bb", "minor", 10, "A#"),
  mkChord("A", "major", 9),
];

const circles: Progression[] = [
  {
    name: "Circle in C — the 50s progression",
    key: "C",
    type: "major",
    degrees: ["I", "vi", "IV", "V"],
    chords: ["C major", "A minor", "F major", "G major"],
  },
  {
    name: "Circle in G — the singing key",
    key: "G",
    type: "major",
    degrees: ["I", "vi", "IV", "V"],
    chords: ["G major", "E minor", "C major", "D major"],
  },
  {
    name: "Circle in A minor — the relative",
    key: "A",
    type: "minor",
    degrees: ["i", "VII", "VI", "VII"],
    chords: ["A minor", "G major", "F major", "G major"],
  },
];

const makeLibraryChord = (
  name: string,
  type: SchemaChord["type"] = "major",
  rootPitch = 0,
): SchemaChord => ({
  name,
  type,
  root: "C",
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

const library: SchemaChord[] = [
  makeLibraryChord("C major", "major", 0),
  makeLibraryChord("D minor", "minor", 2),
  makeLibraryChord("E minor", "minor", 4),
  makeLibraryChord("F major", "major", 5),
  makeLibraryChord("G major", "major", 7),
  makeLibraryChord("A minor", "minor", 9),
  makeLibraryChord("B diminished", "diminished", 11),
];

const mkScale = (
  name: string,
  root: Scale["root"],
  type: Scale["type"],
  rootPitch: number,
  rootAlias?: Scale["rootAlias"],
): Scale => {
  const { displaySpelling, notes } = scaleSpelling(rootPitch, type);
  return {
    name,
    type,
    root,
    rootAlias,
    rootPitch,
    topicSlug: "scales",
    notes: [...notes],
    degrees: ["1", "2", "3", "4", "5", "6", "7", "8"],
    intervals: type === "major" ? "W-W-H-W-W-W-H" : "W-H-W-W-H-W-W",
    displaySpelling,
    diagram: {
      strings: "GCEA",
      positions: [1, 2, 3, 4, 5, 6, 7, 8].map((order) => ({
        string: 1,
        fret: 0,
        order,
        finger: 0,
      })),
      baseFret: 1,
      positionLabel: "fixture",
    },
  };
};

const scales: Scale[] = [
  mkScale("C major", "C", "major", 0),
  mkScale("C minor", "C", "minor", 0),
  mkScale("Bb / A# major", "Bb", "major", 10, "A#"),
  mkScale("Bb / A# minor", "Bb", "minor", 10, "A#"),
  mkScale("A major", "A", "major", 9),
];

const count = () => screen.getByTestId("visible-count").textContent;
const headings = () =>
  screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

describe("RockstarExplorers: pills replace select (FR-012)", () => {
  it("ChordList renders FilterPills with every option + counts, no select", () => {
    const { container } = render(<ChordList chords={chords} />);
    expect(container.querySelector("select")).toBeNull();
    const group = screen.getByRole("radiogroup", { name: "Filter" });
    expect(group).toHaveAttribute("data-testid", "chord-filter");
    const pills = within(group).getAllByRole("radio");
    const expected = FILTER_GROUPS.flatMap((g) => g.options);
    expect(pills).toHaveLength(expected.length);
    expect(
      within(group).getByRole("radio", { name: "All chords (5)" }),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("radio", {
        name: `Major (${filterChords(chords, "major").length})`,
      }),
    ).toBeInTheDocument();
  });

  it("CircleList renders FilterPills with every option + counts, no select", () => {
    const { container } = render(
      <CircleList circles={circles} chords={library} />,
    );
    expect(container.querySelector("select")).toBeNull();
    const group = screen.getByRole("radiogroup", { name: "Filter" });
    expect(group).toHaveAttribute("data-testid", "circle-filter");
    const pills = within(group).getAllByRole("radio");
    const expected = CIRCLE_FILTER_GROUPS.flatMap((g) => g.options);
    expect(pills).toHaveLength(expected.length);
    expect(
      within(group).getByRole("radio", { name: "All circles (3)" }),
    ).toBeInTheDocument();
  });

  it("ScaleList renders FilterPills with every option + counts, no select", () => {
    const { container } = render(<ScaleList scales={scales} />);
    expect(container.querySelector("select")).toBeNull();
    const group = screen.getByRole("radiogroup", { name: "Filter" });
    expect(group).toHaveAttribute("data-testid", "scale-filter");
    const pills = within(group).getAllByRole("radio");
    const expected = SCALE_FILTER_GROUPS.flatMap((g) => g.options);
    expect(pills).toHaveLength(expected.length);
    expect(
      within(group).getByRole("radio", { name: "All scales (5)" }),
    ).toBeInTheDocument();
  });
});

describe("RockstarExplorers: filter semantics unchanged (FR-013)", () => {
  it("chord pills filter via filterChords; All restores default order", async () => {
    const user = userEvent.setup();
    render(<ChordList chords={chords} />);
    const initial = headings();

    for (const value of ["major", "minor", "Bb", "A#"] as const) {
      const n = filterChords(chords, value).length;
      const label = FILTER_GROUPS.flatMap((g) => g.options).find(
        (o) => o.value === value,
      )?.label;
      await user.click(screen.getByRole("radio", { name: `${label} (${n})` }));
      expect(count()).toBe(`(${n})`);
    }

    await user.click(screen.getByRole("radio", { name: "All chords (5)" }));
    expect(count()).toBe("(5)");
    expect(headings()).toEqual(initial);
  });

  it("circle pills filter via filterCircles; All restores default order", async () => {
    const user = userEvent.setup();
    render(<CircleList circles={circles} chords={library} />);
    const initial = headings();

    const major = filterCircles(circles, "major" as CircleFilter);
    await user.click(
      screen.getByRole("radio", {
        name: new RegExp(`Major \\(${major.length}\\)`),
      }),
    );
    expect(count()).toBe(`(${major.length})`);

    const minor = filterCircles(circles, "minor" as CircleFilter);
    await user.click(
      screen.getByRole("radio", {
        name: new RegExp(`Minor \\(${minor.length}\\)`),
      }),
    );
    expect(count()).toBe(`(${minor.length})`);

    await user.click(screen.getByRole("radio", { name: "All circles (3)" }));
    expect(count()).toBe("(3)");
    expect(headings()).toEqual(initial);
  });

  it("scale pills filter via filterScales; All restores default order", async () => {
    const user = userEvent.setup();
    render(<ScaleList scales={scales} />);
    const initial = headings();

    const major = filterScales(scales, "major" as ScaleFilterOption);
    await user.click(
      screen.getByRole("radio", {
        name: new RegExp(`Major \\(${major.length}\\)`),
      }),
    );
    expect(count()).toBe(`(${major.length})`);

    await user.click(screen.getByRole("radio", { name: "All scales (5)" }));
    expect(count()).toBe("(5)");
    expect(headings()).toEqual(initial);
  });
});

describe("RockstarExplorers: detail + back preserves filter (FR-014)", () => {
  it("chord entry expands inline with detail content", async () => {
    const user = userEvent.setup();
    render(<ChordList chords={chords} />);
    await user.click(screen.getByRole("radio", { name: /Minor \(\d+\)/ }));
    const entry = screen.getAllByRole("button", { expanded: false })[0];
    await user.click(entry);
    expect(screen.getByTestId("chord-detail")).toHaveTextContent("Name");
    expect(count()).toBe(`(${filterChords(chords, "minor").length})`);
  });

  it("circle open → labeled back preserves filter", async () => {
    const user = userEvent.setup();
    render(<CircleList circles={circles} chords={library} />);
    await user.click(screen.getByRole("radio", { name: /Major \(\d+\)/ }));
    const before = count();
    await user.click(
      screen.getByRole("heading", { level: 3, name: circles[0].name }),
    );
    expect(screen.getByTestId("circle-detail")).toBeInTheDocument();
    const back = screen.getByTestId("circle-back");
    expect(back).toHaveAccessibleName(/back to all circles/i);
    await user.click(back);
    expect(screen.getByTestId("circle-list")).toBeInTheDocument();
    expect(count()).toBe(before);
    expect(
      screen.getByRole("radio", { name: /Major \(\d+\)/ }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("scale open → labeled back preserves filter", async () => {
    const user = userEvent.setup();
    render(<ScaleList scales={scales} />);
    await user.click(screen.getByRole("radio", { name: /Major \(\d+\)/ }));
    const before = count();
    await user.click(
      screen.getByRole("heading", { level: 3, name: "C major" }),
    );
    expect(screen.getByTestId("scale-detail")).toBeInTheDocument();
    const back = screen.getByTestId("scale-back");
    expect(back).toHaveAccessibleName(/back to all scales/i);
    await user.click(back);
    expect(screen.getByTestId("scale-list")).toBeInTheDocument();
    expect(count()).toBe(before);
    expect(
      screen.getByRole("radio", { name: /Major \(\d+\)/ }),
    ).toHaveAttribute("aria-checked", "true");
  });
});

describe("RockstarExplorers: 44px+ pills and rows (FR-018)", () => {
  it("pills and entry rows meet the touch target", () => {
    render(<ChordList chords={chords} />);
    for (const pill of screen.getAllByRole("radio")) {
      expect((pill as HTMLElement).className).toContain("min-h-11");
    }
    const rows = screen.getAllByRole("button", { expanded: false });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect((row as HTMLElement).className).toContain("min-h-11");
    }
  });
});
