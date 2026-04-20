"use client";

/**
 * ArtifactLineageGraph — SVG artifact lineage panel (Panel C).
 *
 * Renders produced artifacts as nodes and derivation edges between stages.
 * Uses a minimal custom SVG layout (no react-flow dep — keeps bundle ≤80 KB gz).
 *
 * Layout: vertical DAG — artifact nodes sorted by first-appearance stage,
 * connected by straight SVG lines with arrowhead markers.
 *
 * Design reference: workflow-viewer-screen-b.html — "Artifact Handoff Chain"
 * right rail. Adapted to shadcn/ui card aesthetic with SVG connectors.
 *
 * FR-1.5-07 (P1.5-2-02).
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { TimelineStage } from "@/types/workflow-viewer";

// ---------------------------------------------------------------------------
// Derive artifact nodes + edges from timeline stages
// ---------------------------------------------------------------------------

interface ArtifactNode {
  id: string;
  /** Stage where this artifact was first produced. */
  stageLabel: string;
  /** 0-indexed position in the stage list. */
  stageIndex: number;
}

interface ArtifactEdge {
  fromId: string;
  toId: string;
}

interface LineageGraph {
  nodes: ArtifactNode[];
  edges: ArtifactEdge[];
}

function deriveLineageGraph(stages: TimelineStage[]): LineageGraph {
  const nodeMap = new Map<string, ArtifactNode>();
  const edges: ArtifactEdge[] = [];
  let prevArtifactIds: string[] = [];

  stages.forEach((stage, idx) => {
    const payloads = stage.events
      .map((e) => e.event_payload)
      .filter(Boolean) as NonNullable<typeof stage.events[0]["event_payload"]>[];

    const artifactId = payloads.find((p) => p.artifact_id)?.artifact_id as
      | string
      | undefined;
    const artifactIds = payloads.find((p) => p.artifact_ids)?.artifact_ids as
      | string[]
      | undefined;

    const produced: string[] = [
      ...(artifactId ? [String(artifactId)] : []),
      ...(artifactIds?.map(String) ?? []),
    ].filter((id) => !nodeMap.has(id));

    for (const id of produced) {
      nodeMap.set(id, { id, stageLabel: stage.label, stageIndex: idx });
    }

    // Create edges from previous stage's artifacts to this stage's artifacts.
    for (const prevId of prevArtifactIds) {
      for (const currId of produced) {
        edges.push({ fromId: prevId, toId: currId });
      }
    }

    if (produced.length > 0) {
      prevArtifactIds = produced;
    }
  });

  return { nodes: Array.from(nodeMap.values()), edges };
}

// ---------------------------------------------------------------------------
// SVG layout constants
// ---------------------------------------------------------------------------

const NODE_WIDTH = 180;
const NODE_HEIGHT = 52;
const NODE_H_GAP = 40; // horizontal gap between nodes on same row
const ROW_V_GAP = 64; // vertical gap between rows

// Simple vertical layout: one row per stage, centred horizontally.
function computePositions(
  nodes: ArtifactNode[],
  canvasWidth: number,
): Map<string, { x: number; y: number }> {
  // Group nodes by stageIndex.
  const byStage = new Map<number, ArtifactNode[]>();
  for (const n of nodes) {
    if (!byStage.has(n.stageIndex)) byStage.set(n.stageIndex, []);
    byStage.get(n.stageIndex)!.push(n);
  }

  const positions = new Map<string, { x: number; y: number }>();
  const sortedStages = Array.from(byStage.entries()).sort(([a], [b]) => a - b);

  let rowY = 20;
  for (const [, stageNodes] of sortedStages) {
    const totalW =
      stageNodes.length * NODE_WIDTH + (stageNodes.length - 1) * NODE_H_GAP;
    let x = Math.max(0, (canvasWidth - totalW) / 2);

    for (const node of stageNodes) {
      positions.set(node.id, { x, y: rowY });
      x += NODE_WIDTH + NODE_H_GAP;
    }
    rowY += NODE_HEIGHT + ROW_V_GAP;
  }

  return positions;
}

