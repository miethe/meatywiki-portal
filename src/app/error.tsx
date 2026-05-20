"use client";

/**
 * Segment-level error boundary — catches unhandled errors in the React tree
 * below the root layout.
 *
 * Next.js 15 App Router rules:
 * - `app/error.tsx` is a per-segment boundary; it MUST NOT render <html>/<body>
 *   (those are owned by layout.tsx). Only `app/global-error.tsx` may render
 *   the full document shell.
 * - This file must remain a Client Component (receives Error + reset callback
 *   from React's error boundary mechanism).
 */

import Link from "next/link";
import { useEffect } from "react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log errors to an error reporting surface (observability hook for P4+).
    // In v1, we simply log to the console.
    console.error("[MeatyWiki Portal] Unhandled error:", error);
  }, [error]);

  return (
    <div className="contents">
      <main
        className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8 text-center"
        role="alert"
        aria-live="assertive"
      >
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Something went wrong
            </h1>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. You can try to recover or return to
              the home page.
            </p>
            {error.digest && (
              <p className="font-mono text-xs text-muted-foreground">
                Error ID: {error.digest}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Go home
            </Link>
          </div>
        </main>
    </div>
  );
}
