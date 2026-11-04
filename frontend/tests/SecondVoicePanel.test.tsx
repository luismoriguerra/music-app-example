/** @vitest-environment jsdom */
import { describe, expect, it, vi, afterEach } from "vitest";
import { StrictMode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SecondVoicePanel } from "@/components/SecondVoicePanel";
import type { Sheet } from "@/lib/sheets/schemas";

afterEach(() => {
  vi.unstubAllGlobals();
});

const SHEET_ID = "123e4567-e89b-42d3-a456-426614174000";

function sheet(chordSource: Sheet["chord_source"] = "chart"): Sheet {
  return {
    id: SHEET_ID,
    query: "Hallelujah",
    matched_title: "Hallelujah",
    matched_performer: "Pentatonix",
    lyric_source: "chart",
    lyric_source_url: "https://tabs.example.com/tab/1",
    chord_source: chordSource,
    chord_source_url:
      chordSource === "chart" ? "https://tabs.example.com/tab/1" : null,
    model_id: null,
    body: {
      sections: [
        {
          heading: "Verse 1",
          lines: [
            {
              text: "I've heard there was a secret chord",
              chords:
                chordSource === "none"
                  ? []
                  : [
                      { offset: 0, symbol: "C" },
                      { offset: 11, symbol: "Am" },
                    ],
            },
          ],
        },
      ],
    },
    source_links: [],
    degraded: [],
    capo: null,
    tuning_note: null,
    created_at: "2026-09-17T00:00:00Z",
  };
}

const GOLDEN_OUT = {
  key: { tonic: "C", mode: "major", justification: "Uses C, Am, F and G." },
  scale: ["C", "D", "E", "F", "G", "A", "B"],
  diatonic_chords: [
    { degree: "I", chord: "C" },
    { degree: "ii", chord: "Dm" },
    { degree: "iii", chord: "Em" },
    { degree: "IV", chord: "F" },
    { degree: "V", chord: "G" },
    { degree: "vi", chord: "Am" },
    { degree: "vii°", chord: "Bdim" },
  ],
  progression: [
    { section: "Verse 1", chords: ["C", "Am"], degrees: ["I", "vi"] },
  ],
  special_chords: [],
  cadences: [],
  section_feel: [{ section: "Verse 1", feeling: "Stable." }],
  second_voice: {
    melody_status: "missing",
    strategy: "Use thirds above.",
    up: null,
    down: null,
    recommendation: null,
  },
  note_table: [
    {
      section: "Verse 1",
      lyric_snippet: "I've heard there was",
      chord: "C",
      first_voice: null,
      second_voice: null,
      interval: null,
      explanation: "No melody.",
    },
  ],
  singing_tips: ["Listen to the chord."],
};

