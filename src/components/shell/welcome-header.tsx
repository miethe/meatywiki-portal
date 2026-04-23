"use client";

/**
 * WelcomeHeader — display-xl serif heading for the App Home surface.
 *
 * Design spec §4.5: "Welcome back, Archivist." in display-xl serif.
 * Uses the editorial serif stack (font-serif, text-4xl/5xl tracking-tight).
 *
 * Created for Portal v1.5 Stitch Reskin Phase 6 (P6-01).
 */

import { cn } from "@/lib/utils";

interface WelcomeHeaderProps {
  /** Primary greeting text. Default: "Welcome back, Archivist." */
  greeting?: string;
  className?: string;
}

export function WelcomeHeader({
  greeting = "Welcome back, Archivist.",
  className,
}: WelcomeHeaderProps) {
  return (
    <h1
      className={cn(
        // Display-xl serif: large editorial heading, tighter tracking
        "font-serif text-4xl md:text-5xl font-semibold tracking-tight",
        // Dark-mode safe token
        "text-foreground",
        className,
      )}
    >
      {greeting}
    </h1>
  );
}
