// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistoryList } from "@/components/HistoryList";
import {
  historyListResponseSchema,
  type HistoryEntry,
} from "@/lib/sheets/schemas";

const ENTRIES = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    query: "Imagine",
    matched_title: "Imagine",
    matched_performer: "John Lennon",
    sheet_id: "44444444-4444-4444-8444-444444444444",
    created_at: "2026-09-16T00:02:00Z",
    favorite: true,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    query: "Riptide",
    matched_title: "Riptide",
    matched_performer: "Vance Joy",
    sheet_id: "11111111-1111-4111-8111-111111111111",
    created_at: "2026-09-16T00:01:00Z",
    favorite: false,
  },
] satisfies HistoryEntry[];

// Contract guard: fixtures match the REST history envelope.
historyListResponseSchema.parse({ entries: ENTRIES, total: 2 });

const entryHref = (entry: HistoryEntry): string => `/sheets/${entry.id}`;

function renderList(overrides = {}) {
  const onRegenerate = vi.fn();
  const onDelete = vi.fn();
  const onToggleFavorite = vi.fn();
  const utils = render(
    <HistoryList
      entries={ENTRIES}
      entryHref={entryHref}
      onRegenerate={onRegenerate}
      onDelete={onDelete}
      onToggleFavorite={onToggleFavorite}
      {...overrides}
    />,
  );
  return { onRegenerate, onDelete, onToggleFavorite, ...utils };
}

describe("HistoryList (T045)", () => {
  it("renders newest-first rows with query + matched song", () => {
    renderList();
    const rows = screen.getByRole("list", { name: /search history/i });
    expect(rows.children).toHaveLength(2);
    // Newest first, as given.
    expect(rows.textContent?.indexOf("Imagine") ?? -1).toBeLessThan(
      rows.textContent?.indexOf("Riptide") ?? Infinity,
    );
    expect(screen.getAllByText("Imagine")).toHaveLength(2); // query + title
    expect(screen.getByText("John Lennon")).toBeInTheDocument();
    expect(screen.getByText("Vance Joy")).toBeInTheDocument();
  });

  it("title and open icon link to the entry's sheet page", () => {
    renderList();
    const opens = screen.getAllByRole("link", { name: /open imagine/i });
    expect(opens).toHaveLength(2);
    for (const link of opens)
      expect(link).toHaveAttribute("href", `/sheets/${ENTRIES[0].id}`);
  });

  it("star reflects favorite state and fires onToggleFavorite", async () => {
    const user = userEvent.setup();
    const { onToggleFavorite } = renderList();
    expect(
      screen.getByRole("button", { name: /remove imagine from favorites/i }),
    ).toHaveAttribute("aria-pressed", "true");
    const add = screen.getByRole("button", {
      name: /add riptide to favorites/i,
    });
    expect(add).toHaveAttribute("aria-pressed", "false");
    await user.click(add);
    expect(onToggleFavorite).toHaveBeenCalledWith(ENTRIES[1]);
  });

  it("custom empty message replaces the default", () => {
    renderList({ entries: [], emptyMessage: "No songs match these filters." });
    expect(screen.getByRole("status")).toHaveTextContent(
      "No songs match these filters.",
    );
  });

  it("regenerate asks for confirmation; confirm → onRegenerate, cancel keeps it", async () => {
    const user = userEvent.setup();
    const { onRegenerate } = renderList();
    await user.click(
      screen.getByRole("button", { name: /regenerate riptide/i }),
    );
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent(/regenerate this sheet/i);
    expect(dialog).toHaveTextContent("Riptide");
    expect(onRegenerate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onRegenerate).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: /regenerate riptide/i }),
    );
    await user.click(screen.getByRole("button", { name: /^regenerate$/i }));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
    expect(onRegenerate).toHaveBeenCalledWith(ENTRIES[1]);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("empty → friendly no-searches-yet state", () => {
    renderList({ entries: [] });
    expect(screen.getByRole("status")).toHaveTextContent(/no searches yet/i);
  });

  it("loading → indicator", () => {
    renderList({ isLoading: true });
    expect(screen.getByRole("status")).toHaveTextContent(/loading history/i);
  });

  it("error + retry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderList({ entries: [], error: "history exploded", onRetry });
    expect(screen.getByRole("alert")).toHaveTextContent("history exploded");
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("regenerating row shows progress and disables its button", () => {
    renderList({ regeneratingId: ENTRIES[1].id });
    const button = screen.getByRole("button", {
      name: /regenerating riptide/i,
    });
    expect(button).toBeDisabled();
  });

  it("renders as responsive grid cards without scroll controls", () => {
    renderList();
    expect(
      screen.queryByRole("button", { name: /scroll history/i }),
    ).not.toBeInTheDocument();
    const list = screen.getByRole("list", { name: /search history/i });
    expect(list.className).toMatch(/grid/);
    expect(list.className).toMatch(/sm:grid-cols-2/);
    expect(list.className).not.toMatch(/overflow-x-auto/);
    expect(list.className).not.toMatch(/snap-x/);
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect((items[0] as HTMLElement).className).toMatch(/w-full/);
  });

  it("shows each card's created time via time[dateTime]", () => {
    renderList();
    const times = document.querySelectorAll("time");
    expect(times).toHaveLength(2);
    for (const entry of ENTRIES) {
      const time = document.querySelector(
        `time[dateTime="${entry.created_at}"]`,
      );
      expect(time).toBeInTheDocument();
      expect(time?.textContent?.length).toBeGreaterThan(0);
    }
  });

  it("sorts cards newest-first by created_at even when passed out of order", () => {
    renderList({ entries: [...ENTRIES].reverse() });
    const rows = screen.getByRole("list", { name: /search history/i });
    expect(rows.textContent?.indexOf("Imagine") ?? -1).toBeLessThan(
      rows.textContent?.indexOf("Riptide") ?? Infinity,
    );
  });

  it("delete asks for confirmation; cancel keeps the entry", async () => {
    const user = userEvent.setup();
    const { onDelete } = renderList();
    await user.click(screen.getByRole("button", { name: /delete imagine/i }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Imagine");
    expect(dialog).toHaveTextContent(/second-voice analyses/i);
    expect(dialog).toHaveTextContent(/be undone/i);
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("confirming delete fires onDelete with the entry and closes", async () => {
    const user = userEvent.setup();
    const { onDelete } = renderList();
    await user.click(screen.getByRole("button", { name: /delete riptide/i }));
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(ENTRIES[1]);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("escape dismisses the confirm dialog", async () => {
    const user = userEvent.setup();
    const { onDelete } = renderList();
    await user.click(screen.getByRole("button", { name: /delete imagine/i }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("confirm dialog keeps focus on Confirm across parent re-renders", async () => {
    const user = userEvent.setup();
    const { rerender } = renderList();
    await user.click(screen.getByRole("button", { name: /^delete imagine$/i }));
    const dialog = screen.getByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", {
      name: /^confirm delete$/i,
    });
    expect(
      within(dialog).getByRole("button", { name: /^cancel$/i }),
    ).toHaveFocus();
    confirm.focus();
    // New callback closures every render, as the island does.
    rerender(
      <HistoryList
        entries={ENTRIES}
        entryHref={entryHref}
        onRegenerate={vi.fn()}
        onDelete={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );
    expect(confirm).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("deleting row shows progress and disables its buttons", () => {
    renderList({ deletingId: ENTRIES[0].id });
    expect(
      screen.getByRole("button", { name: /deleting imagine/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /^regenerate imagine$/i }),
    ).toBeDisabled();
  });
});
