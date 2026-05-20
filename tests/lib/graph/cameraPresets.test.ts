/**
 * Unit tests for src/lib/graph/cameraPresets.ts
 *
 * Strategy:
 *   - Mock sigma with a minimal SigmaLike stub that records camera.animate calls.
 *   - Build a lightweight GraphLike stub from a list of
 *     [nodeId, attrs, displayData] tuples.
 *   - Assert each preset calls animate() with the expected { x, y, ratio }.
 *   - Assert fallback path: empty filter → animate() called with default state.
 *
 * No WebGL context required; sigma and graphology are fully stubbed.
 */

import {
  cameraPresets,
  type SigmaLike,
  type GraphLike,
  type CameraState,
  type PresetContext,
} from "@/lib/graph/cameraPresets";

// ---------------------------------------------------------------------------
// Stub builders
// ---------------------------------------------------------------------------

interface NodeSpec {
  id: string;
  attrs?: Record<string, unknown>;
  /** Graph-space position sigma reports via getNodeDisplayData. */
  display?: { x: number; y: number };
}

/**
 * Build a SigmaLike test double.
 *
 * - camera.animate is a jest.fn() — assert calls on it.
 * - camera.getState returns a fixed default.
 * - getNodeDisplayData is keyed by nodeId from the supplied nodeSpecs.
 * - getDimensions returns 800 × 600.
 */
function makeSigma(nodes: NodeSpec[] = []): SigmaLike & {
  animateMock: jest.Mock;
} {
  const animateMock = jest.fn<
    void,
    [Partial<CameraState>, { duration: number }]
  >();

  const displayMap = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    if (n.display) {
      displayMap.set(n.id, n.display);
    }
  }

  const sigma: SigmaLike & { animateMock: jest.Mock } = {
    animateMock,
    getCamera() {
      return {
        getState: () => ({ x: 0.5, y: 0.5, ratio: 1, angle: 0 }),
        setState: jest.fn(),
        animate: animateMock,
      };
    },
    getNodeDisplayData(nodeId: string) {
      return displayMap.get(nodeId);
    },
    graphToViewport({ x, y }) {
      // Identity transform for test purposes.
      return { x, y };
    },
    viewportToGraph({ x, y }) {
      return { x, y };
    },
    getDimensions() {
      return { width: 800, height: 600 };
    },
  };
  return sigma;
}

/**
 * Build a GraphLike test double from a list of NodeSpec objects.
 */
function makeGraph(nodes: NodeSpec[]): GraphLike {
  const attrsMap = new Map<string, Record<string, unknown>>();
  for (const n of nodes) {
    attrsMap.set(n.id, { id: n.id, ...(n.attrs ?? {}) });
  }
  return {
    nodes: () => Array.from(attrsMap.keys()),
    getNodeAttributes: (id: string) => attrsMap.get(id) ?? {},
  };
}

/** Extract the first argument (state) of the last animate() call. */
function lastAnimateState(sigma: { animateMock: jest.Mock }): Partial<CameraState> {
  const calls = sigma.animateMock.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0] as Partial<CameraState>;
}

/** Extract the options argument of the last animate() call. */
function lastAnimateOpts(sigma: { animateMock: jest.Mock }): { duration: number } {
  const calls = sigma.animateMock.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][1] as { duration: number };
}

