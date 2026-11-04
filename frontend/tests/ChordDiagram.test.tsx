// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChordDiagram } from "@/components/ChordDiagram";

const cMajor = {
  strings: "GCEA" as const,
  frets: [0, 0, 0, 3] as [number, number, number, number],
  fingers: [0, 0, 0, 3] as [number, number, number, number],
  baseFret: 1,
  barres: [] as Array<{ fret: number; fromString: number; toString: number }>,
};

describe("ChordDiagram (R3 inline SVG)", () => {
  it("renders 4 strings, 6 fret lines, and an accessible title", () => {
    render(<ChordDiagram name="C major" diagram={cMajor} />);
    const svg = screen.getByTestId("chord-diagram");
    expect(svg.querySelectorAll("line")).toHaveLength(4 + 6);
    expect(
      screen.getByRole("img", { name: /C major fingering diagram/i }),
    ).toBeInTheDocument();
  });

  it("renders open markers and fretted dots with finger numbers", () => {
    render(<ChordDiagram name="C major" diagram={cMajor} />);
    expect(screen.getAllByTestId("open")).toHaveLength(3);
    const dots = screen.getAllByTestId("dot");
    expect(dots).toHaveLength(1);
    expect(dots[0].textContent).toBe("3");
  });

  it("renders a nut at baseFret 1 and a numeric label at higher base frets", () => {
    const { container: c1 } = render(
      <ChordDiagram name="C major" diagram={cMajor} />,
    );
    expect(c1.querySelector("rect")).not.toBeNull();

    const { container: c2 } = render(
      <ChordDiagram
        name="High"
        diagram={{
          ...cMajor,
          frets: [5, 5, 5, 5],
          fingers: [1, 1, 1, 1],
          baseFret: 5,
        }}
      />,
    );
    expect(c2.textContent).toContain("5");
  });

  it("renders barres and muted strings", () => {
    render(
      <ChordDiagram
        name="Barre"
        diagram={{
          ...cMajor,
          frets: [-1, 2, 2, 2],
          fingers: [0, 1, 1, 1],
          barres: [{ fret: 2, fromString: 1, toString: 3 }],
        }}
      />,
    );
    expect(screen.getByTestId("barre")).toBeInTheDocument();
    expect(screen.getByTestId("muted")).toBeInTheDocument();
  });

  it("shows a placeholder for invalid or missing diagram data", () => {
    render(<ChordDiagram name="Broken" diagram={null} />);
    expect(screen.getByTestId("chord-diagram-placeholder")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /diagram unavailable/i }),
    ).toBeInTheDocument();
  });
});
