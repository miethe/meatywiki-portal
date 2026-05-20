"use client";

/**
 * GraphLegend — shared legend for knowledge graph visualizations.
 *
 * Shows:
 *   - Node type → shape/color swatches (reactive to colorMode prop)
 *   - Edge type → line style examples
 *   - Size encoding legend (reactive to sizeMode prop)
 *
 * Collapsible: default expanded on desktop, collapsed on mobile (responsive).
 * Reusable by ArtifactMiniGraph (P2) and the vault graph page (P3).
 * When used in bottom-left anchor mode (anchored=true), positions absolutely
 * over the graph canvas.
 *
 * v2.1 — mini-graph component (P2 Phase 2).
 * P4-03 — removed duplicate `hidden` attribute + className logic (was applied twice).
 * P4-04 — legend toggle button is already focus-visible; no changes needed.
 * P2-09 — added colorMode + sizeMode props; legend updates reactively.
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NODE_TYPE_COLORS,
  NODE_TYPE_COLOR_DEFAULT,
  NODE_TYPE_LABELS,
  WORKSPACE_COLORS,
  WORKSPACE_COLOR_DEFAULT,
  WORKSPACE_LABELS,
  FIDELITY_SIZES,
  EDGE_TYPE_LABELS,
  EDGE_TYPE_STYLES,
  EDGE_STYLE_COLORS,
  type EdgeLineStyle,
  type NodeColorMode,
  type NodeSizeMode,
  type FidelityLevel,
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
// Fidelity size swatch
// ---------------------------------------------------------------------------

interface FidelitySwatchProps {
  level: FidelityLevel;
  size?: number;
}

function FidelitySwatch({ level }: FidelitySwatchProps) {
  const px = FIDELITY_SIZES[level];
  return (
    <svg width={16} height={16} aria-hidden="true" focusable="false">
      <circle cx={8} cy={8} r={Math.min(7, px / 2)} fill="#64748b" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GraphLegendProps {
  /** Whether the legend starts expanded. Defaults to true on desktop (CSS), false on mobile. */
  defaultExpanded?: boolean;
  className?: string;
  /**
   * Active node color mode — legend updates its node section to show the
   * relevant dimension (artifact type, workspace, or lens).
   * Defaults to "artifact_type" for backward compat with mini-graph usage.
   */
  colorMode?: NodeColorMode;
  /**
   * Active node size mode — legend shows either fidelity level buckets or
   * a degree scale note.
   * Defaults to "fidelity".
   */
  sizeMode?: NodeSizeMode;
  /**
   * When true, the legend is absolutely positioned bottom-left over the
   * graph canvas. Used for inline overlay mode.
   */
  anchored?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GraphLegend({
  defaultExpanded = true,
  className,
  colorMode = "artifact_type",
  sizeMode = "fidelity",
  anchored = false,
}: GraphLegendProps) {
  // On mobile we default collapsed; on desktop we respect defaultExpanded.
  // Since we can't detect breakpoints in JS without effect, we start with the
  // prop value and let the user toggle. Responsive default via CSS would require
  // a different pattern; this is a pragmatic approach.
  const [expanded, setExpanded] = useState(defaultExpanded);

  const nodeTypes = Object.keys(NODE_TYPE_LABELS);
  const edgeTypes = Object.keys(EDGE_TYPE_LABELS);
  const workspaceTypes = Object.keys(WORKSPACE_LABELS);
  const fidelityLevels: FidelityLevel[] = ["F0", "F1", "F2", "F3", "F4"];

  return (
    <div
      className={cn(
        "rounded-md border bg-card text-[12px]",
        anchored && "absolute bottom-3 left-3 z-20 w-[180px] shadow-lg",
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
        {/* Node color section — switches based on colorMode */}
        <section aria-labelledby="legend-nodes-heading">
          <h4
            id="legend-nodes-heading"
            className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
          >
            {colorMode === "workspace"
              ? "Workspaces"
              : colorMode === "lens"
              ? "Lens (score)"
              : "Node types"}
          </h4>

          {colorMode === "artifact_type" && (
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
          )}

          {colorMode === "workspace" && (
            <ul role="list" className="flex flex-col gap-1">
              {workspaceTypes.map((ws) => {
                const color = WORKSPACE_COLORS[ws] ?? WORKSPACE_COLOR_DEFAULT;
                const label = WORKSPACE_LABELS[ws] ?? ws;
                return (
                  <li key={ws} className="flex items-center gap-2">
                    <NodeSwatch type="concept" color={color} size={14} />
                    <span className="text-foreground/80 capitalize">{label}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {colorMode === "lens" && (
            <div className="flex flex-col gap-1">
              <div className="flex h-3 rounded-sm overflow-hidden" aria-label="Lens score color ramp: blue (low) to red (high)">
                {Array.from({ length: 10 }, (_, i) => {
                  const hue = Math.round(220 - (i / 9) * 220);
                  return (
                    <div
                      key={i}
                      style={{ backgroundColor: `hsl(${hue},80%,45%)`, flex: 1 }}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground/70">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>
          )}
        </section>

        {/* Node size section — switches based on sizeMode */}
        <section aria-labelledby="legend-size-heading">
          <h4
            id="legend-size-heading"
            className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
          >
            {sizeMode === "degree" ? "Node degree" : "Fidelity (F0–F4)"}
          </h4>

          {sizeMode === "fidelity" && (
            <ul role="list" className="flex flex-col gap-0.5">
              {fidelityLevels.map((level) => (
                <li key={level} className="flex items-center gap-2">
                  <FidelitySwatch level={level} />
                  <span className="text-foreground/80">{level}</span>
                </li>
              ))}
            </ul>
          )}

          {sizeMode === "degree" && (
            <p className="text-[10px] text-muted-foreground/80 leading-snug">
              Size scales with log(degree). More connections = larger node.
            </p>
          )}
        </section>

        {/* Opacity legend — always shown (freshness class) */}
        <section aria-labelledby="legend-opacity-heading">
          <h4
            id="legend-opacity-heading"
            className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
          >
            Freshness
          </h4>
          <ul role="list" className="flex flex-col gap-1">
            {(["current", "aging", "stale"] as const).map((cls) => {
              const opacity = cls === "current" ? 1.0 : cls === "aging" ? 0.65 : 0.35;
              return (
                <li key={cls} className="flex items-center gap-2">
                  <svg width={14} height={14} aria-hidden="true">
                    <circle cx={7} cy={7} r={6} fill="#3b82f6" fillOpacity={opacity} />
                  </svg>
                  <span className="text-foreground/80 capitalize">{cls}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Uncertainty ring note */}
        <section aria-labelledby="legend-ring-heading">
          <h4
            id="legend-ring-heading"
            className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
          >
            Uncertainty
          </h4>
          <div className="flex items-center gap-2">
            <svg width={14} height={14} aria-hidden="true">
              <circle cx={7} cy={7} r={5} fill="#3b82f6" />
              <circle cx={7} cy={7} r={6.5} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 2" />
            </svg>
            <span className="text-foreground/80 text-[10px]">Confidence &lt;70%</span>
          </div>
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
