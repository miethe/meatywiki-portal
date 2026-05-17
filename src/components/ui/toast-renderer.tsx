"use client";

/**
 * ToastRenderer — renders the global toast queue as a fixed overlay.
 *
 * Consumes ToastContext via useToast(). Renders a vertical stack of toasts
 * fixed at bottom-right (z-50). Each toast:
 *   - Carries a role="status" (success/info) or role="alert" (error/warning)
 *     for screen-reader announcement.
 *   - Displays a type-appropriate icon.
 *   - Has an explicit close button for manual dismiss.
 *   - Auto-dismisses per the duration set by the ToastProvider.
 *
 * Place this as a sibling of {children} inside <ToastProvider> in the root layout.
 *
 * @example
 * <ToastProvider>
 *   {children}
 *   <ToastRenderer />
 * </ToastProvider>
 *
 * Portal Global Toast Consolidation — F-13 full resolution.
 */

import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Toast, ToastType } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Type-based style config
// ---------------------------------------------------------------------------

const TOAST_STYLES: Record<ToastType, string> = {
  success:
    "border-emerald-500/30 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-950/80 dark:text-emerald-300",
  error:
    "border-destructive/30 bg-destructive/5 text-destructive",
  warning:
    "border-amber-500/30 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-950/80 dark:text-amber-300",
  info:
    "border-blue-500/30 bg-blue-50 text-blue-800 dark:border-blue-500/20 dark:bg-blue-950/80 dark:text-blue-300",
};

const DISMISS_BUTTON_STYLES: Record<ToastType, string> = {
  success: "text-emerald-800 dark:text-emerald-300",
  error: "text-destructive",
  warning: "text-amber-800 dark:text-amber-300",
  info: "text-blue-800 dark:text-blue-300",
};

// ---------------------------------------------------------------------------
// Icon components
// ---------------------------------------------------------------------------

function SuccessIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 14l2-2m0 0 2-2m-2 2-2-2m2 2 2 2m7-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
      />
    </svg>
  );
}

const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
  success: <SuccessIcon />,
  error: <ErrorIcon />,
  warning: <WarningIcon />,
  info: <InfoIcon />,
};

// ---------------------------------------------------------------------------
// Single toast item
// ---------------------------------------------------------------------------

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const isAlert = toast.type === "error" || toast.type === "warning";

  return (
    <div
      role={isAlert ? "alert" : "status"}
      aria-live={isAlert ? "assertive" : "polite"}
      aria-label={toast.message}
      className={cn(
        "flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium shadow-lg",
        "transition-all duration-200",
        TOAST_STYLES[toast.type],
      )}
    >
      {TOAST_ICONS[toast.type]}
      <span>{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        className={cn(
          "ml-1 shrink-0 rounded-sm p-0.5 opacity-70 transition-opacity hover:opacity-100",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          DISMISS_BUTTON_STYLES[toast.type],
        )}
      >
        <svg
          aria-hidden="true"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18 18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Renderer — renders the full toast stack
// ---------------------------------------------------------------------------

/**
 * ToastRenderer — the fixed overlay that renders all active toasts.
 *
 * Stack is flex-col (newest at bottom). Position: fixed bottom-4 right-4 z-50.
 * Multiple toasts stack vertically without overlapping.
 */
export function ToastRenderer() {
  const { toasts, remove } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={remove} />
      ))}
    </div>
  );
}
