"use client";

/**
 * Blog workspace sub-shell layout.
 *
 * Provides a secondary nav bar (Posts | Outline Builder) scoped to /blog.
 * Matches the pattern used by the Research workspace layout.
 *
 * P1.5-3-03: Blog workspace screens
 * Stitch reference: blog-workspace.html (ID: 201421e9905c4255ad32da8c2304b69c)
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface SubNavItem {
  label: string;
  href: string;
  ariaLabel?: string;
}

const BLOG_NAV: SubNavItem[] = [
  { label: "Posts", href: "/blog/posts", ariaLabel: "Blog posts" },
  {
    label: "Outline Builder",
    href: "/blog/outline",
    ariaLabel: "Blog outline builder",
  },
];

function BlogSubNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Blog workspace navigation" className="border-b bg-card">
      <ul
        role="list"
        className={cn(
          "flex flex-row gap-0.5 overflow-x-auto px-4 scrollbar-none",
          "[-webkit-overflow-scrolling:touch]",
        )}
      >
        {BLOG_NAV.map((item) => {
          const isActive = pathname.startsWith(item.href);

          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-label={item.ariaLabel ?? item.label}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-[44px] items-center border-b-2 px-4 text-sm font-medium transition-colors",
                  "sm:h-10 sm:min-h-0",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
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

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BlogSubNav />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
    </div>
  );
}
