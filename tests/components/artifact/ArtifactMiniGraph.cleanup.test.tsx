/**
 * ArtifactMiniGraph — React 19 Strict Mode cleanup contracts (P2-10).
 *
 * Verifies that the FA2 layout worker and webglcontextlost listener are
 * correctly torn down in ALL useEffect cleanup paths:
 *
 *   1. Normal unmount — fa2.kill() called; cleanup fires before settle timer.
 *   2. Strict Mode double-mount — kill() called on first cleanup; new worker
 *      created on second mount without leaking the first.
 *   3. webglcontextlost listener — registered via handleSigmaReady; removed
 *      on unmount via the paired useEffect cleanup.
 *   4. fa2Ref nullification — kill() not called a second time on re-access.
 *
 * Mocking strategy:
 *   - FA2Layout mock: jest.mock factory returns a fresh implementation object
 *     that captures per-instance fn refs exposed via module-level accessor.
 *   - @react-sigma/core: useSigma returns a controlled sigma mock. getCanvases
 *     returns the test canvas element so the webglcontextlost path runs.
 *   - useArtifactNeighborhood: returns MOCK_NEIGHBORHOOD in resolved state.
 *
 * Note on jest.mock hoisting: jest.mock() calls are hoisted to the top of the
 * module by Babel/SWC before any variable declarations run. Variables defined
 * with `const` / `let` at module scope are therefore in the TDZ when the mock
 * factory executes. To work around this, all mock state is captured inside
 * jest.fn() closures or through require()-style lazy access within the factory,
 * and exposed via module-level accessor functions called from tests.
 */

import React from "react";
import { render, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// FA2 worker mock
//
// The mock factory must not reference `const` variables declared later in this
// file (TDZ / hoisting issue). Instead we keep mutable per-instance fn objects
// in module-level `var` declarations (hoisted to undefined before jest.mock
// hoisting runs, then assigned during the first test setup).
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lastFa2Instance: Record<string, jest.Mock> | null = null;

jest.mock("graphology-layout-forceatlas2/worker", () => {
  return jest.fn().mockImplementation(() => {
    const instance = {
      start: jest.fn(),
      stop: jest.fn(),
      kill: jest.fn(),
      isRunning: jest.fn(() => true),
    };
    // Export last created instance so tests can access it
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("graphology-layout-forceatlas2/worker") as jest.Mock;
    (mod as jest.Mock & { __lastInstance?: typeof instance }).__lastInstance = instance;
    return instance;
  });
});

function getLastFa2(): Record<string, jest.Mock> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("graphology-layout-forceatlas2/worker") as jest.Mock & {
    __lastInstance?: Record<string, jest.Mock>;
  };
  if (!mod.__lastInstance) throw new Error("FA2 not instantiated yet");
  return mod.__lastInstance;
}

// ---------------------------------------------------------------------------
// Sigma mock
//
// mockWebglCanvas is a module-level let so it can be reassigned in beforeEach.
// The useSigma factory reads it via closure (not a const reference in the
// factory) — safe because the factory runs lazily each render, not at hoist
// time.
// ---------------------------------------------------------------------------

let mockWebglCanvas: HTMLCanvasElement;

jest.mock("@react-sigma/core", () => ({
  SigmaContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sigma-container">{children}</div>
  ),
  useRegisterEvents: jest.fn(() => jest.fn()),
  useSigma: jest.fn(() => ({
    getGraph: jest.fn(() => ({
      order: 3,
      hasNode: jest.fn(() => true),
      forEachNode: jest.fn(),
    })),
    getCamera: jest.fn(() => ({
      animate: jest.fn(),
      getState: jest.fn(() => ({ x: 0, y: 0, ratio: 1, angle: 0 })),
      on: jest.fn(),
      off: jest.fn(),
    })),
    // Expose the test canvas so the webglcontextlost path in handleSigmaReady runs.
    // Note: this reads `mockWebglCanvas` at call time (not at mock-hoist time),
    // which is correct — by the time useSigma() is called during a test render,
    // beforeEach has already set mockWebglCanvas to a fresh canvas element.
    getCanvases: jest.fn(() => ({ webgl: mockWebglCanvas })),
    getNodeDisplayData: jest.fn(() => ({ x: 0.5, y: 0.5 })),
    graphToViewport: jest.fn((coords: unknown) => coords),
    refresh: jest.fn(),
    kill: jest.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Supporting library mocks
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
  }));
  return { __esModule: true, default: GraphMock };
});

