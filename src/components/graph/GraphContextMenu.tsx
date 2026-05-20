"use client";

/**
 * GraphContextMenu — right-click context menu for vault graph nodes.
 *
 * Two menu variants per interaction spec §4:
 *
 * Single-node (N=1 selected or right-click without prior selection):
 *   1. Open detail view
 *   2. Open in new tab
 *   ─ divider ─
 *   3. Focus: upstream        ⌘↑
 *   4. Focus: downstream      ⌘↓
 *   5. Focus: k-hop (k=2)     ⌘K
 *   6. Focus: flow            ⌘F
 *   ─ divider ─
 *   7. Add to focus (shift)
 *   ─ divider ─
 *   8. Lock to focus (URL)
 *   ─ divider ─
 *   9. Select neighbors
 *
 * Multi-select (N>1 selected):
 *   1. Filter to selection
 *   2. Open all in tabs (max 10)
 *   ─ divider ─
 *   3. Compare lens scores
 *   4. Copy node IDs
 *   5. Export subgraph JSON
 *
 * Positioning: pinned to pointer coordinates; shifts left/up if near viewport edge.
 * Close: click outside, Escape, or selecting an action.
 *
 * Implements: FR-34, FR-35; interaction spec §4.
 * Task: P4-05.
 */

import { useEffect, useRef, useCallback } from "react";
import type { FocusMode } from "@/lib/graph/urlState";

// ---------------------------------------------------------------------------
// Context menu item types
// ---------------------------------------------------------------------------

interface MenuAction {
  label: string;
  shortcut?: string;
  onClick: () => void;
  variant?: "default" | "destructive";
}

interface MenuSection {
  items: MenuAction[];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NodeInfo {
  id: string;
  title: string | null;
  artifact_type: string;
  workspace: string;
}

export interface GraphContextMenuProps {
  /** Position of the context menu in viewport pixels */
  x: number;
  y: number;
  /** The primary node that was right-clicked */
  node: NodeInfo;
  /** All currently selected node IDs (may include the right-clicked node) */
  selectedNodeIds: Set<string>;
  /** All loaded nodes (for export subgraph, open all in tabs) */
  allLoadedNodes: NodeInfo[];
  /** Close the menu */
  onCloseAction: () => void;
  // ── Single-node actions ──
  onFocusModeAction: (mode: FocusMode, nodeId: string) => void;
  onAddToFocusAction: (nodeId: string) => void;
  onLockToFocusAction: (nodeId: string) => void;
  onSelectNeighborsAction: (nodeId: string) => void;
  // ── Multi-select actions ──
  onFilterToSelectionAction: (nodeIds: string[]) => void;
  onCompareLensScoresAction: (nodeIds: string[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GraphContextMenu({
  x,
  y,
  node,
  selectedNodeIds,
  allLoadedNodes,
  onCloseAction,
  onFocusModeAction,
  onAddToFocusAction,
  onLockToFocusAction,
  onSelectNeighborsAction,
  onFilterToSelectionAction,
  onCompareLensScoresAction,
}: GraphContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const isMultiSelect = selectedNodeIds.size > 1;

  // Close on click-outside or Escape
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCloseAction();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseAction();
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCloseAction]);

  // Clamp position to viewport
  const menuWidth = 240;
  const estimatedHeight = isMultiSelect ? 200 : 340;
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 8);
  const clampedY = Math.min(y, window.innerHeight - estimatedHeight - 8);

  const action = useCallback(
    (fn: () => void) => () => {
      fn();
      onCloseAction();
    },
    [onCloseAction],
  );

  // ── Build sections ──
  const sections: MenuSection[] = isMultiSelect
    ? buildMultiSelectSections({
        selectedNodeIds,
        allLoadedNodes,
        onFilterToSelection: onFilterToSelectionAction,
        onCompareLensScores: onCompareLensScoresAction,
        action,
      })
    : buildSingleNodeSections({
        node,
        onFocusMode: onFocusModeAction,
        onAddToFocus: onAddToFocusAction,
        onLockToFocus: onLockToFocusAction,
        onSelectNeighbors: onSelectNeighborsAction,
        action,
      });

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={
        isMultiSelect
          ? `Context menu for ${selectedNodeIds.size} selected nodes`
          : `Context menu for ${node.title ?? node.id}`
      }
      style={{ top: clampedY, left: clampedX }}
      className="fixed z-50 w-[240px] rounded-lg border bg-popover py-1 shadow-xl"
    >
      {/* Header */}
      <div className="border-b px-3 pb-2 pt-2">
        {isMultiSelect ? (
          <p className="text-xs font-semibold text-foreground">
            {selectedNodeIds.size} nodes selected
          </p>
        ) : (
          <>
            <p className="truncate text-xs font-semibold text-foreground">
              {node.title ?? node.id}
            </p>
            <p className="text-[10px] capitalize text-muted-foreground">
              {node.artifact_type.replace(/_/g, " ")} · {node.workspace}
            </p>
          </>
        )}
      </div>

