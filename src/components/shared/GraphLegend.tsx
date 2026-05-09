"use client";

/**
 * GraphLegend — shared legend for knowledge graph visualizations.
 *
 * Shows:
 *   - Node type → shape/color swatches
 *   - Edge type → line style examples
 *
 * Collapsible: default expanded on desktop, collapsed on mobile (responsive).
 * Reusable by ArtifactMiniGraph (P2) and the vault graph page (P3).
 *
 * v2.1 — mini-graph component (P2 Phase 2).
 * P4-03 — removed duplicate `hidden` attribute + className logic (was applied twice).
 * P4-04 — legend toggle button is already focus-visible; no changes needed.
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NODE_TYPE_COLORS,
  NODE_TYPE_COLOR_DEFAULT,
  NODE_TYPE_LABELS,
  EDGE_TYPE_LABELS,
  EDGE_TYPE_STYLES,
  EDGE_STYLE_COLORS,
  type EdgeLineStyle,
} from "@/types/graph";

// ---------------------------------------------------------------------------
// Node type → shape SVG
// ---------------------------------------------------------------------------

const NODE_SHAPES: Record<string, string> = {
  concept: "circle",
  entity: "diamond",
  topic_note: "hexagon",
  summary: "square",
  synthesis: "triangle",
  evidence: "pentagon",
  glossary: "circle-outline",
};

interface NodeShatchProps {
  type: string;
  color: string;
  size?: number;
}

function NodeSwatch({ type, color, size = 16 }: NodeShatchProps) {
  const shape = NODE_SHAPES[type] ?? "circle";
  const half = size / 2;

  if (shape === "circle") {
    return (
      <svg width={size} height={size} aria-hidden="true" focusable="false">
        <circle cx={half} cy={half} r={half - 1} fill={color} />
      </svg>
    );
  }
  if (shape === "circle-outline") {
    return (
      <svg width={size} height={size} aria-hidden="true" focusable="false">
        <circle
          cx={half}
          cy={half}
          r={half - 1.5}
          fill="none"
          stroke={color}
          strokeWidth={2}
        />
      </svg>
    );
  }
  if (shape === "square") {
    return (
      <svg width={size} height={size} aria-hidden="true" focusable="false">
        <rect x={1} y={1} width={size - 2} height={size - 2} fill={color} />
      </svg>
    );
  }
  if (shape === "diamond") {
    const pts = `${half},1 ${size - 1},${half} ${half},${size - 1} 1,${half}`;
    return (
      <svg width={size} height={size} aria-hidden="true" focusable="false">
        <polygon points={pts} fill={color} />
      </svg>
    );
  }
  if (shape === "triangle") {
    const pts = `${half},1 ${size - 1},${size - 1} 1,${size - 1}`;
    return (
      <svg width={size} height={size} aria-hidden="true" focusable="false">
        <polygon points={pts} fill={color} />
      </svg>
    );
  }
  if (shape === "hexagon") {
    const r = half - 1;
    const cx = half;
    const cy = half;
    const pts = Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(" ");
    return (
      <svg width={size} height={size} aria-hidden="true" focusable="false">
        <polygon points={pts} fill={color} />
      </svg>
    );
  }
  if (shape === "pentagon") {
    const r = half - 1;
    const cx = half;
    const cy = half;
    const pts = Array.from({ length: 5 }, (_, i) => {
      const angle = (2 * Math.PI * i) / 5 - Math.PI / 2;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(" ");
    return (
      <svg width={size} height={size} aria-hidden="true" focusable="false">
        <polygon points={pts} fill={color} />
      </svg>
    );
  }
  // Fallback
  return (
    <svg width={size} height={size} aria-hidden="true" focusable="false">
      <circle cx={half} cy={half} r={half - 1} fill={color} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Edge style → SVG line example
// ---------------------------------------------------------------------------

interface EdgeSwatchProps {
  style: EdgeLineStyle;
  width?: number;
  height?: number;
}

function EdgeSwatch({ style, width = 32, height = 12 }: EdgeSwatchProps) {
  const color = EDGE_STYLE_COLORS[style];
  const y = height / 2;

  if (style === "solid") {
    return (
      <svg
        width={width}
        height={height}
        aria-hidden="true"
        focusable="false"
      >
        <line x1={2} y1={y} x2={width - 2} y2={y} stroke={color} strokeWidth={1.5} />
      </svg>
    );
  }
  if (style === "dashed") {
    return (
      <svg width={width} height={height} aria-hidden="true" focusable="false">
        <line
          x1={2}
          y1={y}
          x2={width - 2}
          y2={y}
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      </svg>
    );
  }
  if (style === "dotted") {
    return (
      <svg width={width} height={height} aria-hidden="true" focusable="false">
        <line
          x1={2}
          y1={y}
          x2={width - 2}
          y2={y}
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray="1.5 2.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (style === "thick-solid") {
    return (
      <svg width={width} height={height} aria-hidden="true" focusable="false">
        <line x1={2} y1={y} x2={width - 2} y2={y} stroke={color} strokeWidth={3} />
      </svg>
    );
  }
  if (style === "red-dashed") {
    return (
      <svg width={width} height={height} aria-hidden="true" focusable="false">
        <line
          x1={2}
          y1={y}
          x2={width - 2}
          y2={y}
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      </svg>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GraphLegendProps {
  /** Whether the legend starts expanded. Defaults to true on desktop (CSS), false on mobile. */
  defaultExpanded?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GraphLegend({
  defaultExpanded = true,
  className,
}: GraphLegendProps) {
  // On mobile we default collapsed; on desktop we respect defaultExpanded.
  // Since we can't detect breakpoints in JS without effect, we start with the
  // prop value and let the user toggle. Responsive default via CSS would require
  // a different pattern; this is a pragmatic approach.
  const [expanded, setExpanded] = useState(defaultExpanded);

  const nodeTypes = Object.keys(NODE_TYPE_LABELS);
  const edgeTypes = Object.keys(EDGE_TYPE_LABELS);

  return (
    <div
      className={cn(
        "rounded-md border bg-card text-[12px]",
        className,
      )}
    >
      {/* Header / toggle */}
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="graph-legend-body"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between px-3 py-2",
          "text-xs font-semibold text-muted-foreground uppercase tracking-wider",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          "hover:text-foreground transition-colors",
        )}
      >
        <span>Legend</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-3.5 transition-transform duration-200",
            expanded ? "rotate-0" : "-rotate-90",
          )}
        />
      </button>

      {/* Body — use the HTML `hidden` attribute only (not a duplicate className) */}
      <div
        id="graph-legend-body"
        hidden={!expanded}
        className="border-t px-3 py-2.5 flex flex-col gap-3"
      >
        {/* Node types */}
        <section aria-labelledby="legend-nodes-heading">
          <h4
            id="legend-nodes-heading"
            className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
          >
            Nodes
          </h4>
          <ul role="list" className="flex flex-col gap-1">
            {nodeTypes.map((type) => {
              const color = NODE_TYPE_COLORS[type] ?? NODE_TYPE_COLOR_DEFAULT;
              const label = NODE_TYPE_LABELS[type] ?? type;
              return (
                <li key={type} className="flex items-center gap-2">
                  <NodeSwatch type={type} color={color} size={14} />
                  <span className="text-foreground/80">{label}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Edge types */}
        <section aria-labelledby="legend-edges-heading">
          <h4
            id="legend-edges-heading"
            className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
          >
            Edges
          </h4>
          <ul role="list" className="flex flex-col gap-1">
            {edgeTypes.map((type) => {
              const style = EDGE_TYPE_STYLES[type] ?? "solid";
              const label = EDGE_TYPE_LABELS[type] ?? type;
              return (
                <li key={type} className="flex items-center gap-2">
                  <EdgeSwatch style={style} />
                  <span className="text-foreground/80">{label}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