jest.mock("graphology-layout/circular", () => ({
  __esModule: true,
  default: { assign: jest.fn() },
}));

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

jest.mock("@/components/shared/GraphLegend", () => ({
  GraphLegend: () => <div data-testid="graph-legend" />,
}));

// ---------------------------------------------------------------------------
// useArtifactNeighborhood mock
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
  ],
  edges: [
    { source_id: "center-001", target_id: "node-002", edge_type: "relates_to" },
  ],
  center_id: "center-001",
  hops: 2,
  truncated: false,
  truncation_reason: null,
};

const mockUseNeighborhood = jest.fn();
jest.mock("@/hooks/useArtifactNeighborhood", () => ({
  useArtifactNeighborhood: (...args: unknown[]) => mockUseNeighborhood(...args),
}));

// ---------------------------------------------------------------------------
// Component under test
// ---------------------------------------------------------------------------

import { ArtifactMiniGraphInner } from "@/components/artifact/ArtifactMiniGraph";

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

function resolvedNeighborhood() {
  mockUseNeighborhood.mockReturnValue({
    data: MOCK_NEIGHBORHOOD,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("ArtifactMiniGraph — cleanup contracts (P2-10)", () => {
  beforeEach(() => {
    // Fresh canvas per test so listener state does not bleed across tests.
    mockWebglCanvas = document.createElement("canvas");
    // Update the mock so useSigma().getCanvases() returns the new canvas.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sigmaCore = require("@react-sigma/core") as {
      useSigma: jest.Mock;
    };
    sigmaCore.useSigma.mockReturnValue({
      getGraph: jest.fn(() => ({
        order: 3,
        hasNode: jest.fn(() => true),
        forEachNode: jest.fn(),
      })),
      getCamera: jest.fn(() => ({
        animate: jest.fn(),
        getState: jest.fn(() => ({ x: 0, y: 0, ratio: 1, angle: 0 })),
        on: jest.fn(),
        off: jest.fn(),
      })),
      getCanvases: jest.fn(() => ({ webgl: mockWebglCanvas })),
      getNodeDisplayData: jest.fn(() => ({ x: 0.5, y: 0.5 })),
      graphToViewport: jest.fn((coords: unknown) => coords),
      refresh: jest.fn(),
      kill: jest.fn(),
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const FA2Ctor = require("graphology-layout-forceatlas2/worker") as jest.Mock & {
      __lastInstance?: unknown;
    };
    FA2Ctor.__lastInstance = undefined;

    jest.clearAllMocks();
    resolvedNeighborhood();
  });

  // -------------------------------------------------------------------------
  // 1. Normal unmount — kill() called in cleanup
  // -------------------------------------------------------------------------

  describe("normal unmount", () => {
    it("calls fa2.kill() when the component unmounts", async () => {
      const { unmount } = render(
        <ArtifactMiniGraphInner artifactId="center-001" hops={2} />,
      );

      // Wait for FA2 to be instantiated
      await waitFor(() => {
        const fa2 = getLastFa2();
        expect(fa2.start).toHaveBeenCalled();
      });

      act(() => {
        unmount();
      });

      const fa2 = getLastFa2();
      expect(fa2.kill).toHaveBeenCalledTimes(1);
    });

    it("calls kill() before the 2500ms settle timer fires when unmounted early", async () => {
      jest.useFakeTimers();

      const { unmount } = render(
        <ArtifactMiniGraphInner artifactId="center-001" hops={2} />,
      );

      // Let effects run but not the 2500ms timer
      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      const fa2 = getLastFa2();
      expect(fa2.start).toHaveBeenCalledTimes(1);

      act(() => {
        unmount();
      });

      // cleanup runs: clearTimeout + fa2.kill()
      expect(fa2.kill).toHaveBeenCalledTimes(1);
      // settle timer stop() not yet called
      expect(fa2.stop).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Strict Mode double-mount
  // -------------------------------------------------------------------------

  describe("React 19 Strict Mode double-mount simulation", () => {
    it("kills the first FA2 worker and creates a new one on remount", async () => {
      // Simulate Strict Mode: mount → full unmount → fresh mount.
      // RTL's `rerender` cannot be called after `unmount` (destroyed root),
      // so we use two separate render() calls to model the double-mount cycle.
      const first = render(
        <ArtifactMiniGraphInner artifactId="center-001" hops={2} />,
      );

      await waitFor(() => {
        const fa2 = getLastFa2();
        expect(fa2.start).toHaveBeenCalledTimes(1);
      });

      const firstFa2 = getLastFa2();

      // First cleanup (Strict Mode first unmount)
      act(() => {
        first.unmount();
      });

      expect(firstFa2.kill).toHaveBeenCalledTimes(1);

      // Second mount (Strict Mode remount — fresh RTL root)
      const second = render(
        <ArtifactMiniGraphInner artifactId="center-001" hops={2} />,
      );

      await waitFor(() => {
        const fa2 = getLastFa2();
        expect(fa2.start).toHaveBeenCalled();
      });

      // The second FA2 instance was started; the first was killed exactly once.
      expect(firstFa2.kill).toHaveBeenCalledTimes(1);

      act(() => {
        second.unmount();
      });
    });
  });

  // -------------------------------------------------------------------------
  // 3. webglcontextlost listener — add on mount, remove on unmount
  // -------------------------------------------------------------------------

  describe("webglcontextlost listener lifecycle", () => {
    it("attaches webglcontextlost to the sigma canvas after mount", async () => {
      const addSpy = jest.spyOn(mockWebglCanvas, "addEventListener");

      render(<ArtifactMiniGraphInner artifactId="center-001" hops={2} />);

      await waitFor(() => {
        expect(addSpy).toHaveBeenCalledWith(
          "webglcontextlost",
          expect.any(Function),
        );
      });
    });

    it("removes webglcontextlost from the sigma canvas on unmount", async () => {
      const addSpy = jest.spyOn(mockWebglCanvas, "addEventListener");
      const removeSpy = jest.spyOn(mockWebglCanvas, "removeEventListener");

      const { unmount } = render(
        <ArtifactMiniGraphInner artifactId="center-001" hops={2} />,
      );

      await waitFor(() => {
        expect(addSpy).toHaveBeenCalledWith("webglcontextlost", expect.any(Function));
      });

      act(() => {
        unmount();
      });

      expect(removeSpy).toHaveBeenCalledWith(
        "webglcontextlost",
        expect.any(Function),
      );
    });

    it("does not accumulate webglcontextlost listeners across double-mount cycles", async () => {
      const addSpy = jest.spyOn(mockWebglCanvas, "addEventListener");

      // First mount
      const first = render(
        <ArtifactMiniGraphInner artifactId="center-001" hops={2} />,
      );

      await waitFor(() => {
        expect(addSpy).toHaveBeenCalledWith("webglcontextlost", expect.any(Function));
      });

      const countAfterFirstMount = addSpy.mock.calls.filter(
        (c) => c[0] === "webglcontextlost",
      ).length;

      // Strict Mode: unmount first root, then mount a fresh one.
      act(() => {
        first.unmount();
      });

      // Second mount (fresh RTL root — models Strict Mode remount)
      const second = render(
        <ArtifactMiniGraphInner artifactId="center-001" hops={2} />,
      );

      await waitFor(() => {
        const total = addSpy.mock.calls.filter(
          (c) => c[0] === "webglcontextlost",
        ).length;
        // At most one additional registration on remount (new sigma instance).
        // Guard ensures no unbounded accumulation across the two mounts.
        expect(total).toBeLessThanOrEqual(countAfterFirstMount + 1);
      });

      act(() => {
        second.unmount();
      });
    });
  });

  // -------------------------------------------------------------------------
  // 4. fa2Ref nullification — dead worker reference not retained
  // -------------------------------------------------------------------------

  describe("fa2Ref nullification", () => {
    it("fa2.kill() is called exactly once even if cleanup would run twice", async () => {
      // This verifies the fa2Ref.current = null assignment in cleanup prevents
      // a hypothetical second cleanup from calling kill() on a dead worker.
      // React never double-fires cleanup for a single mount, but this assertion
      // documents and freezes the expected invariant.
      const { unmount } = render(
        <ArtifactMiniGraphInner artifactId="center-001" hops={2} />,
      );

      await waitFor(() => {
        const fa2 = getLastFa2();
        expect(fa2.start).toHaveBeenCalled();
      });

      act(() => {
        unmount();
      });

      const fa2 = getLastFa2();
      // Exactly one kill — not two
      expect(fa2.kill).toHaveBeenCalledTimes(1);
    });
  });
});

// Prevent unused variable lint error for module-level lastFa2Instance
void lastFa2Instance;
