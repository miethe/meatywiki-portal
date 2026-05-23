/**
 * Tests for useTour and useFirstRunOffer hooks.
 *
 * Verifies:
 *   - useTour.isComplete reflects localStorage tour state
 *   - useTour.isRunning reflects TourContext.currentTour
 *   - useTour.start calls context.start with the correct tourId
 *   - useTour.stop calls context.stop
 *   - useTour is safe to call without a TourContext provider (no-op)
 *   - useFirstRunOffer.shouldOffer is true initially (no state, not dismissed)
 *   - useFirstRunOffer.dismiss sets shouldOffer to false
 *   - useFirstRunOffer.shouldOffer is false when the tour is completed
 *   - useFirstRunOffer.accept calls start() and sets shouldOffer to false
 */

import { renderHook, act } from "@testing-library/react";
import React from "react";
import { useTour, useFirstRunOffer } from "@/hooks/use-tour";
import { TourContext } from "@/components/tour/tour-context";
import type { TourContextValue } from "@/components/tour/tour-context";

// ---------------------------------------------------------------------------
// Module-level mock for tour-state so getTourState is configurable.
// ---------------------------------------------------------------------------

jest.mock("@/lib/storage/tour-state", () => ({
  ...jest.requireActual("@/lib/storage/tour-state"),
  getTourState: jest.fn(() => null),
}));

import { getTourState } from "@/lib/storage/tour-state";
const mockGetTourState = getTourState as jest.MockedFunction<typeof getTourState>;

// ---------------------------------------------------------------------------
// In-memory localStorage mock
// ---------------------------------------------------------------------------

const localStorageStore: Map<string, string> = new Map();

const localStorageMock: Storage = {
  getItem: (key) => localStorageStore.get(key) ?? null,
  setItem: (key, value) => {
    localStorageStore.set(key, String(value));
  },
  removeItem: (key) => {
    localStorageStore.delete(key);
  },
  clear: () => localStorageStore.clear(),
  get length() {
    return localStorageStore.size;
  },
  key: (index) => [...localStorageStore.keys()][index] ?? null,
};

beforeAll(() => {
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    writable: true,
  });
});

beforeEach(() => {
  localStorageStore.clear();
  mockGetTourState.mockReturnValue(null);
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTourCtx(overrides?: Partial<TourContextValue>): TourContextValue {
  return {
    currentTour: null,
    start: jest.fn(),
    stop: jest.fn(),
    ...overrides,
  };
}

function wrapWithTourContext(ctx: TourContextValue) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(TourContext.Provider, { value: ctx }, children);
  };
}

// ---------------------------------------------------------------------------
// useTour
// ---------------------------------------------------------------------------

