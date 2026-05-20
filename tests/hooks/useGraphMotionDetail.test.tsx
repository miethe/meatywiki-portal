/**
 * useGraphMotionDetail hook tests (P2-04).
 *
 * Covers:
 *   - Hook returns isMoving=false and detailLevel="full" at rest
 *   - Moving → isMoving=true and detailLevel="low" when speed exceeds 1.0 units/ms
 *   - labelRenderedSizeThreshold set to large value when moving
 *   - labelRenderedSizeThreshold restored when idle for 220 ms
 *   - isMoving reverts to false after 220 ms of camera stillness
 *   - Idle timer resets on consecutive fast-motion frames (debounce behaviour)
 *   - Cleanup: listener removed and timer cleared on unmount
 *
 * Mocking strategy:
 *   - sigma is mocked at module boundary via jest.mock("@react-sigma/core")
 *   - The mock exposes a minimal Camera with `getState()` and a simple
 *     `on`/`off` event bus so tests control when `beforeRender` fires.
 *   - Fake timers (jest.useFakeTimers) control the 220 ms idle window.
 *
 * Note: the test file is .tsx so React can be imported for renderHook (JSX
 * not actually used, but RTL's renderHook wrapper needs the React import).
 */

import { renderHook, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Sigma mock
// ---------------------------------------------------------------------------

/** Narrow camera state used by the mock. */
interface MockCameraState {
  x: number;
  y: number;
  angle: number;
  ratio: number;
}

/** Minimal Sigma mock with a camera, event bus, and setSetting spy. */
function makeSigmaMock() {
  let cameraState: MockCameraState = { x: 0, y: 0, angle: 0, ratio: 1 };

  const listeners: Record<string, Array<() => void>> = {};

  const camera = {
    getState(): MockCameraState {
      return { ...cameraState };
    },
    setState(next: Partial<MockCameraState>) {
      cameraState = { ...cameraState, ...next };
    },
  };

  const sigma = {
    getCamera: () => camera,
    on(event: string, handler: () => void) {
      listeners[event] ??= [];
      listeners[event].push(handler);
    },
    off(event: string, handler: () => void) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter((h) => h !== handler);
    },
    setSetting: jest.fn(),
    /** Helper: fire all registered handlers for an event. */
    _emit(event: string) {
      for (const h of listeners[event] ?? []) {
        h();
      }
    },
    /** Helper: expose camera state setter for tests. */
    _setCameraState(next: Partial<MockCameraState>) {
      camera.setState(next);
    },
    /** Helper: return current listener count for an event. */
    _listenerCount(event: string) {
      return (listeners[event] ?? []).length;
    },
  };

  return sigma;
}

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockSigma = makeSigmaMock();

// Sigma references WebGL2RenderingContext at import time (not available in
// jsdom). Use a fully standalone mock — do NOT spread requireActual here.
jest.mock("@react-sigma/core", () => ({
  useSigma: () => mockSigma,
}));

import { useGraphMotionDetail } from "@/hooks/useGraphMotionDetail";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers();
  mockSigma.setSetting.mockClear();
  // Reset camera to origin between tests
  mockSigma._setCameraState({ x: 0, y: 0, ratio: 1 });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  mockSigma.setSetting.mockClear();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fire a beforeRender tick with the given camera state.
 *
 * `performance.now()` is called inside the hook; fake timers don't mock it by
 * default, so we nudge time by setting a known dt via jest.setSystemTime and
 * advancing performance.now via Date.now shim. Jest's fake timers (v27+)
 * mock performance.now when `legacyFakeTimers: false` (the default in Jest
 * 29). We advance with `jest.advanceTimersByTime` to move both Date.now and
 * performance.now forward.
 */
