/**
 * Global 404 — not-found boundary.
 *
 * Rendered when `notFound()` is called from a Server Component, or when
 * Next.js cannot match any route to the request URL.
 *
 * This is a Server Component (no "use client" directive needed).
 */

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Not Found — MeatyWiki Portal",
};

export default function NotFoundPage() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8 text-center"
      aria-labelledby="not-found-heading"
    >
      <div className="space-y-2">
        <p className="font-mono text-5xl font-bold text-muted-foreground">
          404
        </p>
        <h1
          id="not-found-heading"
          className="text-2xl font-semibold tracking-tight"
        >
          Page not found
        </h1>
        <p className="text-sm text-muted-foreground">
          The page you requested does not exist or has been moved.
        </p>
      </div>

      <Link
        href="/"
        className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Return home
      </Link>
    </main>
  );
}
