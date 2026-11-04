// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SheetGenerator } from "@/components/SheetGenerator";
import {
  generateSheetResponseSchema,
  songSearchResponseSchema,
} from "@/lib/sheets/schemas";
import { navigateTo } from "@/lib/sheets/history-api";
import type * as HistoryApi from "@/lib/sheets/history-api";

vi.mock("@/lib/sheets/history-api", async (importOriginal) => ({
  ...(await importOriginal<typeof HistoryApi>()),
  navigateTo: vi.fn(),
}));

const GAME_PATH = "/courses/ukulele/games/lyrics-chords";
const ENTRY_PATH = `${GAME_PATH}/22222222-2222-4222-8222-222222222222`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(navigateTo).mockReset();
});

const CANDIDATES = [
  {
    title: "Riptide",
    artist: "Vance Joy",
    album: "Dream Your Life Away",
    artwork_url: null,
    provider_refs: { lrclib_id: 969429 },
  },
  {
    title: "Riptide",
    artist: "Sick Puppies",
    album: null,
    artwork_url: null,
    provider_refs: { genius_id: 789012 },
  },
];

const SHEET = {
  id: "11111111-1111-4111-8111-111111111111",
  query: "Riptide",
  matched_title: "Riptide",
  matched_performer: "Vance Joy",
  lyric_source: "chart",
  lyric_source_url: "https://tabs.ultimate-guitar.com/tab/vance-joy/riptide-1",
  chord_source: "chart",
  chord_source_url: "https://tabs.ultimate-guitar.com/tab/vance-joy/riptide-1",
  model_id: null,
  body: {
    sections: [
      {
        heading: "Chorus",
        lines: [
          {
            text: "Lady, runnin' down to the riptide",
            chords: [{ offset: 0, symbol: "Am" }],
          },
        ],
      },
    ],
  },
  source_links: [
    { label: "LRCLIB", url: "https://lrclib.net/api/get/1", kind: "lyrics" },
    {
      label: "Riptide video",
      url: "https://www.youtube.com/watch?v=a",
      kind: "video",
    },
  ],
  degraded: [],
  capo: null,
  tuning_note: null,
  created_at: "2026-09-16T00:00:00Z",
};

const SHEET_RESPONSE = {
  entry_id: "22222222-2222-4222-8222-222222222222",
  sheet: SHEET,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Route mocked fetch by API pathname; records every call for assertions. */
function mockApi(
  routes: Record<string, (url: string, init?: RequestInit) => Response>,
) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const path = new URL(url, "http://test").pathname;
      const handler =
        routes[path] ??
        (path === "/api/v1/history"
          ? () => jsonResponse({ entries: [], total: 0 })
          : undefined);
      if (!handler) throw new Error(`unmocked ${path}`);
      return handler(url, init);
    }),
  );
  return calls;
}

async function submitQuery(
  user: ReturnType<typeof userEvent.setup>,
  query: string,
) {
  await user.type(screen.getByLabelText(/song name/i), query);
  await user.click(screen.getByRole("button", { name: /search|generate/i }));
}

