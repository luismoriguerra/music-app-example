// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CandidateList } from "@/components/CandidateList";
import type { Candidate } from "@/lib/sheets/schemas";

const CANDIDATES: Candidate[] = [
  {
    title: "Riptide",
    artist: "Vance Joy",
    album: "Dream Your Life Away",
    artwork_url: "https://images.genius.com/thumb.jpg",
    provider_refs: { genius_id: 123456 },
  },
  {
    title: "Riptide Acoustic",
    artist: "Vance Joy",
    album: "Riptide EP",
    artwork_url: null,
    provider_refs: { lrclib_id: 969430 },
  },
];

describe("CandidateList (T025)", () => {
  it("renders candidate rows with title, artist, album, and artwork", () => {
    render(<CandidateList candidates={CANDIDATES} onPick={() => {}} />);
    expect(screen.getByText("Riptide")).toBeInTheDocument();
    expect(screen.getAllByText("Vance Joy")).toHaveLength(2);
    expect(screen.getByText("Dream Your Life Away")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /riptide/i })).toHaveAttribute(
      "src",
      "https://images.genius.com/thumb.jpg",
    );
  });

  it("picking a row generates that song via onPick", async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<CandidateList candidates={CANDIDATES} onPick={onPick} />);
    const picks = screen.getAllByRole("button", {
      name: /^use .+ by .+$/i,
    });
    expect(picks).toHaveLength(2);
    await user.click(picks[1]);
    expect(onPick).toHaveBeenCalledWith(CANDIDATES[1]);
  });

  it("shows a loading indicator while searching", () => {
    render(<CandidateList candidates={[]} onPick={() => {}} isLoading />);
    expect(screen.getByRole("status")).toHaveTextContent(/searching/i);
  });

  it("shows an error message with retry, input preserved by the island (FR-007)", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <CandidateList
        candidates={[]}
        onPick={() => {}}
        error="Song search failed."
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/song search failed/i);
    await user.click(screen.getByRole("button", { name: /try again|retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("empty results merge into the no-match state", () => {
    render(<CandidateList candidates={[]} onPick={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent(/no songs matched/i);
  });

  it("pending pick shows inline row loading with peers disabled", () => {
    render(
      <CandidateList
        candidates={CANDIDATES}
        onPick={() => {}}
        pendingCandidate={CANDIDATES[0]}
      />,
    );
    const generating = screen.getByRole("button", {
      name: /generating riptide by vance joy/i,
    });
    expect(generating).toBeDisabled();
    expect(generating).toHaveTextContent(/generating/i);
    const picks = screen.getAllByRole("button");
    expect(picks).toHaveLength(2);
    for (const btn of picks) expect(btn).toBeDisabled();
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveAttribute("aria-busy", "true");
  });

  it("pending row keeps 44px target and blocks double-pick", async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(
      <CandidateList
        candidates={CANDIDATES}
        onPick={onPick}
        pendingCandidate={CANDIDATES[1]}
      />,
    );
    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect((btn as HTMLElement).className).toContain("min-h-11");
      await user.click(btn);
    }
    expect(onPick).not.toHaveBeenCalled();
  });
});
