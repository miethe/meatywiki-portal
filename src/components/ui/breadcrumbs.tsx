"use client";

/**
 * Breadcrumbs — minimal navigation breadcrumb trail.
 *
 * Follows shadcn/ui patterns: unstyled semantic shell, Tailwind tokens.
 * Used by Artifact Detail (P4-01) and any other detail pages.
 *
 * Accessibility:
 *   - Wraps in <nav aria-label="Breadcrumb">
 *   - Last item gets aria-current="page"
 *   - Separator is aria-hidden
 *
 * Design spec §4.2 / §6.3 — breadcrumbs appear above the eyebrow tag list.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  /** Separator character; defaults to "/" */
  separator?: string;
}

export function Breadcrumbs({
  items,
  className,
  separator = "/",
}: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex flex-wrap items-center gap-1 text-meta text-muted-foreground",
        className,
      )}
    >
      <ol className="flex flex-wrap items-center gap-1 list-none">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className="select-none text-muted-foreground/50"
                >
                  {separator}
                </span>
              )}
              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cn(
                    "max-w-[200px] truncate",
                    isLast
                      ? "text-foreground font-medium"
                      : "text-muted-foreground",
                  )}
                  title={item.label}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    "max-w-[200px] truncate text-muted-foreground",
                    "transition-colors hover:text-foreground",
                    "rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                  title={item.label}
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
