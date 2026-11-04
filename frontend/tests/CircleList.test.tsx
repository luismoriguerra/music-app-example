// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CircleList } from "@/components/CircleList";
import { CIRCLE_FILTER_GROUPS } from "@/lib/circles";
import type { Chord, Progression } from "@/lib/content/schemas";

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
    name: "Circle in F — meeting B flat",
    key: "F",
    type: "major",
    degrees: ["I", "vi", "IV", "V"],
    chords: ["F major", "D minor", "Bb / A# major", "C major"],
  },
];

const makeChord = (
  name: string,
  type: Chord["type"] = "major",
  rootPitch = 0,
): Chord => ({
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

/** C-major diatonic set + the G/F progression extras. */
const library: Chord[] = [
  makeChord("C major", "major", 0),
  makeChord("D minor", "minor", 2),
  makeChord("E minor", "minor", 4),
  makeChord("F major", "major", 5),
  makeChord("G major", "major", 7),
  makeChord("A minor", "minor", 9),
  makeChord("B diminished", "diminished", 11),
  makeChord("D major", "major", 2),
  makeChord("Bb / A# major", "major", 10),
  makeChord("B major", "major", 11),
];

const count = () => screen.getByTestId("visible-count").textContent;
const pillFor = (value: string): HTMLElement => {
  const label = CIRCLE_FILTER_GROUPS.flatMap((g) => g.options).find(
    (o) => o.value === value,
  )?.label;
  const pill = screen
    .getAllByRole("radio")
    .find((p) => p.textContent?.startsWith(`${label} (`));
  if (!pill) throw new Error(`no pill for filter value "${value}"`);
  return pill;
};

describe("CircleList explorer (US1)", () => {
  it("renders every circle name from props with a count badge (FR-001)", () => {
    render(<CircleList circles={circles} chords={library} />);
    expect(count()).toBe("(3)");
    for (const circle of circles) {
      expect(
        screen.getByRole("heading", { level: 3, name: circle.name }),
      ).toBeInTheDocument();
    }
  });

  it("lists key, type, and progression per circle (FR-005)", () => {
    render(<CircleList circles={circles} chords={library} />);
    const list = screen.getByTestId("circle-list");
    expect(within(list).getByText(/Key of C/)).toBeInTheDocument();
    expect(within(list).getAllByText(/Major/)).toHaveLength(3);
    expect(within(list).getAllByText(/I – vi – IV – V/)).toHaveLength(3);
  });

  it("renders one-tap pills with every option + counts (FR-012)", () => {
    render(<CircleList circles={circles} chords={library} />);
    const group = screen.getByRole("radiogroup", { name: "Filter" });
    expect(group).toHaveAttribute("data-testid", "circle-filter");
    const pills = within(group).getAllByRole("radio");
    expect(pills).toHaveLength(
      CIRCLE_FILTER_GROUPS.flatMap((g) => g.options).length,
    );
    expect(
      within(group).getByRole("radio", { name: "All circles (3)" }),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("radio", { name: "Major (3)" }),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("radio", { name: "Bb (0)" }),
    ).toBeInTheDocument();
  });

  it("filters by type and note, restores on All (FR-002/FR-003)", async () => {
    const user = userEvent.setup();
    render(<CircleList circles={circles} chords={library} />);

    await user.click(pillFor("major"));
    expect(count()).toBe("(3)");

    await user.click(pillFor("minor"));
    expect(screen.getByText(/no matching circles/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /show all circles/i }));
    expect(count()).toBe("(3)");

    await user.click(pillFor("F"));
    expect(count()).toBe("(1)");
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Circle in F — meeting B flat",
      }),
    ).toBeInTheDocument();

    // Enharmonic spellings list identical results.
    await user.click(pillFor("Gb"));
    expect(count()).toBe("(0)");
    await user.click(pillFor("F#"));
    expect(count()).toBe("(0)");

    await user.click(pillFor("all"));
    expect(count()).toBe("(3)");
  });

  it("shows empty state with reset path when nothing matches (FR-015)", async () => {
    const user = userEvent.setup();
    render(<CircleList circles={[]} chords={library} />);
    expect(screen.getByText(/no matching circles/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /show all circles/i }));
    expect(screen.getByText(/no matching circles/i)).toBeInTheDocument();
  });

  it("shows error state with retry (FR-015)", () => {
    render(
      <CircleList
        circles={circles}
        chords={library}
        error="Could not load circles."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load circles.",
    );
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });

  it("updates within 2s (SC-006 sanity)", async () => {
    const user = userEvent.setup();
    render(<CircleList circles={circles} chords={library} />);
    const start = performance.now();
    await user.click(pillFor("F"));
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

describe("CircleList focus detail (US1)", () => {
  it("opens a full-width detail hiding list + filter; back restores (FR-004)", async () => {
    const user = userEvent.setup();
    render(<CircleList circles={circles} chords={library} />);
    // Sorted C, F, G — open the C circle.
    await user.click(
      screen.getByRole("button", {
        name: /Circle in C — the 50s progression/,
      }),
    );
    expect(screen.queryByTestId("circle-list")).toBeNull();
    expect(screen.queryByTestId("circle-filter")).toBeNull();
    const detail = screen.getByTestId("circle-detail");
    expect(detail).toHaveClass("w-full");
    expect(
      within(detail).getByRole("heading", {
        level: 2,
        name: "Circle in C — the 50s progression",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("circle-back"));
    expect(screen.getByTestId("circle-list")).toBeInTheDocument();
    expect(screen.getByTestId("circle-filter")).toBeInTheDocument();
    expect(screen.queryByTestId("circle-detail")).toBeNull();
  });

  it("shows key, type, progression, and scale notes (FR-005/FR-006)", async () => {
    const user = userEvent.setup();
    render(<CircleList circles={circles} chords={library} />);
    await user.click(
      screen.getByRole("button", {
        name: /Circle in C — the 50s progression/,
      }),
    );
    const detail = screen.getByTestId("circle-detail");
    expect(detail).toHaveTextContent("Key of C");
    expect(detail).toHaveTextContent("Major");
    expect(detail).toHaveTextContent("I – vi – IV – V");
    expect(detail).toHaveTextContent("C D E F G A B");
  });

  it("renders seven diatonic rows with degrees, notes, chords, diagrams (FR-007)", async () => {
    const user = userEvent.setup();
    render(<CircleList circles={circles} chords={library} />);
    await user.click(
      screen.getByRole("button", {
        name: /Circle in C — the 50s progression/,
      }),
    );
    const detail = screen.getByTestId("circle-detail");
    const rows = within(detail).getAllByTestId("diatonic-row");
    expect(rows).toHaveLength(7);
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("I"),
      expect.stringContaining("ii"),
      expect.stringContaining("iii"),
      expect.stringContaining("IV"),
      expect.stringContaining("V"),
      expect.stringContaining("vi"),
      expect.stringContaining("vii°"),
    ]);
    for (const name of [
      "C major",
      "D minor",
      "E minor",
      "F major",
      "G major",
      "A minor",
      "B diminished",
    ]) {
      expect(within(detail).getByText(name)).toBeInTheDocument();
    }
    expect(within(detail).getAllByTestId("chord-diagram")).toHaveLength(7);
  });

  it("marks exactly the progression chords in-circle (FR-010)", async () => {
    const user = userEvent.setup();
    render(<CircleList circles={circles} chords={library} />);
    await user.click(
      screen.getByRole("button", {
        name: /Circle in C — the 50s progression/,
      }),
    );
    const detail = screen.getByTestId("circle-detail");
    expect(within(detail).getAllByText("In this circle")).toHaveLength(4);
  });

  it("renders the 12-fret neck reference without order badges (FR-011)", async () => {
    const user = userEvent.setup();
    render(<CircleList circles={circles} chords={library} />);
    await user.click(
      screen.getByRole("button", {
        name: /Circle in C — the 50s progression/,
      }),
    );
    const detail = screen.getByTestId("circle-detail");
    expect(detail).toHaveTextContent("Neck reference");
    expect(within(detail).getByTestId("scale-neck")).toBeInTheDocument();
  });

  it("shows both spellings when they differ: Cb note + B major chord (FR-009)", async () => {
    const user = userEvent.setup();
    const gb: Progression = {
      name: "Circle in Gb",
      key: "Gb",
      type: "major",
      degrees: ["I", "vi", "IV", "V"],
      chords: ["Gb major", "Eb minor", "B major", "Db major"],
    };
    render(<CircleList circles={[gb]} chords={library} />);
    await user.click(screen.getByRole("button", { name: /Circle in Gb/ }));
    const detail = screen.getByTestId("circle-detail");
    expect(detail).toHaveTextContent("Key of Gb / F#");
    const rows = within(detail).getAllByTestId("diatonic-row");
    expect(rows[3]).toHaveTextContent("Cb");
    expect(rows[3]).toHaveTextContent("B major");
  });

  it("preserves the filter across open and back (FR-004)", async () => {
    const user = userEvent.setup();
    render(<CircleList circles={circles} chords={library} />);
    await user.click(pillFor("F"));
    await user.click(
      screen.getByRole("button", { name: /Circle in F — meeting B flat/ }),
    );
    await user.click(screen.getByTestId("circle-back"));
    expect(count()).toBe("(1)");
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Circle in F — meeting B flat",
      }),
    ).toBeInTheDocument();
  });

  it("is keyboard operable (Enter opens, Escape closes)", async () => {
    const user = userEvent.setup();
    render(<CircleList circles={circles} chords={library} />);
    const first = screen.getAllByRole("button")[0];
    first.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("circle-detail")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.getByTestId("circle-list")).toBeInTheDocument();
    expect(screen.queryByTestId("circle-detail")).toBeNull();
  });

  it("renders null-chord rows with a placeholder beside intact labels", async () => {
    const user = userEvent.setup();
    const sparse = library.filter((c) => c.name !== "B diminished");
    render(<CircleList circles={circles} chords={sparse} />);
    await user.click(
      screen.getByRole("button", {
        name: /Circle in C — the 50s progression/,
      }),
    );
    const detail = screen.getByTestId("circle-detail");
    const rows = within(detail).getAllByTestId("diatonic-row");
    expect(rows).toHaveLength(7);
    expect(rows[6]).toHaveTextContent("vii°");
    expect(rows[6]).toHaveTextContent("Diagram unavailable.");
    expect(within(detail).getAllByTestId("chord-diagram")).toHaveLength(6);
  });

  it("stacks the diatonic table to one column at 360px (SC-007)", async () => {
    const user = userEvent.setup();
    render(<CircleList circles={circles} chords={library} />);
    await user.click(
      screen.getByRole("button", {
        name: /Circle in C — the 50s progression/,
      }),
    );
    const detail = screen.getByTestId("circle-detail");
    expect(detail).toHaveClass("max-w-full");
    const rows = within(detail).getAllByTestId("diatonic-row");
    for (const row of rows) {
      for (const cell of within(row).getAllByRole("cell")) {
        expect(cell).toHaveClass("block");
      }
    }
  });
});
