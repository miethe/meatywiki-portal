"use client";

/**
 * ShellHeader — top bar for the authenticated shell.
 *
 * Contains:
 * - Skip-to-main-content link (WCAG 2.1 AA)
 * - Mobile menu toggle (placeholder; full implementation in P3-02)
 * - Page title slot (to be provided by nested layouts in P3-03+)
 * - Logout button
 *
 * P3-01 implementation: functional but minimal.
 * Full Stitch design applied in P3-02.
 */

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

export function ShellHeader() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleLogout() {
    startTransition(async () => {
      await fetch("/api/auth/session", { method: "DELETE" });
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <>
      {/* Skip link — first focusable element for keyboard/screen reader users */}
      <a
        href="#main-content"
        className={cn(
          "absolute left-4 top-4 z-50 -translate-y-16 rounded-md",
          "bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
          "focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring",
          "transition-transform",
        )}
      >
        Skip to main content
      </a>

      <header
        className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4"
        role="banner"
      >
        {/* Left: mobile brand (hidden on md+) */}
        <span className="text-sm font-semibold md:hidden">MeatyWiki</span>

        {/* Right: actions */}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isPending}
            aria-label="Sign out"
            className={cn(
              "inline-flex h-8 items-center rounded-md px-3 text-xs font-medium",
              "border border-input bg-background text-foreground",
              "transition-colors hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            {isPending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>
    </>
  );
}
