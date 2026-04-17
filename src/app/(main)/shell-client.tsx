"use client";

/**
 * ShellClient — client component owning mobile drawer state.
 *
 * P3-10: Extracted from layout.tsx to hold drawer open/close state while
 *        keeping the parent layout.tsx as an async server component (for auth).
 *
 * Exposes MobileNavContext so ShellHeader's hamburger button can toggle the
 * drawer without prop-drilling.
 *
 * Mobile nav pattern:
 *   < 768px  → sidebar hidden; hamburger in top bar; clicking opens a left
 *              drawer with full nav + backdrop to close.
 *   ≥ 768px  → persistent sidebar, drawer never renders.
 */

import { useState, createContext, useContext, useCallback } from "react";
import { ShellNav } from "./shell-nav";
import { ShellHeader } from "./shell-header";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Mobile nav context — consumed by ShellHeader to wire the toggle button
// ---------------------------------------------------------------------------

interface MobileNavContextValue {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

export const MobileNavContext = createContext<MobileNavContextValue>({
  isOpen: false,
  toggle: () => {},
  close: () => {},
});

export function useMobileNav(): MobileNavContextValue {
  return useContext(MobileNavContext);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShellClient({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const toggle = useCallback(() => setMobileNavOpen((v) => !v), []);
  const close = useCallback(() => setMobileNavOpen(false), []);

  return (
    <MobileNavContext.Provider value={{ isOpen: mobileNavOpen, toggle, close }}>
      <div className="flex min-h-screen bg-background">
        {/* ---------------------------------------------------------------- */}
        {/* Desktop sidebar — hidden on mobile, shown md+                    */}
        {/* ---------------------------------------------------------------- */}
        <aside
          className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex"
          aria-label="Sidebar navigation"
        >
          <ShellNav />
        </aside>

        {/* ---------------------------------------------------------------- */}
        {/* Mobile drawer — rendered only below md breakpoint               */}
        {/* ---------------------------------------------------------------- */}
        {mobileNavOpen && (
          <>
            {/* Backdrop */}
            <div
              aria-hidden="true"
              className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
              onClick={close}
            />
            {/* Drawer */}
            <aside
              aria-label="Mobile navigation drawer"
              role="dialog"
              aria-modal="true"
              className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-card md:hidden"
            >
              {/* Drawer header with close button */}
              <div className="flex h-14 items-center justify-between border-b px-3">
                <span className="text-sm font-semibold tracking-tight">
                  MeatyWiki
                </span>
                <button
                  type="button"
                  aria-label="Close navigation menu"
                  onClick={close}
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-md",
                    "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <svg
                    aria-hidden="true"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              {/* Nav items with close-on-click */}
              <ShellNav onNavClick={close} />
            </aside>
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Main column: top bar + content                                    */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex min-w-0 flex-1 flex-col">
          <ShellHeader />

          <main
            id="main-content"
            className="flex-1 overflow-y-auto p-4 md:p-6"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>
      </div>
    </MobileNavContext.Provider>
  );
}
