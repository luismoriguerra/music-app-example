// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SheetGenerator } from "@/components/SheetGenerator";
import { navigateTo } from "@/lib/sheets/history-api";
import type * as HistoryApi from "@/lib/sheets/history-api";
import {
  historyListResponseSchema,
  regenerateResponseSchema,
  type HistoryEntry,
} from "@/lib/sheets/schemas";

vi.mock("@/lib/sheets/history-api", async (importOriginal) => ({
  ...(await importOriginal<typeof HistoryApi>()),
  navigateTo: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(navigateTo).mockReset();
  window.history.replaceState({}, "", "/");
});

const GAME_PATH = "/courses/ukulele/games/lyrics-chords";
const ENTRY_ID = "22222222-2222-4222-8222-222222222222";
const FRESH_ENTRY_ID = "66666666-6666-4666-8666-666666666666";

const SHEET = {
  id: "55555555-5555-4555-8555-555555555555",
  query: "Riptide",
  matched_title: "Riptide",
  matched_performer: "Vance Joy",
  lyric_source: "chart",
  lyric_source_url: "https://tabs.ultimate-guitar.com/tab/vance-joy/riptide-1",
  chord_source: "chart",
  chord_source_url: "https://tabs.ultimate-guitar.com/tab/vance-joy/riptide-2",
  model_id: null,
  body: {
    sections: [
      {
        heading: "Chorus",
        lines: [{ text: "Lady", chords: [{ offset: 0, symbol: "Am" }] }],
      },
    ],
  },
  source_links: [],
  degraded: [],
  capo: null,
  tuning_note: null,
  created_at: "2026-09-16T00:00:00Z",
};
const REGEN_RESPONSE = { entry_id: FRESH_ENTRY_ID, sheet: SHEET };
regenerateResponseSchema.parse(REGEN_RESPONSE);

const RIPTIDE: HistoryEntry = {
  id: ENTRY_ID,
  query: "Riptide",
  matched_title: "Riptide",
  matched_performer: "Vance Joy",
  sheet_id: SHEET.id,
  created_at: "2026-09-16T00:01:00Z",
  favorite: false,
};
const IMAGINE: HistoryEntry = {
  id: "77777777-7777-4777-8777-777777777777",
  query: "Imagine",
  matched_title: "Imagine",
  matched_performer: "John Lennon",
  sheet_id: "88888888-8888-4888-8888-888888888888",
  created_at: "2026-09-16T00:00:00Z",
  favorite: true,
};

/** `n` distinct entries, newest first: "Song 1" … "Song n". */
function manyEntries(n: number): HistoryEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    query: `Song ${i + 1}`,
    matched_title: `Track ${i + 1}`,
    matched_performer: "Artist",
    sheet_id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    created_at: new Date(Date.UTC(2026, 8, 16, 0, 0, 1000 - i)).toISOString(),
    favorite: false,
  }));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type Call = { url: string; init?: RequestInit };

/**
 * In-memory history backend honoring limit/offset/q/favorite plus
 * DELETE/PATCH/regenerate per rest-api.md. Records every call.
 */
