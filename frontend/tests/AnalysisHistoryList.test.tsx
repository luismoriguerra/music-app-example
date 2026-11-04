/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnalysisHistoryList } from "@/components/AnalysisHistoryList";
import type { SecondVoiceSummary } from "@/lib/sheets/schemas";

const SHEET_ID = "123e4567-e89b-42d3-a456-426614174000";

const ENTRIES: SecondVoiceSummary[] = [
  {
    id: "new-id",
    sheet_id: SHEET_ID,
    transpose: 5,
    model_id: "openrouter/test-model",
    created_at: "2026-09-17T02:00:00Z",
  },
  {
    id: "old-id",
    sheet_id: SHEET_ID,
    transpose: 0,
    model_id: "openrouter/test-model",
    created_at: "2026-09-17T00:00:00Z",
  },
];

function renderList(
  over: Partial<Parameters<typeof AnalysisHistoryList>[0]> = {},
) {
  const onOpen = vi.fn();
  const onDelete = vi.fn();
  const view = render(
    <AnalysisHistoryList
      entries={ENTRIES}
      songTitle="Hallelujah"
      selectedId={null}
      onOpen={onOpen}
      onDelete={onDelete}
      {...over}
    />,
  );
  return { onOpen, onDelete, view };
}

describe("AnalysisHistoryList (T022, 006)", () => {
  it("renders newest-first rows with badge, timestamp, and model", () => {
    renderList();
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("@Tr. +5")).toBeInTheDocument();
    expect(within(rows[1]).getByText("@Tr. 0")).toBeInTheDocument();
    expect(screen.getAllByText(/openrouter\/test-model/i)).toHaveLength(2);
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("marks the selected entry", () => {
    renderList({ selectedId: "old-id" });
    const rows = screen.getAllByRole("listitem");
    expect(rows[1]).toHaveAttribute("aria-current", "true");
    expect(rows[0]).not.toHaveAttribute("aria-current");
  });

  it("shows the empty state when no analyses exist", () => {
    renderList({ entries: [] });
    expect(
      screen.getByText(
        "No analyses yet for this song — completed runs will appear here",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("open action calls onOpen with the entry id", async () => {
    const user = userEvent.setup();
    const { onOpen } = renderList();
    const rows = screen.getAllByRole("listitem");
    await user.click(
      within(rows[1]).getByRole("button", { name: /open analysis/i }),
    );
    expect(onOpen).toHaveBeenCalledWith("old-id");
  });

  it("delete asks for confirmation naming the song and offset", async () => {
    const user = userEvent.setup();
    const { onDelete } = renderList();
    const rows = screen.getAllByRole("listitem");
    await user.click(
      within(rows[0]).getByRole("button", { name: /delete analysis/i }),
    );
    const dialog = screen.getByRole("alertdialog");
    expect(
      within(dialog).getByText(/hallelujah.*tr\. \+5|tr\. \+5.*hallelujah/i),
    ).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(
      within(dialog).getByRole("button", { name: /confirm delete/i }),
    );
    expect(onDelete).toHaveBeenCalledWith("new-id");
  });

  it("cancel and Escape abort the delete", async () => {
    const user = userEvent.setup();
    const { onDelete } = renderList();
    const rows = screen.getAllByRole("listitem");

    await user.click(
      within(rows[0]).getByRole("button", { name: /delete analysis/i }),
    );
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: /cancel/i,
      }),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(
      within(rows[0]).getByRole("button", { name: /delete analysis/i }),
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