function tick(
  sigma: ReturnType<typeof makeSigmaMock>,
  advanceMs: number,
  cameraUpdate?: Partial<{ x: number; y: number; ratio: number }>,
) {
  if (cameraUpdate) {
    sigma._setCameraState(cameraUpdate);
  }
  jest.advanceTimersByTime(advanceMs);
  act(() => {
    sigma._emit("beforeRender");
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useGraphMotionDetail — initial state", () => {
  it("returns isMoving=false and detailLevel='full' on first render", () => {
    const { result } = renderHook(() => useGraphMotionDetail());

    expect(result.current.isMoving).toBe(false);
    expect(result.current.detailLevel).toBe("full");
  });

  it("does not set labelRenderedSizeThreshold before any beforeRender fires", () => {
    renderHook(() => useGraphMotionDetail());
    // First beforeRender tick — no previous snapshot, so no speed computed yet.
    tick(mockSigma, 16);
    // setSetting may have been called on cleanup only if unmounted, but not here.
    expect(mockSigma.setSetting).not.toHaveBeenCalledWith(
      "labelRenderedSizeThreshold",
      1_000_000,
    );
  });
});

describe("useGraphMotionDetail — moving state", () => {
  it("sets isMoving=true when camera speed exceeds 1.0 units/ms", () => {
    const { result } = renderHook(() => useGraphMotionDetail());

    // First tick — establishes baseline snapshot.
    tick(mockSigma, 16);

    // Second tick — move 32 units in 16 ms → speed = 2.0 units/ms (fast).
    tick(mockSigma, 16, { x: 32 });

    expect(result.current.isMoving).toBe(true);
    expect(result.current.detailLevel).toBe("low");
  });

  it("sets labelRenderedSizeThreshold to large value when moving", () => {
    renderHook(() => useGraphMotionDetail());

    tick(mockSigma, 16);
    tick(mockSigma, 16, { x: 32 }); // speed=2.0 units/ms → triggers low detail

    expect(mockSigma.setSetting).toHaveBeenCalledWith(
      "labelRenderedSizeThreshold",
      1_000_000,
    );
  });

  it("does not set isMoving=true when camera speed is below threshold", () => {
    const { result } = renderHook(() => useGraphMotionDetail());

    tick(mockSigma, 100);
    // Move 0.05 units in 100 ms → speed=0.0005 units/ms (slow)
    tick(mockSigma, 100, { x: 0.05 });

    expect(result.current.isMoving).toBe(false);
    expect(result.current.detailLevel).toBe("full");
  });

  it("ratio-weighted delta triggers moving state", () => {
    const { result } = renderHook(() => useGraphMotionDetail());

    tick(mockSigma, 16);
    // ratio changes by 0.2 in 16 ms → weighted speed = (0.2 * 10) / 16 = 0.125
    // Still below threshold with just ratio change at 16 ms...
    // Use a larger ratio shift: 2.0 in 16 ms → weighted = (2.0 * 10)/16 = 1.25 > 1.0
    tick(mockSigma, 16, { ratio: 3.0 }); // started at 1.0, now 3.0 → Δratio=2.0

    expect(result.current.isMoving).toBe(true);
  });
});

describe("useGraphMotionDetail — idle restore after 220 ms", () => {
  it("restores isMoving=false after 220 ms of camera stillness", () => {
    const { result } = renderHook(() => useGraphMotionDetail());

    // Trigger moving state
    tick(mockSigma, 16);
    tick(mockSigma, 16, { x: 32 });

    expect(result.current.isMoving).toBe(true);

    // Let 220 ms elapse with no further camera changes
    act(() => {
      jest.advanceTimersByTime(220);
    });

    expect(result.current.isMoving).toBe(false);
    expect(result.current.detailLevel).toBe("full");
  });

  it("restores labelRenderedSizeThreshold to 6 after idle window", () => {
    renderHook(() => useGraphMotionDetail());

    tick(mockSigma, 16);
    tick(mockSigma, 16, { x: 32 });

    act(() => {
      jest.advanceTimersByTime(220);
    });

    expect(mockSigma.setSetting).toHaveBeenCalledWith(
      "labelRenderedSizeThreshold",
      6,
    );
  });

  it("does NOT restore detail before 220 ms elapses", () => {
    const { result } = renderHook(() => useGraphMotionDetail());

    tick(mockSigma, 16);
    tick(mockSigma, 16, { x: 32 });

    act(() => {
      jest.advanceTimersByTime(219);
    });

    expect(result.current.isMoving).toBe(true);
  });

  it("resets idle timer when additional fast frames arrive (debounce)", () => {
    const { result } = renderHook(() => useGraphMotionDetail());

    // Tick 1 (T=16): baseline snapshot — no prev, no speed computed.
    tick(mockSigma, 16);

    // Tick 2 (T=32): Δx=32 in 16 ms → speed=2.0 → moving=true; idle timer at T+220=252.
    tick(mockSigma, 16, { x: 32 });
    expect(result.current.isMoving).toBe(true);

    // Advance 150 ms (T=182) — idle timer hasn't fired yet.
    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(result.current.isMoving).toBe(true);

    // Tick 3 (T=182+16=198): camera moves fast again to reset the idle timer.
    // Δt from T=32 is 166 ms; need Δx > 166 to exceed threshold of 1.0 units/ms.
    // Use Δx=200 (x: 32→232) → speed=200/166≈1.2 > 1.0 → enterLowDetail again.
    // Idle timer reset to fire at T=198+220=418.
    tick(mockSigma, 16, { x: 232 });
    expect(result.current.isMoving).toBe(true);

    // Advance 150 ms (T=348) — within the new idle window (timer at 418).
    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(result.current.isMoving).toBe(true);

    // Complete the idle window from the last fast frame: need 220 ms total.
    // 150 ms already elapsed since T=198; need 70 more to reach T=418.
    act(() => {
      jest.advanceTimersByTime(70);
    });
    expect(result.current.isMoving).toBe(false);
  });
});

describe("useGraphMotionDetail — cleanup on unmount", () => {
  it("removes the beforeRender listener on unmount", () => {
    const { unmount } = renderHook(() => useGraphMotionDetail());

    expect(mockSigma._listenerCount("beforeRender")).toBe(1);

    unmount();

    expect(mockSigma._listenerCount("beforeRender")).toBe(0);
  });

  it("cancels the pending idle timer on unmount", () => {
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

    const { unmount } = renderHook(() => useGraphMotionDetail());

    // Trigger moving state — starts the idle timer
    tick(mockSigma, 16);
    tick(mockSigma, 16, { x: 32 });

    unmount();

    // clearTimeout must have been called with the active timer id
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });

  it("restores labelRenderedSizeThreshold on unmount", () => {
    const { unmount } = renderHook(() => useGraphMotionDetail());

    // Trigger moving state
    tick(mockSigma, 16);
    tick(mockSigma, 16, { x: 32 });

    mockSigma.setSetting.mockClear();
    unmount();

    expect(mockSigma.setSetting).toHaveBeenCalledWith(
      "labelRenderedSizeThreshold",
      6,
    );
  });
});