function mockBackend(
  initial: HistoryEntry[],
  opts: { deleteStatus?: number; regenerateStatus?: number } = {},
) {
  const store = initial.map((e) => ({ ...e }));
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const u = new URL(url);
      const method = init?.method ?? "GET";
      if (u.pathname === "/api/v1/history") {
        const q = (u.searchParams.get("q") ?? "").toLowerCase();
        const fav = u.searchParams.get("favorite") === "true";
        const limit = Number(u.searchParams.get("limit"));
        const offset = Number(u.searchParams.get("offset"));
        const matched = store.filter(
          (e) =>
            (!q ||
              e.query.toLowerCase().includes(q) ||
              e.matched_title.toLowerCase().includes(q)) &&
            (!fav || e.favorite),
        );
        const body = {
          entries: matched.slice(offset, offset + limit),
          total: matched.length,
        };
        historyListResponseSchema.parse(body);
        return jsonResponse(body);
      }
      const regen = u.pathname.match(
        /^\/api\/v1\/history\/([^/]+)\/regenerate$/,
      );
      if (regen && method === "POST") {
        if (opts.regenerateStatus)
          return new Response(null, { status: opts.regenerateStatus });
        return jsonResponse(REGEN_RESPONSE);
      }
      const one = u.pathname.match(/^\/api\/v1\/history\/([^/]+)$/);
      if (one) {
        const idx = store.findIndex((e) => e.id === one[1]);
        if (idx < 0) return jsonResponse({ error: { code: "NOT_FOUND" } }, 404);
        if (method === "DELETE") {
          if (opts.deleteStatus)
            return new Response(null, { status: opts.deleteStatus });
          store.splice(idx, 1);
          return new Response(null, { status: 204 });
        }
        if (method === "PATCH") {
          const { favorite } = JSON.parse(String(init?.body)) as {
            favorite: boolean;
          };
          store[idx] = { ...store[idx], favorite };
          return jsonResponse(store[idx]);
        }
      }
      throw new Error(`unmocked ${method} ${u.pathname}`);
    }),
  );
  return calls;
}

function listCalls(calls: Call[]): URLSearchParams[] {
  return calls
    .map((c) => new URL(c.url))
    .filter((u) => u.pathname === "/api/v1/history")
    .map((u) => u.searchParams);
}

function renderGenerator() {
  return render(
    <SheetGenerator gamePath={GAME_PATH} apiBaseUrl="http://test" />,
  );
}

describe("SheetGenerator history (T046)", () => {
  it("first load shows loading, then newest-first cards linking to their sheet pages", async () => {
    const calls = mockBackend([RIPTIDE, IMAGINE]);
    renderGenerator();

    // SSR-shell guard: first paint is loading, never a false empty state.
    expect(screen.getByText(/loading history/i)).toBeInTheDocument();
    expect(screen.queryByText(/no searches yet/i)).not.toBeInTheDocument();

    expect(await screen.findByText("John Lennon")).toBeInTheDocument();
    const first = listCalls(calls)[0];
    expect(first.get("limit")).toBe("10");
    expect(first.get("offset")).toBe("0");
    for (const link of screen.getAllByRole("link", { name: /open riptide/i }))
      expect(link).toHaveAttribute("href", `${GAME_PATH}/${ENTRY_ID}`);
    // Listing alone fetches no entry/provider endpoints.
    expect(calls).toHaveLength(1);
  });

  it("history lives in the main content; the tips rail stays history-free", async () => {
    mockBackend([RIPTIDE, IMAGINE]);
    renderGenerator();
    expect(await screen.findByText("John Lennon")).toBeInTheDocument();

    const section = screen.getByLabelText("History");
    const history = within(section).getByRole("list", {
      name: /search history/i,
    });
    expect(within(history).getAllByRole("listitem")).toHaveLength(2);

    const aside = screen.getByLabelText("Tips");
    expect(
      within(aside).queryByRole("list", { name: /search history/i }),
    ).not.toBeInTheDocument();
    expect(within(aside).getByLabelText("How it works")).toBeInTheDocument();
  });

  it("regenerate from a row → navigates to the fresh entry's page", async () => {
    const calls = mockBackend([RIPTIDE, IMAGINE]);
    const user = userEvent.setup();
    renderGenerator();
    expect(await screen.findByText("John Lennon")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /regenerate riptide/i }),
    );
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: /^regenerate$/i,
      }),
    );
    await waitFor(() =>
      expect(navigateTo).toHaveBeenCalledWith(`${GAME_PATH}/${FRESH_ENTRY_ID}`),
    );
    expect(
      calls.some((c) => c.url.endsWith(`/history/${ENTRY_ID}/regenerate`)),
    ).toBe(true);
  });

  it("regenerate rejected by the service → service error copy, not the connection message", async () => {
    mockBackend([RIPTIDE, IMAGINE], { regenerateStatus: 502 });
    const user = userEvent.setup();
    renderGenerator();
    expect(await screen.findByText("John Lennon")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /regenerate riptide/i }),
    );
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: /^regenerate$/i,
      }),
    );
    const errorBox = await screen.findByRole("alert");
    expect(errorBox).toHaveTextContent(/returned an error/i);
    expect(errorBox).not.toHaveTextContent(/check your connection/i);
  });

  it("legacy ?entry= link redirects to the dedicated page (replace)", async () => {
    mockBackend([]);
    window.history.replaceState({}, "", `/?entry=${ENTRY_ID}`);
    renderGenerator();
    await waitFor(() =>
      expect(navigateTo).toHaveBeenCalledWith(`${GAME_PATH}/${ENTRY_ID}`, {
        replace: true,
      }),
    );
  });

  it("fresh DB → friendly empty history; error + retry", async () => {
    let fails = 1;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        if (fails-- > 0)
          return jsonResponse({ error: { code: "PROVIDER_ERROR" } }, 502);
        return jsonResponse({ entries: [], total: 0 });
      }),
    );
    const user = userEvent.setup();
    renderGenerator();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText(/no searches yet/i)).toBeInTheDocument();
  });

  it("delete with confirm → DELETE call + entry leaves the list", async () => {
    const calls = mockBackend([RIPTIDE, IMAGINE]);
    const user = userEvent.setup();
    renderGenerator();
    expect(await screen.findByText("John Lennon")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /delete riptide/i }));
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    await waitFor(() =>
      expect(
        screen.queryByRole("link", { name: /open riptide/i }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getAllByRole("link", { name: /open imagine/i })[0],
    ).toBeInTheDocument();
    expect(
      calls.some(
        (c) =>
          c.url.endsWith(`/history/${ENTRY_ID}`) && c.init?.method === "DELETE",
      ),
    ).toBe(true);
  });

  it("delete failure keeps the entry and shows an inline error", async () => {
    mockBackend([RIPTIDE, IMAGINE], { deleteStatus: 500 });
    const user = userEvent.setup();
    renderGenerator();
    expect(await screen.findByText("John Lennon")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /delete riptide/i }));
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn't delete/i,
    );
    expect(
      screen.getAllByRole("link", { name: /open riptide/i })[0],
    ).toBeInTheDocument();
  });
});