function analysisRow(
  transpose: number,
  id = "223e4567-e89b-42d3-a456-426614174001",
) {
  return {
    id,
    sheet_id: SHEET_ID,
    transpose,
    model_id: "openrouter/test-model",
    analysis: GOLDEN_OUT,
    created_at: "2026-09-17T00:00:00Z",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const LIST_PATH = `/api/v1/sheets/${SHEET_ID}/second-voice`;

function renderPanel(
  transpose = 5,
  chordSource: Sheet["chord_source"] = "chart",
) {
  return render(
    <SecondVoicePanel
      displaySheet={sheet(chordSource)}
      transpose={transpose}
      apiBaseUrl="http://test"
    />,
  );
}

/**
 * Route-aware stub for the analyze flow: GET history resolves to `history`
 * (empty by default), POST analyze echoes the posted transpose back as a
 * full row unless `postImpl` overrides it.
 */
function stubAnalyzeApi(options?: {
  history?: unknown[];
  postImpl?: () => Promise<Response>;
}) {
  const history = options?.history ?? [];
  const postImpl = options?.postImpl;
  const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
    const href = String(url);
    const method = init?.method ?? "GET";
    const path = new URL(href, "http://test").pathname;
    if (path === LIST_PATH && method === "GET") {
      return jsonResponse({ analyses: history, total: history.length });
    }
    if (path === LIST_PATH && method === "POST") {
      if (postImpl) return postImpl();
      const payload = JSON.parse(init?.body as string) as {
        transpose: number;
      };
      return jsonResponse({ analysis: analysisRow(payload.transpose) });
    }
    throw new Error(`unmocked ${method} ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock };
}

function postCalls(fetchMock: ReturnType<typeof stubAnalyzeApi>["fetchMock"]) {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
}

describe("SecondVoicePanel (T013, 006)", () => {
  it("renders the trigger with Tr. context", async () => {
    stubAnalyzeApi();
    renderPanel(5);
    const trigger = screen.getByRole("button", { name: /ai 2nd voice/i });
    expect(trigger).toBeInTheDocument();
    expect(screen.getByText("Tr. +5")).toBeInTheDocument();
    // Empty history settles into the auto-generated analysis.
    expect(
      await screen.findByTestId("second-voice-analysis"),
    ).toBeInTheDocument();
  });

  it("hides the trigger for lyrics-only sheets", () => {
    const { container } = renderPanel(0, "none");
    expect(
      screen.queryByRole("button", { name: /ai 2nd voice/i }),
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("auto-generates on first load when the song has no saved analysis", async () => {
    const { fetchMock } = stubAnalyzeApi();
    renderPanel(5);

    const region = await screen.findByTestId("second-voice-analysis");
    expect(region).toBeInTheDocument();
    expect(screen.getByText("@Tr. +5")).toBeInTheDocument();

    // POSTs the rendered snapshot once; never lyric text
    const posts = postCalls(fetchMock);
    expect(posts).toHaveLength(1);
    const [url, init] = posts[0];
    expect(url).toBe(`http://test/api/v1/sheets/${SHEET_ID}/second-voice`);
    const payload = JSON.parse(init?.body as string);
    expect(payload.transpose).toBe(5);
    expect(payload.chords_by_line).toHaveLength(1);
    expect(JSON.stringify(payload)).not.toContain("secret chord");
  });

  it("auto-generates exactly once under StrictMode double effects", async () => {
    const { fetchMock } = stubAnalyzeApi();
    render(
      <StrictMode>
        <SecondVoicePanel
          displaySheet={sheet()}
          transpose={5}
          apiBaseUrl="http://test"
        />
      </StrictMode>,
    );
    await screen.findByTestId("second-voice-analysis");
    expect(postCalls(fetchMock)).toHaveLength(1);
  });

  it("shows the generating animation and disables the trigger while in flight", async () => {
    let release!: (v: Response) => void;
    const gate = new Promise<Response>((resolve) => {
      release = resolve;
    });
    stubAnalyzeApi({ postImpl: () => gate });
    renderPanel(5);

    const status = await screen.findByRole("status", {
      name: /analyzing at tr\. \+5/i,
    });
    expect(status).toHaveAttribute("data-testid", "second-voice-generating");
    expect(status).toHaveTextContent(/generating your 2nd-voice analysis/i);
    const trigger = screen.getByRole("button", { name: /ai 2nd voice/i });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute("aria-busy", "true");
    release(jsonResponse({ analysis: analysisRow(5) }));
    await screen.findByTestId("second-voice-analysis");
    expect(
      screen.queryByTestId("second-voice-generating"),
    ).not.toBeInTheDocument();
  });

  it("error → retry preserves the sheet and stepper", async () => {
    let attempts = 0;
    const { fetchMock } = stubAnalyzeApi({
      postImpl: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("boom");
        return jsonResponse({ analysis: analysisRow(5) });
      },
    });
    const user = userEvent.setup();
    renderPanel(5);

    // The automatic first run fails; Retry is the explicit second run.
    const alert = await screen.findByRole("alert");
    expect(alert).toBeInTheDocument();
    await user.click(within(alert).getByRole("button", { name: /retry/i }));
    expect(
      await screen.findByTestId("second-voice-analysis"),
    ).toBeInTheDocument();
    expect(screen.getByText("Tr. +5")).toBeInTheDocument();
    expect(postCalls(fetchMock)).toHaveLength(2);
  });

  it("stepper change marks stale with a one-action re-run", async () => {
    const { fetchMock } = stubAnalyzeApi();
    const user = userEvent.setup();
    const view = renderPanel(5);
    await screen.findByTestId("second-voice-analysis");

    view.rerender(
      <SecondVoicePanel
        displaySheet={sheet()}
        transpose={3}
        apiBaseUrl="http://test"
      />,
    );
    expect(
      screen.getByText("Computed at Tr. +5 — showing Tr. +3"),
    ).toBeInTheDocument();
    // Stale analyses stay readable.
    expect(screen.getByTestId("second-voice-analysis")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /re-run at tr\. \+3/i }),
    );
    const dialog = screen.getByRole("alertdialog");
    expect(
      within(dialog).getByText(/regenerate second voice analysis\?/i),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: /^regenerate$/i }),
    );
    await screen.findByText("@Tr. +3");
    const posts = postCalls(fetchMock);
    expect(posts).toHaveLength(2);
    const lastPayload = JSON.parse(posts[1][1]?.body as string);
    expect(lastPayload.transpose).toBe(3);
  });

  it("toolbar shows Regenerate once analysis exists; confirms before run", async () => {
    const { fetchMock } = stubAnalyzeApi();
    const user = userEvent.setup();
    renderPanel(5);
    await screen.findByTestId("second-voice-analysis");

    // Once an analysis exists, toolbar shows Regenerate, NOT the generate button.
    const regen = screen.getByRole("button", { name: /^regenerate$/i });
    expect(regen).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /ai 2nd voice/i }),
    ).not.toBeInTheDocument();

    // Clicking Regenerate opens the confirm dialog; cancel aborts with no POST.
    await user.click(regen);
    let dialog = screen.getByRole("alertdialog");
    expect(
      within(dialog).getByText(/regenerate second voice analysis\?/i),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(postCalls(fetchMock)).toHaveLength(1);

    // Confirming in the dialog performs the regeneration.
    await user.click(regen);
    dialog = screen.getByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: /^regenerate$/i }),
    );
    expect(
      await screen.findByTestId("second-voice-analysis"),
    ).toBeInTheDocument();
    expect(postCalls(fetchMock)).toHaveLength(2);
  });
});

