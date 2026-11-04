// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SheetEntry } from "@/components/SheetEntry";
import { navigateTo } from "@/lib/sheets/history-api";
import type * as HistoryApi from "@/lib/sheets/history-api";
import {
  historyGetResponseSchema,
  regenerateResponseSchema,
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
  id: "11111111-1111-4111-8111-111111111111",
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

const GET_RESPONSE = { entry_id: ENTRY_ID, favorite: false, sheet: SHEET };
const REGEN_RESPONSE = { entry_id: FRESH_ENTRY_ID, sheet: SHEET };
historyGetResponseSchema.parse(GET_RESPONSE);
regenerateResponseSchema.parse(REGEN_RESPONSE);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type Call = { url: string; init?: RequestInit };

function mockApi(
  entry: (init?: RequestInit) => Response = () => jsonResponse(GET_RESPONSE),
) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const path = new URL(url).pathname;
      if (path === `/api/v1/history/${ENTRY_ID}/regenerate`)
        return jsonResponse(REGEN_RESPONSE);
      if (path.startsWith("/api/v1/history/")) return entry(init);
      return jsonResponse({ error: { code: "NOT_FOUND" } }, 404);
    }),
  );
  return calls;
}

const entryCalls = (calls: Call[]) =>
  calls.filter((c) => new URL(c.url).pathname.startsWith("/api/v1/history/"));

function renderAt(id: string) {
  window.history.pushState({}, "", `${GAME_PATH}/${id}`);
  return render(
    <SheetEntry
      gamePath={GAME_PATH}
      gameTitle="Lyrics + Chords"
      coursePath="/courses/ukulele"
      courseTitle="Ukulele"
      apiBaseUrl="http://test"
    />,
  );
}

describe("SheetEntry dedicated sheet page (FR-009/015)", () => {
  it("renders the stored sheet with a breadcrumb ending in the song title", async () => {
    const calls = mockApi();
    renderAt(ENTRY_ID);

    expect(
      await screen.findByText("Lady, runnin' down to the riptide"),
    ).toBeInTheDocument();
    const crumb = screen.getByRole("navigation", { name: /breadcrumb/i });
    const links = within(crumb).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "Courses",
      "Ukulele",
      "Lyrics + Chords",
    ]);
    expect(links[2]).toHaveAttribute("href", GAME_PATH);
    const current = crumb.querySelector('[aria-current="page"]');
    expect(current).toHaveTextContent("Riptide");
    expect(crumb.lastElementChild).toBe(current);
    expect(
      screen.getByRole("link", { name: /riptide video/i }),
    ).toHaveAttribute("target", "_blank");
    // Exactly one stored-entry fetch; no provider calls.
    expect(entryCalls(calls)).toHaveLength(1);
    expect(entryCalls(calls)[0].url).toBe(
      `http://test/api/v1/history/${ENTRY_ID}`,
    );
  });

  it("malformed id → not-found view without fetching", async () => {
    const calls = mockApi();
    renderAt("not-a-uuid");
    expect(await screen.findByRole("alert")).toHaveTextContent(/not found/i);
    expect(
      screen.getByRole("link", { name: /back to generator/i }),
    ).toHaveAttribute("href", GAME_PATH);
    expect(calls).toHaveLength(0);
  });

  it("unknown id (404) → not-found view", async () => {
    mockApi(() => jsonResponse({ error: { code: "NOT_FOUND" } }, 404));
    renderAt("00000000-0000-4000-8000-000000000000");
    expect(await screen.findByRole("alert")).toHaveTextContent(/not found/i);
    expect(screen.getByRole("link", { name: /^home$/i })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("network failure → error with Try again that refetches", async () => {
    let fails = 1;
    mockApi(() =>
      fails-- > 0
        ? new Response(null, { status: 502 })
        : jsonResponse(GET_RESPONSE),
    );
    const user = userEvent.setup();
    renderAt(ENTRY_ID);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn't reach/i,
    );
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(
      await screen.findByText("Lady, runnin' down to the riptide"),
    ).toBeInTheDocument();
  });

  it("delete via confirm → DELETE then navigates back to the game page", async () => {
    const calls = mockApi((init) =>
      init?.method === "DELETE"
        ? new Response(null, { status: 204 })
        : jsonResponse(GET_RESPONSE),
    );
    const user = userEvent.setup();
    renderAt(ENTRY_ID);
    await screen.findByText("Lady, runnin' down to the riptide");

    const toolbar = screen.getByRole("group", { name: /sheet actions/i });
    await user.click(
      within(toolbar).getByRole("button", { name: /^delete$/i }),
    );
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      /second-voice analyses/i,
    );
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    await waitFor(() => expect(navigateTo).toHaveBeenCalledWith(GAME_PATH));
    expect(
      calls.some(
        (c) =>
          c.url.endsWith(`/history/${ENTRY_ID}`) && c.init?.method === "DELETE",
      ),
    ).toBe(true);
  });

  it("regenerate via confirm → navigates to the fresh entry's page", async () => {
    mockApi();
    const user = userEvent.setup();
    renderAt(ENTRY_ID);
    await screen.findByText("Lady, runnin' down to the riptide");

    const toolbar = screen.getByRole("group", { name: /sheet actions/i });
    await user.click(
      within(toolbar).getByRole("button", { name: /^regenerate$/i }),
    );
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: /^regenerate$/i,
      }),
    );
    await waitFor(() =>
      expect(navigateTo).toHaveBeenCalledWith(`${GAME_PATH}/${FRESH_ENTRY_ID}`),
    );
  });

  it("cancelling a confirm keeps the sheet and fires no request", async () => {
    const calls = mockApi();
    const user = userEvent.setup();
    renderAt(ENTRY_ID);
    await screen.findByText("Lady, runnin' down to the riptide");
    const before = calls.length;
    const toolbar = screen.getByRole("group", { name: /sheet actions/i });
    await user.click(
      within(toolbar).getByRole("button", { name: /^delete$/i }),
    );
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(calls.length).toBe(before);
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it("favorite star PATCHes and flips aria-pressed", async () => {
    const calls = mockApi((init) =>
      init?.method === "PATCH"
        ? jsonResponse({
            id: ENTRY_ID,
            query: "Riptide",
            matched_title: "Riptide",
            matched_performer: "Vance Joy",
            sheet_id: SHEET.id,
            created_at: SHEET.created_at,
            favorite: true,
          })
        : jsonResponse(GET_RESPONSE),
    );
    const user = userEvent.setup();
    renderAt(ENTRY_ID);
    const star = await screen.findByRole("button", {
      name: /^add to favorites$/i,
    });
    expect(star).toHaveAttribute("aria-pressed", "false");
    await user.click(star);
    expect(
      await screen.findByRole("button", { name: /^remove from favorites$/i }),
    ).toHaveAttribute("aria-pressed", "true");
    const patch = calls.find((c) => c.init?.method === "PATCH");
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ favorite: true });
  });
});
