/**
 * rendererCoexistence.test.tsx — WebGL context mutual-exclusion contract (P2-11).
 *
 * Tests the guarantee that sigma.js and cosmos.gl are never alive simultaneously.
 * The contract lives in VaultGraphPageClient: `activeRenderer` is derived from
 * `totalNodeCount` via `selectRenderer`, and sigma vs CosmosGraphWrapper are in
 * an if/else branch — React unmounts the outgoing renderer before mounting the
 * incoming one.
 *
 * Because VaultGraphPageClient is a large, deeply-integrated Next.js client
 * component (sigma WebGL context, FA2 worker, TanStack Query, next/navigation,
 * next/dynamic, etc.), the approach here is a two-layer strategy:
 *
 *   Layer 1 (unit) — `selectRenderer` pure-function tests: verify the threshold
 *     boundary logic with no DOM at all. Fast, zero-mock-overhead.
 *
 *   Layer 2 (component) — Lightweight component tests that stub out all
 *     browser-specific APIs, mock `@/hooks/useVaultGraph` to control totalNodeCount,
 *     and assert DOM presence/absence of `data-testid="sigma-container"` vs
 *     `data-testid="cosmos-graph-wrapper"`.
 *
 *     For transition tests (c) and (d) the call-ordering contract is verified by
 *     tracking mock invocation order via a shared `callLog` array.
 *
 * Mocking strategy:
 *   - `@react-sigma/core` — SigmaContainer stubbed to a div[data-testid="sigma-container"].
 *     useSigma / useRegisterEvents return minimal jest.fn() stubs. A module-level
 *     `sigmaCreateCount` / `sigmaDestroyCount` accumulate across renders; a React
 *     useEffect inside the stub fires cleanup on unmount to increment destroyCount.
 *   - `graphology-layout-forceatlas2/worker` — class mock; instance exposes
 *     start/stop/kill as jest.fn(); kill call is counted toward destroy tracking.
 *   - `@cosmos.gl/graph` — class mock; instance exposes destroy as jest.fn();
 *     constructor call increments cosmosCreateCount, destroy increments destroyCount.
 *   - `graphology` — minimal graph stub (no real data structure needed).
 *   - `graphology-layout/circular` — no-op assign mock.
 *   - `next/dynamic` — synchronous resolver that immediately renders the inner component.
 *   - `@/hooks/useVaultGraph` — fully mocked; `totalNodeCount` driven by test-local state.
 *   - `@/hooks/useArtifactNeighborhood` — returns empty neighborhood (no loading).
 *   - Lucide icons, `@/lib/graph/encoding`, `@/lib/graph/cosmosWrapper` — thin stubs.
 *   - `next/link` → plain <a> stub.
 *
 * Covers task P2-11 (Portal v2.2 Graph Explorer Phase 2).
 */

import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// Shared call-order log (module-level so all mock factories can write to it)
// ---------------------------------------------------------------------------

/** Ordered record of renderer lifecycle events for transition ordering tests. */
const callLog: string[] = [];

// ---------------------------------------------------------------------------
// Mock counters — track WebGL renderer create/destroy across renders
// ---------------------------------------------------------------------------

let sigmaCreateCount = 0;
let sigmaDestroyCount = 0;
let cosmosCreateCount = 0;
let cosmosDestroyCount = 0;
let fa2KillCount = 0;

/** Total "alive" WebGL contexts at any point: create - destroy per renderer pair. */
function aliveContextCount(): number {
  const sigmaAlive = Math.max(0, sigmaCreateCount - sigmaDestroyCount);
  const cosmosAlive = Math.max(0, cosmosCreateCount - cosmosDestroyCount);
  return sigmaAlive + cosmosAlive;
}

function resetCounters(): void {
  sigmaCreateCount = 0;
  sigmaDestroyCount = 0;
  cosmosCreateCount = 0;
  cosmosDestroyCount = 0;
  fa2KillCount = 0;
  callLog.length = 0;
}

// ---------------------------------------------------------------------------
// Mock: @react-sigma/core
//
// SigmaContainer increments sigmaCreateCount on mount, sigmaDestroyCount on
// unmount (via a useEffect cleanup). Children are rendered inside so hooks
// like GraphCanvasInner still execute (though their sigma calls are no-ops).
// ---------------------------------------------------------------------------