describe("SecondVoicePanel history wiring (T025, 006)", () => {
  const SUMMARIES = [
    {
      id: "223e4567-e89b-42d3-a456-426614174001",
      sheet_id: SHEET_ID,
      transpose: 5,
      model_id: "openrouter/test-model",
      created_at: "2026-09-17T02:00:00Z",
    },
    {
      id: "323e4567-e89b-42d3-a456-426614174002",
      sheet_id: SHEET_ID,
      transpose: 0,
      model_id: "openrouter/test-model",
      created_at: "2026-09-17T00:00:00Z",
    },
  ];

  function mockHistoryApi() {
    const calls: Array<{ url: string; method: string }> = [];
    let list = [...SUMMARIES];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        calls.push({ url, method });
        const path = new URL(url, "http://test").pathname;
        if (
          path === `/api/v1/sheets/${SHEET_ID}/second-voice` &&
          method === "GET"
        ) {
          return jsonResponse({ analyses: list, total: list.length });
        }
        if (
          path ===
            "/api/v1/second-voice/223e4567-e89b-42d3-a456-426614174001" &&
          method === "GET"
        ) {
          return jsonResponse({
            analysis: analysisRow(5, "223e4567-e89b-42d3-a456-426614174001"),
          });
        }
        if (
          path ===
            "/api/v1/second-voice/323e4567-e89b-42d3-a456-426614174002" &&
          method === "GET"
        ) {
          return jsonResponse({
            analysis: analysisRow(0, "323e4567-e89b-42d3-a456-426614174002"),
          });
        }
        if (path.startsWith("/api/v1/second-voice/") && method === "DELETE") {
          list = list.filter((e) => `/api/v1/second-voice/${e.id}` !== path);
          return new Response(null, { status: 204 });
        }
        throw new Error(`unmocked ${method} ${path}`);
      }),
    );
    return calls;
  }

  it("toggle fetches and lists entries newest-first", async () => {
    mockHistoryApi();
    const user = userEvent.setup();
    render(
      <SecondVoicePanel
        displaySheet={sheet()}
        transpose={5}
        apiBaseUrl="http://test"
      />,
    );
    await user.click(screen.getByRole("button", { name: /past analyses/i }));
    const historyList = await screen.findByRole("list", {
      name: /past analyses/i,
    });
    const rows = within(historyList).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("@Tr. +5")).toBeInTheDocument();
  });

  it("selecting an entry re-opens it with zero POSTs", async () => {
    const calls = mockHistoryApi();
    const user = userEvent.setup();
    render(
      <SecondVoicePanel
        displaySheet={sheet()}
        transpose={5}
        apiBaseUrl="http://test"
      />,
    );
    await user.click(screen.getByRole("button", { name: /past analyses/i }));
    const historyList = await screen.findByRole("list", {
      name: /past analyses/i,
    });
    const rows = within(historyList).getAllByRole("listitem");
    await user.click(
      within(rows[1]).getByRole("button", { name: /open analysis/i }),
    );
    const region = await screen.findByTestId("second-voice-analysis");
    expect(within(region).getByText("@Tr. 0")).toBeInTheDocument();
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("delete confirms, removes, and refetches", async () => {
    mockHistoryApi();
    const user = userEvent.setup();
    render(
      <SecondVoicePanel
        displaySheet={sheet()}
        transpose={5}
        apiBaseUrl="http://test"
      />,
    );
    await user.click(screen.getByRole("button", { name: /past analyses/i }));
    const historyList = await screen.findByRole("list", {
      name: /past analyses/i,
    });
    let rows = within(historyList).getAllByRole("listitem");
    await user.click(
      within(rows[0]).getByRole("button", { name: /delete analysis/i }),
    );
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/hallelujah/i)).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: /confirm delete/i }),
    );
    await screen.findByText("@Tr. 0");
    rows = within(historyList).getAllByRole("listitem");
    expect(rows).toHaveLength(1);
  });
});