describe("SheetGenerator generate flow (T028)", () => {
  it("ambiguous name → candidate list → pick generates that song", async () => {
    const calls = mockApi({
      "/api/v1/song-search": () => jsonResponse({ candidates: CANDIDATES }),
      "/api/v1/sheets": () => jsonResponse(SHEET_RESPONSE),
    });
    const user = userEvent.setup();
    render(<SheetGenerator gamePath={GAME_PATH} apiBaseUrl="http://test" />);

    await submitQuery(user, "Riptide");
    expect(await screen.findByText("Sick Puppies")).toBeInTheDocument();

    const picks = screen.getAllByRole("button", {
      name: /^use .+ by .+$/i,
    });
    await user.click(picks[0]);

    await waitFor(() => expect(navigateTo).toHaveBeenCalledWith(ENTRY_PATH));
    const sheetCall = calls.find((call) => call.url.endsWith("/api/v1/sheets"));
    expect(JSON.parse(String(sheetCall?.init?.body))).toMatchObject({
      query: "Riptide",
      candidate: CANDIDATES[0],
    });
  });

  it("single candidate auto-generates without a pick step", async () => {
    const calls = mockApi({
      "/api/v1/song-search": () =>
        jsonResponse({ candidates: CANDIDATES.slice(0, 1) }),
      "/api/v1/sheets": () => jsonResponse(SHEET_RESPONSE),
    });
    const user = userEvent.setup();
    render(<SheetGenerator gamePath={GAME_PATH} apiBaseUrl="http://test" />);

    await submitQuery(user, "Riptide");
    await waitFor(() => expect(navigateTo).toHaveBeenCalledWith(ENTRY_PATH));
    expect(
      screen.queryByRole("button", { name: /^use .+ by .+$/i }),
    ).not.toBeInTheDocument();
    expect(
      calls.filter((call) => call.url.endsWith("/api/v1/sheets")),
    ).toHaveLength(1);
  });

  it("single web-search candidate is never auto-generated (009 FR-003)", async () => {
    const enriched = {
      title: "Almohada",
      artist: "José José",
      album: null,
      artwork_url: null,
      provider_refs: { duckduckgo: "almohada|josejose" },
    };
    const calls = mockApi({
      "/api/v1/song-search": () => jsonResponse({ candidates: [enriched] }),
      "/api/v1/sheets": () => jsonResponse(SHEET_RESPONSE),
    });
    const user = userEvent.setup();
    render(<SheetGenerator gamePath={GAME_PATH} apiBaseUrl="http://test" />);

    await submitQuery(user, "amohada - jose jose");
    const pick = await screen.findByRole("button", {
      name: /^use almohada by josé josé$/i,
    });
    expect(
      calls.filter((call) => call.url.endsWith("/api/v1/sheets")),
    ).toHaveLength(0);

    await user.click(pick);
    await waitFor(() => expect(navigateTo).toHaveBeenCalledWith(ENTRY_PATH));
    const sheetCall = calls.find((call) => call.url.endsWith("/api/v1/sheets"));
    expect(JSON.parse(String(sheetCall?.init?.body))).toMatchObject({
      candidate: enriched,
    });
  });

  it("shows a loading state while generating", async () => {
    let release!: (value: Response) => void;
    const gate = new Promise<Response>((resolve) => {
      release = resolve;
    });
    mockApi({
      "/api/v1/song-search": () =>
        jsonResponse({ candidates: CANDIDATES.slice(0, 1) }),
      "/api/v1/sheets": () => gate as unknown as Response,
    });
    const user = userEvent.setup();
    render(<SheetGenerator gamePath={GAME_PATH} apiBaseUrl="http://test" />);

    await submitQuery(user, "Riptide");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /generating/i }),
      ).toBeDisabled(),
    );
    release(jsonResponse(SHEET_RESPONSE));
    await waitFor(() => expect(navigateTo).toHaveBeenCalledWith(ENTRY_PATH));
  });

  it("gibberish → no-match state with a spelling retry hint", async () => {
    mockApi({ "/api/v1/song-search": () => jsonResponse({ candidates: [] }) });
    const user = userEvent.setup();
    render(<SheetGenerator gamePath={GAME_PATH} apiBaseUrl="http://test" />);

    await submitQuery(user, "xyz-gibberish");
    expect(await screen.findByText(/no songs matched/i)).toBeInTheDocument();
    expect(screen.getByText(/no songs matched/i)).toHaveTextContent(
      /spelling/i,
    );
    expect(screen.getByLabelText(/song name/i)).toHaveValue("xyz-gibberish");
  });

  it("generate failure → error state with retry, input preserved (FR-007)", async () => {
    const calls = mockApi({
      "/api/v1/song-search": () =>
        jsonResponse({ candidates: CANDIDATES.slice(0, 1) }),
      "/api/v1/sheets": () =>
        jsonResponse(
          { error: { code: "PROVIDER_ERROR", message: "upstream down" } },
          502,
        ),
    });
    const user = userEvent.setup();
    render(<SheetGenerator gamePath={GAME_PATH} apiBaseUrl="http://test" />);

    await submitQuery(user, "Riptide");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText(/song name/i)).toHaveValue("Riptide");

    await user.click(screen.getByRole("button", { name: /try again|retry/i }));
    await screen.findByRole("alert");
    expect(
      calls.filter((call) => call.url.endsWith("/api/v1/sheets")),
    ).toHaveLength(2);
  });

  it("auto-generate rejected by the service → service error copy, not the connection message", async () => {
    mockApi({
      "/api/v1/song-search": () =>
        jsonResponse({ candidates: CANDIDATES.slice(0, 1) }),
      "/api/v1/sheets": () =>
        jsonResponse(
          { error: { code: "PROVIDER_ERROR", message: "upstream down" } },
          502,
        ),
    });
    const user = userEvent.setup();
    render(<SheetGenerator gamePath={GAME_PATH} apiBaseUrl="http://test" />);

    await submitQuery(user, "Riptide");
    const errorBox = await screen.findByRole("alert");
    expect(errorBox).toHaveTextContent(/returned an error/i);
    expect(errorBox).not.toHaveTextContent(/check your connection/i);
  });

  it("malformed sheet payload → error state, never a crash", async () => {
    mockApi({
      "/api/v1/song-search": () =>
        jsonResponse({ candidates: CANDIDATES.slice(0, 1) }),
      "/api/v1/sheets": () => jsonResponse({ sheet: { nope: true } }),
    });
    const user = userEvent.setup();
    render(<SheetGenerator gamePath={GAME_PATH} apiBaseUrl="http://test" />);

    await submitQuery(user, "Riptide");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText(/song name/i)).toBeInTheDocument();
  });

  it("backend dying mid-flow → error state (never blank)", async () => {
    mockApi({
      "/api/v1/song-search": () =>
        jsonResponse({ candidates: CANDIDATES.slice(0, 1) }),
      "/api/v1/sheets": () => {
        throw new Error("connection reset");
      },
    });
    const user = userEvent.setup();
    render(<SheetGenerator gamePath={GAME_PATH} apiBaseUrl="http://test" />);

    await submitQuery(user, "Riptide");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText(/song name/i)).toHaveValue("Riptide");
  });

  it("candidates phase hides search + history and shows back to search", async () => {
    mockApi({
      "/api/v1/song-search": () => jsonResponse({ candidates: CANDIDATES }),
      "/api/v1/sheets": () => jsonResponse(SHEET_RESPONSE),
    });
    const user = userEvent.setup();
    render(<SheetGenerator gamePath={GAME_PATH} apiBaseUrl="http://test" />);

    await submitQuery(user, "Riptide");
    expect(await screen.findByText("Sick Puppies")).toBeInTheDocument();

    const back = screen.getByRole("button", { name: /back to search/i });
    expect(back).toBeInTheDocument();
    expect(back.className).toContain("min-h-11");
    expect(screen.queryByLabelText(/song name/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^search & generate$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^(show|hide) history$/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("quick-start")).not.toBeInTheDocument();

    await user.click(back);
    expect(screen.getByLabelText(/song name/i)).toHaveValue("Riptide");
    expect(screen.queryByText("Sick Puppies")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^(show|hide) history$/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("quick-start")).toBeInTheDocument();
  });

  it("picking a candidate shows per-row loading, not search button", async () => {
    let release!: (value: Response) => void;
    const gate = new Promise<Response>((resolve) => {
      release = resolve;
    });
    mockApi({
      "/api/v1/song-search": () => jsonResponse({ candidates: CANDIDATES }),
      "/api/v1/sheets": () => gate as unknown as Response,
    });
    const user = userEvent.setup();
    render(<SheetGenerator gamePath={GAME_PATH} apiBaseUrl="http://test" />);

    await submitQuery(user, "Riptide");
    expect(await screen.findByText("Sick Puppies")).toBeInTheDocument();

    const picks = screen.getAllByRole("button", {
      name: /^use .+ by .+$/i,
    });
    await user.click(picks[0]);

    const generating = await screen.findByRole("button", {
      name: /generating riptide by vance joy/i,
    });
    expect(generating).toBeDisabled();
    expect(generating).toHaveTextContent(/generating/i);
    expect(
      screen.queryByRole("button", { name: /^search & generate$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /back to search/i }),
    ).toBeDisabled();
    const rowButtons = screen.getAllByRole("button", {
      name: /generating|use .+ by/i,
    });
    for (const btn of rowButtons) expect(btn).toBeDisabled();

    release(jsonResponse(SHEET_RESPONSE));
    await waitFor(() => expect(navigateTo).toHaveBeenCalledWith(ENTRY_PATH));
  });

  it("fixtures stay contract-valid", () => {
    expect(() =>
      songSearchResponseSchema.parse({ candidates: CANDIDATES }),
    ).not.toThrow();
    expect(() =>
      generateSheetResponseSchema.parse(SHEET_RESPONSE),
    ).not.toThrow();
  });
});