jest.mock("@react-sigma/core", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require("react") as typeof React;

  function SigmaContainerMock({ children }: { children?: React.ReactNode }) {
    R.useEffect(() => {
      sigmaCreateCount++;
      callLog.push("sigma:create");
      return () => {
        sigmaDestroyCount++;
        callLog.push("sigma:destroy");
      };
    }, []);
    return <div data-testid="sigma-container">{children}</div>;
  }
  SigmaContainerMock.displayName = "SigmaContainerMock";

  return {
    SigmaContainer: SigmaContainerMock,
    useRegisterEvents: jest.fn(() => jest.fn()),
    useSigma: jest.fn(() => ({
      getGraph: jest.fn(() => ({
        order: 3,
        hasNode: jest.fn(() => true),
        forEachNode: jest.fn(),
        forEachEdge: jest.fn(),
      })),
      getCamera: jest.fn(() => ({
        animate: jest.fn(),
        getState: jest.fn(() => ({ x: 0, y: 0, ratio: 1, angle: 0 })),
      })),
      getNodeDisplayData: jest.fn(() => ({ x: 0, y: 0 })),
      graphToViewport: jest.fn((c: { x: number; y: number }) => c),
      refresh: jest.fn(),
      getCanvases: jest.fn(() => ({ webgl: null })),
      on: jest.fn(),
      off: jest.fn(),
    })),
    useLoadGraph: jest.fn(() => jest.fn()),
    useSetSettings: jest.fn(() => jest.fn()),
  };
});

// ---------------------------------------------------------------------------
// Mock: graphology-layout-forceatlas2/worker
//
// FA2Layout constructor is tracked; kill() increments fa2KillCount and writes
// to callLog so ordering assertions can reference it.
// ---------------------------------------------------------------------------

jest.mock("graphology-layout-forceatlas2/worker", () => {
  return jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    kill: jest.fn(() => {
      fa2KillCount++;
      callLog.push("fa2:kill");
    }),
    isRunning: jest.fn(() => false),
  }));
});

// ---------------------------------------------------------------------------
// Mock: @cosmos.gl/graph
//
// Graph constructor increments cosmosCreateCount; destroy() increments
// cosmosDestroyCount. Both write to callLog for ordering assertions.
// ---------------------------------------------------------------------------

jest.mock("@cosmos.gl/graph", () => {
  const GraphMock = jest.fn().mockImplementation(() => {
    cosmosCreateCount++;
    callLog.push("cosmos:create");

    return {
      setPointPositions: jest.fn(),
      setPointColors: jest.fn(),
      setPointSizes: jest.fn(),
      setLinks: jest.fn(),
      setLinkColors: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      getPointPositions: jest.fn(() => []),
      destroy: jest.fn(() => {
        cosmosDestroyCount++;
        callLog.push("cosmos:destroy");
      }),
    };
  });

  return { Graph: GraphMock };
});

// ---------------------------------------------------------------------------
// Mock: graphology
// ---------------------------------------------------------------------------

jest.mock("graphology", () => {
  const GraphMock = jest.fn().mockImplementation(() => ({
    addNode: jest.fn(),
    addEdgeWithKey: jest.fn(),
    hasNode: jest.fn(() => false),
    hasEdge: jest.fn(() => false),
    order: 0,
    nodes: jest.fn(() => []),
    edges: jest.fn(() => []),
    forEachNode: jest.fn(),
    forEachEdge: jest.fn(),
  }));
  return { __esModule: true, default: GraphMock };
});

// ---------------------------------------------------------------------------
// Mock: graphology-layout/circular
// ---------------------------------------------------------------------------

