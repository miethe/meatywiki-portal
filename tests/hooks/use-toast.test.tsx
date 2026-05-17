/**
 * useToast hook unit tests.
 *
 * Covers:
 * 1. ToastProvider initialises with an empty queue.
 * 2. add() enqueues a toast with the correct id, message, type.
 * 3. remove() removes a toast by id (idempotent on double-remove).
 * 4. Multiple toasts stack without clobbering each other.
 * 5. useToast() throws when called outside a <ToastProvider>.
 * 6. Auto-dismiss fires after the correct default duration (jest timers).
 *
 * Portal Global Toast Consolidation — F-13 full resolution.
 */

import React from "react";
import { renderHook, act } from "@testing-library/react";
// Note: React 19 strict act() enforcement — timer callbacks that update state
// must be wrapped in act(). jest.runOnlyPendingTimers() in afterEach is called
// inside act() to suppress spurious "not wrapped in act()" warnings when timers
// fire during cleanup.
import { ToastProvider, useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useToast", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Wrap in act() so any pending state updates from timer callbacks are
    // flushed cleanly without React 19 "not wrapped in act()" warnings.
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  // Test 1: initial state
  it("starts with an empty toast queue", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    expect(result.current.toasts).toHaveLength(0);
  });

  // Test 2: add() enqueues a toast
  it("add() enqueues a toast with correct fields", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.add({ message: "Hello!", type: "success" });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe("Hello!");
    expect(result.current.toasts[0].type).toBe("success");
    expect(result.current.toasts[0].id).toMatch(/^toast-/);
  });

  // Test 3: remove() removes by id, idempotent on double call
  it("remove() removes a toast by id", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.add({ message: "Bye!", type: "info" });
    });

    const id = result.current.toasts[0].id;

    act(() => {
      result.current.remove(id);
    });

    expect(result.current.toasts).toHaveLength(0);

    // Idempotent: second remove should not throw
    expect(() => {
      act(() => {
        result.current.remove(id);
      });
    }).not.toThrow();
  });

  // Test 4: multiple toasts stack without clobbering
  it("multiple toasts coexist in the queue", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.add({ message: "A", type: "success" });
      result.current.add({ message: "B", type: "error" });
      result.current.add({ message: "C", type: "warning" });
    });

    expect(result.current.toasts).toHaveLength(3);
    expect(result.current.toasts.map((t) => t.message)).toEqual(["A", "B", "C"]);
  });

  // Test 5: useToast() throws outside provider
  it("throws when called outside a <ToastProvider>", () => {
    // Suppress the React error boundary console.error for this test
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useToast());
    }).toThrow("useToast() must be called inside a <ToastProvider>");

    consoleSpy.mockRestore();
  });

  // Test 6: auto-dismiss fires after type-default duration
  it("auto-dismisses a success toast after 5000ms", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.add({ message: "Done!", type: "success" });
    });

    expect(result.current.toasts).toHaveLength(1);

    // Advance time just under 5s — toast still present
    act(() => {
      jest.advanceTimersByTime(4_999);
    });
    expect(result.current.toasts).toHaveLength(1);

    // Advance past 5s — toast dismissed
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  // Test 7: auto-dismiss for error uses 10s
  it("auto-dismisses an error toast after 10000ms", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.add({ message: "Oops!", type: "error" });
    });

    // After 9.999s still visible
    act(() => {
      jest.advanceTimersByTime(9_999);
    });
    expect(result.current.toasts).toHaveLength(1);

    // After 10s dismissed
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  // Test 8: custom duration overrides type default
  it("respects custom duration override", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.add({ message: "Custom!", type: "success", duration: 15_000 });
    });

    // 5s would have dismissed it under type default — but custom is 15s
    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  // Test 9: manual remove clears the auto-dismiss timer (no error after timer fires on already-removed toast)
  it("manual remove before auto-dismiss does not cause errors when timer fires", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.add({ message: "Early remove!", type: "success" });
    });

    const id = result.current.toasts[0].id;

    act(() => {
      result.current.remove(id);
    });

    expect(result.current.toasts).toHaveLength(0);

    // Fire the auto-dismiss timer — should not throw or re-add the toast
    expect(() => {
      act(() => {
        jest.advanceTimersByTime(5_000);
      });
    }).not.toThrow();

    expect(result.current.toasts).toHaveLength(0);
  });
});