// Default camera state the module targets for "reset" presets.
const DEFAULT_STATE: CameraState = { x: 0.5, y: 0.5, ratio: 1 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Suppress console.warn for a single test block. */
function suppressWarn() {
  const spy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  return () => spy.mockRestore();
}

// ---------------------------------------------------------------------------
// preset: default
// ---------------------------------------------------------------------------

describe("cameraPresets.default", () => {
  it("animates to the full-graph reset state { x:0.5, y:0.5, ratio:1 }", () => {
    const sigma = makeSigma();
    const graph = makeGraph([]);
    cameraPresets.default(sigma, graph);
    const state = lastAnimateState(sigma);
    expect(state).toEqual(DEFAULT_STATE);
  });

  it("uses the 400ms duration", () => {
    const sigma = makeSigma();
    cameraPresets.default(sigma, makeGraph([]));
    expect(lastAnimateOpts(sigma).duration).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// preset: focus-node
// ---------------------------------------------------------------------------

describe('cameraPresets["focus-node"]', () => {
  it("animates to the node's display coordinates at ratio 0.3", () => {
    const nodes: NodeSpec[] = [
      { id: "abc", display: { x: 0.7, y: 0.4 } },
    ];
    const sigma = makeSigma(nodes);
    const graph = makeGraph(nodes);
    const ctx: PresetContext = { nodeId: "abc" };
    cameraPresets["focus-node"](sigma, graph, ctx);
    const state = lastAnimateState(sigma);
    expect(state.x).toBeCloseTo(0.7);
    expect(state.y).toBeCloseTo(0.4);
    expect(state.ratio).toBeCloseTo(0.3);
  });

  it("falls back to default when nodeId is missing from context", () => {
    const restore = suppressWarn();
    const sigma = makeSigma();
    cameraPresets["focus-node"](sigma, makeGraph([]));
    expect(lastAnimateState(sigma)).toEqual(DEFAULT_STATE);
    restore();
  });

  it("falls back to default when the node has no display data", () => {
    const restore = suppressWarn();
    const nodes: NodeSpec[] = [{ id: "xyz" }]; // no display field
    const sigma = makeSigma(nodes);
    const graph = makeGraph(nodes);
    cameraPresets["focus-node"](sigma, graph, { nodeId: "xyz" });
    expect(lastAnimateState(sigma)).toEqual(DEFAULT_STATE);
    restore();
  });

  it("logs a warning when context.nodeId is absent", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const sigma = makeSigma();
    cameraPresets["focus-node"](sigma, makeGraph([]));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("focus-node"),
    );
    warn.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// preset: fit-selection
// ---------------------------------------------------------------------------

describe('cameraPresets["fit-selection"]', () => {
  it("frames the bounding box of the supplied node IDs", () => {
    // Two nodes at graph positions (0, 0) and (1, 1) — bbox centre = (0.5, 0.5).
    const nodes: NodeSpec[] = [
      { id: "n1", display: { x: 0.0, y: 0.0 } },
      { id: "n2", display: { x: 1.0, y: 1.0 } },
    ];
    const sigma = makeSigma(nodes);
    const graph = makeGraph(nodes);
    cameraPresets["fit-selection"](sigma, graph, {
      nodeIds: ["n1", "n2"],
    });
    const state = lastAnimateState(sigma);
    expect(state.x).toBeCloseTo(0.5, 3);
    expect(state.y).toBeCloseTo(0.5, 3);
    expect(typeof state.ratio).toBe("number");
    expect(state.ratio).toBeGreaterThan(0);
  });

  it("falls back to default when nodeIds is empty", () => {
    const restore = suppressWarn();
    const sigma = makeSigma();
    cameraPresets["fit-selection"](sigma, makeGraph([]), { nodeIds: [] });
    expect(lastAnimateState(sigma)).toEqual(DEFAULT_STATE);
    restore();
  });

  it("falls back to default when no display data for any nodeId", () => {
    const restore = suppressWarn();
    const nodes: NodeSpec[] = [{ id: "ghost" }]; // no display
    const sigma = makeSigma(nodes);
    const graph = makeGraph(nodes);
    cameraPresets["fit-selection"](sigma, graph, { nodeIds: ["ghost"] });
    expect(lastAnimateState(sigma)).toEqual(DEFAULT_STATE);
    restore();
  });

  it("falls back to default when context is omitted", () => {
    const restore = suppressWarn();
    const sigma = makeSigma();
    cameraPresets["fit-selection"](sigma, makeGraph([]));
    expect(lastAnimateState(sigma)).toEqual(DEFAULT_STATE);
    restore();
  });

  it("uses ratio ≈ 0.4 for a single-node selection (degenerate bbox)", () => {
    const nodes: NodeSpec[] = [
      { id: "solo", display: { x: 0.5, y: 0.5 } },
    ];
    const sigma = makeSigma(nodes);
    const graph = makeGraph(nodes);
    cameraPresets["fit-selection"](sigma, graph, { nodeIds: ["solo"] });
    const state = lastAnimateState(sigma);
    expect(state.x).toBeCloseTo(0.5);
    expect(state.y).toBeCloseTo(0.5);
    expect(state.ratio).toBeCloseTo(0.4, 1);
  });
});

// ---------------------------------------------------------------------------
// preset: high-fidelity-core
// ---------------------------------------------------------------------------

describe('cameraPresets["high-fidelity-core"]', () => {
  it("frames nodes with fidelity_level === 'F4'", () => {
    const nodes: NodeSpec[] = [
      {
        id: "f4-node",
        attrs: { fidelity_level: "F4" },
        display: { x: 0.2, y: 0.8 },
      },
      {
        id: "f2-node",
        attrs: { fidelity_level: "F2" },
        display: { x: 0.9, y: 0.1 },
      },
    ];
    const sigma = makeSigma(nodes);
    const graph = makeGraph(nodes);
    cameraPresets["high-fidelity-core"](sigma, graph);
    const state = lastAnimateState(sigma);
    // Only f4-node matched — centre must equal its position.
    expect(state.x).toBeCloseTo(0.2, 3);
    expect(state.y).toBeCloseTo(0.8, 3);
  });

  it("falls back to default when no F4 nodes exist", () => {
    const restore = suppressWarn();
    const nodes: NodeSpec[] = [
      {
        id: "f3-node",
        attrs: { fidelity_level: "F3" },
        display: { x: 0.5, y: 0.5 },
      },
    ];
    const sigma = makeSigma(nodes);
    const graph = makeGraph(nodes);
    cameraPresets["high-fidelity-core"](sigma, graph);
    expect(lastAnimateState(sigma)).toEqual(DEFAULT_STATE);
    restore();
  });

  it("logs a warning when fallback is triggered", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const sigma = makeSigma();
    cameraPresets["high-fidelity-core"](sigma, makeGraph([]));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("high-fidelity-core"),
    );
    warn.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// preset: recent-activity
// ---------------------------------------------------------------------------

describe('cameraPresets["recent-activity"]', () => {
  it("frames nodes with freshness_class === 'current'", () => {
    const nodes: NodeSpec[] = [
      {
        id: "fresh",
        attrs: { freshness_class: "current" },
        display: { x: 0.3, y: 0.6 },
      },
      {
        id: "stale",
        attrs: { freshness_class: "stale" },
        display: { x: 0.9, y: 0.1 },
      },
    ];
    const sigma = makeSigma(nodes);
    const graph = makeGraph(nodes);
    cameraPresets["recent-activity"](sigma, graph);
    const state = lastAnimateState(sigma);
    expect(state.x).toBeCloseTo(0.3, 3);
    expect(state.y).toBeCloseTo(0.6, 3);
  });

  it("falls back to default when no 'current' freshness nodes exist", () => {
    const restore = suppressWarn();
    const nodes: NodeSpec[] = [
      { id: "old", attrs: { freshness_class: "outdated" }, display: { x: 0, y: 0 } },
    ];
    const sigma = makeSigma(nodes);
    const graph = makeGraph(nodes);
    cameraPresets["recent-activity"](sigma, graph);
    expect(lastAnimateState(sigma)).toEqual(DEFAULT_STATE);
    restore();
  });
});

// ---------------------------------------------------------------------------
// preset: low-confidence-review
// ---------------------------------------------------------------------------

describe('cameraPresets["low-confidence-review"]', () => {
  it("frames nodes with classification_confidence < 0.7", () => {
    const nodes: NodeSpec[] = [
      {
        id: "low",
        attrs: { classification_confidence: 0.45 },
        display: { x: 0.1, y: 0.9 },
      },
      {
        id: "high",
        attrs: { classification_confidence: 0.95 },
        display: { x: 0.9, y: 0.1 },
      },
    ];
    const sigma = makeSigma(nodes);
    const graph = makeGraph(nodes);
    cameraPresets["low-confidence-review"](sigma, graph);
    const state = lastAnimateState(sigma);
    expect(state.x).toBeCloseTo(0.1, 3);
    expect(state.y).toBeCloseTo(0.9, 3);
  });

  it("includes node at exactly the boundary (0.699... < 0.7)", () => {
    const nodes: NodeSpec[] = [
      {
        id: "boundary",
        attrs: { classification_confidence: 0.699 },
        display: { x: 0.5, y: 0.5 },
      },
    ];
    const sigma = makeSigma(nodes);
    const graph = makeGraph(nodes);
    cameraPresets["low-confidence-review"](sigma, graph);
    const state = lastAnimateState(sigma);
    // Single matching node — centred on it.
    expect(state.x).toBeCloseTo(0.5, 3);
  });

  it("excludes node at exactly 0.7 (not < 0.7)", () => {
    const restore = suppressWarn();
    const nodes: NodeSpec[] = [
      {
        id: "exact",
        attrs: { classification_confidence: 0.7 },
        display: { x: 0.5, y: 0.5 },
      },
    ];
    const sigma = makeSigma(nodes);
    const graph = makeGraph(nodes);
    cameraPresets["low-confidence-review"](sigma, graph);
    expect(lastAnimateState(sigma)).toEqual(DEFAULT_STATE);
    restore();
  });

  it("falls back to default when no low-confidence nodes exist", () => {
    const restore = suppressWarn();
    const nodes: NodeSpec[] = [
      { id: "certain", attrs: { classification_confidence: 0.98 }, display: { x: 0, y: 0 } },
    ];
    const sigma = makeSigma(nodes);
    const graph = makeGraph(nodes);
    cameraPresets["low-confidence-review"](sigma, graph);
    expect(lastAnimateState(sigma)).toEqual(DEFAULT_STATE);
    restore();
  });

  it("ignores nodes whose classification_confidence is not a number", () => {
    const restore = suppressWarn();
    const nodes: NodeSpec[] = [
      { id: "null-conf", attrs: { classification_confidence: null }, display: { x: 0, y: 0 } },
      { id: "str-conf", attrs: { classification_confidence: "low" }, display: { x: 0, y: 0 } },
    ];
    const sigma = makeSigma(nodes);
    const graph = makeGraph(nodes);
    cameraPresets["low-confidence-review"](sigma, graph);
    expect(lastAnimateState(sigma)).toEqual(DEFAULT_STATE);
    restore();
  });
});

// ---------------------------------------------------------------------------
// preset: research-threads
// ---------------------------------------------------------------------------

describe('cameraPresets["research-threads"]', () => {
  it("frames nodes with workspace === 'research'", () => {
    const nodes: NodeSpec[] = [
      {
        id: "r1",
        attrs: { workspace: "research" },
        display: { x: 0.2, y: 0.3 },
      },
      {
        id: "r2",
        attrs: { workspace: "research" },
        display: { x: 0.4, y: 0.5 },
      },
      {
        id: "other",
        attrs: { workspace: "library" },
        display: { x: 0.9, y: 0.9 },
      },
    ];
    const sigma = makeSigma(nodes);
    const graph = makeGraph(nodes);
    cameraPresets["research-threads"](sigma, graph);
    const state = lastAnimateState(sigma);
    // Centre of r1 and r2: x=(0.2+0.4)/2=0.3, y=(0.3+0.5)/2=0.4
    expect(state.x).toBeCloseTo(0.3, 3);
    expect(state.y).toBeCloseTo(0.4, 3);
  });

  it("falls back to default when no research-workspace nodes exist", () => {
    const restore = suppressWarn();
    const nodes: NodeSpec[] = [
      { id: "lib", attrs: { workspace: "library" }, display: { x: 0, y: 0 } },
    ];
    const sigma = makeSigma(nodes);
    const graph = makeGraph(nodes);
    cameraPresets["research-threads"](sigma, graph);
    expect(lastAnimateState(sigma)).toEqual(DEFAULT_STATE);
    restore();
  });
});

// ---------------------------------------------------------------------------
// Duration invariant — all presets must use 400 ms
// ---------------------------------------------------------------------------

describe("animate duration invariant", () => {
  const DURATION = 400;

  const presetWithNoContext: Array<[string, Partial<PresetContext>?]> = [
    ["default", undefined],
    ["high-fidelity-core", undefined],
    ["recent-activity", undefined],
    ["low-confidence-review", undefined],
    ["research-threads", undefined],
  ];

  it.each(presetWithNoContext)(
    'preset "%s" uses %d ms duration (fallback path)',
    (name) => {
      const restore = suppressWarn();
      const sigma = makeSigma();
      const graph = makeGraph([]);
      cameraPresets[name as keyof typeof cameraPresets](sigma, graph);
      expect(lastAnimateOpts(sigma).duration).toBe(DURATION);
      restore();
    },
  );

  it('preset "focus-node" uses 400 ms when node is found', () => {
    const nodes: NodeSpec[] = [{ id: "n", display: { x: 0.5, y: 0.5 } }];
    const sigma = makeSigma(nodes);
    const graph = makeGraph(nodes);
    cameraPresets["focus-node"](sigma, graph, { nodeId: "n" });
    expect(lastAnimateOpts(sigma).duration).toBe(DURATION);
  });

  it('preset "fit-selection" uses 400 ms when nodes are found', () => {
    const nodes: NodeSpec[] = [{ id: "n", display: { x: 0.5, y: 0.5 } }];
    const sigma = makeSigma(nodes);
    const graph = makeGraph(nodes);
    cameraPresets["fit-selection"](sigma, graph, { nodeIds: ["n"] });
    expect(lastAnimateOpts(sigma).duration).toBe(DURATION);
  });
});

// ---------------------------------------------------------------------------
// Preset map completeness — all 7 names must be present
// ---------------------------------------------------------------------------

describe("cameraPresets map", () => {
  const EXPECTED_NAMES: Array<keyof typeof cameraPresets> = [
    "default",
    "focus-node",
    "fit-selection",
    "high-fidelity-core",
    "recent-activity",
    "low-confidence-review",
    "research-threads",
  ];

  it("exports all 7 named presets", () => {
    expect(Object.keys(cameraPresets)).toHaveLength(7);
  });

  it.each(EXPECTED_NAMES)('contains preset "%s"', (name) => {
    expect(typeof cameraPresets[name]).toBe("function");
  });
});