describe("SheetGenerator history pagination + filters (FR-010/018)", () => {
  it("25 entries → Page 1 of 3; Next fetches offset=10; Previous disabled on page 1", async () => {
    const calls = mockBackend(manyEntries(25));
    const user = userEvent.setup();
    renderGenerator();

    const pages = await screen.findByRole("navigation", {
      name: /history pages/i,
    });
    expect(pages).toHaveTextContent("Page 1 of 3");
    expect(
      screen.getByRole("heading", { name: /history \(25\)/i }),
    ).toBeInTheDocument();
    expect(
      within(pages).getByRole("button", { name: /previous/i }),
    ).toBeDisabled();
    expect(
      within(
        screen.getByRole("list", { name: /search history/i }),
      ).getAllByRole("listitem"),
    ).toHaveLength(10);

    await user.click(within(pages).getByRole("button", { name: /next/i }));
    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    expect(listCalls(calls).at(-1)?.get("offset")).toBe("10");
    expect(screen.getByText("Track 11")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous/i })).toBeEnabled();
  });

  it("hides page controls when total ≤ 10", async () => {
    mockBackend(manyEntries(10));
    renderGenerator();
    expect(await screen.findByText("Track 10")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: /history pages/i }),
    ).not.toBeInTheDocument();
  });

  it("restores page + filters from the URL and fetches them first (Back from a sheet page)", async () => {
    window.history.replaceState({}, "", `${GAME_PATH}?page=2&q=track&fav=1`);
    const entries = manyEntries(25).map((e) => ({ ...e, favorite: true }));
    const calls = mockBackend(entries);
    renderGenerator();

    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    const first = listCalls(calls)[0];
    expect(first.get("offset")).toBe("10");
    expect(first.get("q")).toBe("track");
    expect(first.get("favorite")).toBe("true");
    expect(screen.getByLabelText(/filter history by name/i)).toHaveValue(
      "track",
    );
    expect(
      screen.getByRole("button", { name: /favorites only/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("mirrors page + filters into the URL, omitting defaults", async () => {
    window.history.replaceState({}, "", GAME_PATH);
    mockBackend(manyEntries(25));
    const user = userEvent.setup();
    renderGenerator();

    await user.click(await screen.findByRole("button", { name: /next/i }));
    await screen.findByText("Page 2 of 3");
    expect(window.location.search).toBe("?page=2");

    await user.click(screen.getByRole("button", { name: /favorites only/i }));
    await waitFor(() => expect(window.location.search).toBe("?fav=1"));
  });

  it("name filter sends q= after the debounce and resets to page 1", async () => {
    const calls = mockBackend([...manyEntries(15), RIPTIDE]);
    const user = userEvent.setup();
    renderGenerator();
    await user.click(await screen.findByRole("button", { name: /next/i }));
    expect(await screen.findByText("Page 2 of 2")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/filter history by name/i), "ript");
    // Debounced: no per-keystroke requests.
    expect(listCalls(calls).some((p) => p.has("q"))).toBe(false);
    await waitFor(() => expect(listCalls(calls).at(-1)?.get("q")).toBe("ript"));
    expect(listCalls(calls).filter((p) => p.has("q"))).toHaveLength(1);
    expect(listCalls(calls).at(-1)?.get("offset")).toBe("0");
    expect(await screen.findByText("Vance Joy")).toBeInTheDocument();
    expect(screen.queryByText("Song 1")).not.toBeInTheDocument();
  });

  it("Favorites only sends favorite=true, resets to page 1, and toggles aria-pressed", async () => {
    const calls = mockBackend([...manyEntries(15), IMAGINE]);
    const user = userEvent.setup();
    renderGenerator();
    await user.click(await screen.findByRole("button", { name: /next/i }));
    expect(await screen.findByText("Page 2 of 2")).toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: /favorites only/i });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("John Lennon")).toBeInTheDocument();
    const last = listCalls(calls).at(-1);
    expect(last?.get("favorite")).toBe("true");
    expect(last?.get("offset")).toBe("0");
    expect(screen.queryByText("Song 1")).not.toBeInTheDocument();
  });

  it("filters that match nothing show the filtered empty message", async () => {
    mockBackend([RIPTIDE]);
    const user = userEvent.setup();
    renderGenerator();
    expect(await screen.findByText("Vance Joy")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /favorites only/i }));
    expect(
      await screen.findByText(/no songs match these filters/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/no searches yet/i)).not.toBeInTheDocument();
  });

  it("star click PATCHes the favorite and flips aria-pressed", async () => {
    const calls = mockBackend([RIPTIDE]);
    const user = userEvent.setup();
    renderGenerator();
    const star = await screen.findByRole("button", {
      name: /add riptide to favorites/i,
    });
    expect(star).toHaveAttribute("aria-pressed", "false");
    await user.click(star);

    const unstar = await screen.findByRole("button", {
      name: /remove riptide from favorites/i,
    });
    expect(unstar).toHaveAttribute("aria-pressed", "true");
    const patch = calls.find((c) => c.init?.method === "PATCH");
    expect(patch?.url).toMatch(new RegExp(`/history/${ENTRY_ID}$`));
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ favorite: true });
  });

  it("deleting the only entry on the last page falls back to the previous page", async () => {
    const entries = manyEntries(11);
    const calls = mockBackend(entries);
    const user = userEvent.setup();
    renderGenerator();
    await user.click(await screen.findByRole("button", { name: /next/i }));
    expect(await screen.findByText("Page 2 of 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /delete song 11/i }));
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    expect(await screen.findByText("Track 1")).toBeInTheDocument();
    expect(screen.queryByText("Track 11")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: /history pages/i }),
    ).not.toBeInTheDocument();
    expect(listCalls(calls).at(-1)?.get("offset")).toBe("0");
  });
});
