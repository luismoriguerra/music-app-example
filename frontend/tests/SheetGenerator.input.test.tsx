// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SheetGenerator } from "@/components/SheetGenerator";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SheetGenerator input states (T014)", () => {
  it("renders the song-name input with a single search-and-generate action (FR-003)", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const path = new URL(url, "http://test").pathname;
        if (path === "/api/v1/history") {
          return { ok: true, json: async () => ({ entries: [], total: 0 }) };
        }
        throw new Error(`unmocked ${path}`);
      }),
    );
    render(
      <SheetGenerator
        gamePath={"/courses/ukulele/games/lyrics-chords"}
        apiBaseUrl="http://test"
      />,
    );
    expect(screen.getByLabelText(/song name/i)).toBeInTheDocument();
    const actions = screen.getAllByRole("button", { name: /search|generate/i });
    expect(actions).toHaveLength(1);
  });

  it("keeps the song-name input at 16px so iOS Safari never auto-zooms on focus", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const path = new URL(url, "http://test").pathname;
        if (path === "/api/v1/history") {
          return { ok: true, json: async () => ({ entries: [], total: 0 }) };
        }
        throw new Error(`unmocked ${path}`);
      }),
    );
    render(
      <SheetGenerator
        gamePath={"/courses/ukulele/games/lyrics-chords"}
        apiBaseUrl="http://test"
      />,
    );
    // text-base = 16px: anything smaller triggers iOS focus zoom,
    // which visually breaks the mobile layout (page appears cropped).
    expect(screen.getByLabelText(/song name/i)).toHaveClass("text-base");
  });

  it("blocks empty submit with inline guidance and runs no search (FR-003)", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const path = new URL(url, "http://test").pathname;
      if (path === "/api/v1/history") {
        return { ok: true, json: async () => ({ entries: [], total: 0 }) };
      }
      throw new Error(`unexpected ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <SheetGenerator
        gamePath={"/courses/ukulele/games/lyrics-chords"}
        apiBaseUrl="http://test"
      />,
    );
    fetchMock.mockClear();

    await user.click(screen.getByRole("button", { name: /search|generate/i }));
    expect(screen.getByText(/enter a song name/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/song name/i), "   ");
    await user.click(screen.getByRole("button", { name: /search|generate/i }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces an error state with retry when the backend is unreachable (FR-007)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const path = new URL(url, "http://test").pathname;
        if (path === "/api/v1/history") {
          return { ok: true, json: async () => ({ entries: [], total: 0 }) };
        }
        throw new Error("down");
      }),
    );
    const user = userEvent.setup();
    render(
      <SheetGenerator
        gamePath={"/courses/ukulele/games/lyrics-chords"}
        apiBaseUrl="http://test"
      />,
    );

    await user.type(screen.getByLabelText(/song name/i), "Riptide");
    await user.click(screen.getByRole("button", { name: /search|generate/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn't reach/i,
    );
    // Input is preserved for retry (FR-007).
    expect(screen.getByLabelText(/song name/i)).toHaveValue("Riptide");
    expect(
      screen.getByRole("button", { name: /try again|retry/i }),
    ).toBeInTheDocument();
  });

  it("blames the service, not the connection, when the backend answers with an error (FR-007)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const path = new URL(url, "http://test").pathname;
        if (path === "/api/v1/history") {
          return { ok: true, json: async () => ({ entries: [], total: 0 }) };
        }
        return new Response(
          JSON.stringify({
            error: {
              code: "PROVIDER_ERROR",
              message: "Song search is temporarily unavailable.",
            },
          }),
          { status: 502, headers: { "content-type": "application/json" } },
        );
      }),
    );
    const user = userEvent.setup();
    render(
      <SheetGenerator
        gamePath={"/courses/ukulele/games/lyrics-chords"}
        apiBaseUrl="http://test"
      />,
    );

    await user.type(screen.getByLabelText(/song name/i), "Riptide");
    await user.click(screen.getByRole("button", { name: /search|generate/i }));

    const errorBox = await screen.findByRole("alert");
    expect(errorBox).toHaveTextContent(/returned an error/i);
    expect(errorBox).not.toHaveTextContent(/check your connection/i);
  });

  it("never renders a blank page: input stays mounted in every state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const path = new URL(url, "http://test").pathname;
        if (path === "/api/v1/history") {
          return { ok: true, json: async () => ({ entries: [], total: 0 }) };
        }
        throw new Error("down");
      }),
    );
    const user = userEvent.setup();
    render(
      <SheetGenerator
        gamePath={"/courses/ukulele/games/lyrics-chords"}
        apiBaseUrl="http://test"
      />,
    );
    await user.type(screen.getByLabelText(/song name/i), "Riptide");
    await user.click(screen.getByRole("button", { name: /search|generate/i }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText(/song name/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /search|generate/i }),
    ).toBeInTheDocument();
  });
});
