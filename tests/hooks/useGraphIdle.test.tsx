/**
 * useGraphIdle hook tests.
 *
 * Covers:
 *   - Wall-clock idle (3000ms default): pauses FA2 and calls sigma.refresh()
 *   - Custom idleMs option
 *   - No pause when layout is not running at idle time
 *   - mousedown on sigma container resumes FA2 and resets idle timer
 *   - touchstart on sigma container resumes FA2 and resets idle timer
 *   - Camera "updated" event resumes FA2 and resets idle timer
 *   - Listeners removed and timer cancelled on unmount (no leaks)
 *   - Disabled (enabled: false) — no listeners attached, no pause
 *   - Null sigma — no listeners, no error
 *   - Null fa2 — no listeners, no error
 *
 * Mocking strategy:
 *   Sigma and FA2LayoutSupervisor are mocked with the minimum API surface
 *   needed (getContainer, getCamera, isRunning, start, stop, refresh) so the
 *   tests are not coupled to internal library details.
 *
 * Covers task P2-03 (Portal v2.2 Graph Explorer Phase 2).
 */

import { renderHook, act } from "@testing-library/react";
import { useGraphIdle } from "@/hooks/useGraphIdle";

// ---------------------------------------------------------------------------
// Minimal mock types — mirrors only what the hook actually uses
// ---------------------------------------------------------------------------

type CameraListener = () => void;

interface MockCamera {
  on: jest.Mock;
  off: jest.Mock;
  _emit: (event: string) => void;
}

interface MockSigma {
  getContainer: jest.Mock;
  getCamera: jest.Mock;
  refresh: jest.Mock;
  _container: HTMLDivElement;
  _camera: MockCamera;
}

