// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScaleList } from "@/components/ScaleList";
import { SCALE_FILTER_GROUPS, scaleSpelling, type Scale } from "@/lib/scales";

export const mkScale = (
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

export const scales: Scale[] = [
  mkScale("C major", "C", "major", 0),
  mkScale("C minor", "C", "minor", 0),
  mkScale("Bb / A# major", "Bb", "major", 10, "A#"),
  mkScale("Bb / A# minor", "Bb", "minor", 10, "A#"),
  mkScale("A major", "A", "major", 9),
];

const count = () => screen.getByTestId("visible-count").textContent;
const pillFor = (value: string): HTMLElement => {
  const label = SCALE_FILTER_GROUPS.flatMap((g) => g.options).find(
    (o) => o.value === value,
  )?.label;
  const pill = screen
    .getAllByRole("radio")
    .find((p) => p.textContent?.startsWith(`${label} (`));
  if (!pill) throw new Error(`no pill for filter value "${value}"`);
  return pill;
};

describe("ScaleList island skeleton (US1)", () => {
  it("renders every scale name from props with a count badge", () => {
    render(<ScaleList scales={scales} />);
    expect(count()).toBe("(5)");
    for (const s of scales) {
      expect(
        screen.getByRole("heading", { level: 3, name: s.name }),
      ).toBeInTheDocument();
    }
  });

  it("shows a friendly empty state for zero scales (FR-014)", () => {
    render(<ScaleList scales={[]} />);
    expect(screen.getByText(/no scales/i)).toBeInTheDocument();
  });

  it("shows an error state with retry (FR-014)", () => {
    render(<ScaleList scales={scales} error="Could not load scales." />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load scales.",
    );
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });
});

describe("ScaleList filtering (US2)", () => {
  it("renders one-tap pills with every option + counts (FR-012)", () => {
    render(<ScaleList scales={scales} />);
    const group = screen.getByRole("radiogroup", { name: "Filter" });
    expect(group).toHaveAttribute("data-testid", "scale-filter");
    const pills = within(group).getAllByRole("radio");
    expect(pills).toHaveLength(
      SCALE_FILTER_GROUPS.flatMap((g) => g.options).length,
    );
    expect(
      within(group).getByRole("radio", { name: "All scales (5)" }),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("radio", { name: "Bb (2)" }),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("radio", { name: "A# (2)" }),
    ).toBeInTheDocument();
  });

  it("filters via pills and restores on All (FR-005/FR-013)", async () => {
    const user = userEvent.setup();
    render(<ScaleList scales={scales} />);
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

  it("defaults to alphabetical major-first order (FR-010)", () => {
    render(<ScaleList scales={scales} />);
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    ).toEqual([
      "A major",
      "Bb / A# major",
      "Bb / A# minor",
      "C major",
      "C minor",
    ]);
  });

  it("shows empty state + reset path on zero matches (FR-012)", async () => {
    const user = userEvent.setup();
    render(<ScaleList scales={[scales[0]]} />);
    await user.click(pillFor("minor"));
    expect(screen.getByText(/no matching scales/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /show all scales/i }));
    expect(count()).toBe("(1)");
  });

  it("updates within 2s (SC-002 sanity)", async () => {
    const user = userEvent.setup();
    render(<ScaleList scales={scales} />);
    const start = performance.now();
    await user.click(pillFor("major"));
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

describe("ScaleList focus detail (US3)", () => {
  it("opens a full-width detail hiding all others; back restores the list (FR-006)", async () => {
    const user = userEvent.setup();
    render(<ScaleList scales={scales} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(5);
    expect(screen.queryByTestId("scale-detail")).toBeNull();

    await user.click(buttons[3]);
    // others hidden: list + filter gone, single full-width detail shown
    expect(screen.queryByTestId("scale-list")).toBeNull();
    expect(screen.queryByTestId("scale-filter")).toBeNull();
    expect(
      screen.queryByRole("heading", { level: 3, name: "A major" }),
    ).toBeNull();
    const detail = screen.getByTestId("scale-detail");
    expect(detail).toHaveClass("w-full");
    expect(detail).toHaveTextContent("C major");
    expect(detail).toHaveTextContent("major");
    expect(detail).toHaveTextContent("C");
    expect(detail).toHaveTextContent("C D E F G A B C");
    expect(detail).toHaveTextContent("W-W-H-W-W-W-H");
    expect(within(detail).getByTestId("scale-diagram")).toBeInTheDocument();
    expect(within(detail).getByTestId("scale-neck")).toBeInTheDocument();

    await user.click(screen.getByTestId("scale-back"));
    expect(screen.getByTestId("scale-list")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.queryByTestId("scale-detail")).toBeNull();
  });

  it("is keyboard operable (Enter opens, Escape closes)", async () => {
    const user = userEvent.setup();
    render(<ScaleList scales={scales} />);
    const first = screen.getAllByRole("button")[0];
    first.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("scale-detail")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.getByTestId("scale-list")).toBeInTheDocument();
    expect(screen.queryByTestId("scale-detail")).toBeNull();
  });

  it("shows a placeholder beside intact notes when the diagram is missing (FR-015)", async () => {
    const user = userEvent.setup();
    const broken = {
      ...mkScale("C major", "C", "major", 0),
      diagram: null,
    } as unknown as (typeof scales)[number];
    render(<ScaleList scales={[broken]} />);
    await user.click(screen.getByRole("button"));
    const detail = screen.getByTestId("scale-detail");
    expect(detail).toHaveTextContent("C D E F G A B C");
    expect(
      within(detail).getByTestId("scale-diagram-placeholder"),
    ).toBeInTheDocument();
    // neck reference still renders from notes alone
    expect(within(detail).getByTestId("scale-neck")).toBeInTheDocument();
  });
});
