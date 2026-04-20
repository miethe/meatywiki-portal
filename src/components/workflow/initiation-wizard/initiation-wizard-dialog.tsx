"use client";

/**
 * InitiationWizardDialog — modal shell for InitiationWizard.
 *
 * Built on shadcn Dialog primitives for focus trapping, keyboard (Esc)
 * dismiss, and ARIA modal semantics. The dialog is uncontrolled by default:
 * the trigger renders a "New workflow" button that opens the wizard.
 *
 * Use `controlled` + `open` / `onOpenChange` for external state control
 * (e.g., opening from a context menu or deep-link).
 *
 * Accessibility:
 *   - Dialog traps focus inside the modal
 *   - Esc key closes the dialog (shadcn default)
 *   - aria-modal="true" set by Dialog.Content
 *   - Title provided via DialogTitle (screen-reader accessible)
 *
 * Traces FR-1.5-06 / P1.5-2-03.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InitiationWizard } from "./initiation-wizard";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InitiationWizardDialogProps {
  /**
   * When true the dialog is controlled externally via `open` / `onOpenChange`.
   * When false the component manages its own open state via the trigger button.
   */
  controlled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Optional artifact ID — passed through to the wizard for routing
   * recommendation context.
   */
  artifactId?: string;
  /** Custom trigger element. Defaults to a "New workflow" button. */
  trigger?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Default trigger button
// ---------------------------------------------------------------------------

interface TriggerButtonProps {
  onClick: () => void;
}

function TriggerButton({ onClick }: TriggerButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open workflow initiation wizard"
      className={[
        "inline-flex items-center gap-2 rounded-md border border-input",
        "bg-foreground px-4 py-2 text-sm font-semibold text-background",
        "transition-colors hover:bg-foreground/90",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      ].join(" ")}
    >
      {/* Plus icon */}
      <svg
        aria-hidden="true"
        className="size-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      New workflow
    </button>
  );
}

// ---------------------------------------------------------------------------
// InitiationWizardDialog
// ---------------------------------------------------------------------------

export function InitiationWizardDialog({
  controlled,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  artifactId,
  trigger,
}: InitiationWizardDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  const isOpen = controlled ? (controlledOpen ?? false) : uncontrolledOpen;
  const setOpen = controlled
    ? (controlledOnOpenChange ?? (() => undefined))
    : setUncontrolledOpen;

  return (
    <>
      {/* Trigger — only rendered when uncontrolled */}
      {!controlled &&
        (trigger ? (
          <span onClick={() => setOpen(true)}>{trigger}</span>
        ) : (
          <TriggerButton onClick={() => setOpen(true)} />
        ))}

      <Dialog open={isOpen} onOpenChange={setOpen}>
        <DialogContent
          className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0"
          aria-describedby={undefined}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Workflow Initiation Wizard</DialogTitle>
          </DialogHeader>

          <InitiationWizard
            artifactId={artifactId}
            onClose={() => setOpen(false)}
            className="flex-1 min-h-0"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
