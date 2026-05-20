/**
 * useClusterExpandCollapse hook tests — P3-13 (h).
 *
 * Covers:
 *   (h) State machine basics:
 *       - collapse(id): removes id from expanded set; adds super-node; hides members.
 *       - expand(id): adds id to expanded set; removes super-node; restores members.
 *       - Sibling-collapse rule: expanding a cluster collapses other clusters
 *         at the same depth (all depth-0 in v2.2).
 *       - URL `cluster_expand` round-trip:
 *         * Collapsed IDs stored in `cluster_expand` param on collapse.
 *         * Expanded set restored from the URL param on mount.
 *       - syncClusters: discovers all cluster IDs from the graph and builds
 *         the initial expanded set (all expanded by default).
 */

import { renderHook, act } from "@testing-library/react";
import { useClusterExpandCollapse, superNodeId, isSuperNode } from "@/hooks/useClusterExpandCollapse";
import type Graph from "graphology";

// ---------------------------------------------------------------------------
// Mocks — next/navigation with per-test URL control
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => "/graph",
  useSearchParams: () => mockSearchParams,
}));

// ---------------------------------------------------------------------------
// Fake graphology graph
// ---------------------------------------------------------------------------

interface FakeNodeEntry {
  id: string;
  cluster_id?: string;
  isSuperNode?: boolean;
  x?: number;
  y?: number;
  artifact_type?: string;
}

function makeFakeGraph(nodes: FakeNodeEntry[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attrsMap = new Map<string, Record<string, any>>(
    nodes.map((n) => [
      n.id,
      {
        cluster_id: n.cluster_id ?? null,
        isSuperNode: n.isSuperNode ?? false,
        x: n.x ?? 0,
        y: n.y ?? 0,
        artifact_type: n.artifact_type ?? "artifact",
        clusterHidden: false,
        hidden: false,
      },
    ]),
  );

  return {
    order: nodes.length,
    forEachNode(
      cb: (id: string, attrs: Record<string, unknown>) => void,
    ): void {
      attrsMap.forEach((attrs, id) => cb(id, { ...attrs }));
    },
    setNodeAttribute(id: string, key: string, value: unknown): void {
      const attrs = attrsMap.get(id);
      if (attrs) attrs[key] = value;
    },
    hasNode(id: string): boolean {
      return attrsMap.has(id);
    },
    addNode(id: string, attrs: Record<string, unknown>): void {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attrsMap.set(id, attrs as Record<string, any>);
    },
    dropNode(id: string): void {
      attrsMap.delete(id);
    },
    _attrsMap: attrsMap,
  } as unknown as Graph & { _attrsMap: Map<string, Record<string, unknown>> };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  mockSearchParams = new URLSearchParams();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useClusterExpandCollapse — syncClusters (P3-13h)", () => {
  it("syncClusters populates expanded with all cluster IDs from the graph", () => {
    const graph = makeFakeGraph([
      { id: "n1", cluster_id: "A" },
      { id: "n2", cluster_id: "A" },
      { id: "n3", cluster_id: "B" },
    ]);

    const { result } = renderHook(() => useClusterExpandCollapse(graph));

    act(() => {
      result.current.syncClusters(graph);
    });

    expect(result.current.expanded.has("A")).toBe(true);
    expect(result.current.expanded.has("B")).toBe(true);
  });

  it("syncClusters excludes super-nodes from the cluster discovery", () => {
    const graph = makeFakeGraph([
      { id: "n1", cluster_id: "A" },
      { id: superNodeId("A"), cluster_id: "A", isSuperNode: true },
    ]);

    const { result } = renderHook(() => useClusterExpandCollapse(graph));

    act(() => {
      result.current.syncClusters(graph);
    });

    // Only "A" should be in expanded — the super-node ID should not be a cluster key
    expect(result.current.expanded.size).toBe(1);
    expect(result.current.expanded.has("A")).toBe(true);
  });
});

describe("useClusterExpandCollapse — collapse (P3-13h)", () => {
  it("collapse removes the cluster from expanded set", () => {
    const graph = makeFakeGraph([
      { id: "n1", cluster_id: "A" },
      { id: "n2", cluster_id: "A" },
    ]);

    const { result } = renderHook(() => useClusterExpandCollapse(graph));

    act(() => {
      result.current.syncClusters(graph);
    });

    act(() => {
      result.current.collapse("A");
    });

    expect(result.current.expanded.has("A")).toBe(false);
  });

  it("collapse sets clusterHidden=true on member nodes", () => {
    const graph = makeFakeGraph([
      { id: "n1", cluster_id: "A" },
      { id: "n2", cluster_id: "A" },
    ]);

    const { result } = renderHook(() => useClusterExpandCollapse(graph));

    act(() => {
      result.current.syncClusters(graph);
    });

    act(() => {
      result.current.collapse("A");
    });

    // Members should be cluster-hidden
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeGraph = graph as any;
    expect(fakeGraph._attrsMap.get("n1").clusterHidden).toBe(true);
    expect(fakeGraph._attrsMap.get("n2").clusterHidden).toBe(true);
  });

  it("collapse adds a super-node to the graph", () => {
    const graph = makeFakeGraph([
      { id: "n1", cluster_id: "A", x: 10, y: 20 },
    ]);

    const { result } = renderHook(() => useClusterExpandCollapse(graph));

    act(() => {
      result.current.syncClusters(graph);
    });

    act(() => {
      result.current.collapse("A");
    });

    expect(graph.hasNode(superNodeId("A"))).toBe(true);
  });

  it("collapse writes collapsed IDs to URL via router.replace", () => {
    const graph = makeFakeGraph([
      { id: "n1", cluster_id: "A" },
      { id: "n2", cluster_id: "B" },
    ]);

    const { result } = renderHook(() => useClusterExpandCollapse(graph));

    act(() => {
      result.current.syncClusters(graph);
    });

    act(() => {
      result.current.collapse("A");
    });

    expect(mockReplace).toHaveBeenCalled();
    const url: string = mockReplace.mock.calls[0][0] as string;
    expect(url).toContain("cluster_expand=A");
  });
});

