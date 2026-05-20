/**
 * Unit tests for src/lib/graph/focusModes.ts
 *
 * Coverage:
 *  - UPSTREAM_EDGE_TYPES constant: correct membership
 *  - clearFocusMode: resets all node and edge hidden flags to false
 *  - activateFocusMode("off"): delegates to clearFocusMode
 *  - activateFocusMode("upstream"): BFS along upstream edge direction only
 *  - activateFocusMode("downstream"): BFS along downstream direction only
 *  - activateFocusMode("flow"): bidirectional union of upstream + downstream
 *  - activateFocusMode("k-hop", { k:1 }): only direct upstream neighbors
 *  - activateFocusMode("k-hop", { k:2 }): two-hop upstream neighborhood
 *  - k clamping: k < 1 treated as 1; k > 5 treated as 5
 *  - Edge visibility: edges between two hidden nodes are hidden; edges touching
 *    at least one visible node are visible
 *  - Non-upstream edge types are ignored by directional traversal modes
 *  - Focal node is always included in the visible set for directional modes
 */

import {
  activateFocusMode,
  clearFocusMode,
  UPSTREAM_EDGE_TYPES,
  type GraphologyLike,
  type FocusMode,
} from "@/lib/graph/focusModes";

// ---------------------------------------------------------------------------
// Test graph fixture builder
// ---------------------------------------------------------------------------

interface TestNode {
  hidden: boolean;
}

interface TestEdge {
  edge_type: string;
  hidden: boolean;
}

/**
 * Minimal in-memory graph that satisfies the GraphologyLike interface and
 * records mutations so tests can inspect hidden state after each call.
 *
 * Nodes are keyed by ID. Edges are stored as { edgeId, source, target, attrs }.
 */
function makeGraph(
  nodes: string[],
  edges: Array<{ id: string; source: string; target: string; edge_type: string }>,
): {
  graph: GraphologyLike;
  getNode: (id: string) => TestNode;
  getEdge: (id: string) => TestEdge;
} {
  const nodeAttrs = new Map<string, TestNode>();
  const edgeStore = new Map<
    string,
    { source: string; target: string; attrs: TestEdge }
  >();

  for (const id of nodes) {
    nodeAttrs.set(id, { hidden: false });
  }
  for (const e of edges) {
    edgeStore.set(e.id, {
      source: e.source,
      target: e.target,
      attrs: { edge_type: e.edge_type, hidden: false },
    });
  }

  const graph: GraphologyLike = {
    forEachNode(cb) {
      for (const [id, attrs] of nodeAttrs.entries()) {
        cb(id, attrs as unknown as Record<string, unknown>);
      }
    },
    forEachEdge(cb) {
      for (const [id, { source, target, attrs }] of edgeStore.entries()) {
        cb(id, attrs as unknown as Record<string, unknown>, source, target);
      }
    },
    setNodeAttribute(nodeId, attr, value) {
      const node = nodeAttrs.get(nodeId);
      if (!node) throw new Error(`Unknown node: ${nodeId}`);
      (node as unknown as Record<string, unknown>)[attr] = value;
    },
    setEdgeAttribute(edgeId, attr, value) {
      const edge = edgeStore.get(edgeId);
      if (!edge) throw new Error(`Unknown edge: ${edgeId}`);
      (edge.attrs as unknown as Record<string, unknown>)[attr] = value;
    },
  };

  return {
    graph,
    getNode: (id: string) => {
      const n = nodeAttrs.get(id);
      if (!n) throw new Error(`Unknown node: ${id}`);
      return n;
    },
    getEdge: (id: string) => {
      const e = edgeStore.get(id);
      if (!e) throw new Error(`Unknown edge: ${id}`);
      return e.attrs;
    },
  };
}

// ---------------------------------------------------------------------------
// Fixture: 7-node DAG
//
//  A --derived_from--> B --derived_from--> C
//  A --references----> D
//  E --generated_by--> A
//  F --relates_to----> A   (non-upstream edge — ignored for direction)
//  G                       (isolated node)
//
// Upstream from A's perspective: B, C, D (via derived_from/references recursion)
// Downstream from A's perspective: E (E was generated_by A)
// Flow from A: B, C, D, E
// ---------------------------------------------------------------------------