      {/* Sections */}
      {sections.map((section, sIdx) => (
        <div key={sIdx}>
          {sIdx > 0 && <div role="separator" className="my-1 border-t" />}
          {section.items.map((item, iIdx) => (
            <button
              key={iIdx}
              type="button"
              role="menuitem"
              onClick={item.onClick}
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none ${
                item.variant === "destructive"
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-foreground"
              }`}
            >
              <span>{item.label}</span>
              {item.shortcut && (
                <kbd className="ml-2 text-[9px] text-muted-foreground">
                  {item.shortcut}
                </kbd>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single-node section builder
// ---------------------------------------------------------------------------

function buildSingleNodeSections({
  node,
  onFocusMode,
  onAddToFocus,
  onLockToFocus,
  onSelectNeighbors,
  action,
}: {
  node: NodeInfo;
  onFocusMode: (mode: FocusMode, nodeId: string) => void;
  onAddToFocus: (nodeId: string) => void;
  onLockToFocus: (nodeId: string) => void;
  onSelectNeighbors: (nodeId: string) => void;
  action: (fn: () => void) => () => void;
}): MenuSection[] {
  return [
    {
      items: [
        {
          label: "Open detail view",
          onClick: action(() => {
            window.location.href = `/artifact/${node.id}`;
          }),
        },
        {
          label: "Open in new tab",
          onClick: action(() => {
            window.open(`/artifact/${node.id}`, "_blank", "noopener,noreferrer");
          }),
        },
      ],
    },
    {
      items: [
        {
          label: "Focus: upstream",
          shortcut: "⌘↑",
          onClick: action(() => onFocusMode("upstream", node.id)),
        },
        {
          label: "Focus: downstream",
          shortcut: "⌘↓",
          onClick: action(() => onFocusMode("downstream", node.id)),
        },
        {
          label: "Focus: k-hop (k=2)",
          shortcut: "⌘K",
          onClick: action(() => onFocusMode("k-hop", node.id)),
        },
        {
          label: "Focus: flow",
          shortcut: "⌘F",
          onClick: action(() => onFocusMode("flow", node.id)),
        },
      ],
    },
    {
      items: [
        {
          label: "Add to focus (shift)",
          onClick: action(() => onAddToFocus(node.id)),
        },
      ],
    },
    {
      items: [
        {
          label: "Lock to focus (URL)",
          onClick: action(() => onLockToFocus(node.id)),
        },
      ],
    },
    {
      items: [
        {
          label: "Select neighbors",
          onClick: action(() => onSelectNeighbors(node.id)),
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Multi-select section builder
// ---------------------------------------------------------------------------

function buildMultiSelectSections({
  selectedNodeIds,
  allLoadedNodes,
  onFilterToSelection,
  onCompareLensScores,
  action,
}: {
  selectedNodeIds: Set<string>;
  allLoadedNodes: NodeInfo[];
  onFilterToSelection: (nodeIds: string[]) => void;
  onCompareLensScores: (nodeIds: string[]) => void;
  action: (fn: () => void) => () => void;
}): MenuSection[] {
  const selectedIds = Array.from(selectedNodeIds);

  return [
    {
      items: [
        {
          label: "Filter to selection",
          onClick: action(() => onFilterToSelection(selectedIds)),
        },
        {
          label: `Open all in tabs (max 10)`,
          onClick: action(() => {
            const toOpen = selectedIds.slice(0, 10);
            for (const id of toOpen) {
              window.open(`/artifact/${id}`, "_blank", "noopener,noreferrer");
            }
          }),
        },
      ],
    },
    {
      items: [
        {
          label: "Compare lens scores",
          onClick: action(() => onCompareLensScores(selectedIds)),
        },
        {
          label: "Copy node IDs",
          onClick: action(() => {
            const text = selectedIds.join("\n");
            navigator.clipboard.writeText(text).catch(() => {
              // Clipboard API unavailable (non-secure context) — silent failure.
              // The user can still export via "Export subgraph JSON".
            });
          }),
        },
        {
          label: "Export subgraph JSON",
          onClick: action(() => {
            const subgraph = allLoadedNodes.filter((n) => selectedNodeIds.has(n.id));
            const blob = new Blob([JSON.stringify(subgraph, null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `subgraph-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }),
        },
      ],
    },
  ];
}
