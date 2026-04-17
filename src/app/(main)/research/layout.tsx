"use client";

/**
 * Research sub-shell layout.
 *
 * Provides a secondary navigation bar (Pages | Synthesis | Backlinks | Queue)
 * scoped to the /research route group. On mobile (< sm), the sub-nav collapses
 * into a horizontally-scrollable pill row. On sm+ it renders as a tab-style bar.
 *
 * P4-01: Research workspace structure + navigation.
 *
 * Stitch reference: "Research Home" (ID: 0cf6fb7b27d9459e8b5bebfea66915c5)
 * Shell: Standard Archival (sidebar + header owned by parent (main)/layout.tsx)
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Sub-nav definition
// ---------------------------------------------------------------------------

interface SubNavItem {
  label: string;
  href: string;
  ariaLabel?: string;
}

const RESEARCH_NAV: SubNavItem[] = [
  { label: "Pages", href: "/research/pages", ariaLabel: "Research pages" },
  {
    label: "Synthesis",
    href: "/research/synthesis",
    ariaLabel: "Synthesis builder",
  },
  {
    label: "Backlinks",
    href: "/research/backlinks",
    ariaLabel: "Backlinks explorer",
  },
  {
    label: "Queue",
    href: "/research/queue",
    ariaLabel: "Review queue",
  },
];

// ---------------------------------------------------------------------------
// ResearchSubNav — client component (needs usePathname)
// ---------------------------------------------------------------------------

function ResearchSubNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Research workspace navigation"
      className={cn(
        // Container: full-width, border-bottom separator, background matches card
        "border-b bg-card",
      )}
    >
      {/*
       * Inner scroll container:
       *   - overflow-x-auto for mobile horizontal scroll
       *   - flex row with gap, no wrapping
       *   - hide scrollbar visually while keeping it accessible
       */}
      <ul
        role="list"
        className={cn(
          "flex flex-row gap-0.5 overflow-x-auto px-4 scrollbar-none",
          // Smooth momentum scrolling on iOS
          "[-webkit-overflow-scrolling:touch]",
        )}
      >
        {RESEARCH_NAV.map((item) => {
          /*
           * Active matching: treat /research as equivalent to /research/pages
           * (the overview page redirects there). A sub-route is active when the
           * pathname starts with that href.
           */
          const isActive = pathname.startsWith(item.href);

          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-label={item.ariaLabel ?? item.label}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  // Base: pill-style tab — matches height to header chrome
                  "inline-flex min-h-[44px] items-center border-b-2 px-4 text-sm font-medium transition-colors",
                  "sm:h-10 sm:min-h-0",
                  // Focus ring
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  // Active vs inactive
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function ResearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ResearchSubNav />

      {/* Page content — matches the padding convention used by other (main) pages */}
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
    </div>
  );
}
