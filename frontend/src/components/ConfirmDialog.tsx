import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

export interface ConfirmDialogProps {
  /** Dialog heading, e.g. "Delete this search?" */
  title: string;
  /** Explanatory body; may contain inline markup. */
  description: ReactNode;
  /** Confirm button label, e.g. "Confirm delete". */
  confirmLabel: string;
  /** Optional leading icon for the confirm button. */
  confirmIcon?: ReactNode;
  /** Destructive styling (red) vs neutral. */
  tone?: "destructive" | "neutral";
  onConfirm: () => void;
  onCancel: () => void;
}

const TEXT_BUTTON =
  "bg-secondary text-secondary-foreground inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium hover:opacity-90";

/**
 * Modal confirm dialog used before irreversible or expensive actions
 * (history delete, regenerate). Rendered as a fixed overlay so it is always
 * visible in the viewport — even when triggered from a card deep inside a
 * long (20+ entry) history list, where the previous inline placement left
 * the confirmation far below the fold and delete appeared broken. The
 * backdrop blocks the page and a backdrop tap cancels; Escape cancels
 * (FR-014). Focuses Cancel on open. Ids come from useId so two dialogs
 * (card + sheet toolbar) can coexist without collisions.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  confirmIcon,
  tone = "neutral",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  // Focus Cancel once on mount only. Callers pass fresh onCancel closures
  // every render, so keying this on onCancel would re-steal focus (e.g. off
  // Confirm) on any parent re-render while the dialog is open.
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Lock background scroll while the modal is open (mobile: the history
  // list behind the overlay must not scroll away from the dialog).
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onCancelRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const border =
    tone === "destructive" ? "border-destructive/50" : "border-border";
  const confirmClass =
    tone === "destructive"
      ? "bg-destructive text-destructive-foreground"
      : "bg-primary text-primary-foreground";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        onClick={onCancel}
        className="absolute inset-0 bg-black/60"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={`${border} bg-card relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border p-4 text-sm shadow-lg`}
      >
        <h3 id={titleId} className="font-semibold">
          {title}
        </h3>
        <p id={descId} className="text-muted-foreground mt-1">
          {description}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            ref={cancelRef}
            onClick={onCancel}
            className={TEXT_BUTTON}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`${confirmClass} inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium hover:opacity-90`}
          >
            {confirmIcon}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
