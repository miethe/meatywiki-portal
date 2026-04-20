"use client";

/**
 * Dialog — minimal accessible modal dialog built without Radix UI.
 *
 * Provides focus trap, Esc-to-close, scroll lock, and ARIA modal semantics.
 * API mirrors shadcn/ui's Dialog (Dialog, DialogContent, DialogHeader,
 * DialogTitle) so it's a drop-in when Radix is added later.
 *
 * Focus trap: cycles focus through all focusable children on Tab/Shift-Tab.
 * Backdrop click closes the dialog (standard UX expectation).
 *
 * WCAG 2.1 AA: role="dialog", aria-modal="true", aria-labelledby connected
 * to DialogTitle.
 */

import {
  useEffect,
  useRef,
  useCallback,
  useId,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface DialogContextValue {
  titleId: string;
}

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("Dialog sub-component used outside <Dialog>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Focus trap helpers
// ---------------------------------------------------------------------------

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter(
    (el) => el.offsetParent !== null, // skip hidden elements
  );
}

// ---------------------------------------------------------------------------
// Dialog (container + state)
// ---------------------------------------------------------------------------

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const titleId = useId();

  return (
    <DialogContext.Provider value={{ titleId }}>
      {open && (
        <DialogPortal onClose={() => onOpenChange(false)} titleId={titleId}>
          {children}
        </DialogPortal>
      )}
    </DialogContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Portal + backdrop
// ---------------------------------------------------------------------------

interface DialogPortalProps {
  onClose: () => void;
  titleId: string;
  children: ReactNode;
}

function DialogPortal({ onClose, children }: DialogPortalProps) {
  useEffect(() => {
    // Scroll lock
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Global Esc listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Content layer */}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DialogContent
// ---------------------------------------------------------------------------

export interface DialogContentProps {
  children: ReactNode;
  className?: string;
  /** Pass undefined to suppress aria-describedby (shadcn compat). */
  "aria-describedby"?: string | undefined;
}

export function DialogContent({
  children,
  className,
  "aria-describedby": ariaDescribedBy,
}: DialogContentProps) {
  const { titleId } = useDialogContext();
  const contentRef = useRef<HTMLDivElement>(null);

  // Focus first focusable element on mount
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const focusable = getFocusable(el);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      el.focus();
    }
  }, []);

  // Focus trap + Esc handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;

    const el = contentRef.current;
    if (!el) return;
    const focusable = getFocusable(el);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  return (
    <div
      ref={contentRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={ariaDescribedBy}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative z-50 max-h-[90vh] w-full overflow-hidden rounded-xl bg-background shadow-2xl ring-1 ring-border",
        "animate-in fade-in-0 zoom-in-95 duration-200",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DialogHeader
// ---------------------------------------------------------------------------

export function DialogHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DialogTitle
// ---------------------------------------------------------------------------

export function DialogTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { titleId } = useDialogContext();
  return (
    <h2
      id={titleId}
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    >
      {children}
    </h2>
  );
}
