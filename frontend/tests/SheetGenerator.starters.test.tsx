// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SheetGenerator } from "@/components/SheetGenerator";
import { STARTER_SONGS } from "@/lib/sheets/starter-songs";

const API = "http://test";

function mockSearch(candidates: unknown[] = []) {
  const fetchMock = vi.fn(async (url: string) => {
    const path = new URL(url, API).pathname;
    if (path === "/api/v1/history") {
      return { ok: true, json: async () => ({ entries: [], total: 0 }) };
    }
    return { ok: true, json: async () => ({ candidates }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mockHistoryEmpty() {
  const fetchMock = vi.fn(async (url: string) => {
    const path = new URL(url, API).pathname;
    if (path === "/api/v1/history") {
      return { ok: true, json: async () => ({ entries: [], total: 0 }) };
    }
    throw new Error(`unmocked ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SheetGenerator starters (FR-009)", () => {
  it("renders explanation + starter chips from STARTER_SONGS", () => {
    mockHistoryEmpty();
    render(
      <SheetGenerator
        gamePath={"/courses/ukulele/games/lyrics-chords"}
        apiBaseUrl={API}
      />,
    );
    const quickStart = screen.getByTestId("quick-start");
    expect(
      within(quickStart).getByText("Start with an example"),
    ).toBeInTheDocument();
    expect(
      within(quickStart).getByText(/no typing needed/),
    ).toBeInTheDocument();
    const chips = within(quickStart).getAllByRole("button");
    expect(chips.length).toBeGreaterThanOrEqual(4);
    for (const starter of STARTER_SONGS) {
      expect(
        within(quickStart).getByRole("button", { name: starter }),
      ).toBeInTheDocument();
    }
  });

  it("routes chip selection through the existing submit(query) path", async () => {
    const fetchMock = mockSearch([]);
    const user = userEvent.setup();
    render(
      <SheetGenerator
        gamePath={"/courses/ukulele/games/lyrics-chords"}
        apiBaseUrl={API}
      />,
    );
    const starter = STARTER_SONGS[0] ?? "Riptide";

    await user.click(screen.getByRole("button", { name: starter }));

    const songCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/api/v1/song-search"),
    );
    expect(songCalls).toHaveLength(1);
    const [url, init] = songCalls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${API}/api/v1/song-search`);
    expect(JSON.parse((init.body as string) ?? "{}")).toEqual({
      query: starter,
    });
    expect(await screen.findByText(/No songs matched/)).toBeInTheDocument();
  });

  it("keeps candidates/sheet/history/error sub-views untouched", () => {
    mockHistoryEmpty();
    render(
      <SheetGenerator
        gamePath={"/courses/ukulele/games/lyrics-chords"}
        apiBaseUrl={API}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Hide history" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Riptide")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Search & generate" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("How it works")).toBeInTheDocument();
  });

  it("keeps input + actions at 44px+ with phone-first stacking", () => {
    mockHistoryEmpty();
    const { container } = render(
      <SheetGenerator
        gamePath={"/courses/ukulele/games/lyrics-chords"}
        apiBaseUrl={API}
      />,
    );
    expect(screen.getByLabelText("Song name").className).toContain("min-h-11");
    expect(
      screen.getByRole("button", { name: "Search & generate" }).className,
    ).toContain("min-h-11");
    const quickStart = screen.getByTestId("quick-start");
    for (const chip of within(quickStart).getAllByRole("button")) {
      expect((chip as HTMLElement).className).toContain("min-h-11");
    }
    const form = container.querySelector("form");
    expect(form?.className).toContain("flex-col");
  });
});