// ---------------------------------------------------------------------------
// Short artifact ID display
// ---------------------------------------------------------------------------

function shortId(id: string): string {
  return id.length > 18 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;
}

// ---------------------------------------------------------------------------
// SVG arrowhead marker
// ---------------------------------------------------------------------------

const MARKER_ID = "lineage-arrow";

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyLineage() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
      <svg
        aria-hidden="true"
        className="mb-3 size-8 opacity-40"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
      <p className="text-sm">No artifact lineage recorded for this run.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

interface ArtifactLineageGraphProps {
  stages: TimelineStage[];
  className?: string;
}

export function ArtifactLineageGraph({ stages, className }: ArtifactLineageGraphProps) {
  const { nodes, edges } = useMemo(() => deriveLineageGraph(stages), [stages]);

  const CANVAS_WIDTH = 480;
  const positions = useMemo(
    () => computePositions(nodes, CANVAS_WIDTH),
    [nodes],
  );

  // Derive canvas height from max Y position.
  const canvasHeight = useMemo(() => {
    let maxY = 120;
    for (const { y } of positions.values()) {
      maxY = Math.max(maxY, y + NODE_HEIGHT + 24);
    }
    return maxY;
  }, [positions]);

  return (
    <section
      aria-label="Artifact lineage graph"
      className={cn("rounded-xl border border-border bg-card", className)}
    >
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <h3 className="text-sm font-semibold text-foreground">Artifact Lineage</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Produced artifacts and derivation chain
        </p>
      </div>

      {/* Graph body */}
      <div className="p-4">
        {nodes.length === 0 ? (
          <EmptyLineage />
        ) : (
          <div className="overflow-x-auto">
            <svg
              width={CANVAS_WIDTH}
              height={canvasHeight}
              viewBox={`0 0 ${CANVAS_WIDTH} ${canvasHeight}`}
              role="img"
              aria-label={`Artifact lineage: ${nodes.length} artifact${nodes.length === 1 ? "" : "s"}`}
              className="w-full max-w-full"
            >
              {/* Arrow marker */}
              <defs>
                <marker
                  id={MARKER_ID}
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <path
                    d="M0,0 L0,6 L8,3 z"
                    className="fill-muted-foreground/50"
                    fill="currentColor"
                  />
                </marker>
              </defs>

              {/* Edges */}
              {edges.map((edge, i) => {
                const from = positions.get(edge.fromId);
                const to = positions.get(edge.toId);
                if (!from || !to) return null;

                const x1 = from.x + NODE_WIDTH / 2;
                const y1 = from.y + NODE_HEIGHT;
                const x2 = to.x + NODE_WIDTH / 2;
                const y2 = to.y;
                const midY = (y1 + y2) / 2;

                return (
                  <path
                    key={i}
                    d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    className="stroke-muted-foreground/40"
                    markerEnd={`url(#${MARKER_ID})`}
                  />
                );
              })}

              {/* Nodes */}
              {nodes.map((node) => {
                const pos = positions.get(node.id);
                if (!pos) return null;

                return (
                  <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`}>
                    {/* Node card */}
                    <rect
                      width={NODE_WIDTH}
                      height={NODE_HEIGHT}
                      rx={6}
                      className="fill-muted/50 stroke-border"
                      strokeWidth={1}
                    />
                    {/* Stage label */}
                    <text
                      x={NODE_WIDTH / 2}
                      y={18}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[10px]"
                      style={{ fontSize: 10, fontFamily: "inherit" }}
                    >
                      {node.stageLabel}
                    </text>
                    {/* Artifact ID */}
                    <text
                      x={NODE_WIDTH / 2}
                      y={36}
                      textAnchor="middle"
                      className="fill-foreground font-mono"
                      style={{ fontSize: 11, fontFamily: "ui-monospace, monospace" }}
                    >
                      {shortId(node.id)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>
    </section>
  );
}