describe("SecondVoicePanel initial load (006)", () => {
  const SUMMARIES = [
    {
      id: "223e4567-e89b-42d3-a456-426614174001",
      sheet_id: SHEET_ID,
      transpose: 5,
      model_id: "openrouter/test-model",
      created_at: "2026-09-17T02:00:00Z",
    },
    {
      id: "323e4567-e89b-42d3-a456-426614174002",
      sheet_id: SHEET_ID,
      transpose: 0,
      model_id: "openrouter/test-model",
      created_at: "2026-09-17T00:00:00Z",
    },
  ];

  function stubHistory(list = SUMMARIES) {
    const calls: Array<{ url: string; method: string }> = [];
    const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
      const href = String(url);
      const method = init?.method ?? "GET";
      calls.push({ url: href, method });
      const path = new URL(href, "http://test").pathname;
      if (path === LIST_PATH && method === "GET") {
        return jsonResponse({ analyses: list, total: list.length });
      }
      const one = list.find((e) => path === `/api/v1/second-voice/${e.id}`);
      if (one && method === "GET") {
        return jsonResponse({ analysis: analysisRow(one.transpose, one.id) });
      }
      throw new Error(`unmocked ${method} ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    return { fetchMock, calls };
  }

  it("auto-opens the latest saved analysis on mount with zero POSTs", async () => {
    const { calls } = stubHistory();
    renderPanel(5);
    const region = await screen.findByTestId("second-voice-analysis");
    expect(within(region).getByText("@Tr. +5")).toBeInTheDocument();
    expect(calls.every((c) => c.method === "GET")).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it("auto-open prefers the newest entry at the current transpose", async () => {
    const { calls } = stubHistory();
    renderPanel(0);
    const region = await screen.findByTestId("second-voice-analysis");
    expect(within(region).getByText("@Tr. 0")).toBeInTheDocument();
    expect(calls.map((c) => new URL(c.url, "http://test").pathname)).toEqual([
      LIST_PATH,
      "/api/v1/second-voice/323e4567-e89b-42d3-a456-426614174002",
    ]);
  });

  it("history failure shows retry; recovering to empty auto-generates once", async () => {
    let historyFails = true;
    const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
      const href = String(url);
      const method = init?.method ?? "GET";
      const path = new URL(href, "http://test").pathname;
      if (path === LIST_PATH && method === "GET") {
        if (historyFails) {
          return jsonResponse(
            { error: { message: "History failed (500)." } },
            500,
          );
        }
        return jsonResponse({ analyses: [], total: 0 });
      }
      if (path === LIST_PATH && method === "POST") {
        return jsonResponse({ analysis: analysisRow(5) });
      }
      throw new Error(`unmocked ${method} ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPanel(5);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("History failed (500).");
    // A failed history load never spends a model call.
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "POST"),
    ).toBe(false);

    // Retry loading recovers to an empty history, which auto-generates.
    historyFails = false;
    await user.click(
      within(alert).getByRole("button", { name: /retry loading/i }),
    );
    await screen.findByTestId("second-voice-analysis");
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === "POST"),
    ).toHaveLength(1);
  });
});
