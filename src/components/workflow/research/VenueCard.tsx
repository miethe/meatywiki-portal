"use client";

/**
 * VenueCard — single route-card tile for the Step 2 venue selection panel.
 *
 * Renders one RouteCard from the routing-analysis response:
 *   - Venue name derived from the route slug
 *   - Suitability score as a labelled bar + numeric badge
 *   - Expected output type
 *   - Rationale excerpt
 *
 * Selected state has a clear ring + background treatment.
 * Pure presentational — no state, no dispatch.
 *
 * P4-04 (audit-wave-2-phase-4).
 */

import { cn } from "@/lib/utils";
import type { RouteCard } from "@/types/workflows/research";
import {
  Bot,
  Search,
  BookOpen,
  Layers,
  FlaskConical,
  Globe,
  CheckCircle2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Venue display metadata
// ---------------------------------------------------------------------------

interface VenueMeta {
  label: string;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  accentClass: string;
}

const VENUE_META: Record<string, VenueMeta> = {
  chatgpt: {
    label: "ChatGPT",
    Icon: Bot,
    accentClass: "text-emerald-600 dark:text-emerald-400",
  },
  perplexity: {
    label: "Perplexity",
    Icon: Search,
    accentClass: "text-violet-600 dark:text-violet-400",
  },
  gemini: {
    label: "Gemini",
    Icon: FlaskConical,
    accentClass: "text-blue-600 dark:text-blue-400",
  },
  notebooklm: {
    label: "NotebookLM",
    Icon: BookOpen,
    accentClass: "text-amber-600 dark:text-amber-400",
  },
  internal_synthesis: {
    label: "Internal Synthesis",
    Icon: Layers,
    accentClass: "text-slate-600 dark:text-slate-400",
  },
  custom_manual: {
    label: "Custom / Manual",
    Icon: Globe,
    accentClass: "text-rose-600 dark:text-rose-400",
  },
  auto: {
    label: "Auto",
    Icon: Bot,
    accentClass: "text-foreground",
  },
};

function getVenueMeta(route: string): VenueMeta {
  return (
    VENUE_META[route] ?? {
      label: route.replace(/_/g, " "),
      Icon: Globe,
      accentClass: "text-foreground",
    }
  );
}

// ---------------------------------------------------------------------------
// Score bar
// ---------------------------------------------------------------------------

interface ScoreBarProps {
  score: number;
}

/**
 * Renders a narrow filled bar (0–100 %) plus a numeric badge showing the score
 * as a percentage. ARIA uses a meter role for semantic meaning.
 */
function ScoreBar({ score }: ScoreBarProps) {
  const pct = Math.round(score * 100);

  // Colour tier: red < 40, amber < 70, green ≥ 70
  const fillClass =
    pct >= 70
      ? "bg-emerald-500"
      : pct >= 40
        ? "bg-amber-400"
        : "bg-rose-400";

  return (
    <div className="flex items-center gap-2.5">
      {/* Track */}
      <div
        role="meter"
        aria-label="Suitability score"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-border"
      >
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", fillClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Badge */}
      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
          pct >= 70
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            : pct >= 40
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
        )}
        aria-hidden="true"
      >
        {pct}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VenueCard
// ---------------------------------------------------------------------------

export interface VenueCardProps {
  card: RouteCard;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

export function VenueCard({ card, selected, onSelect, disabled = false }: VenueCardProps) {
  const meta = getVenueMeta(card.route);
  const { Icon, label, accentClass } = meta;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`Select venue: ${label}`}
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        // Base
        "relative w-full rounded-xl border-2 p-4 text-left",
        "transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Idle
        !selected &&
          "border-border bg-card hover:border-foreground/25 hover:bg-accent/20",
        // Selected
        selected &&
          "border-foreground/70 bg-accent/30 shadow-sm",
      )}
    >
      {/* Selected checkmark — absolute top-right */}
      {selected && (
        <CheckCircle2
          aria-hidden
          className="absolute right-3 top-3 size-4 text-foreground"
        />
      )}

      {/* Header row: icon + name */}
      <div className="mb-3 flex items-center gap-2.5">
        <Icon
          aria-hidden
          className={cn("size-5 shrink-0", accentClass)}
        />
        <span className="text-sm font-semibold leading-tight">{label}</span>
      </div>

      {/* Score bar */}
      <div className="mb-3">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Suitability
        </p>
        <ScoreBar score={card.score} />
      </div>

      {/* Expected output */}
      <div className="mb-2.5">
        <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Expected Output
        </p>
        <p className="text-xs text-foreground/90 leading-relaxed">
          {card.expected_output}
        </p>
      </div>

      {/* Rationale */}
      <div>
        <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Rationale
        </p>
        <p className="line-clamp-3 text-xs text-muted-foreground leading-relaxed">
          {card.rationale}
        </p>
      </div>
    </button>
  );
}
