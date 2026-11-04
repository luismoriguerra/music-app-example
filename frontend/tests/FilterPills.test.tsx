// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterPills } from "@/components/FilterPills";

const GROUPS = [
  { label: "All", options: [{ value: "all", label: "All" }] },
  {
    label: "By type",
    options: [
      { value: "major", label: "Major" },
      { value: "minor", label: "Minor" },
    ],
  },
];

const COUNTS = new Map([
  ["all", 10],
  ["major", 6],
  ["minor", 4],
]);

const setup = (value = "all") => {
  const onChange = vi.fn();
  render(
    <FilterPills
      groups={GROUPS}
      value={value}
      counts={COUNTS}
      onChange={onChange}
      id="test-filter"
    />,
  );
  return onChange;
};

describe("FilterPills (FR-012)", () => {
  it("renders a radiogroup of pills with labels + counts from props", () => {
    setup();
    const group = screen.getByRole("radiogroup", { name: "Filter" });
    expect(group).toHaveAttribute("data-testid", "test-filter");
    const pills = within(group).getAllByRole("radio");
    expect(pills.map((p) => p.textContent)).toEqual([
      "All (10)",
      "Major (6)",
      "Minor (4)",
    ]);
  });

  it("marks exactly one pill checked", () => {
    setup("minor");
    const pills = screen.getAllByRole("radio");
    expect(
      pills.filter((p) => p.getAttribute("aria-checked") === "true"),
    ).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "Minor (4)" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("calls onChange with a valid filter value on selection", async () => {
    const user = userEvent.setup();
    const onChange = setup();
    await user.click(screen.getByRole("radio", { name: "Major (6)" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("major");
  });

  it("supports arrow-key navigation with roving tabindex", async () => {
    const user = userEvent.setup();
    const onChange = setup("all");
    const pills = screen.getAllByRole("radio");
    expect(pills[0]).toHaveAttribute("tabindex", "0");
    expect(pills[1]).toHaveAttribute("tabindex", "-1");

    (pills[0] as HTMLElement).focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("major");
    expect(document.activeElement).toHaveAccessibleName("Major (6)");

    await user.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenCalledWith("all");
    expect(document.activeElement).toHaveAccessibleName("All (10)");
  });

  it("is reachable by Tab on the selected pill", async () => {
    const user = userEvent.setup();
    setup("minor");
    await user.tab();
    expect(document.activeElement).toHaveAccessibleName("Minor (4)");
  });

  it("lays out as a wrapping row on sm+ and a scroll row on phones", () => {
    setup();
    const group = screen.getByRole("radiogroup");
    expect(group.className).toContain("overflow-x-auto");
    expect(group.className).toContain("snap-x");
    expect(group.className).toContain("sm:flex-wrap");
    for (const pill of screen.getAllByRole("radio")) {
      expect((pill as HTMLElement).className).toContain("min-h-11");
      expect((pill as HTMLElement).className).toContain("shrink-0");
    }
  });
});
