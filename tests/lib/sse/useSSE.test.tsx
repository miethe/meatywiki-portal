/**
 * Unit tests for src/hooks/useSSE.ts
 *
 * Tests:
 * - Hook subscribes on mount, unsubscribes on unmount
 * - Events accumulate in state
 * - Status transitions reflect connection state
 * - reconnect() resets and reconnects
 * - close() closes permanently
 * - enabled=false prevents connection
 * - debounce batches events (100 ms window)
 */

import { renderHook, act } from "@testing-library/react";
import { useSSE } from "@/hooks/useSSE";
import { MockEventSource } from "./eventSourceStub";

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers();
  MockEventSource.install();
});

afterEach(() => {
  MockEventSource.uninstall();
  jest.useRealTimers();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TestEvent = { type: "ping"; value: string };

async function flushAll(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

// ---------------------------------------------------------------------------
// Tests: basic subscribe / unsubscribe
// ---------------------------------------------------------------------------

describe("useSSE — subscribe / unsubscribe", () => {
  it("opens a connection on mount when url is provided", async () => {
    renderHook(() =>
      useSSE<TestEvent>({ url: "/api/workflows/run-1/stream", debounceMs: 0 }),
    );
    await flushAll();

    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("starts with idle status before url is set", () => {
    const { result } = renderHook(() =>
      useSSE<TestEvent>({ url: undefined, debounceMs: 0 }),
    );

    expect(result.current.status).toBe("idle");
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("does not open a connection when enabled=false", async () => {
    renderHook(() =>
      useSSE<TestEvent>({
        url: "/api/workflows/run-1/stream",
        enabled: false,
        debounceMs: 0,
      }),
    );
    await flushAll();

    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("closes the EventSource on unmount", async () => {
    const { unmount } = renderHook(() =>
      useSSE<TestEvent>({ url: "/api/workflows/run-1/stream", debounceMs: 0 }),
    );
    await flushAll();

    const stub = MockEventSource.latest;
    expect(stub.isClosed).toBe(false);

    unmount();

    expect(stub.isClosed).toBe(true);
  });

  it("does not reconnect after unmount", async () => {
    const { unmount } = renderHook(() =>
      useSSE<TestEvent>({
        url: "/api/workflows/run-1/stream",
        debounceMs: 0,
        backoff: { baseMs: 10, maxMs: 100, maxRetries: 5, factor: 2 },
      }),
    );
    await flushAll();

    unmount();

    // Trigger error AFTER unmount — should not cause reconnect
    // (EventSource was already closed so onerror is null)
    jest.advanceTimersByTime(500);
    await flushAll();

    expect(MockEventSource.instances).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: event accumulation
// ---------------------------------------------------------------------------

describe("useSSE — event accumulation", () => {
  it("accumulates received events in state", async () => {
    const { result } = renderHook(() =>
      useSSE<TestEvent>({ url: "/api/workflows/run-1/stream", debounceMs: 0 }),
    );
    await flushAll();

    act(() => {
      MockEventSource.latest.emit(JSON.stringify({ type: "ping", value: "a" }));
      MockEventSource.latest.emit(JSON.stringify({ type: "ping", value: "b" }));
    });
    // debounceMs=0 uses setTimeout(fn, 0) — advance fake timers to flush it
    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    expect(result.current.events).toHaveLength(2);
    expect(result.current.events[0]).toEqual({ type: "ping", value: "a" });
    expect(result.current.events[1]).toEqual({ type: "ping", value: "b" });
  });

  it("batches rapid events within the debounce window", async () => {
    const { result } = renderHook(() =>
      useSSE<TestEvent>({ url: "/api/workflows/run-1/stream", debounceMs: 100 }),
    );
    await flushAll();

    act(() => {
      MockEventSource.latest.emit(JSON.stringify({ type: "ping", value: "x1" }));
      MockEventSource.latest.emit(JSON.stringify({ type: "ping", value: "x2" }));
      MockEventSource.latest.emit(JSON.stringify({ type: "ping", value: "x3" }));
    });

    // Before debounce fires, state should still be empty
    expect(result.current.events).toHaveLength(0);

    // Advance past debounce window
    act(() => {
      jest.advanceTimersByTime(110);
    });

    // All 3 events should be in state now (single batch)
    expect(result.current.events).toHaveLength(3);
  });

  it("reports error state on parse failure", async () => {
    const { result } = renderHook(() =>
      useSSE<TestEvent>({ url: "/api/workflows/run-1/stream", debounceMs: 0 }),
    );
    await flushAll();

    act(() => {
      MockEventSource.latest.emit("this-is-not-json");
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.type).toBe("parse_error");
  });
});

// ---------------------------------------------------------------------------
// Tests: status transitions
// ---------------------------------------------------------------------------

describe("useSSE — status transitions", () => {
  it("transitions from 'connecting' to 'open'", async () => {
    const { result } = renderHook(() =>
      useSSE<TestEvent>({ url: "/api/workflows/run-1/stream", debounceMs: 0 }),
    );

    // Before microtasks flush, status should be 'connecting'
    expect(result.current.status).toBe("connecting");

    await flushAll();

    expect(result.current.status).toBe("open");
  });

  it("transitions to 'closed' after close()", async () => {
    const { result } = renderHook(() =>
      useSSE<TestEvent>({ url: "/api/workflows/run-1/stream", debounceMs: 0 }),
    );
    await flushAll();

    act(() => {
      result.current.close();
    });

    expect(result.current.status).toBe("closed");
  });
});

// ---------------------------------------------------------------------------
// Tests: reconnect()
// ---------------------------------------------------------------------------

describe("useSSE — reconnect()", () => {
  it("creates a new connection and clears event history on reconnect()", async () => {
    const { result } = renderHook(() =>
      useSSE<TestEvent>({ url: "/api/workflows/run-1/stream", debounceMs: 0 }),
    );
    await flushAll();

    // Accumulate some events — debounceMs=0 still uses setTimeout(fn, 0),
    // so advance fake timers to flush the debounce after emitting.
    act(() => {
      MockEventSource.latest.emit(JSON.stringify({ type: "ping", value: "old" }));
    });
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(result.current.events).toHaveLength(1);

    // Reconnect
    act(() => {
      result.current.reconnect();
      jest.runAllTimers();
    });
    await flushAll();

    // Event history cleared
    expect(result.current.events).toHaveLength(0);
    // A new connection was opened
    expect(MockEventSource.instances).toHaveLength(2);
  });
});
