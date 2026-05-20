/**
 * useClientFilters hook tests — P3-13 (c).
 *
 * Covers:
 *   (c) Client filter change updates graphology hidden nodes WITHOUT triggering
 *       a server refetch. Specifically:
 *       - setNodeAttribute('hidden', true) called for nodes that fail client predicates.
 *       - setNodeAttribute('hidden', false) called for nodes that pass.
 *       - sigma.refresh() called once after the node pass (debounce 100ms).
 *       - No changes applied before the 100ms debounce window.
 *
 * Mocking strategy:
 *   - useSigma() is mocked to return a fake sigma with a minimal graphology graph.
 *   - sigma.getGraph() returns a simple fake graph with forEachNode and setNodeAttribute.
 *   - We do NOT import graphology/sigma directly — pure mock objects.
 *
 * Note: useClientFilters uses useSigma() from @react-sigma/core (context hook).
 * We mock the entire module so no SigmaContainer is required.
 */

import { renderHook, act } from "@testing-library/react";
import { useClientFilters } from "@/hooks/useClientFilters";
import { GRAPH_FILTERS_DEFAULT } from "@/components/graph/GraphFilters";
import type { GraphFiltersValues } from "@/components/graph/GraphFilters";

// ---------------------------------------------------------------------------
// Mock @react-sigma/core — replace useSigma() with a factory that returns
// our fake sigma. The test reassigns mockSigmaInstance per describe block.
// ---------------------------------------------------------------------------

let mockSigmaInstance: ReturnType<typeof makeMockSigma> | null = null;

jest.mock("@react-sigma/core", () => ({
  useSigma: () => mockSigmaInstance,
}));

// ---------------------------------------------------------------------------
// Minimal fake graphology graph
// ---------------------------------------------------------------------------

interface FakeNodeAttrs {
  hidden: boolean;
  clusterHidden?: boolean;
  fidelity_level?: string;
  freshness_score?: number;
  classification_confidence?: number;
  lifecycle_stage?: string;
  status?: string;
  verification_status?: string;
  tags?: string[];
}

interface FakeNode {
  id: string;
  attrs: FakeNodeAttrs;
}

function makeFakeGraph(nodes: FakeNode[]) {
  // Mutable attrs map so setNodeAttribute mutates in-place
  const attrsMap = new Map(nodes.map((n) => [n.id, { ...n.attrs }]));

  return {
    order: nodes.length,
    forEachNode(
      cb: (id: string, attrs: Record<string, unknown>) => void,
    ): void {
      attrsMap.forEach((attrs, id) => cb(id, attrs as Record<string, unknown>));
    },
    setNodeAttribute(id: string, key: string, value: unknown): void {
      const attrs = attrsMap.get(id);
      if (attrs) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (attrs as any)[key] = value;
      }
    },
    getNodeAttribute(id: string, key: string): unknown {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (attrsMap.get(id) as any)?.[key];
    },
    _attrsMap: attrsMap,
  };
}

