"use client";

/**
 * SidebarFooter + QuickAddButton — generic shell primitives.
 *
 * Design spec §3 (Component Inventory) — SidebarFooter entry.
 * Phase plan P2-03.
 *
 * Render order (top-to-bottom within the footer slot):
 *   1. QuickAddButton — primary CTA (full-width solid; icon-only when compact)
 *   2. Separator
 *   3. Optional user row — avatar + name (avatar-only when compact)
 *   4. Stacked links — icon + label, muted (icon-only when compact)
 *
 * Extraction discipline:
 *   - No imports from @/lib/artifact, @/lib/api, or portal-specific modules.
 *   - Uses native <a> tags (not next/link) for Next.js independence.
 *   - next/image is intentionally excluded; avatar uses <img> with alt.
 *
 * Accessibility:
 *   - QuickAddButton carries aria-label in compact mode (label hidden visually).
 *   - Avatar <img> always has alt text.
 *   - Link icons are aria-hidden; visible/sr-only label covers each link.
 */

import * as React from "react";
import { Sparkles, Settings, HelpCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SidebarFooterLink {
  icon: React.ReactNode;
  label: string;
  href: string;
}

export interface SidebarFooterUser {
  name: string;
  /** Optional URL for avatar image. If absent, initials are shown. */
  avatar?: string;
}

export interface SidebarFooterProps {
  user?: SidebarFooterUser;
  onQuickAdd: () => void;
  /** Button label. Defaults to "Quick Add". */
  quickAddLabel?: string;
  links?: SidebarFooterLink[];
  /** When true, renders icon-only variants. Defaults to false. */
  compact?: boolean;
  className?: string;
}

export interface QuickAddButtonProps {
  onClick: () => void;
  /** Button label. Defaults to "Quick Add". */
  label?: string;
  /** When true, renders as square icon-only button. */
  compact?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_LINKS: SidebarFooterLink[] = [
  {
    icon: <Settings aria-hidden="true" className="size-4 shrink-0" />,
    label: "Settings",
    href: "/settings",
  },
  {
    icon: <HelpCircle aria-hidden="true" className="size-4 shrink-0" />,
    label: "Help & Support",
    href: "/support",
  },
];

// ---------------------------------------------------------------------------
// UserAvatar — internal helper
// ---------------------------------------------------------------------------

function UserAvatar({
  user,
  compact,
}: {
  user: SidebarFooterUser;
  compact: boolean;
}) {
  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");

  const avatarEl = user.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={user.avatar}
      alt={user.name}
      className="size-7 rounded-full object-cover ring-1 ring-border"
    />
  ) : (
    <span
      aria-label={user.name}
      className={cn(
        "flex size-7 items-center justify-center rounded-full",
        "bg-muted text-[11px] font-semibold text-muted-foreground ring-1 ring-border",
      )}
    >
      {initials}
    </span>
  );

  if (compact) {
    return avatarEl;
  }

  return (
    <div className="flex items-center gap-2.5 px-2.5 py-1.5">
      {avatarEl}
      <span className="truncate text-sm font-medium text-foreground">
        {user.name}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuickAddButton — exported standalone
// ---------------------------------------------------------------------------

export function QuickAddButton({
  onClick,
  label = "Quick Add",
  compact = false,
  className,
}: QuickAddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={compact ? label : undefined}
      className={cn(
        // Base
        "inline-flex items-center justify-center rounded-md",
        "bg-primary text-primary-foreground",
        "text-sm font-medium",
        "transition-colors hover:bg-primary/90 active:bg-primary/80",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        // Layout variants
        compact
          ? "size-9 shrink-0 p-0"
          : "h-9 w-full gap-2 px-3",
        className,
      )}
    >
      <Sparkles
        aria-hidden="true"
        className={cn("shrink-0", compact ? "size-4" : "size-4")}
      />
      {!compact && <span>{label}</span>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// SidebarFooter
// ---------------------------------------------------------------------------

export function SidebarFooter({
  user,
  onQuickAdd,
  quickAddLabel = "Quick Add",
  links = DEFAULT_LINKS,
  compact = false,
  className,
}: SidebarFooterProps) {
  return (
    <footer
      className={cn(
        "mt-auto flex flex-col",
        compact ? "gap-1 px-2 py-2" : "gap-1.5 px-3 py-3",
        className,
      )}
    >
      {/* Primary CTA */}
      <QuickAddButton
        onClick={onQuickAdd}
        label={quickAddLabel}
        compact={compact}
      />

      {/* Divider */}
      <Separator className="my-1" />

      {/* Optional user row */}
      {user && <UserAvatar user={user} compact={compact} />}

      {/* Stacked footer links */}
      {links.length > 0 && (
        <nav aria-label="Footer navigation">
          <ul className={cn("flex flex-col", compact ? "gap-0.5" : "gap-0.5")}>
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  title={compact ? link.label : undefined}
                  className={cn(
                    "flex items-center rounded-md text-sm text-muted-foreground",
                    "transition-colors hover:bg-accent hover:text-accent-foreground",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    compact
                      ? "size-9 justify-center p-0"
                      : "h-8 gap-2.5 px-2.5",
                  )}
                >
                  {link.icon}
                  {compact ? (
                    <span className="sr-only">{link.label}</span>
                  ) : (
                    <span className="truncate">{link.label}</span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </footer>
  );
}