interface MockFA2 {
  isRunning: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeCamera(): MockCamera {
  const listeners: Map<string, CameraListener[]> = new Map();

  const camera: MockCamera = {
    on: jest.fn((event: string, cb: CameraListener) => {
      const existing = listeners.get(event) ?? [];
      listeners.set(event, [...existing, cb]);
    }),
    off: jest.fn((event: string, cb: CameraListener) => {
      const existing = listeners.get(event) ?? [];
      listeners.set(
        event,
        existing.filter((fn) => fn !== cb),
      );
    }),
    _emit(event: string) {
      const cbs = listeners.get(event) ?? [];
      cbs.forEach((fn) => fn());
    },
  };

  return camera;
}

function makeSigma(): MockSigma {
  const container = document.createElement("div");
  const camera = makeCamera();

  return {
    getContainer: jest.fn(() => container),
    getCamera: jest.fn(() => camera),
    refresh: jest.fn(),
    _container: container,
    _camera: camera,
  };
}

function makeFA2(initiallyRunning = true): MockFA2 {
  let running = initiallyRunning;

  return {
    isRunning: jest.fn(() => running),
    start: jest.fn(() => {
      running = true;
    }),
    stop: jest.fn(() => {
      running = false;
    }),
  };
}

// ---------------------------------------------------------------------------
// Cast helpers — avoid spreading mock objects into the real types
// ---------------------------------------------------------------------------

function asSigma(m: MockSigma): import("sigma").default {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return m as any;
}

function asFA2(m: MockFA2): import("graphology-layout-forceatlas2/worker").default {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return m as any;
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
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useGraphIdle", () => {
  describe("wall-clock idle pause", () => {
    it("pauses FA2 and calls sigma.refresh() after default 3000ms with no interaction", () => {
      const sigma = makeSigma();
      const fa2 = makeFA2(true);

      renderHook(() => useGraphIdle(asSigma(sigma), asFA2(fa2)));

      // Not paused yet
      expect(fa2.stop).not.toHaveBeenCalled();
      expect(sigma.refresh).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(fa2.stop).toHaveBeenCalledTimes(1);
      expect(sigma.refresh).toHaveBeenCalledTimes(1);
    });

    it("respects a custom idleMs option", () => {
      const sigma = makeSigma();
      const fa2 = makeFA2(true);

      renderHook(() => useGraphIdle(asSigma(sigma), asFA2(fa2), { idleMs: 1500 }));

      act(() => {
        jest.advanceTimersByTime(1499);
      });
      expect(fa2.stop).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(fa2.stop).toHaveBeenCalledTimes(1);
      expect(sigma.refresh).toHaveBeenCalledTimes(1);
    });

    it("does not call stop/refresh if FA2 is already stopped when idle fires", () => {
      const sigma = makeSigma();
      const fa2 = makeFA2(false); // not running

      renderHook(() => useGraphIdle(asSigma(sigma), asFA2(fa2)));

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(fa2.stop).not.toHaveBeenCalled();
      expect(sigma.refresh).not.toHaveBeenCalled();
    });
  });

  describe("resume on pointer interaction", () => {
    it("mousedown on the sigma container resumes FA2 and resets idle timer", () => {
      const sigma = makeSigma();
      const fa2 = makeFA2(true);

      renderHook(() => useGraphIdle(asSigma(sigma), asFA2(fa2)));

      // Let the idle fire once to stop FA2
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(fa2.stop).toHaveBeenCalledTimes(1);

      // Simulate mousedown — should resume FA2
      act(() => {
        sigma._container.dispatchEvent(new MouseEvent("mousedown"));
      });

      expect(fa2.start).toHaveBeenCalledTimes(1);

      // Advance less than idleMs — should NOT pause yet
      act(() => {
        jest.advanceTimersByTime(2999);
      });
      expect(fa2.stop).toHaveBeenCalledTimes(1); // still the original one

      // Advance the final ms — should pause again
      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(fa2.stop).toHaveBeenCalledTimes(2);
    });

    it("touchstart on the sigma container resumes FA2", () => {
      const sigma = makeSigma();
      const fa2 = makeFA2(false); // already stopped

      renderHook(() => useGraphIdle(asSigma(sigma), asFA2(fa2)));

      act(() => {
        sigma._container.dispatchEvent(new TouchEvent("touchstart"));
      });

      expect(fa2.start).toHaveBeenCalledTimes(1);
    });

    it("does not call start if FA2 is already running on resume", () => {
      const sigma = makeSigma();
      const fa2 = makeFA2(true); // running

      renderHook(() => useGraphIdle(asSigma(sigma), asFA2(fa2)));

      act(() => {
        sigma._container.dispatchEvent(new MouseEvent("mousedown"));
      });

      // FA2 is already running — start should NOT be called a second time
      expect(fa2.start).not.toHaveBeenCalled();
    });
  });

  describe("resume on camera updated event", () => {
    it("camera 'updated' event resumes FA2 and resets the idle timer", () => {
      const sigma = makeSigma();
      const fa2 = makeFA2(false); // stopped initially

      renderHook(() => useGraphIdle(asSigma(sigma), asFA2(fa2)));

      // Emit camera updated (simulates pan/zoom)
      act(() => {
        sigma._camera._emit("updated");
      });

      expect(fa2.start).toHaveBeenCalledTimes(1);

      // Idle timer reset: advance just under idleMs → no pause
      act(() => {
        jest.advanceTimersByTime(2999);
      });
      expect(fa2.stop).not.toHaveBeenCalled();

      // Full idleMs → pause
      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(fa2.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe("cleanup on unmount", () => {
    it("removes DOM listeners and cancels the idle timer on unmount", () => {
      const sigma = makeSigma();
      const fa2 = makeFA2(true);

      const removeEventListenerSpy = jest.spyOn(sigma._container, "removeEventListener");

      const { unmount } = renderHook(() =>
        useGraphIdle(asSigma(sigma), asFA2(fa2)),
      );

      unmount();

      // DOM listeners should be cleaned up
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "mousedown",
        expect.any(Function),
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "touchstart",
        expect.any(Function),
      );

      // Camera listener should be cleaned up
      expect(sigma._camera.off).toHaveBeenCalledWith(
        "updated",
        expect.any(Function),
      );

      // Idle timer cancelled — advancing time should NOT trigger stop
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(fa2.stop).not.toHaveBeenCalled();
    });
  });

  describe("disabled / null guard", () => {
    it("does nothing when enabled is false", () => {
      const sigma = makeSigma();
      const fa2 = makeFA2(true);

      const addEventListenerSpy = jest.spyOn(sigma._container, "addEventListener");

      renderHook(() =>
        useGraphIdle(asSigma(sigma), asFA2(fa2), { enabled: false }),
      );

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(addEventListenerSpy).not.toHaveBeenCalled();
      expect(fa2.stop).not.toHaveBeenCalled();
      expect(sigma.refresh).not.toHaveBeenCalled();
    });

    it("does nothing when sigma is null", () => {
      const fa2 = makeFA2(true);

      // Should not throw
      expect(() => {
        const { unmount } = renderHook(() => useGraphIdle(null, asFA2(fa2)));
        act(() => {
          jest.advanceTimersByTime(3000);
        });
        unmount();
      }).not.toThrow();

      expect(fa2.stop).not.toHaveBeenCalled();
    });

    it("does nothing when fa2 is null", () => {
      const sigma = makeSigma();
      const addEventListenerSpy = jest.spyOn(sigma._container, "addEventListener");

      // Should not throw
      expect(() => {
        const { unmount } = renderHook(() => useGraphIdle(asSigma(sigma), null));
        act(() => {
          jest.advanceTimersByTime(3000);
        });
        unmount();
      }).not.toThrow();

      expect(addEventListenerSpy).not.toHaveBeenCalled();
    });

    it("does nothing when both sigma and fa2 are undefined", () => {
      expect(() => {
        const { unmount } = renderHook(() =>
          useGraphIdle(undefined, undefined),
        );
        act(() => {
          jest.advanceTimersByTime(3000);
        });
        unmount();
      }).not.toThrow();
    });
  });
});
