// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceLinks } from "@/components/SourceLinks";
import type { DegradedEntry, SourceLink } from "@/lib/sheets/schemas";

const LINKS: SourceLink[] = [
  { label: "LRCLIB", url: "https://lrclib.net/api/get/1", kind: "lyrics" },
  { label: "Ultimate Guitar", url: "https://tabs.ug/tab/1", kind: "chords" },
  {
    label: "Riptide video",
    url: "https://www.youtube.com/watch?v=a",
    kind: "video",
  },
];

describe("SourceLinks (T027)", () => {
  it("renders outbound links that open outside the app (FR-016)", () => {
    render(<SourceLinks links={LINKS} />);
    const anchors = screen.getAllByRole("link");
    expect(anchors).toHaveLength(3);
    for (const anchor of anchors) {
      expect(anchor).toHaveAttribute("target", "_blank");
      expect(anchor.getAttribute("rel")).toMatch(/noopener/);
    }
    expect(
      screen.getByRole("link", { name: /ultimate guitar/i }),
    ).toHaveAttribute("href", "https://tabs.ug/tab/1");
  });

  it("dead or label-less links never break the sheet", () => {
    const odd: SourceLink[] = [
      { label: "", url: "https://example.com/gone", kind: "video" },
      ...LINKS,
    ];
    render(<SourceLinks links={odd} />);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(
      screen.getByRole("link", { name: /example\.com\/gone/ }),
    ).toBeInTheDocument();
  });

  it("empty sources render an explanatory empty state", () => {
    render(<SourceLinks links={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent(/no other sources/i);
  });

  it("video-part degradation explains the missing video links", () => {
    const degraded: DegradedEntry[] = [{ part: "video", reason: "quota" }];
    const pages = LINKS.filter((link) => link.kind !== "video");
    render(<SourceLinks links={pages} degraded={degraded} />);
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent(
      /video.*quota|quota.*video/i,
    );
  });

  it("renders kind badges for video and chords (US2)", () => {
    render(<SourceLinks links={LINKS} />);
    expect(screen.getByText("[Video]")).toBeInTheDocument();
    expect(screen.getByText("[Chords]")).toBeInTheDocument();
    expect(screen.getByText("[Lyrics]")).toBeInTheDocument();
  });

  it("enrichment degradation explains when enrichment is skipped", () => {
    const degraded: DegradedEntry[] = [
      { part: "enrichment", reason: "timeout" },
    ];
    render(<SourceLinks links={[]} degraded={degraded} />);
    expect(
      screen.getByText(/search enrichment was unavailable/i),
    ).toBeInTheDocument();
  });
});