describe("useClusterExpandCollapse — expand (P3-13h)", () => {
  it("expand adds the cluster back to the expanded set", () => {
    const graph = makeFakeGraph([
      { id: "n1", cluster_id: "A" },
    ]);

    const { result } = renderHook(() => useClusterExpandCollapse(graph));

    act(() => {
      result.current.syncClusters(graph);
    });

    // Collapse first, then expand
    act(() => {
      result.current.collapse("A");
    });

    act(() => {
      result.current.expand("A");
    });

    expect(result.current.expanded.has("A")).toBe(true);
  });

  it("expand removes the super-node from the graph", () => {
    const graph = makeFakeGraph([
      { id: "n1", cluster_id: "A" },
    ]);

    const { result } = renderHook(() => useClusterExpandCollapse(graph));

    act(() => {
      result.current.syncClusters(graph);
      result.current.collapse("A");
    });

    expect(graph.hasNode(superNodeId("A"))).toBe(true);

    act(() => {
      result.current.expand("A");
    });

    expect(graph.hasNode(superNodeId("A"))).toBe(false);
  });

  it("expand restores clusterHidden=false on member nodes", () => {
    const graph = makeFakeGraph([
      { id: "n1", cluster_id: "A" },
      { id: "n2", cluster_id: "A" },
    ]);

    const { result } = renderHook(() => useClusterExpandCollapse(graph));

    act(() => {
      result.current.syncClusters(graph);
      result.current.collapse("A");
    });

    act(() => {
      result.current.expand("A");
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeGraph = graph as any;
    expect(fakeGraph._attrsMap.get("n1").clusterHidden).toBe(false);
    expect(fakeGraph._attrsMap.get("n2").clusterHidden).toBe(false);
  });
});

describe("useClusterExpandCollapse — sibling-collapse rule (P3-13h)", () => {
  it("expanding cluster B collapses sibling cluster A at same depth", () => {
    const graph = makeFakeGraph([
      { id: "a1", cluster_id: "A" },
      { id: "b1", cluster_id: "B" },
    ]);

    const { result } = renderHook(() => useClusterExpandCollapse(graph));

    act(() => {
      result.current.syncClusters(graph);
    });

    // Both A and B are expanded initially; expand B explicitly → A collapses
    act(() => {
      result.current.expand("B");
    });

    // B should be expanded
    expect(result.current.expanded.has("B")).toBe(true);
    // A (sibling at same depth 0) should be collapsed
    expect(result.current.expanded.has("A")).toBe(false);
  });
});

describe("useClusterExpandCollapse — URL round-trip (P3-13h)", () => {
  it("restores collapsed clusters from URL param on mount", () => {
    // Simulate URL with A collapsed
    mockSearchParams = new URLSearchParams("cluster_expand=A");

    const graph = makeFakeGraph([
      { id: "n1", cluster_id: "A" },
      { id: "n2", cluster_id: "B" },
    ]);

    const { result } = renderHook(() => useClusterExpandCollapse(graph));

    act(() => {
      result.current.syncClusters(graph);
    });

    // A should be collapsed (excluded from expanded), B expanded
    expect(result.current.expanded.has("A")).toBe(false);
    expect(result.current.expanded.has("B")).toBe(true);
  });

  it("clears cluster_expand param from URL when all clusters are expanded", () => {
    const graph = makeFakeGraph([
      { id: "n1", cluster_id: "A" },
    ]);

    const { result } = renderHook(() => useClusterExpandCollapse(graph));

    act(() => {
      result.current.syncClusters(graph);
      result.current.collapse("A");
    });

    mockReplace.mockClear();

    act(() => {
      result.current.expand("A");
    });

    // After expanding all, URL should have no cluster_expand param
    const url: string = mockReplace.mock.calls[0][0] as string;
    expect(url).not.toContain("cluster_expand");
  });
});

describe("useClusterExpandCollapse — helper utilities (P3-13h)", () => {
  it("superNodeId produces the expected format", () => {
    expect(superNodeId("my-cluster")).toBe("__super_my-cluster");
  });

  it("isSuperNode correctly identifies super-node IDs", () => {
    expect(isSuperNode("__super_A")).toBe(true);
    expect(isSuperNode("n1")).toBe(false);
    expect(isSuperNode("__super_")).toBe(true);
  });
});
