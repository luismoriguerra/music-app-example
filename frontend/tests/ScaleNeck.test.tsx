// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ScaleNeck } from "@/components/ScaleNeck";
import { scaleNeckTones, scaleSpelling } from "@/lib/scales";

const cMajor = [...scaleSpelling(0, "major").notes];
const csMinor = [...scaleSpelling(1, "minor").notes];

describe("ScaleNeck landscape reference", () => {
  it("renders every scale tone across frets 0..12 with the tonic marked", () => {
    render(<ScaleNeck name="C major" notes={cMajor} rootPitch={0} />);
    const svg = screen.getByTestId("scale-neck");
    const tones = within(svg).getAllByTestId("scale-neck-tone");
    expect(tones).toHaveLength(scaleNeckTones(cMajor, 0).length);
    expect(tones.length).toBeGreaterThan(20);

    // all four open strings belong to C major (G C E A)
    const open = tones.filter((t) => t.getAttribute("data-fret") === "0");
    expect(open).toHaveLength(4);

    // tonic dots spell C and are flagged
    const tonic = tones.filter((t) => t.getAttribute("data-tonic") === "true");
    expect(tonic.length).toBeGreaterThan(0);
    for (const t of tonic) {
      expect(t.getAttribute("data-note")).toBe("C");
    }

    // fret 12 reaches the octave: C string fret 12 is the tonic
    const octave = tones.find(
      (t) =>
        t.getAttribute("data-string") === "1" &&
        t.getAttribute("data-fret") === "12",
    );
    expect(octave?.getAttribute("data-note")).toBe("C");
    expect(octave?.getAttribute("data-tonic")).toBe("true");
  });

  it("spells from conventional names, never generic enharmonics", () => {
    render(<ScaleNeck name="Db / C# minor" notes={csMinor} rootPitch={1} />);
    const tones = screen.getAllByTestId("scale-neck-tone");
    const spellings = new Set(tones.map((t) => t.getAttribute("data-note")));
    expect(spellings.has("C#")).toBe(true);
    expect(spellings.has("Db")).toBe(false);
  });

  it("badges 1st-position notes with playing order", () => {
    render(
      <ScaleNeck
        name="C major"
        notes={cMajor}
        rootPitch={0}
        firstPositions={[
          { string: 1, fret: 0, order: 1 },
          { string: 1, fret: 2, order: 2 },
        ]}
      />,
    );
    expect(screen.getAllByTestId("scale-neck-order")).toHaveLength(2);
    const ordered = screen
      .getAllByTestId("scale-neck-tone")
      .filter((t) => t.getAttribute("data-order") !== "");
    expect(ordered.map((t) => t.getAttribute("data-order")).sort()).toEqual([
      "1",
      "2",
    ]);
  });

  it("is responsive and shows a placeholder without notes", () => {
    const { unmount } = render(
      <ScaleNeck name="C major" notes={cMajor} rootPitch={0} />,
    );
    const svg = screen.getByTestId("scale-neck");
    expect(svg.getAttribute("viewBox")).toBe("0 0 760 208");
    expect(svg.getAttribute("class")).toContain("w-full");

    unmount();
    render(<ScaleNeck name="C major" notes={[]} rootPitch={0} />);
    expect(screen.getByTestId("scale-neck-placeholder")).toBeInTheDocument();
  });
});
