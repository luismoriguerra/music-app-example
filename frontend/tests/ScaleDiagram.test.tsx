// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScaleDiagram } from "@/components/ScaleDiagram";
import type { Scale } from "@/lib/scales";

const cMajorDiagram: Scale["diagram"] = {
  strings: "GCEA",
  positions: [
    { string: 1, fret: 0, order: 1, finger: 0 },
    { string: 1, fret: 2, order: 2, finger: 2 },
    { string: 2, fret: 0, order: 3, finger: 0 },
    { string: 2, fret: 1, order: 4, finger: 1 },
    { string: 2, fret: 3, order: 5, finger: 3 },
    { string: 3, fret: 0, order: 6, finger: 0 },
    { string: 3, fret: 2, order: 7, finger: 2 },
    { string: 3, fret: 3, order: 8, finger: 3 },
  ],
  baseFret: 1,
  positionLabel: "1st position",
};
const cMajorNotes = ["C", "D", "E", "F", "G", "A", "B", "C"];

describe("ScaleDiagram (fretboard-chart SVG)", () => {
  it("renders 4 strings, 6 fret lines, and an accessible title", () => {
    render(
      <ScaleDiagram
        name="C major"
        diagram={cMajorDiagram}
        notes={cMajorNotes}
      />,
    );
    const svg = screen.getByTestId("scale-diagram");
    expect(svg.querySelectorAll("line")).toHaveLength(4 + 6);
    expect(
      screen.getByRole("img", { name: /C major scale diagram/i }),
    ).toBeInTheDocument();
  });

  it("renders 8 numbered dots in playing order with note labels", () => {
    render(
      <ScaleDiagram
        name="C major"
        diagram={cMajorDiagram}
        notes={cMajorNotes}
      />,
    );
    const dots = screen.getAllByTestId("scale-dot");
    const opens = screen.getAllByTestId("scale-open");
    expect(dots).toHaveLength(5);
    expect(opens).toHaveLength(3);
    const all = screen
      .getByTestId("scale-diagram")
      .querySelectorAll(
        '[data-testid="scale-dot"], [data-testid="scale-open"]',
      );
    expect(all).toHaveLength(8);
    all.forEach((g, i) => {
      expect(g.textContent).toContain(String(i + 1));
      expect(g.getAttribute("data-note")).toBe(cMajorNotes[i]);
    });
  });

  it("renders open-string marks and the position-label caption", () => {
    render(
      <ScaleDiagram
        name="C major"
        diagram={cMajorDiagram}
        notes={cMajorNotes}
      />,
    );
    expect(screen.getAllByTestId("scale-open")).toHaveLength(3);
    expect(screen.getByText("1st position")).toBeInTheDocument();
  });

  it("scales responsively via viewBox (SC-008)", () => {
    render(
      <ScaleDiagram
        name="C major"
        diagram={cMajorDiagram}
        notes={cMajorNotes}
      />,
    );
    const svg = screen.getByTestId("scale-diagram");
    expect(svg.getAttribute("viewBox")).toBe("0 0 96 136");
    expect(svg.classList.contains("w-full")).toBe(true);
    expect(svg.classList.contains("h-auto")).toBe(true);
  });

  it("shows a placeholder for invalid or missing diagram data (FR-015)", () => {
    render(<ScaleDiagram name="Broken" diagram={null} notes={[]} />);
    expect(screen.getByTestId("scale-diagram-placeholder")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /diagram unavailable/i }),
    ).toBeInTheDocument();
  });
});
