/**
 * Tests for src/lib/graph/cosmosWrapper.tsx
 *
 * Coverage:
 *  - CosmosGraph.create (constructor) called on mount with the wrapper div
 *  - CosmosGraph.destroy called on unmount
 *  - GPU banner renders by default and dismisses on click
 *  - webglcontextlost handler is registered on the canvas
 *  - contextLost fallback UI renders when context is lost
 *  - onNodeClick callback fires with the correct VaultGraphNode
 *
 * Mocking strategy:
 *  @cosmos.gl/graph is fully mocked. The mock Graph class captures the div
 *  reference and config passed to the constructor, and exposes jest.fn()
 *  stubs for all methods used in cosmosWrapper.tsx.
 *
 *  The mock also simulates cosmos.gl's behavior of inserting a <canvas>
 *  element into the provided div on construction, so the component can
 *  register the webglcontextlost event listener.
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { VaultGraphNode, VaultGraphEdge } from "@/types/graph";

// ---------------------------------------------------------------------------
// @cosmos.gl/graph mock
// ---------------------------------------------------------------------------

/**
 * Tracks all Graph instances created during the test so we can make
 * assertions on individual instances.
 */
const cosmosInstances: MockCosmosGraph[] = [];

interface MockCosmosGraph {
  div: HTMLDivElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: Record<string, any>;
  setPointPositions: jest.Mock;
  setPointColors: jest.Mock;
  setPointSizes: jest.Mock;
  setLinks: jest.Mock;
  setLinkColors: jest.Mock;
  setConfig: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
  pause: jest.Mock;
  unpause: jest.Mock;
  destroy: jest.Mock;
  getPointPositions: jest.Mock;
  /** Simulate a webglcontextlost event on the injected canvas. */
  simulateContextLost: () => void;
}

jest.mock("@cosmos.gl/graph", () => {
  class MockGraph {
    div: HTMLDivElement;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: Record<string, any>;
    setPointPositions = jest.fn();
    setPointColors = jest.fn();
    setPointSizes = jest.fn();
    setLinks = jest.fn();
    setLinkColors = jest.fn();
    setConfig = jest.fn();
    start = jest.fn();
    stop = jest.fn();
    pause = jest.fn();
    unpause = jest.fn();
    destroy = jest.fn();
    getPointPositions = jest.fn().mockReturnValue([]);

    // The canvas that cosmos.gl would inject into the div
    private _canvas: HTMLCanvasElement;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(div: HTMLDivElement, config: Record<string, any>) {
      this.div = div;
      this.config = config;

      // Simulate cosmos.gl injecting a <canvas> into the div
      this._canvas = document.createElement("canvas");
      this._canvas.setAttribute("data-testid", "cosmos-injected-canvas");
      div.appendChild(this._canvas);

      // Register this instance so tests can inspect it
      (cosmosInstances as MockCosmosGraph[]).push(this as unknown as MockCosmosGraph);
    }

    simulateContextLost() {
      const event = new Event("webglcontextlost", { bubbles: false, cancelable: true });
      this._canvas.dispatchEvent(event);
    }
  }

  return { Graph: MockGraph };
});

// ---------------------------------------------------------------------------
// Import after mock registration
// ---------------------------------------------------------------------------

// Imported after jest.mock() so the component receives the mock
import { CosmosGraphWrapper } from "@/lib/graph/cosmosWrapper";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeNode(id: string, overrides: Partial<VaultGraphNode> = {}): VaultGraphNode {
  return {
    id,
    title: `Node ${id}`,
    artifact_type: "concept",
    workspace: "wiki",
    updated_at: "2026-05-01T00:00:00Z",
    fidelity_level: "F2",
    freshness_class: "current",
    classification_confidence: 0.9,
    ...overrides,
  };
}

function makeEdge(
  sourceId: string,
  targetId: string,
  overrides: Partial<VaultGraphEdge> = {},
): VaultGraphEdge {
  return {
    source_id: sourceId,
    target_id: targetId,
    edge_type: "relates_to",
    confidence: 0.8,
    ...overrides,
  };
}

const NODES: VaultGraphNode[] = [
  makeNode("n1"),
  makeNode("n2", { artifact_type: "entity" }),
  makeNode("n3", { artifact_type: "summary", fidelity_level: "F4" }),
];