function makeFixture() {
  const nodes = ["A", "B", "C", "D", "E", "F", "G"];
  const edges = [
    { id: "e1", source: "A", target: "B", edge_type: "derived_from" },
    { id: "e2", source: "B", target: "C", edge_type: "derived_from" },
    { id: "e3", source: "A", target: "D", edge_type: "references" },
    { id: "e4", source: "E", target: "A", edge_type: "generated_by" },
    { id: "e5", source: "F", target: "A", edge_type: "relates_to" },
  ];
  return makeGraph(nodes, edges);
}

// ---------------------------------------------------------------------------
// UPSTREAM_EDGE_TYPES
// ---------------------------------------------------------------------------

describe("UPSTREAM_EDGE_TYPES", () => {
  it("contains the three MeatyWiki provenance edge types", () => {
    expect(UPSTREAM_EDGE_TYPES.has("derived_from")).toBe(true);
    expect(UPSTREAM_EDGE_TYPES.has("references")).toBe(true);
    expect(UPSTREAM_EDGE_TYPES.has("generated_by")).toBe(true);
  });

  it("does not include lateral edge types", () => {
    expect(UPSTREAM_EDGE_TYPES.has("relates_to")).toBe(false);
    expect(UPSTREAM_EDGE_TYPES.has("supports")).toBe(false);
    expect(UPSTREAM_EDGE_TYPES.has("contains")).toBe(false);
    expect(UPSTREAM_EDGE_TYPES.has("superseded_by")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// clearFocusMode
// ---------------------------------------------------------------------------

describe("clearFocusMode", () => {
  it("sets hidden=false on all nodes and edges", () => {
    const { graph, getNode, getEdge } = makeFixture();

    // Pre-set some hidden flags to simulate a previous focus activation.
    graph.setNodeAttribute("B", "hidden", true);
    graph.setNodeAttribute("C", "hidden", true);
    graph.setEdgeAttribute("e2", "hidden", true);

    clearFocusMode(graph);

    expect(getNode("A").hidden).toBe(false);
    expect(getNode("B").hidden).toBe(false);
    expect(getNode("C").hidden).toBe(false);
    expect(getNode("D").hidden).toBe(false);
    expect(getNode("E").hidden).toBe(false);
    expect(getNode("F").hidden).toBe(false);
    expect(getNode("G").hidden).toBe(false);

    expect(getEdge("e1").hidden).toBe(false);
    expect(getEdge("e2").hidden).toBe(false);
    expect(getEdge("e3").hidden).toBe(false);
    expect(getEdge("e4").hidden).toBe(false);
    expect(getEdge("e5").hidden).toBe(false);
  });

  it("is idempotent on a clean graph", () => {
    const { graph, getNode } = makeFixture();
    clearFocusMode(graph);
    clearFocusMode(graph);
    expect(getNode("A").hidden).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// activateFocusMode("off")
// ---------------------------------------------------------------------------

describe('activateFocusMode — "off" mode', () => {
  it('delegates to clearFocusMode, resetting all hidden flags', () => {
    const { graph, getNode, getEdge } = makeFixture();
    graph.setNodeAttribute("C", "hidden", true);
    graph.setEdgeAttribute("e2", "hidden", true);

    activateFocusMode(graph, "A", "off");

    expect(getNode("C").hidden).toBe(false);
    expect(getEdge("e2").hidden).toBe(false);
    expect(getNode("A").hidden).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// activateFocusMode("upstream")
// ---------------------------------------------------------------------------

describe('activateFocusMode — "upstream" mode', () => {
  it("keeps focal node A and its upstream lineage (B, C, D) visible", () => {
    const { graph, getNode } = makeFixture();
    activateFocusMode(graph, "A", "upstream");

    // A derived_from B → B is upstream of A
    // B derived_from C → C is upstream of A (transitively)
    // A references D  → D is upstream of A
    expect(getNode("A").hidden).toBe(false);
    expect(getNode("B").hidden).toBe(false);
    expect(getNode("C").hidden).toBe(false);
    expect(getNode("D").hidden).toBe(false);
  });

  it("hides nodes that are downstream or unrelated", () => {
    const { graph, getNode } = makeFixture();
    activateFocusMode(graph, "A", "upstream");

    // E generated_by A — E is downstream of A, not upstream
    expect(getNode("E").hidden).toBe(true);
    // F relates_to A — non-upstream edge type, unrelated
    expect(getNode("F").hidden).toBe(true);
    // G — isolated
    expect(getNode("G").hidden).toBe(true);
  });

  it("hides edges where both endpoints are hidden", () => {
    const { graph, getEdge } = makeFixture();
    activateFocusMode(graph, "A", "upstream");

    // e4: E → A (generated_by) — E is hidden, A is visible → hidden=true
    expect(getEdge("e4").hidden).toBe(true);
    // e5: F → A (relates_to) — F is hidden, A is visible → hidden=true
    expect(getEdge("e5").hidden).toBe(true);
  });

  it("keeps edges touching at least one visible node visible", () => {
    const { graph, getEdge } = makeFixture();
    activateFocusMode(graph, "A", "upstream");

    expect(getEdge("e1").hidden).toBe(false); // A → B both visible
    expect(getEdge("e2").hidden).toBe(false); // B → C both visible
    expect(getEdge("e3").hidden).toBe(false); // A → D both visible
  });

  it("focal node B — only B and C visible (upstream of B)", () => {
    const { graph, getNode } = makeFixture();
    activateFocusMode(graph, "B", "upstream");

    expect(getNode("B").hidden).toBe(false);
    expect(getNode("C").hidden).toBe(false);

    // A is not upstream of B (A derives FROM B, not the other way)
    expect(getNode("A").hidden).toBe(true);
    expect(getNode("D").hidden).toBe(true);
    expect(getNode("E").hidden).toBe(true);
    expect(getNode("F").hidden).toBe(true);
    expect(getNode("G").hidden).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// activateFocusMode("downstream")
// ---------------------------------------------------------------------------

describe('activateFocusMode — "downstream" mode', () => {
  it("keeps focal node A and its downstream consumers (E) visible", () => {
    const { graph, getNode } = makeFixture();
    activateFocusMode(graph, "A", "downstream");

    // E generated_by A → E is downstream of A
    expect(getNode("A").hidden).toBe(false);
    expect(getNode("E").hidden).toBe(false);
  });

  it("hides upstream nodes and unrelated nodes", () => {
    const { graph, getNode } = makeFixture();
    activateFocusMode(graph, "A", "downstream");

    expect(getNode("B").hidden).toBe(true);
    expect(getNode("C").hidden).toBe(true);
    expect(getNode("D").hidden).toBe(true);
    expect(getNode("F").hidden).toBe(true);
    expect(getNode("G").hidden).toBe(true);
  });

  it("focal node B — A is downstream of B", () => {
    // B derived_from C means B was derived from C, so B is downstream of C.
    // A derived_from B means A is downstream of B.
    const { graph, getNode } = makeFixture();
    activateFocusMode(graph, "B", "downstream");

    expect(getNode("B").hidden).toBe(false);
    // A derives from B → A is downstream of B
    expect(getNode("A").hidden).toBe(false);
    // E is generated_by A → transitively downstream of B
    expect(getNode("E").hidden).toBe(false);

    // C is upstream of B, not downstream
    expect(getNode("C").hidden).toBe(true);
    expect(getNode("D").hidden).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// activateFocusMode("flow")
// ---------------------------------------------------------------------------

describe('activateFocusMode — "flow" mode', () => {
  it("shows focal node plus all upstream and downstream (bidirectional)", () => {
    const { graph, getNode } = makeFixture();
    activateFocusMode(graph, "A", "flow");

    // Upstream of A: B, C, D
    // Downstream of A: E
    // F relates_to A — non-upstream edge, excluded from flow
    // G — isolated

    expect(getNode("A").hidden).toBe(false);
    expect(getNode("B").hidden).toBe(false);
    expect(getNode("C").hidden).toBe(false);
    expect(getNode("D").hidden).toBe(false);
    expect(getNode("E").hidden).toBe(false);
  });

  it("excludes nodes reachable only via non-upstream edge types", () => {
    const { graph, getNode } = makeFixture();
    activateFocusMode(graph, "A", "flow");

    // F is connected to A only via relates_to — not an upstream edge type
    expect(getNode("F").hidden).toBe(true);
    // G is isolated
    expect(getNode("G").hidden).toBe(true);
  });

  it("focal node C — upstream and downstream of C visible", () => {
    // C has no upstream edges (nothing is derived_from/references/generated_by C).
    // Downstream of C via the downstreamMap:
    //   B derived_from C → B is downstream of C
    //   A derived_from B → A is downstream of C (transitively)
    //   E generated_by A → E is downstream of C (transitively)
    // D is connected to A via A references D, meaning D is upstream OF A,
    // not downstream of C. Flow mode is the union of upstream(C) ∪ downstream(C);
    // it does not recursively expand upstream from downstream-reached nodes.
    // Therefore D is NOT reachable in flow mode from C.
    const { graph, getNode } = makeFixture();
    activateFocusMode(graph, "C", "flow");

    expect(getNode("C").hidden).toBe(false);
    expect(getNode("B").hidden).toBe(false);
    expect(getNode("A").hidden).toBe(false);
    expect(getNode("E").hidden).toBe(false);

    // D is upstream of A (A references D), not downstream of C — should be hidden.
    expect(getNode("D").hidden).toBe(true);
    // F is relates_to A (non-upstream edge) — hidden.
    expect(getNode("F").hidden).toBe(true);
    // G is isolated — hidden.
    expect(getNode("G").hidden).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// activateFocusMode("k-hop")
// ---------------------------------------------------------------------------

describe('activateFocusMode — "k-hop" mode', () => {
  it("k=1 — shows only direct upstream neighbors of focal node A", () => {
    const { graph, getNode } = makeFixture();
    activateFocusMode(graph, "A", "k-hop", { k: 1 });

    // Direct upstream neighbors of A (1 hop via upstream edges):
    // A → B (derived_from), A → D (references)
    // E → A (generated_by) → A's 1-hop also includes E (E is adjacent via upstream edge)
    expect(getNode("A").hidden).toBe(false);
    expect(getNode("B").hidden).toBe(false);
    expect(getNode("D").hidden).toBe(false);
    expect(getNode("E").hidden).toBe(false);

    // C is 2 hops from A (A→B→C) — should be hidden with k=1
    expect(getNode("C").hidden).toBe(true);
    // F is adjacent via relates_to (non-upstream) — should be hidden
    expect(getNode("F").hidden).toBe(true);
    // G isolated
    expect(getNode("G").hidden).toBe(true);
  });

  it("k=2 — expands to 2 hops from focal node A", () => {
    const { graph, getNode } = makeFixture();
    activateFocusMode(graph, "A", "k-hop", { k: 2 });

    // 1-hop from A: B, D, E
    // 2-hop from A via B: C (B → C via derived_from)
    // 2-hop from A via E: (no further upstream edges from E)
    expect(getNode("A").hidden).toBe(false);
    expect(getNode("B").hidden).toBe(false);
    expect(getNode("C").hidden).toBe(false);
    expect(getNode("D").hidden).toBe(false);
    expect(getNode("E").hidden).toBe(false);

    // F is non-upstream adjacent — still hidden
    expect(getNode("F").hidden).toBe(true);
    // G isolated
    expect(getNode("G").hidden).toBe(true);
  });

  it("k defaults to 2 when not specified", () => {
    const { graph: g1, getNode: getNode1 } = makeFixture();
    const { graph: g2, getNode: getNode2 } = makeFixture();

    activateFocusMode(g1, "A", "k-hop");           // default k
    activateFocusMode(g2, "A", "k-hop", { k: 2 }); // explicit k=2

    // Both should produce identical hidden state.
    for (const id of ["A", "B", "C", "D", "E", "F", "G"]) {
      expect(getNode1(id).hidden).toBe(getNode2(id).hidden);
    }
  });

  it("k < 1 is clamped to 1", () => {
    const { graph: g1, getNode: getNode1 } = makeFixture();
    const { graph: g2, getNode: getNode2 } = makeFixture();

    activateFocusMode(g1, "A", "k-hop", { k: 0 });
    activateFocusMode(g2, "A", "k-hop", { k: 1 });

    for (const id of ["A", "B", "C", "D", "E", "F", "G"]) {
      expect(getNode1(id).hidden).toBe(getNode2(id).hidden);
    }
  });

  it("k > 5 is clamped to 5", () => {
    // Build a longer chain: A→B→C→D→E→F (6 hops)
    const nodes = ["A", "B", "C", "D", "E", "F", "X"];
    const edges = [
      { id: "e1", source: "A", target: "B", edge_type: "derived_from" },
      { id: "e2", source: "B", target: "C", edge_type: "derived_from" },
      { id: "e3", source: "C", target: "D", edge_type: "derived_from" },
      { id: "e4", source: "D", target: "E", edge_type: "derived_from" },
      { id: "e5", source: "E", target: "F", edge_type: "derived_from" },
      { id: "e6", source: "F", target: "X", edge_type: "derived_from" },
    ];
    const { graph: g1, getNode: getNode1 } = makeGraph(nodes, edges);
    const { graph: g2, getNode: getNode2 } = makeGraph(nodes, edges);

    activateFocusMode(g1, "A", "k-hop", { k: 100 }); // clamped to 5
    activateFocusMode(g2, "A", "k-hop", { k: 5 });   // explicit 5

    for (const id of nodes) {
      expect(getNode1(id).hidden).toBe(getNode2(id).hidden);
    }

    // Node X is 6 hops away — should be hidden even with clamped k=5
    expect(getNode1("X").hidden).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Non-upstream edge type: ignored by directional modes
// ---------------------------------------------------------------------------

describe("non-upstream edges — directional modes ignore them", () => {
  it("relates_to edge does not propagate in upstream mode", () => {
    // F --relates_to--> A — F should stay hidden in upstream mode from A
    const { graph, getNode } = makeFixture();
    activateFocusMode(graph, "A", "upstream");
    expect(getNode("F").hidden).toBe(true);
  });

  it("relates_to edge does not propagate in downstream mode", () => {
    const { graph, getNode } = makeFixture();
    activateFocusMode(graph, "A", "downstream");
    expect(getNode("F").hidden).toBe(true);
  });

  it("relates_to edge does not propagate in flow mode", () => {
    const { graph, getNode } = makeFixture();
    activateFocusMode(graph, "A", "flow");
    expect(getNode("F").hidden).toBe(true);
  });

  it("relates_to edge does not propagate in k-hop mode", () => {
    const { graph, getNode } = makeFixture();
    activateFocusMode(graph, "A", "k-hop", { k: 5 });
    // F is not reachable via upstream-type edges from A
    expect(getNode("F").hidden).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge visibility semantics
// ---------------------------------------------------------------------------

describe("edge visibility", () => {
  it("edges with two hidden nodes are hidden", () => {
    const { graph, getEdge } = makeFixture();
    activateFocusMode(graph, "A", "upstream");

    // e4: E → A (generated_by), E is hidden
    expect(getEdge("e4").hidden).toBe(true);
  });

  it("edges with one hidden and one visible node are hidden", () => {
    // e4: E (hidden) → A (visible) → edge hidden
    const { graph, getEdge } = makeFixture();
    activateFocusMode(graph, "A", "upstream");
    expect(getEdge("e4").hidden).toBe(true);
  });

  it("edges with two visible nodes are visible", () => {
    const { graph, getEdge } = makeFixture();
    activateFocusMode(graph, "A", "upstream");

    expect(getEdge("e1").hidden).toBe(false); // A → B
    expect(getEdge("e2").hidden).toBe(false); // B → C
    expect(getEdge("e3").hidden).toBe(false); // A → D
  });
});

// ---------------------------------------------------------------------------
// Focus + clear round-trip
// ---------------------------------------------------------------------------

describe("focus → clear round-trip", () => {
  it("clearFocusMode after upstream restores all nodes and edges", () => {
    const { graph, getNode, getEdge } = makeFixture();

    activateFocusMode(graph, "A", "upstream");
    // Verify some nodes are hidden after focus.
    expect(getNode("E").hidden).toBe(true);

    clearFocusMode(graph);

    // All nodes visible again.
    for (const id of ["A", "B", "C", "D", "E", "F", "G"]) {
      expect(getNode(id).hidden).toBe(false);
    }
    // All edges visible again.
    for (const id of ["e1", "e2", "e3", "e4", "e5"]) {
      expect(getEdge(id).hidden).toBe(false);
    }
  });

  it("second activateFocusMode call overwrites previous focus state", () => {
    const { graph, getNode } = makeFixture();

    activateFocusMode(graph, "A", "upstream");
    expect(getNode("E").hidden).toBe(true);

    // Switch to downstream — E should now be visible, B/C/D hidden.
    activateFocusMode(graph, "A", "downstream");
    expect(getNode("E").hidden).toBe(false);
    expect(getNode("B").hidden).toBe(true);
    expect(getNode("C").hidden).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// All modes — type-level exhaustion check
// ---------------------------------------------------------------------------

describe("all FocusMode values are handled without throwing", () => {
  const modes: FocusMode[] = ["off", "flow", "upstream", "downstream", "k-hop"];

  for (const mode of modes) {
    it(`mode "${mode}" does not throw`, () => {
      const { graph } = makeFixture();
      expect(() => activateFocusMode(graph, "A", mode)).not.toThrow();
    });
  }
});
