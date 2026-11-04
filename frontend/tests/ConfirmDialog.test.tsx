// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/components/ConfirmDialog";

describe("ConfirmDialog modal", () => {
  it("renders as a viewport-fixed overlay so long lists can't hide it below the fold", () => {
    render(
      <ConfirmDialog
        title="Delete this search?"
        description="Sure?"
        confirmLabel="Confirm delete"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    // Overlay wrapper centers the dialog in the viewport.
    const overlay = dialog.parentElement;
    expect(overlay?.className).toMatch(/fixed/);
    expect(overlay?.className).toMatch(/inset-0/);
    expect(overlay?.className).toMatch(/items-center/);
    expect(overlay?.className).toMatch(/justify-center/);
  });

  it("backdrop click cancels", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const { container } = render(
      <ConfirmDialog
        title="Delete this search?"
        description="Sure?"
        confirmLabel="Confirm delete"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    const backdrop = container.firstElementChild
      ?.firstElementChild as HTMLElement;
    await user.click(backdrop);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
