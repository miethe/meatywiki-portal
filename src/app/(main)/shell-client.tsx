"use client";

/**
 * ShellClient — client component owning mobile drawer state.
 *
 * P3-10: Extracted from layout.tsx to hold drawer open/close state while
 *        keeping the parent layout.tsx as an async server component (for auth).
 *
 * DP3-04 §2.10#4: Mobile drawer backdrop colour fixed from bg-black/40 to
 *   bg-foreground/20 — neutral overlay that works in both light and dark modes.
 *
 * Exposes MobileNavContext so ShellHeader's hamburger button can toggle the
 * drawer without prop-drilling.
 *
 * Mobile nav pattern:
 *   < 768px  → sidebar hidden; hamburger in top bar; clicking opens a left
 *              drawer with full nav + backdrop to close.
 *   ≥ 768px  → persistent sidebar, drawer never renders.
 *
 * P5-04: Added sidebar footer with SmartTriageButton (OQ-6 stub) below the
 *        nav items in both desktop sidebar and mobile drawer.
 */

import { useState, createContext, useContext, useCallback } from "react";
import { usePathname } from "next/navigation";
import { ShellNav } from "./shell-nav";
import { ShellHeader } from "./shell-header";
import { SmartTriageButton } from "@/components/inbox/smart-triage-button";
import { Separator } from "@/components/ui/separator";
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
// SidebarFooterSlot — shared footer content for desktop sidebar + mobile drawer
// ---------------------------------------------------------------------------

function SidebarFooterSlot({ compact = false }: { compact?: boolean }) {
  return (
    <footer className={cn("mt-auto flex flex-col", compact ? "gap-1 px-2 py-2" : "gap-1.5 px-3 py-3")}>
      <Separator className="mb-0.5" />
      <SmartTriageButton compact={compact} />
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShellClient({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  const toggle = useCallback(() => setMobileNavOpen((v) => !v), []);
  const close = useCallback(() => setMobileNavOpen(false), []);

  // Routes that own their internal scroll partitioning (locked top section +
  // independently-scrolling body columns). For these, <main> must NOT scroll
  // and must NOT impose padding — the page handles both internally.
  const isFullBleed =
    pathname === "/library" || pathname.startsWith("/artifact/");

  return (
    <MobileNavContext.Provider value={{ isOpen: mobileNavOpen, toggle, close }}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* ---------------------------------------------------------------- */}
        {/* Desktop sidebar — hidden on mobile, shown md+                    */}
        {/* ---------------------------------------------------------------- */}
        <aside
          className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r bg-card md:flex"
          aria-label="Sidebar navigation"
        >
          {/* Brand chip — desktop sidebar header (ADR-DPI-006 Option B).
              Mirrors the mobile drawer header at line ~89 for visual parity.
              Stitch baseline: 6803245… desktop standard shell. */}
          <div className="flex h-14 shrink-0 items-center border-b px-3">
            <span className="text-sm font-semibold tracking-tight">
              MeatyWiki
            </span>
          </div>
          <ShellNav />
          <SidebarFooterSlot />
        </aside>

        {/* ---------------------------------------------------------------- */}
        {/* Mobile drawer — rendered only below md breakpoint               */}
        {/* ---------------------------------------------------------------- */}
        {mobileNavOpen && (
          <>
            {/* Backdrop — DP3-04 §2.10#4: bg-foreground/20 works in both
                light and dark modes without hard black contrast. */}
            <div
              aria-hidden="true"
              className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm md:hidden"
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
              <SidebarFooterSlot />
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
            className={cn(
              "flex min-w-0 min-h-0 flex-1 flex-col",
              isFullBleed
                ? "overflow-hidden"
                : "overflow-y-auto p-4 md:p-6",
            )}
            tabIndex={-1}
          >
            {children}
          </main>
        </div>
      </div>
    </MobileNavContext.Provider>
  );
}
