'use client';

/**
 * FirstRunOffer — dismissible inline banner offering a product tour.
 *
 * Renders a subtle top-of-page banner when the given tour has never been
 * completed or dismissed. Returns null otherwise so it leaves no DOM trace.
 *
 * Dev escape hatch: add ?notour=1 to the URL to suppress the banner without
 * modifying localStorage. Useful when demoing or recording screencasts.
 *
 * Accessibility:
 *   - banner has role="status" (non-assertive live region)
 *   - "Dismiss" + "Take tour" are explicit <button> elements with aria-labels
 *   - Entrance animation respects prefers-reduced-motion via Tailwind's
 *     motion-safe: modifier
 *
 * Usage:
 *   <FirstRunOffer tourId="inbox" tourLabel="Inbox" />
 */

import { useSearchParams } from 'next/navigation';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirstRunOffer } from '@/hooks/use-tour';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FirstRunOfferProps {
  /** Tour identifier — must match a key in TOURS (lib/copy/tours.ts). */
  tourId: string;
  /** Human-readable name shown in banner copy, e.g. "Inbox", "Library". */
  tourLabel: string;
  /** Optional extra className for the outer wrapper. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FirstRunOffer({ tourId, tourLabel, className }: FirstRunOfferProps) {
  const searchParams = useSearchParams();
  const { shouldOffer, dismiss, accept } = useFirstRunOffer(tourId);

  // Dev / demo escape hatch — ?notour=1 suppresses the banner entirely.
  if (searchParams.get('notour') === '1') return null;

  if (!shouldOffer) return null;

  return (
    <div
      role="status"
      aria-label={`Tour offer for ${tourLabel}`}
      className={cn(
        // Layout
        'flex items-center gap-3 rounded-lg border px-4 py-2.5',
        // Surface — muted background matches the "soft informational" tier
        'border-border/60 bg-muted/60',
        // Entrance animation (skipped when user prefers reduced motion)
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1',
        'motion-safe:duration-300',
        className,
      )}
    >
      {/* Icon */}
      <Sparkles
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />

      {/* Copy */}
      <p className="min-w-0 flex-1 text-sm text-foreground">
        New here?{' '}
        <span className="font-medium">Take the {tourLabel} tour</span>{' '}
        to get oriented quickly.
      </p>

      {/* Action buttons */}
      <div className="flex shrink-0 items-center gap-1">
        {/* Primary — Take tour */}
        <button
          type="button"
          aria-label={`Start the ${tourLabel} tour`}
          onClick={accept}
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3',
            'text-xs font-medium text-primary-foreground',
            'transition-colors hover:bg-primary/90',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          )}
        >
          Take tour
        </button>

        {/* Ghost — Dismiss */}
        <button
          type="button"
          aria-label={`Dismiss ${tourLabel} tour offer`}
          onClick={dismiss}
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-md',
            'text-muted-foreground transition-colors',
            'hover:bg-accent hover:text-foreground',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
