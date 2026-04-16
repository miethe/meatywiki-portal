"use client";

/**
 * ShellNav — sidebar navigation for the authenticated shell.
 *
 * Updated in P3-02: full Stitch-informed nav hierarchy.
 * Stitch reference: "Unified Shell — Standard Archival" sidebar.
 *
 * Navigation sections:
 *   - Primary workspace links (Inbox, Library, Research)
 *   - Workflow OS (Workflows)
 *   - Admin (Settings)
 *
 * Responsive: hidden on mobile (< 768px), shown md+.
 * Mobile menu managed via MobileNav in ShellHeader.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  ariaLabel?: string;
  icon?: React.ReactNode;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

// Icon primitives (inline SVG — no icon lib dependency)
function InboxIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function ResearchIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  );
}

function WorkflowIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Workspace",
    items: [
      { label: "Inbox", href: "/inbox", icon: <InboxIcon /> },
      { label: "Library", href: "/library", icon: <LibraryIcon /> },
      { label: "Research", href: "/research", icon: <ResearchIcon /> },
    ],
  },
  {
    title: "Workflow OS",
    items: [
      { label: "Workflows", href: "/workflows", icon: <WorkflowIcon /> },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Settings", href: "/settings", icon: <SettingsIcon /> },
    ],
  },
];

interface NavLinkProps extends NavItem {
  isActive: boolean;
}

function NavLink({ label, href, ariaLabel, icon, isActive }: NavLinkProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel ?? label}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {icon && <span className="shrink-0 text-current">{icon}</span>}
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function ShellNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-col gap-1 p-3"
      aria-label="Primary navigation"
    >
      {/* Brand */}
      <div className="mb-3 flex items-center gap-2 px-2 py-1">
        <span className="text-base font-semibold tracking-tight">
          MeatyWiki
        </span>
      </div>

      {NAV_SECTIONS.map((section) => (
        <div key={section.title ?? "primary"} className="mb-2">
          {section.title && (
            <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <NavLink key={item.href} {...item} isActive={isActive} />
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
