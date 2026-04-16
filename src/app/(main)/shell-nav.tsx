"use client";

/**
 * ShellNav — sidebar navigation for the authenticated shell.
 *
 * Links to primary screens. Active link is highlighted via usePathname().
 * Full Stitch-sourced nav wired in P3-02; this is the P3-01 functional stub.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  /** Aria label override for screen readers */
  ariaLabel?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Inbox", href: "/inbox" },
  { label: "Library", href: "/library" },
  { label: "Workflows", href: "/workflows" },
];

export function ShellNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-col gap-1 p-3"
      aria-label="Primary navigation"
    >
      {/* Brand / logo area */}
      <div className="mb-4 px-2 py-1">
        <span className="text-base font-semibold tracking-tight">
          MeatyWiki
        </span>
      </div>

      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.ariaLabel ?? item.label}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