describe("useTour", () => {
  it("returns isComplete=false for a tour with no stored state", () => {
    const ctx = makeTourCtx();
    const { result } = renderHook(() => useTour("intro"), {
      wrapper: wrapWithTourContext(ctx),
    });

    expect(result.current.isComplete).toBe(false);
  });

  it("returns isComplete=true when tour state is marked completed in localStorage", () => {
    mockGetTourState.mockReturnValue({
      completed: true,
      lastStepIndex: 3,
      completedAt: "2026-05-23T12:00:00Z",
    });

    const ctx = makeTourCtx();
    const { result } = renderHook(() => useTour("intro"), {
      wrapper: wrapWithTourContext(ctx),
    });

    expect(result.current.isComplete).toBe(true);
  });

  it("calls context.start with the correct tourId when start() is invoked", () => {
    const ctx = makeTourCtx();
    const { result } = renderHook(() => useTour("intro"), {
      wrapper: wrapWithTourContext(ctx),
    });

    act(() => {
      result.current.start();
    });

    expect(ctx.start).toHaveBeenCalledTimes(1);
    expect(ctx.start).toHaveBeenCalledWith("intro");
  });

  it("calls context.stop when stop() is invoked", () => {
    const ctx = makeTourCtx();
    const { result } = renderHook(() => useTour("intro"), {
      wrapper: wrapWithTourContext(ctx),
    });

    act(() => {
      result.current.stop();
    });

    expect(ctx.stop).toHaveBeenCalledTimes(1);
  });

  it("returns isRunning=true when context.currentTour matches tourId", () => {
    const ctx = makeTourCtx({ currentTour: "intro" });
    const { result } = renderHook(() => useTour("intro"), {
      wrapper: wrapWithTourContext(ctx),
    });

    expect(result.current.isRunning).toBe(true);
  });

  it("returns isRunning=false when context.currentTour is a different tour", () => {
    const ctx = makeTourCtx({ currentTour: "other-tour" });
    const { result } = renderHook(() => useTour("intro"), {
      wrapper: wrapWithTourContext(ctx),
    });

    expect(result.current.isRunning).toBe(false);
  });

  it("returns isRunning=false when context.currentTour is null", () => {
    const ctx = makeTourCtx({ currentTour: null });
    const { result } = renderHook(() => useTour("intro"), {
      wrapper: wrapWithTourContext(ctx),
    });

    expect(result.current.isRunning).toBe(false);
  });

  it("is safe to call without a TourContext provider — start/stop are no-ops", () => {
    const { result } = renderHook(() => useTour("intro"));

    expect(() => {
      act(() => {
        result.current.start();
        result.current.stop();
      });
    }).not.toThrow();

    expect(result.current.isRunning).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// useFirstRunOffer
// ---------------------------------------------------------------------------

describe("useFirstRunOffer", () => {
  it("shouldOffer is true initially (tour not complete, not dismissed)", () => {
    const ctx = makeTourCtx();
    const { result } = renderHook(() => useFirstRunOffer("intro"), {
      wrapper: wrapWithTourContext(ctx),
    });

    expect(result.current.shouldOffer).toBe(true);
  });

  it("shouldOffer becomes false after dismiss()", () => {
    const ctx = makeTourCtx();
    const { result } = renderHook(() => useFirstRunOffer("intro"), {
      wrapper: wrapWithTourContext(ctx),
    });

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.shouldOffer).toBe(false);
  });

  it("dismiss() persists the dismissed flag in localStorage", () => {
    const ctx = makeTourCtx();
    const { result } = renderHook(() => useFirstRunOffer("intro"), {
      wrapper: wrapWithTourContext(ctx),
    });

    act(() => {
      result.current.dismiss();
    });

    expect(localStorageMock.getItem("meatywiki:tour:v1:intro:dismissed")).toBe("1");
  });

  it("shouldOffer is false when the tour is already completed", () => {
    mockGetTourState.mockReturnValue({
      completed: true,
      lastStepIndex: 3,
    });

    const ctx = makeTourCtx();
    const { result } = renderHook(() => useFirstRunOffer("intro"), {
      wrapper: wrapWithTourContext(ctx),
    });

    expect(result.current.shouldOffer).toBe(false);
  });

  it("shouldOffer is false when dismissed flag already exists in localStorage", () => {
    localStorageMock.setItem("meatywiki:tour:v1:intro:dismissed", "1");

    const ctx = makeTourCtx();
    const { result } = renderHook(() => useFirstRunOffer("intro"), {
      wrapper: wrapWithTourContext(ctx),
    });

    expect(result.current.shouldOffer).toBe(false);
  });

  it("accept() sets shouldOffer to false and calls context.start with tourId", () => {
    const ctx = makeTourCtx();
    const { result } = renderHook(() => useFirstRunOffer("intro"), {
      wrapper: wrapWithTourContext(ctx),
    });

    act(() => {
      result.current.accept();
    });

    expect(result.current.shouldOffer).toBe(false);
    expect(ctx.start).toHaveBeenCalledWith("intro");
  });

  it("accept() persists the dismissed flag in localStorage", () => {
    const ctx = makeTourCtx();
    const { result } = renderHook(() => useFirstRunOffer("intro"), {
      wrapper: wrapWithTourContext(ctx),
    });

    act(() => {
      result.current.accept();
    });

    expect(localStorageMock.getItem("meatywiki:tour:v1:intro:dismissed")).toBe("1");
  });
});
