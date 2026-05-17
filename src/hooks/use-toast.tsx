"use client";

/**
 * use-toast — global toast context, provider, and hook.
 *
 * Implements the interim global toast provider for the Portal frontend.
 * All Portal components dispatch toasts via `useToast().add(...)`.
 *
 * Design:
 *   - React context (ToastContext) holds a shared queue of Toast objects.
 *   - ToastProvider manages the queue via useState; memoizes add/remove to
 *     prevent unnecessary re-renders.
 *   - useToast() is the public consumer API.
 *   - Auto-dismiss timers are tracked per toast ID in a Map<id, timeoutId>
 *     and cleaned up idempotently (safe to remove a toast whose timer already
 *     fired).
 *
 * Type defaults (per contract §5):
 *   success → 5 000 ms
 *   error   → 10 000 ms
 *   warning →  6 000 ms
 *   info    →  4 000 ms
 *
 * Future migration path: When @miethe/ui ships a global provider with a
 * compatible `useContext` API, replace ToastProvider + ToastContext here with
 * the upstream export. Component call sites do not need to change.
 *
 * Portal Global Toast Consolidation — F-13 full resolution.
 */

import { createContext, useCallback, useContext, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  /** ms; if omitted, the type-default is used by ToastProvider. */
  duration?: number;
}

export interface ToastContextType {
  toasts: Toast[];
  add(toast: Omit<Toast, "id">): void;
  remove(id: string): void;
}

// ---------------------------------------------------------------------------
// Auto-dismiss defaults (ms)
// ---------------------------------------------------------------------------

const DISMISS_DEFAULTS: Record<ToastType, number> = {
  success: 5_000,
  error: 10_000,
  warning: 6_000,
  info: 4_000,
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const ToastContext = createContext<ToastContextType | null>(null);

// ---------------------------------------------------------------------------
// Provider — this is what wraps the root layout
// ---------------------------------------------------------------------------

let toastIdCounter = 0;

/**
 * ToastProvider must be rendered above any component that calls useToast().
 * Place it in the root layout (src/app/layout.tsx) so all Portal routes share
 * the same global queue.
 *
 * @example
 * // src/app/layout.tsx
 * <ToastProvider>
 *   {children}
 *   <ToastRenderer />
 * </ToastProvider>
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Map from toast ID → setTimeout return value for cleanup
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: string) => {
    // Idempotent: clear the timer regardless of whether it already fired
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = `toast-${++toastIdCounter}`;
      const resolvedDuration = toast.duration ?? DISMISS_DEFAULTS[toast.type];

      setToasts((prev) => [...prev, { ...toast, id }]);

      // Schedule auto-dismiss
      const timer = setTimeout(() => {
        remove(id);
      }, resolvedDuration);
      timersRef.current.set(id, timer);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ toasts, add, remove }}>
      {children}
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook — public consumer API
// ---------------------------------------------------------------------------

/**
 * useToast — access the global toast queue.
 *
 * Must be called within a component tree that has a <ToastProvider> ancestor.
 * Throws if called outside a provider (development guard).
 *
 * @example
 * const { add } = useToast();
 * add({ message: "Approved!", type: "success" });
 * add({ message: "Failed to approve item #3", type: "error", duration: 12000 });
 */
export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (ctx === null) {
    throw new Error(
      "useToast() must be called inside a <ToastProvider>. " +
        "Ensure <ToastProvider> wraps your root layout.",
    );
  }
  return ctx;
}