function makeMockSigma(nodes: FakeNode[]) {
  const graph = makeFakeGraph(nodes);
  const refreshMock = jest.fn();

  return {
    getGraph: jest.fn(() => graph),
    refresh: refreshMock,
    _graph: graph,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.clearAllMocks();
  mockSigmaInstance = null;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValues(overrides: Partial<GraphFiltersValues>): GraphFiltersValues {
  return { ...GRAPH_FILTERS_DEFAULT, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests (P3-13c)
// ---------------------------------------------------------------------------

describe("useClientFilters — debounce timing (P3-13c)", () => {
  it("does NOT apply updates before 100ms debounce window", () => {
    const nodes: FakeNode[] = [
      { id: "n1", attrs: { hidden: false, tags: [] } },
    ];
    mockSigmaInstance = makeMockSigma(nodes);

    renderHook(() =>
      useClientFilters(makeValues({ tags: ["ai"] })),
    );

    // Advance only 99ms — should not have applied yet
    act(() => {
      jest.advanceTimersByTime(99);
    });

    expect(mockSigmaInstance!.refresh).not.toHaveBeenCalled();
  });

  it("applies updates and calls sigma.refresh() after 100ms", () => {
    const nodes: FakeNode[] = [
      { id: "n1", attrs: { hidden: false, tags: ["ai"] } },
      { id: "n2", attrs: { hidden: false, tags: [] } },
    ];
    mockSigmaInstance = makeMockSigma(nodes);

    renderHook(() =>
      useClientFilters(makeValues({ tags: ["ai"] })),
    );

    act(() => {
      jest.advanceTimersByTime(100);
    });

    // n2 has no matching tags → should be hidden
    expect(
      mockSigmaInstance!._graph._attrsMap.get("n2")!.hidden,
    ).toBe(true);

    // n1 passes → should NOT be hidden
    expect(
      mockSigmaInstance!._graph._attrsMap.get("n1")!.hidden,
    ).toBe(false);

    // sigma.refresh() called exactly once (not per-node)
    expect(mockSigmaInstance!.refresh).toHaveBeenCalledTimes(1);
  });
});

describe("useClientFilters — node visibility (P3-13c)", () => {
  it("hides nodes that fail the lifecycle filter", () => {
    const nodes: FakeNode[] = [
      { id: "active", attrs: { hidden: false, lifecycle_stage: "active" } },
      {
        id: "archived",
        attrs: { hidden: false, lifecycle_stage: "archived" },
      },
    ];
    mockSigmaInstance = makeMockSigma(nodes);

    renderHook(() =>
      useClientFilters(makeValues({ lifecycle: ["active"] })),
    );

    act(() => { jest.advanceTimersByTime(100); });

    expect(mockSigmaInstance!._graph._attrsMap.get("active")!.hidden).toBe(false);
    expect(mockSigmaInstance!._graph._attrsMap.get("archived")!.hidden).toBe(true);
  });

  it("hides nodes below the freshness_score min threshold", () => {
    const nodes: FakeNode[] = [
      { id: "high", attrs: { hidden: false, freshness_score: 0.8 } },
      { id: "low",  attrs: { hidden: false, freshness_score: 0.2 } },
    ];
    mockSigmaInstance = makeMockSigma(nodes);

    renderHook(() =>
      useClientFilters(makeValues({ fscore_min: 0.5, fscore_max: 1 })),
    );

    act(() => { jest.advanceTimersByTime(100); });

    expect(mockSigmaInstance!._graph._attrsMap.get("high")!.hidden).toBe(false);
    expect(mockSigmaInstance!._graph._attrsMap.get("low")!.hidden).toBe(true);
  });

  it("shows all nodes when all filters are at defaults", () => {
    const nodes: FakeNode[] = [
      { id: "n1", attrs: { hidden: false } },
      { id: "n2", attrs: { hidden: true } },
    ];
    mockSigmaInstance = makeMockSigma(nodes);

    renderHook(() => useClientFilters(GRAPH_FILTERS_DEFAULT));

    act(() => { jest.advanceTimersByTime(100); });

    // All default → all visible
    expect(mockSigmaInstance!._graph._attrsMap.get("n1")!.hidden).toBe(false);
    expect(mockSigmaInstance!._graph._attrsMap.get("n2")!.hidden).toBe(false);
  });

  it("node passes tags filter when any tag matches (any-match semantics)", () => {
    const nodes: FakeNode[] = [
      {
        id: "partial",
        attrs: { hidden: false, tags: ["ai", "research"] },
      },
      {
        id: "nomatch",
        attrs: { hidden: false, tags: ["physics"] },
      },
    ];
    mockSigmaInstance = makeMockSigma(nodes);

    renderHook(() =>
      useClientFilters(makeValues({ tags: ["ai", "ml"] })),
    );

    act(() => { jest.advanceTimersByTime(100); });

    expect(mockSigmaInstance!._graph._attrsMap.get("partial")!.hidden).toBe(false);
    expect(mockSigmaInstance!._graph._attrsMap.get("nomatch")!.hidden).toBe(true);
  });

  it("node with absent freshness_score passes the freshness range filter", () => {
    const nodes: FakeNode[] = [
      { id: "n1", attrs: { hidden: false } }, // no freshness_score attr
    ];
    mockSigmaInstance = makeMockSigma(nodes);

    renderHook(() =>
      useClientFilters(makeValues({ fscore_min: 0.7, fscore_max: 1 })),
    );

    act(() => { jest.advanceTimersByTime(100); });

    // Absent → defaults to pass (defensive behavior per hook doc)
    expect(mockSigmaInstance!._graph._attrsMap.get("n1")!.hidden).toBe(false);
  });

  it("clusterHidden=true keeps the node hidden regardless of filter result", () => {
    const nodes: FakeNode[] = [
      {
        id: "cluster-member",
        attrs: { hidden: false, clusterHidden: true, tags: ["ai"] },
      },
    ];
    mockSigmaInstance = makeMockSigma(nodes);

    // tags filter matches → but clusterHidden overrides
    renderHook(() =>
      useClientFilters(makeValues({ tags: ["ai"] })),
    );

    act(() => { jest.advanceTimersByTime(100); });

    // Despite passing the filter, node is hidden because clusterHidden=true
    expect(
      mockSigmaInstance!._graph._attrsMap.get("cluster-member")!.hidden,
    ).toBe(true);
  });

  it("sigma.refresh() is called exactly once per update cycle (not per-node)", () => {
    const nodes: FakeNode[] = Array.from({ length: 10 }, (_, i) => ({
      id: `n${i}`,
      attrs: { hidden: false, status: i % 2 === 0 ? "published" : "draft" },
    }));
    mockSigmaInstance = makeMockSigma(nodes);

    renderHook(() =>
      useClientFilters(makeValues({ status: ["published"] })),
    );

    act(() => { jest.advanceTimersByTime(100); });

    // Only one refresh, not one per node
    expect(mockSigmaInstance!.refresh).toHaveBeenCalledTimes(1);
  });
});
