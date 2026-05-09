/**
 * ArtifactMiniGraph — component tests (v2.1 mini-graph P2 Phase 2).
 *
 * Verifies:
 *   - Renders loading skeleton while neighborhood data is fetching
 *   - Renders error state when fetch fails
 *   - Renders screen-reader fallback list after data loads
 *   - Renders hop selector (1/2/3) controls
 *   - Truncation indicator shown when data.truncated = true
 *   - Visual encoding constants: node colors match encoding table
 *   - Dynamic import (sigma) is mocked — canvas is not rendered in jsdom
 *
 * Mocking strategy:
 *   - Mock useArtifactNeighborhood at module boundary to control data
 *   - Mock @react-sigma/core — jsdom has no WebGL; sigma cannot render
 *   - Mock graphology-layout-forceatlas2/worker — no SharedArrayBuffer in jsdom
 *   - Mock next/dynamic so the inner component renders directly
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  NODE_TYPE_COLORS,
  EDGE_TYPE_STYLES,
  type GraphNodeType,
} from "@/types/graph";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock graphology — graph data structure library
jest.mock("graphology", () => {
  const GraphMock = jest.fn().mockImplementation(() => ({
    addNode: jest.fn(),
    addEdgeWithKey: jest.fn(),
    hasNode: jest.fn(() => false),
    hasEdge: jest.fn(() => false),
    order: 0,
    nodes: jest.fn(() => []),
    edges: jest.fn(() => []),
  }));
  return { __esModule: true, default: GraphMock };
});

// Mock sigma — no WebGL in jsdom
jest.mock("@react-sigma/core", () => ({
  SigmaContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sigma-container">{children}</div>
  ),
  useRegisterEvents: jest.fn(() => jest.fn()),
  useSigma: jest.fn(() => ({
    getGraph: jest.fn(() => ({
      order: 3,
      hasNode: jest.fn(() => true),
    })),
    getCamera: jest.fn(() => ({
      animate: jest.fn(),
      getState: jest.fn(() => ({ x: 0, y: 0, ratio: 1, angle: 0 })),
    })),
    getNodeDisplayData: jest.fn(() => ({ x: 0, y: 0 })),
    graphToViewport: jest.fn((coords) => coords),
    refresh: jest.fn(),
  })),
}));

// Mock FA2 worker — requires SharedArrayBuffer not available in jsdom
jest.mock("graphology-layout-forceatlas2/worker", () => {
  return jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    kill: jest.fn(),
  }));
});

// Mock graphology circular layout (used in buildGraph)
jest.mock("graphology-layout/circular", () => ({
  __esModule: true,
  default: { assign: jest.fn() },
}));

// Mock next/dynamic so components render directly in tests
jest.mock("next/dynamic", () => {
  return (fn: () => Promise<{ default: React.ComponentType<unknown> }>) => {
    // Return a component that synchronously renders the inner component
    // by calling the loader. This is a simplified test double.
    const DynamicMock = (props: Record<string, unknown>) => {
      const [Component, setComponent] = React.useState<React.ComponentType<unknown> | null>(null);
      React.useEffect(() => {
        fn().then((mod) => setComponent(() => mod.default)).catch(() => {});
      }, []);
      if (!Component) return <div data-testid="dynamic-loading" />;
      return <Component {...props} />;
    };
    DynamicMock.displayName = "DynamicMock";
    return DynamicMock;
  };
});

// Mock next/link
jest.mock("next/link", () => {
  const LinkMock = ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
  LinkMock.displayName = "LinkMock";
  return LinkMock;
});

// Mock useArtifactNeighborhood
const mockUseArtifactNeighborhood = jest.fn();
jest.mock("@/hooks/useArtifactNeighborhood", () => ({
  useArtifactNeighborhood: (...args: unknown[]) =>
    mockUseArtifactNeighborhood(...args),
}));

// Mock GraphLegend to keep tests focused
jest.mock("@/components/shared/GraphLegend", () => ({
  GraphLegend: () => <div data-testid="graph-legend" />,
}));

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

const MOCK_NEIGHBORHOOD = {
  nodes: [
    {
      id: "center-001",
      title: "Distributed Systems",
      artifact_type: "concept",
      workspace: "library",
      updated_at: "2026-04-15T10:00:00Z",
      hop_distance: 0,
    },
    {
      id: "node-002",
      title: "CAP Theorem",
      artifact_type: "topic_note",
      workspace: "library",
      updated_at: "2026-04-10T09:00:00Z",
      hop_distance: 1,
    },
    {
      id: "node-003",
      title: "Raft Consensus",
      artifact_type: "evidence",
      workspace: "research",
      updated_at: "2026-04-01T08:00:00Z",
      hop_distance: 2,
    },
  ],
  edges: [
    { source_id: "center-001", target_id: "node-002", edge_type: "relates_to" },
    { source_id: "center-001", target_id: "node-003", edge_type: "supports" },
  ],
  center_id: "center-001",
  hops: 2,
  truncated: false,
  truncation_reason: null,
};

// ---------------------------------------------------------------------------
// Import the component under test (after mocks are set up)
// ---------------------------------------------------------------------------

// We import ArtifactMiniGraphInner directly to bypass the dynamic() wrapper
// and test the real component rendering.
import { ArtifactMiniGraphInner } from "@/components/artifact/ArtifactMiniGraph";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderGraph(artifactId = "center-001", hops: 1 | 2 | 3 = 2) {
  return render(
    <ArtifactMiniGraphInner artifactId={artifactId} hops={hops} />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ArtifactMiniGraph", () => {
  beforeEach(() => {
    mockUseArtifactNeighborhood.mockReset();
  });

  describe("loading state", () => {
    it("renders loading skeleton while data is fetching", () => {
      mockUseArtifactNeighborhood.mockReturnValue({
        data: undefined,
        isLoading: true,
        isFetching: true,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      renderGraph();

      // Hop selector still renders in loading state
      expect(screen.getByRole("group", { name: /hop count/i })).toBeInTheDocument();
      // Skeleton has aria-busy
      expect(document.querySelector("[aria-busy='true']")).toBeTruthy();
    });

    it("renders hop selector during loading", () => {
      mockUseArtifactNeighborhood.mockReturnValue({
        data: undefined,
        isLoading: true,
        isFetching: true,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      renderGraph();

      const hopGroup = screen.getByRole("group", { name: /hop count/i });
      expect(hopGroup).toBeInTheDocument();
      // All 3 hop buttons rendered
      expect(screen.getByRole("button", { name: /show 1 hop/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /show 2 hops/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /show 3 hops/i })).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("renders error message when fetch fails", () => {
      const testError = new Error("Network error: connection refused");
      mockUseArtifactNeighborhood.mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
        isError: true,
        error: testError,
        refetch: jest.fn(),
      });

      renderGraph();

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/failed to load knowledge graph/i)).toBeInTheDocument();
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });

    it("calls refetch when try again is clicked", async () => {
      const mockRefetch = jest.fn();
      mockUseArtifactNeighborhood.mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
        isError: true,
        error: new Error("503"),
        refetch: mockRefetch,
      });

      renderGraph();

      fireEvent.click(screen.getByRole("button", { name: /try again/i }));
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("populated state", () => {
    beforeEach(() => {
      mockUseArtifactNeighborhood.mockReturnValue({
        data: MOCK_NEIGHBORHOOD,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });
    });

    it("renders graph canvas region with proper aria role", () => {
      renderGraph();
      const canvas = screen.getByRole("img", { name: /knowledge graph neighborhood/i });
      expect(canvas).toBeInTheDocument();
    });

    it("renders screen-reader fallback list with all nodes", () => {
      renderGraph();

      // All 3 nodes appear in the fallback list
      expect(screen.getByText("Distributed Systems")).toBeInTheDocument();
      expect(screen.getByText("CAP Theorem")).toBeInTheDocument();
      expect(screen.getByText("Raft Consensus")).toBeInTheDocument();
    });

    it("marks center node in fallback list", () => {
      renderGraph();
      expect(screen.getByText("center")).toBeInTheDocument();
    });

    it("renders links to artifact detail pages in fallback list", () => {
      renderGraph();
      const links = screen.getAllByRole("link");
      const hrefs = links.map((l) => l.getAttribute("href"));
      expect(hrefs).toContain("/artifact/center-001");
      expect(hrefs).toContain("/artifact/node-002");
      expect(hrefs).toContain("/artifact/node-003");
    });

    it("renders hop selector with correct active button", () => {
      renderGraph("center-001", 2);
      const btn2 = screen.getByRole("button", { name: /show 2 hops/i });
      expect(btn2).toHaveAttribute("aria-pressed", "true");
    });

    it("renders graph legend", () => {
      renderGraph();
      expect(screen.getByTestId("graph-legend")).toBeInTheDocument();
    });

    it("renders sigma container", () => {
      renderGraph();
      expect(screen.getByTestId("sigma-container")).toBeInTheDocument();
    });

    it("does not show truncation indicator when not truncated", () => {
      renderGraph();
      expect(screen.queryByRole("note", { name: /truncated/i })).not.toBeInTheDocument();
    });
  });

  describe("truncation indicator", () => {
    it("shows truncation indicator when data.truncated is true", () => {
      mockUseArtifactNeighborhood.mockReturnValue({
        data: {
          ...MOCK_NEIGHBORHOOD,
          truncated: true,
          truncation_reason: "node cap reached (500)",
        },
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      renderGraph();

      const note = screen.getByRole("note", {
        name: /truncated/i,
      });
      expect(note).toBeInTheDocument();
    });
  });

  describe("hop selector behavior", () => {
    it("calls useArtifactNeighborhood with new hop count when selector changes", async () => {
      mockUseArtifactNeighborhood.mockReturnValue({
        data: MOCK_NEIGHBORHOOD,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });

      renderGraph("center-001", 2);

      // Initially 2 hops
      expect(mockUseArtifactNeighborhood).toHaveBeenCalledWith(
        "center-001",
        expect.objectContaining({ hops: 2 }),
      );

      // Click hop 1
      fireEvent.click(screen.getByRole("button", { name: /show 1 hop/i }));

      await waitFor(() => {
        // Should re-render with hops: 1
        const calls = mockUseArtifactNeighborhood.mock.calls;
        const lastCall = calls[calls.length - 1];
        expect(lastCall[1]).toMatchObject({ hops: 1 });
      });
    });
  });

  describe("accessibility", () => {
    beforeEach(() => {
      mockUseArtifactNeighborhood.mockReturnValue({
        data: MOCK_NEIGHBORHOOD,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      });
    });

    it("graph canvas has role=img with descriptive aria-label", () => {
      renderGraph();
      const canvas = screen.getByRole("img");
      const label = canvas.getAttribute("aria-label") ?? "";
      expect(label).toContain("Knowledge graph");
      expect(label).toContain("nodes");
      expect(label).toContain("edges");
    });

    it("canvas region has tabIndex=0 for keyboard focus", () => {
      renderGraph();
      const canvas = screen.getByRole("img");
      expect(canvas).toHaveAttribute("tabindex", "0");
    });

    it("skip link to fallback list is present", () => {
      renderGraph();
      const skipLink = document.querySelector('a[href="#graph-fallback-list"]');
      expect(skipLink).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Visual encoding constant tests
// ---------------------------------------------------------------------------

describe("Graph visual encoding constants", () => {
  const NODE_TYPES: GraphNodeType[] = [
    "concept",
    "entity",
    "topic_note",
    "summary",
    "synthesis",
    "evidence",
    "glossary",
  ];

  it("all documented node types have a color in NODE_TYPE_COLORS", () => {
    for (const type of NODE_TYPES) {
      expect(NODE_TYPE_COLORS[type]).toBeDefined();
      expect(NODE_TYPE_COLORS[type]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("concept node is blue (#3f83ff)", () => {
    expect(NODE_TYPE_COLORS["concept"]).toBe("#3f83ff");
  });

  it("entity node is green (#2ebd6e)", () => {
    expect(NODE_TYPE_COLORS["entity"]).toBe("#2ebd6e");
  });

  it("synthesis node is red (#ef4444)", () => {
    expect(NODE_TYPE_COLORS["synthesis"]).toBe("#ef4444");
  });

  it("evidence node is teal (#14b8a6)", () => {
    expect(NODE_TYPE_COLORS["evidence"]).toBe("#14b8a6");
  });

  it("all documented edge types have a style in EDGE_TYPE_STYLES", () => {
    const edgeTypes = [
      "derived_from",
      "relates_to",
      "supports",
      "contains",
      "superseded_by",
    ];
    for (const type of edgeTypes) {
      expect(EDGE_TYPE_STYLES[type]).toBeDefined();
    }
  });

  it("derived_from edge is solid", () => {
    expect(EDGE_TYPE_STYLES["derived_from"]).toBe("solid");
  });

  it("superseded_by edge is red-dashed", () => {
    expect(EDGE_TYPE_STYLES["superseded_by"]).toBe("red-dashed");
  });

  it("contains edge is thick-solid", () => {
    expect(EDGE_TYPE_STYLES["contains"]).toBe("thick-solid");
  });
});