const EDGES: VaultGraphEdge[] = [
  makeEdge("n1", "n2"),
  makeEdge("n2", "n3", { edge_type: "derived_from" }),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWrapper(
  overrides: Partial<React.ComponentProps<typeof CosmosGraphWrapper>> = {},
) {
  return render(
    <CosmosGraphWrapper
      nodes={NODES}
      edges={EDGES}
      {...overrides}
    />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CosmosGraphWrapper", () => {
  beforeEach(() => {
    cosmosInstances.length = 0;
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Mount / unmount lifecycle
  // -------------------------------------------------------------------------

  describe("mount lifecycle", () => {
    it("calls cosmos Graph constructor (create) on mount", () => {
      renderWrapper();
      expect(cosmosInstances).toHaveLength(1);
      expect(cosmosInstances[0].div).toBeInstanceOf(HTMLDivElement);
    });

    it("calls setPointPositions, setPointColors, setPointSizes, setLinks after mount", () => {
      renderWrapper();
      const instance = cosmosInstances[0];
      expect(instance.setPointPositions).toHaveBeenCalledTimes(1);
      expect(instance.setPointColors).toHaveBeenCalledTimes(1);
      expect(instance.setPointSizes).toHaveBeenCalledTimes(1);
      expect(instance.setLinks).toHaveBeenCalledTimes(1);
    });

    it("passes Float32Array to setPointPositions with 2 floats per node", () => {
      renderWrapper();
      const [arg] = cosmosInstances[0].setPointPositions.mock.calls[0] as [Float32Array];
      expect(arg).toBeInstanceOf(Float32Array);
      expect(arg.length).toBe(NODES.length * 2);
    });

    it("passes Float32Array to setPointColors with 4 floats per node", () => {
      renderWrapper();
      const [arg] = cosmosInstances[0].setPointColors.mock.calls[0] as [Float32Array];
      expect(arg).toBeInstanceOf(Float32Array);
      expect(arg.length).toBe(NODES.length * 4);
    });

    it("passes Float32Array to setLinks with 2 floats per valid edge pair", () => {
      renderWrapper();
      const [arg] = cosmosInstances[0].setLinks.mock.calls[0] as [Float32Array];
      expect(arg).toBeInstanceOf(Float32Array);
      // Both edges are valid (n1→n2, n2→n3)
      expect(arg.length).toBe(EDGES.length * 2);
    });

    it("calls start() after feeding data", () => {
      renderWrapper();
      expect(cosmosInstances[0].start).toHaveBeenCalledTimes(1);
    });

    it("does not create a cosmos instance when nodes array is empty", () => {
      renderWrapper({ nodes: [] });
      expect(cosmosInstances).toHaveLength(0);
    });
  });

  describe("unmount lifecycle", () => {
    it("calls destroy on unmount", () => {
      const { unmount } = renderWrapper();
      expect(cosmosInstances[0].destroy).not.toHaveBeenCalled();
      unmount();
      expect(cosmosInstances[0].destroy).toHaveBeenCalledTimes(1);
    });

    it("does not call destroy if no instance was created (empty nodes)", () => {
      const { unmount } = renderWrapper({ nodes: [] });
      // No instance — unmount should not throw
      expect(() => unmount()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // GPU banner
  // -------------------------------------------------------------------------

  describe("GPU banner", () => {
    it("renders the GPU-accelerated banner by default", () => {
      renderWrapper();
      expect(
        screen.getByText(/Large vault detected — using GPU-accelerated layout/i),
      ).toBeInTheDocument();
    });

    it("dismisses the banner on dismiss button click", () => {
      renderWrapper();
      const dismiss = screen.getByRole("button", { name: /dismiss gpu renderer notice/i });
      fireEvent.click(dismiss);
      expect(
        screen.queryByText(/Large vault detected — using GPU-accelerated layout/i),
      ).not.toBeInTheDocument();
    });

    it("banner has role=note for assistive technology", () => {
      renderWrapper();
      const banner = screen.getByRole("note", { name: /GPU-accelerated layout active/i });
      expect(banner).toBeInTheDocument();
    });

    it("banner does not render after dismiss — no re-render needed", () => {
      renderWrapper();
      fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
      // Banner is gone; the canvas wrapper div should still be there
      expect(screen.getByTestId("cosmos-graph-wrapper")).toBeInTheDocument();
      expect(
        screen.queryByRole("note", { name: /GPU-accelerated layout active/i }),
      ).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // webglcontextlost handler
  // -------------------------------------------------------------------------

  describe("webglcontextlost handler", () => {
    it("registers a webglcontextlost listener on the cosmos-injected canvas", () => {
      renderWrapper();

      // The cosmos mock injects a canvas into the inner div
      const innerDiv = screen.getByTestId("cosmos-graph-inner");
      const canvas = innerDiv.querySelector("canvas");
      expect(canvas).not.toBeNull();

      // Dispatch the event — the handler should be registered
      act(() => {
        cosmosInstances[0].simulateContextLost();
      });

      // After context loss, the fallback UI should appear
      expect(screen.getByTestId("cosmos-context-lost")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("shows the context-lost fallback UI when WebGL context is lost", () => {
      renderWrapper();
      act(() => {
        cosmosInstances[0].simulateContextLost();
      });
      expect(screen.getByText(/GPU context unavailable/i)).toBeInTheDocument();
      expect(screen.getByText(/WebGL context was lost/i)).toBeInTheDocument();
    });

    it("hides the GPU banner when context is lost", () => {
      renderWrapper();
      // Banner is visible initially
      expect(
        screen.getByText(/Large vault detected — using GPU-accelerated layout/i),
      ).toBeInTheDocument();

      act(() => {
        cosmosInstances[0].simulateContextLost();
      });

      // Banner is gone after context loss (contextLost=true hides it)
      expect(
        screen.queryByText(/Large vault detected — using GPU-accelerated layout/i),
      ).not.toBeInTheDocument();
    });

    it("removes the webglcontextlost listener on unmount", () => {
      const { unmount } = renderWrapper();
      const innerDiv = screen.getByTestId("cosmos-graph-inner");
      const canvas = innerDiv.querySelector("canvas") as HTMLCanvasElement;

      const removeEventListenerSpy = jest.spyOn(canvas, "removeEventListener");
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "webglcontextlost",
        expect.any(Function),
      );
    });
  });

  // -------------------------------------------------------------------------
  // onNodeClick callback
  // -------------------------------------------------------------------------

  describe("onNodeClick callback", () => {
    it("calls onNodeClick with the correct VaultGraphNode when a point is clicked", () => {
      const onNodeClick = jest.fn();
      renderWrapper({ onNodeClick });

      const instance = cosmosInstances[0];
      // The config.onPointClick should be wired — simulate it
      const onPointClick = instance.config.onPointClick as (
        index: number,
        pos: [number, number],
        event: MouseEvent,
      ) => void;

      expect(onPointClick).toBeDefined();

      // Click node index 1 (n2)
      const fakeEvent = new MouseEvent("click");
      onPointClick(1, [100, 200], fakeEvent);

      expect(onNodeClick).toHaveBeenCalledTimes(1);
      expect(onNodeClick).toHaveBeenCalledWith(NODES[1]);
    });

    it("does not call onNodeClick if index is undefined", () => {
      const onNodeClick = jest.fn();
      renderWrapper({ onNodeClick });

      const instance = cosmosInstances[0];
      const onPointClick = instance.config.onPointClick as (
        index: number | undefined,
        pos: [number, number] | undefined,
        event: MouseEvent,
      ) => void;

      const fakeEvent = new MouseEvent("click");
      onPointClick(undefined, undefined, fakeEvent);

      expect(onNodeClick).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // onCameraMove callback
  // -------------------------------------------------------------------------

  describe("onCameraMove callback", () => {
    it("calls onCameraMove when zoom event fires", () => {
      const onCameraMove = jest.fn();
      renderWrapper({ onCameraMove });

      const instance = cosmosInstances[0];
      const onZoom = instance.config.onZoom as (event: unknown, userDriven: boolean) => void;

      expect(onZoom).toBeDefined();
      onZoom({ transform: { k: 1.5 } }, true);
      expect(onCameraMove).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Accessibility
  // -------------------------------------------------------------------------

  describe("accessibility", () => {
    it("inner div has role=img with a descriptive aria-label", () => {
      renderWrapper();
      const img = screen.getByRole("img");
      expect(img).toHaveAttribute(
        "aria-label",
        expect.stringContaining(`${NODES.length.toLocaleString()} nodes`),
      );
    });
  });
});