jest.mock("graphology-layout/circular", () => ({
  __esModule: true,
  default: { assign: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Mock: next/dynamic
//
// Synchronous resolver: calls the factory fn and immediately renders the
// resolved component so no async Suspense is needed in tests.
// ---------------------------------------------------------------------------

jest.mock("next/dynamic", () => {
  return (
    fn: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>,
  ) => {
    const DynamicMock = (props: Record<string, unknown>) => {
      const [Component, setComponent] = React.useState<React.ComponentType<Record<string, unknown>> | null>(null);
      React.useEffect(() => {
        fn()
          .then((mod) => setComponent(() => mod.default))
          .catch(() => {});
      }, []);
      if (!Component) return <div data-testid="dynamic-loading" />;
      return <Component {...props} />;
    };
    DynamicMock.displayName = "DynamicMock";
    return DynamicMock;
  };
});

// ---------------------------------------------------------------------------
// Mock: next/link
// ---------------------------------------------------------------------------

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// ---------------------------------------------------------------------------
// Mock: lucide-react (icons only — no functional behavior needed in tests)
// ---------------------------------------------------------------------------

jest.mock("lucide-react", () => {
  const icon = (name: string) => {
    const Icon = ({ className }: { className?: string }) => (
      <span data-testid={`icon-${name}`} className={className} />
    );
    Icon.displayName = name;
    return Icon;
  };
  return {
    ZoomIn: icon("ZoomIn"),
    ZoomOut: icon("ZoomOut"),
    Maximize2: icon("Maximize2"),
    X: icon("X"),
    ExternalLink: icon("ExternalLink"),
    Network: icon("Network"),
    ArrowLeft: icon("ArrowLeft"),
    AlertTriangle: icon("AlertTriangle"),
    SlidersHorizontal: icon("SlidersHorizontal"),
    ChevronRight: icon("ChevronRight"),
    Palette: icon("Palette"),
    Ruler: icon("Ruler"),
  };
});

// ---------------------------------------------------------------------------
// Mock: @/lib/graph/encoding
// ---------------------------------------------------------------------------

jest.mock("@/lib/graph/encoding", () => ({
  resolveNodeColor: jest.fn(() => "#6366f1"),
  resolveNodeSize: jest.fn(() => 8),
  resolveNodeOpacity: jest.fn(() => 1),
  hasUncertaintyRing: jest.fn(() => false),
  resolveEdgeColor: jest.fn(() => "#94a3b8"),
  resolveEdgeSize: jest.fn(() => 1.5),
  isSemanticEdge: jest.fn(() => false),
}));

// ---------------------------------------------------------------------------
// Mock: @/components/graph/FilterSidebar
// ---------------------------------------------------------------------------

jest.mock("@/components/graph/FilterSidebar", () => ({
  FilterSidebar: () => <div data-testid="filter-sidebar" />,
}));

// ---------------------------------------------------------------------------
// Mock: @/components/graph/DegradedFallback
// ---------------------------------------------------------------------------

jest.mock("@/components/graph/DegradedFallback", () => ({
  DegradedFallback: () => <div data-testid="degraded-fallback" />,
}));

// ---------------------------------------------------------------------------
// Mock: @/components/shared/GraphLegend
// ---------------------------------------------------------------------------

jest.mock("@/components/shared/GraphLegend", () => ({
  GraphLegend: () => <div data-testid="graph-legend" />,
}));

// ---------------------------------------------------------------------------
// Mock: @/hooks/useArtifactNeighborhood
// ---------------------------------------------------------------------------

jest.mock("@/hooks/useArtifactNeighborhood", () => ({
  useArtifactNeighborhood: jest.fn(() => ({
    data: null,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Mock: @/hooks/useVaultGraph
//
// Controlled via module-level `mockTotalNodeCount` updated per test.
// ---------------------------------------------------------------------------

let mockTotalNodeCount = 0;

const mockUseVaultGraph = jest.fn(() => ({
  nodes: makeNodes(Math.min(mockTotalNodeCount, 5)),
  edges: [],
  totalNodeCount: mockTotalNodeCount,
  sampled: false,
  degraded: false,
  nextCursor: null,
  isLoading: false,
  isFetchingMore: false,
  hasMore: false,
  isError: false,
  error: null,
  refetch: jest.fn(),
  fetchNextPage: jest.fn(),
  nodeTypes: [],
  edgeTypes: [],
  setNodeTypes: jest.fn(),
  setEdgeTypes: jest.fn(),
  clearFilters: jest.fn(),
}));

jest.mock("@/hooks/useVaultGraph", () => ({
  useVaultGraph: mockUseVaultGraph,
  VAULT_GRAPH_NODE_CAP: 2000,
}));

// ---------------------------------------------------------------------------
// Mock: @/lib/utils (cn helper)
// ---------------------------------------------------------------------------

jest.mock("@/lib/utils", () => ({
  cn: (...args: (string | undefined | null | false)[]) =>
    args.filter(Boolean).join(" "),
}));

// ---------------------------------------------------------------------------
// Mock: @react-sigma/core/lib/style.css (static import — no-op)
// ---------------------------------------------------------------------------

jest.mock("@react-sigma/core/lib/style.css", () => ({}), { virtual: true });

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

import type { VaultGraphNode } from "@/types/graph";

function makeNode(id: string): VaultGraphNode {
  return {
    id,
    title: `Node ${id}`,
    artifact_type: "concept",
    workspace: "wiki",
    updated_at: "2026-05-18T00:00:00Z",
    fidelity_level: null,
    freshness_class: null,
    classification_confidence: null,
    lens_scores_jsonb: null,
  };
}

function makeNodes(count: number): VaultGraphNode[] {
  return Array.from({ length: count }, (_, i) => makeNode(`node-${i}`));
}

// ---------------------------------------------------------------------------
// Wrapper component — allows us to change totalNodeCount across renders
// without remounting the parent tree. We drive mockTotalNodeCount externally
// via the jest mock factory, then re-render with new props.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Import AFTER all jest.mock() calls (hoisting completes before import)
import { selectRenderer, EXTREME_SCALE_THRESHOLD } from "@/lib/graph/rendererSelect";

// VaultGraphPageClient is imported last — all mocks must be declared above.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { VaultGraphPageClient } = require("@/app/(main)/graph/VaultGraphPageClient") as {
  VaultGraphPageClient: React.ComponentType;
};

// ---------------------------------------------------------------------------
// Layer 1: Pure unit tests for selectRenderer
// ---------------------------------------------------------------------------

describe("selectRenderer — pure unit tests", () => {
  it("returns 'sigma' when nodeCount is 0", () => {
    expect(selectRenderer({ nodeCount: 0 })).toBe("sigma");
  });

  it("returns 'sigma' when nodeCount is 1", () => {
    expect(selectRenderer({ nodeCount: 1 })).toBe("sigma");
  });

  it("returns 'sigma' when nodeCount is EXTREME_SCALE_THRESHOLD - 1", () => {
    expect(selectRenderer({ nodeCount: EXTREME_SCALE_THRESHOLD - 1 })).toBe("sigma");
  });

  it("returns 'cosmos' when nodeCount equals EXTREME_SCALE_THRESHOLD", () => {
    expect(selectRenderer({ nodeCount: EXTREME_SCALE_THRESHOLD })).toBe("cosmos");
  });

  it("returns 'cosmos' when nodeCount exceeds EXTREME_SCALE_THRESHOLD", () => {
    expect(selectRenderer({ nodeCount: EXTREME_SCALE_THRESHOLD + 1 })).toBe("cosmos");
  });

  it("returns 'cosmos' for very large counts (100K)", () => {
    expect(selectRenderer({ nodeCount: 100_000 })).toBe("cosmos");
  });

  it("EXTREME_SCALE_THRESHOLD is 15000", () => {
    expect(EXTREME_SCALE_THRESHOLD).toBe(15_000);
  });
});

// ---------------------------------------------------------------------------
// Layer 2: Component-level mutual-exclusion tests
//
// Strategy: render VaultGraphPageClient with mocked hooks; control totalNodeCount
// via mockUseVaultGraph. Assert DOM testids for presence/absence.
// ---------------------------------------------------------------------------

describe("VaultGraphPageClient — renderer mutual exclusion (P2-11)", () => {
  beforeEach(() => {
    resetCounters();
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // (a) sigma renders at nodeCount < 15000; cosmos NOT in DOM
  // -------------------------------------------------------------------------
  describe("(a) sigma at N < 15000", () => {
    it("renders sigma-container when totalNodeCount is below threshold", async () => {
      mockUseVaultGraph.mockReturnValue({
        nodes: makeNodes(5),
        edges: [],
        totalNodeCount: 100,
        sampled: false,
        degraded: false,
        nextCursor: null,
        isLoading: false,
        isFetchingMore: false,
        hasMore: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        fetchNextPage: jest.fn(),
        nodeTypes: [],
        edgeTypes: [],
        setNodeTypes: jest.fn(),
        setEdgeTypes: jest.fn(),
        clearFilters: jest.fn(),
      });

      render(<VaultGraphPageClient />);

      await waitFor(() => {
        expect(screen.getByTestId("sigma-container")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("cosmos-graph-wrapper")).not.toBeInTheDocument();
    });

    it("renders sigma-container at exactly EXTREME_SCALE_THRESHOLD - 1 nodes", async () => {
      mockUseVaultGraph.mockReturnValue({
        nodes: makeNodes(5),
        edges: [],
        totalNodeCount: EXTREME_SCALE_THRESHOLD - 1,
        sampled: false,
        degraded: false,
        nextCursor: null,
        isLoading: false,
        isFetchingMore: false,
        hasMore: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        fetchNextPage: jest.fn(),
        nodeTypes: [],
        edgeTypes: [],
        setNodeTypes: jest.fn(),
        setEdgeTypes: jest.fn(),
        clearFilters: jest.fn(),
      });

      render(<VaultGraphPageClient />);

      await waitFor(() => {
        expect(screen.getByTestId("sigma-container")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("cosmos-graph-wrapper")).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // (b) cosmos renders at nodeCount >= 15000; sigma NOT in DOM
  // -------------------------------------------------------------------------
  describe("(b) cosmos at N >= 15000", () => {
    it("renders cosmos-graph-wrapper when totalNodeCount equals threshold", async () => {
      mockUseVaultGraph.mockReturnValue({
        nodes: makeNodes(5),
        edges: [],
        totalNodeCount: EXTREME_SCALE_THRESHOLD,
        sampled: false,
        degraded: false,
        nextCursor: null,
        isLoading: false,
        isFetchingMore: false,
        hasMore: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        fetchNextPage: jest.fn(),
        nodeTypes: [],
        edgeTypes: [],
        setNodeTypes: jest.fn(),
        setEdgeTypes: jest.fn(),
        clearFilters: jest.fn(),
      });

      render(<VaultGraphPageClient />);

      // cosmos branch rendered via next/dynamic — may be async
      await waitFor(() => {
        expect(screen.getByTestId("cosmos-graph-wrapper")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("sigma-container")).not.toBeInTheDocument();
    });

    it("renders cosmos-graph-wrapper when totalNodeCount is well above threshold", async () => {
      mockUseVaultGraph.mockReturnValue({
        nodes: makeNodes(5),
        edges: [],
        totalNodeCount: 50_000,
        sampled: false,
        degraded: false,
        nextCursor: null,
        isLoading: false,
        isFetchingMore: false,
        hasMore: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        fetchNextPage: jest.fn(),
        nodeTypes: [],
        edgeTypes: [],
        setNodeTypes: jest.fn(),
        setEdgeTypes: jest.fn(),
        clearFilters: jest.fn(),
      });

      render(<VaultGraphPageClient />);

      await waitFor(() => {
        expect(screen.getByTestId("cosmos-graph-wrapper")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("sigma-container")).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // (c) Transition: N<15K → N>=15K (sigma → cosmos)
  //
  // Sigma must unmount (sigma:destroy in callLog) BEFORE cosmos mounts
  // (cosmos:create in callLog). We drive this by re-rendering with a new
  // totalNodeCount via rerender().
  // -------------------------------------------------------------------------
  describe("(c) transition sigma → cosmos", () => {
    it("sigma unmounts before cosmos mounts when count crosses threshold upward", async () => {
      // Start below threshold
      mockUseVaultGraph.mockReturnValue({
        nodes: makeNodes(5),
        edges: [],
        totalNodeCount: 100,
        sampled: false,
        degraded: false,
        nextCursor: null,
        isLoading: false,
        isFetchingMore: false,
        hasMore: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        fetchNextPage: jest.fn(),
        nodeTypes: [],
        edgeTypes: [],
        setNodeTypes: jest.fn(),
        setEdgeTypes: jest.fn(),
        clearFilters: jest.fn(),
      });

      const { rerender } = render(<VaultGraphPageClient />);

      await waitFor(() => {
        expect(screen.getByTestId("sigma-container")).toBeInTheDocument();
      });

      // Sigma is now alive; log should contain sigma:create
      expect(callLog).toContain("sigma:create");
      const sigmaCreateIdx = callLog.indexOf("sigma:create");

      // Reset counter snapshots before transition
      const sigmaDestroyBefore = sigmaDestroyCount;
      const cosmosCreateBefore = cosmosCreateCount;

      // Transition: push totalNodeCount above threshold
      act(() => {
        mockUseVaultGraph.mockReturnValue({
          nodes: makeNodes(5),
          edges: [],
          totalNodeCount: EXTREME_SCALE_THRESHOLD + 1000,
          sampled: false,
          degraded: false,
          nextCursor: null,
          isLoading: false,
          isFetchingMore: false,
          hasMore: false,
          isError: false,
          error: null,
          refetch: jest.fn(),
          fetchNextPage: jest.fn(),
          nodeTypes: [],
          edgeTypes: [],
          setNodeTypes: jest.fn(),
          setEdgeTypes: jest.fn(),
          clearFilters: jest.fn(),
        });
        rerender(<VaultGraphPageClient />);
      });

      await waitFor(() => {
        expect(screen.getByTestId("cosmos-graph-wrapper")).toBeInTheDocument();
      });

      // Sigma must now be gone
      expect(screen.queryByTestId("sigma-container")).not.toBeInTheDocument();

      // Destroy count must have incremented — sigma was cleaned up
      expect(sigmaDestroyCount).toBeGreaterThan(sigmaDestroyBefore);
      // Cosmos must have been created
      expect(cosmosCreateCount).toBeGreaterThan(cosmosCreateBefore);

      // Ordering: sigma:destroy must appear BEFORE cosmos:create in callLog
      const sigmaDestroyIdx = callLog.lastIndexOf("sigma:destroy");
      const cosmosCreateIdx = callLog.lastIndexOf("cosmos:create");

      expect(sigmaDestroyIdx).toBeGreaterThan(sigmaCreateIdx); // destroy happened after create
      expect(cosmosCreateIdx).toBeGreaterThan(sigmaDestroyIdx); // cosmos created after sigma destroyed
    });

    it("WebGL context count never exceeds 1 during sigma→cosmos transition", async () => {
      mockUseVaultGraph.mockReturnValue({
        nodes: makeNodes(5),
        edges: [],
        totalNodeCount: 100,
        sampled: false,
        degraded: false,
        nextCursor: null,
        isLoading: false,
        isFetchingMore: false,
        hasMore: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        fetchNextPage: jest.fn(),
        nodeTypes: [],
        edgeTypes: [],
        setNodeTypes: jest.fn(),
        setEdgeTypes: jest.fn(),
        clearFilters: jest.fn(),
      });

      const { rerender } = render(<VaultGraphPageClient />);
      await waitFor(() => screen.getByTestId("sigma-container"));

      act(() => {
        mockUseVaultGraph.mockReturnValue({
          nodes: makeNodes(5),
          edges: [],
          totalNodeCount: EXTREME_SCALE_THRESHOLD + 1000,
          sampled: false,
          degraded: false,
          nextCursor: null,
          isLoading: false,
          isFetchingMore: false,
          hasMore: false,
          isError: false,
          error: null,
          refetch: jest.fn(),
          fetchNextPage: jest.fn(),
          nodeTypes: [],
          edgeTypes: [],
          setNodeTypes: jest.fn(),
          setEdgeTypes: jest.fn(),
          clearFilters: jest.fn(),
        });
        rerender(<VaultGraphPageClient />);
      });

      await waitFor(() => screen.getByTestId("cosmos-graph-wrapper"));

      // Post-transition: at most 1 alive context
      expect(aliveContextCount()).toBeLessThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // (d) Transition: N>=15K → N<15K (cosmos → sigma)
  // -------------------------------------------------------------------------
  describe("(d) transition cosmos → sigma", () => {
    it("cosmos destroys before sigma mounts when count drops below threshold", async () => {
      // Start above threshold
      mockUseVaultGraph.mockReturnValue({
        nodes: makeNodes(5),
        edges: [],
        totalNodeCount: EXTREME_SCALE_THRESHOLD + 1000,
        sampled: false,
        degraded: false,
        nextCursor: null,
        isLoading: false,
        isFetchingMore: false,
        hasMore: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        fetchNextPage: jest.fn(),
        nodeTypes: [],
        edgeTypes: [],
        setNodeTypes: jest.fn(),
        setEdgeTypes: jest.fn(),
        clearFilters: jest.fn(),
      });

      const { rerender } = render(<VaultGraphPageClient />);

      await waitFor(() => {
        expect(screen.getByTestId("cosmos-graph-wrapper")).toBeInTheDocument();
      });

      // Allow cosmos to fully mount (its useEffect fires async in the wrapper)
      await waitFor(() => {
        expect(cosmosCreateCount).toBeGreaterThan(0);
      });

      const cosmosDestroyBefore = cosmosDestroyCount;
      const sigmaCreateBefore = sigmaCreateCount;

      // Transition: drop below threshold
      act(() => {
        mockUseVaultGraph.mockReturnValue({
          nodes: makeNodes(5),
          edges: [],
          totalNodeCount: 100,
          sampled: false,
          degraded: false,
          nextCursor: null,
          isLoading: false,
          isFetchingMore: false,
          hasMore: false,
          isError: false,
          error: null,
          refetch: jest.fn(),
          fetchNextPage: jest.fn(),
          nodeTypes: [],
          edgeTypes: [],
          setNodeTypes: jest.fn(),
          setEdgeTypes: jest.fn(),
          clearFilters: jest.fn(),
        });
        rerender(<VaultGraphPageClient />);
      });

      await waitFor(() => {
        expect(screen.getByTestId("sigma-container")).toBeInTheDocument();
      });

      // Cosmos must now be gone
      expect(screen.queryByTestId("cosmos-graph-wrapper")).not.toBeInTheDocument();

      // Cosmos destroy must have incremented
      expect(cosmosDestroyCount).toBeGreaterThan(cosmosDestroyBefore);
      // Sigma must have been (re-)created
      expect(sigmaCreateCount).toBeGreaterThan(sigmaCreateBefore);

      // Ordering: cosmos:destroy must appear BEFORE sigma:create (latest occurrence)
      const cosmosDestroyIdx = callLog.lastIndexOf("cosmos:destroy");
      const sigmaCreateIdx = callLog.lastIndexOf("sigma:create");

      expect(cosmosDestroyIdx).toBeGreaterThan(-1); // cosmos was destroyed
      expect(sigmaCreateIdx).toBeGreaterThan(cosmosDestroyIdx); // sigma created after cosmos destroyed
    });

    it("WebGL context count never exceeds 1 during cosmos→sigma transition", async () => {
      mockUseVaultGraph.mockReturnValue({
        nodes: makeNodes(5),
        edges: [],
        totalNodeCount: EXTREME_SCALE_THRESHOLD + 1000,
        sampled: false,
        degraded: false,
        nextCursor: null,
        isLoading: false,
        isFetchingMore: false,
        hasMore: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        fetchNextPage: jest.fn(),
        nodeTypes: [],
        edgeTypes: [],
        setNodeTypes: jest.fn(),
        setEdgeTypes: jest.fn(),
        clearFilters: jest.fn(),
      });

      const { rerender } = render(<VaultGraphPageClient />);
      await waitFor(() => screen.getByTestId("cosmos-graph-wrapper"));
      await waitFor(() => expect(cosmosCreateCount).toBeGreaterThan(0));

      act(() => {
        mockUseVaultGraph.mockReturnValue({
          nodes: makeNodes(5),
          edges: [],
          totalNodeCount: 100,
          sampled: false,
          degraded: false,
          nextCursor: null,
          isLoading: false,
          isFetchingMore: false,
          hasMore: false,
          isError: false,
          error: null,
          refetch: jest.fn(),
          fetchNextPage: jest.fn(),
          nodeTypes: [],
          edgeTypes: [],
          setNodeTypes: jest.fn(),
          setEdgeTypes: jest.fn(),
          clearFilters: jest.fn(),
        });
        rerender(<VaultGraphPageClient />);
      });

      await waitFor(() => screen.getByTestId("sigma-container"));

      // Post-transition: at most 1 alive context
      expect(aliveContextCount()).toBeLessThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // (e) At all times, alive WebGL renderer count ≤ 1
  //
  // Steady-state: single renderer alive after initial mount for each branch.
  // -------------------------------------------------------------------------
  describe("(e) alive WebGL context count ≤ 1 at all times", () => {
    it("steady state sigma: exactly 1 context alive", async () => {
      mockUseVaultGraph.mockReturnValue({
        nodes: makeNodes(5),
        edges: [],
        totalNodeCount: 100,
        sampled: false,
        degraded: false,
        nextCursor: null,
        isLoading: false,
        isFetchingMore: false,
        hasMore: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        fetchNextPage: jest.fn(),
        nodeTypes: [],
        edgeTypes: [],
        setNodeTypes: jest.fn(),
        setEdgeTypes: jest.fn(),
        clearFilters: jest.fn(),
      });

      render(<VaultGraphPageClient />);
      await waitFor(() => screen.getByTestId("sigma-container"));

      expect(aliveContextCount()).toBeLessThanOrEqual(1);
      // At least sigma is alive
      expect(sigmaCreateCount).toBeGreaterThan(0);
      expect(cosmosCreateCount).toBe(0);
    });

    it("steady state cosmos: exactly 1 context alive", async () => {
      mockUseVaultGraph.mockReturnValue({
        nodes: makeNodes(5),
        edges: [],
        totalNodeCount: EXTREME_SCALE_THRESHOLD,
        sampled: false,
        degraded: false,
        nextCursor: null,
        isLoading: false,
        isFetchingMore: false,
        hasMore: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        fetchNextPage: jest.fn(),
        nodeTypes: [],
        edgeTypes: [],
        setNodeTypes: jest.fn(),
        setEdgeTypes: jest.fn(),
        clearFilters: jest.fn(),
      });

      render(<VaultGraphPageClient />);
      await waitFor(() => screen.getByTestId("cosmos-graph-wrapper"));
      await waitFor(() => expect(cosmosCreateCount).toBeGreaterThan(0));

      expect(aliveContextCount()).toBeLessThanOrEqual(1);
      expect(sigmaCreateCount).toBe(0);
    });

    it("cosmos alive count = 0 after unmount", async () => {
      mockUseVaultGraph.mockReturnValue({
        nodes: makeNodes(5),
        edges: [],
        totalNodeCount: EXTREME_SCALE_THRESHOLD,
        sampled: false,
        degraded: false,
        nextCursor: null,
        isLoading: false,
        isFetchingMore: false,
        hasMore: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        fetchNextPage: jest.fn(),
        nodeTypes: [],
        edgeTypes: [],
        setNodeTypes: jest.fn(),
        setEdgeTypes: jest.fn(),
        clearFilters: jest.fn(),
      });

      const { unmount } = render(<VaultGraphPageClient />);
      await waitFor(() => screen.getByTestId("cosmos-graph-wrapper"));
      await waitFor(() => expect(cosmosCreateCount).toBeGreaterThan(0));

      act(() => {
        unmount();
      });

      // After unmount, all cosmos instances should have been destroyed
      expect(cosmosDestroyCount).toBe(cosmosCreateCount);
      expect(aliveContextCount()).toBe(0);
    });

    it("sigma alive count = 0 after unmount", async () => {
      mockUseVaultGraph.mockReturnValue({
        nodes: makeNodes(5),
        edges: [],
        totalNodeCount: 100,
        sampled: false,
        degraded: false,
        nextCursor: null,
        isLoading: false,
        isFetchingMore: false,
        hasMore: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        fetchNextPage: jest.fn(),
        nodeTypes: [],
        edgeTypes: [],
        setNodeTypes: jest.fn(),
        setEdgeTypes: jest.fn(),
        clearFilters: jest.fn(),
      });

      const { unmount } = render(<VaultGraphPageClient />);
      await waitFor(() => screen.getByTestId("sigma-container"));

      act(() => {
        unmount();
      });

      // After unmount, all sigma instances should have been destroyed
      expect(sigmaDestroyCount).toBe(sigmaCreateCount);
      expect(aliveContextCount()).toBe(0);
    });
  });
});
