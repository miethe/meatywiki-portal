"use client";

/**
 * ShellHeader — top bar for the authenticated shell.
 *
 * Updated in P3-02: Stitch-informed Standard Archival shell top bar.
 * Stitch reference: "Unified Shell — Standard Archival" top bar.
 *
 * Contains:
 * - Skip-to-main-content link (WCAG 2.1 AA)
 * - Mobile menu toggle with hamburger icon
 * - Page title slot (provided via context in P3-03+)
 * - Quick Add button (triggers QuickAddModal — P3-04 wires the actual submit)
 * - Logout button
 *
 * The Workflow status indicator (audit §2.1, §3.2 row 2) is a slot here;
 * P3-07 mounts the real WorkflowStatusBadge once SSE subscription is wired.
 */

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { QuickAddModal } from "@/components/quick-add/quick-add-modal";

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

/** Derive a page title from the current pathname */
function pageTitleFromPathname(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean)[0];
  if (!segment) return "Dashboard";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function ShellHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const pageTitle = pageTitleFromPathname(pathname);

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
        {/* Left: mobile menu toggle + page title */}
        <div className="flex items-center gap-3">
          {/* Mobile toggle — visible below md breakpoint */}
          <button
            type="button"
            aria-label="Toggle navigation menu"
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-md md:hidden",
              "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <MenuIcon />
          </button>

          {/* Page title — hidden on small mobile to save space */}
          <span className="hidden text-sm font-semibold sm:block">{pageTitle}</span>
        </div>

        {/* Right: workflow indicator slot + Quick Add + sign out */}
        <div className="ml-auto flex items-center gap-2">
          {/* Workflow status indicator slot — P3-07 mounts real indicator here */}
          {/* <WorkflowTopBarIndicator /> */}

          {/* Quick Add */}
          <button
            type="button"
            onClick={() => setQuickAddOpen(true)}
            aria-label="Quick Add artifact"
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium",
              "bg-primary text-primary-foreground",
              "transition-colors hover:bg-primary/90",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          >
            <PlusIcon />
            <span className="hidden sm:inline">Add</span>
          </button>

          {/* Sign out */}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isPending}
            aria-label="Sign out"
            className={cn(
              "inline-flex h-8 items-center rounded-md px-3 text-xs font-medium",
              "border border-input bg-background text-foreground",
              "transition-colors hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            {isPending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>

      {/* Quick Add Modal */}
      <QuickAddModal open={quickAddOpen} onOpenChange={setQuickAddOpen} />
    </>
  );
}
