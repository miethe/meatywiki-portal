/**
 * Unit tests for src/lib/sse/client.ts
 *
 * Uses MockEventSource stub — no real network calls.
 * Jest fake timers control backoff delays.
 */

import { createSSEConnection } from "@/lib/sse/client";
import type { SSEClientError } from "@/lib/sse/client";
import type { SSEStatus } from "@/lib/sse/types";
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
// Helper
// ---------------------------------------------------------------------------

type TestEvent = { type: "ping"; id: string };

async function flushMicrotasks(): Promise<void> {
  // Flushes the microtask queue (e.g., the Promise.resolve().then() in MockEventSource)
  await Promise.resolve();
}

// ---------------------------------------------------------------------------
// Tests: basic connection lifecycle
// ---------------------------------------------------------------------------

describe("createSSEConnection — basic lifecycle", () => {
  it("opens an EventSource and calls onOpen", async () => {
    const onOpen = jest.fn();
    const onEvent = jest.fn();

    createSSEConnection<TestEvent>({
      url: "/api/workflows/run-1/stream",
      onOpen,
      onEvent,
    });

    // Allow the deferred _open() in MockEventSource to run
    await flushMicrotasks();

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.latest.url).toBe("/api/workflows/run-1/stream");
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("reports 'connecting' → 'open' status transitions", async () => {
    const statuses: SSEStatus[] = [];
    createSSEConnection<TestEvent>({
      url: "/api/workflows/run-1/stream",
      onEvent: jest.fn(),
      onStatusChange: (s) => statuses.push(s),
    });

    // Before open event
    expect(statuses).toContain("connecting");

    await flushMicrotasks();
    expect(statuses).toContain("open");
  });

  it("delivers parsed events to onEvent", async () => {
    const received: TestEvent[] = [];
    createSSEConnection<TestEvent>({
      url: "/api/workflows/run-1/stream",
      onEvent: (e) => received.push(e),
    });
    await flushMicrotasks();

    MockEventSource.latest.emit(JSON.stringify({ type: "ping", id: "e1" }), "1");

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ type: "ping", id: "e1" });
  });

  it("calls onError with parse_error on malformed data", async () => {
    const errors: SSEClientError[] = [];
    createSSEConnection<TestEvent>({
      url: "/api/workflows/run-1/stream",
      onEvent: jest.fn(),
      onError: (e) => errors.push(e),
    });
    await flushMicrotasks();

    MockEventSource.latest.emit("not-json");

    expect(errors).toHaveLength(1);
    expect(errors[0]?.type).toBe("parse_error");
  });

  it("close() tears down the EventSource", async () => {
    const conn = createSSEConnection<TestEvent>({
      url: "/api/workflows/run-1/stream",
      onEvent: jest.fn(),
    });
    await flushMicrotasks();

    const stub = MockEventSource.latest;
    expect(stub.isClosed).toBe(false);

    conn.close();

    expect(stub.isClosed).toBe(true);
    expect(conn.status).toBe("closed");
  });
});

// ---------------------------------------------------------------------------
// Tests: reconnect with exponential backoff
// ---------------------------------------------------------------------------

describe("createSSEConnection — reconnect + backoff", () => {
  it("reconnects after an error with backoff delay", async () => {
    const onError = jest.fn();
    createSSEConnection<TestEvent>({
      url: "/api/workflows/run-1/stream",
      onEvent: jest.fn(),
      onError,
      backoff: { baseMs: 100, maxMs: 30_000, maxRetries: 3, factor: 2 },
    });
    await flushMicrotasks();

    expect(MockEventSource.instances).toHaveLength(1);

    // Trigger a connection error (readyState=CLOSED → scheduleReconnect)
    MockEventSource.latest.triggerError(true);

    // Advance timer past first backoff window (100 ms)
    jest.advanceTimersByTime(150);
    await flushMicrotasks();

    // A second EventSource should have been created
    expect(MockEventSource.instances).toHaveLength(2);
    expect(onError).not.toHaveBeenCalled(); // not failed yet — just reconnecting
  });

  it("backoff delay grows exponentially with each retry", async () => {
    createSSEConnection<TestEvent>({
      url: "/api/workflows/run-1/stream",
      onEvent: jest.fn(),
      onError: jest.fn(),
      backoff: { baseMs: 100, maxMs: 30_000, maxRetries: 5, factor: 2 },
    });
    await flushMicrotasks();

    // First error → retryCount=0 → delay = 100 * 2^0 = 100 ms; retryCount becomes 1
    MockEventSource.latest.triggerError(true);
    // Advance 100 ms — the timer fires connect() synchronously, creating instance #2.
    // Do NOT await flushMicrotasks() yet: MockEventSource defers _open() via
    // Promise.resolve().then(), so onopen hasn't fired and retryCount is still 1.
    jest.advanceTimersByTime(100);
    expect(MockEventSource.instances).toHaveLength(2);

    // Trigger second error on instance #2 BEFORE flushing microtasks.
    // This closes the connection before _open() runs, so retryCount stays at 1.
    // Second delay = 100 * 2^1 = 200 ms.
    MockEventSource.latest.triggerError(true);
    await flushMicrotasks(); // _open() is a no-op now (stub is closed)

    // Advance only 150 ms — should NOT have reconnected yet (200 ms delay)
    jest.advanceTimersByTime(150);
    await flushMicrotasks();
    expect(MockEventSource.instances).toHaveLength(2); // still 2

    // Advance remaining 50 ms to complete the 200 ms window
    jest.advanceTimersByTime(50);
    await flushMicrotasks();
    expect(MockEventSource.instances).toHaveLength(3);
  });

  it("emits max_retries error after exceeding retry limit", async () => {
    const errors: SSEClientError[] = [];
    createSSEConnection<TestEvent>({
      url: "/api/workflows/run-1/stream",
      onEvent: jest.fn(),
      onError: (e) => errors.push(e),
      backoff: { baseMs: 10, maxMs: 100, maxRetries: 2, factor: 2 },
    });
    await flushMicrotasks();

    // Exhaust retries by triggering errors without letting connections successfully
    // open (which would reset retryCount). With maxRetries=2 we need 3 failures:
    //   failure 0: retryCount=0 → delay=10ms, retryCount→1
    //   failure 1: retryCount=1 → delay=20ms, retryCount→2
    //   failure 2: retryCount=2 >= maxRetries → emit max_retries, no reconnect
    for (let i = 0; i < 3; i++) {
      MockEventSource.latest.triggerError(true);
      // Advance timers to fire the scheduled reconnect (if any)
      jest.advanceTimersByTime(200);
      // Do NOT flush microtasks here — prevents onopen from resetting retryCount
    }
    // Flush microtasks once at the end to settle any remaining promises
    await flushMicrotasks();

    const maxRetriesError = errors.find((e) => e.type === "max_retries");
    expect(maxRetriesError).toBeDefined();
  });

  it("resets retry count on successful reconnect", async () => {
    const onError = jest.fn();
    createSSEConnection<TestEvent>({
      url: "/api/workflows/run-1/stream",
      onEvent: jest.fn(),
      onError,
      backoff: { baseMs: 100, maxMs: 30_000, maxRetries: 5, factor: 2 },
    });
    await flushMicrotasks();

    // Error → reconnect → success → error again should reset to base delay
    MockEventSource.latest.triggerError(true);
    jest.advanceTimersByTime(100);
    await flushMicrotasks();
    // Second instance opens successfully
    await flushMicrotasks(); // let onopen fire

    // Now trigger error on the second instance
    MockEventSource.latest.triggerError(true);
    // Should reconnect after base delay (100 ms), not exponential (200 ms)
    jest.advanceTimersByTime(100);
    await flushMicrotasks();

    // Third instance created
    expect(MockEventSource.instances).toHaveLength(3);
    expect(onError).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: Last-Event-ID replay on reconnect
// ---------------------------------------------------------------------------

describe("createSSEConnection — Last-Event-ID replay", () => {
  it("appends lastEventId as query param on initial connect when provided", async () => {
    createSSEConnection<TestEvent>({
      url: "/api/workflows/run-1/stream",
      lastEventId: "evt-42",
      onEvent: jest.fn(),
    });
    await flushMicrotasks();

    expect(MockEventSource.latest.url).toBe(
      "/api/workflows/run-1/stream?lastEventId=evt-42",
    );
  });

  it("does NOT append lastEventId when none provided", async () => {
    createSSEConnection<TestEvent>({
      url: "/api/workflows/run-1/stream",
      onEvent: jest.fn(),
    });
    await flushMicrotasks();

    expect(MockEventSource.latest.url).toBe("/api/workflows/run-1/stream");
  });

  it("sends Last-Event-ID on reconnect after receiving events", async () => {
    createSSEConnection<TestEvent>({
      url: "/api/workflows/run-1/stream",
      onEvent: jest.fn(),
      backoff: { baseMs: 50, maxMs: 30_000, maxRetries: 5, factor: 2 },
    });
    await flushMicrotasks();

    // Emit an event with id "99" — MockEventSource.lastEventId is empty-string
    // so we test via the URL on reconnect (the client tracks lastEventId internally
    // using the es.lastEventId getter exposed by the stub).
    // To properly test this, we need to make MockEventSource.lastEventId return
    // the last id that was passed to emit().
    // The stub sets lastEventId="" by default; but the client reads es.lastEventId
    // after each message.  We simulate this by overriding the getter on the instance.

    const stub = MockEventSource.latest;
    let fakeLastId = "";
    Object.defineProperty(stub, "lastEventId", {
      get: () => fakeLastId,
      configurable: true,
    });

    stub.emit(JSON.stringify({ type: "ping", id: "e99" }), "99");
    fakeLastId = "99"; // simulate browser updating lastEventId

    // Trigger reconnect
    stub.triggerError(true);
    jest.advanceTimersByTime(50);
    await flushMicrotasks();

    // The new connection URL should include the lastEventId
    const newStub = MockEventSource.instances[1];
    expect(newStub?.url).toContain("lastEventId=99");
  });
});

// ---------------------------------------------------------------------------
// Tests: AbortSignal cleanup
// ---------------------------------------------------------------------------

describe("createSSEConnection — AbortSignal cleanup", () => {
  it("closes the EventSource when the signal is aborted", async () => {
    const controller = new AbortController();
    const conn = createSSEConnection<TestEvent>({
      url: "/api/workflows/run-1/stream",
      onEvent: jest.fn(),
      signal: controller.signal,
    });
    await flushMicrotasks();

    const stub = MockEventSource.latest;
    expect(stub.isClosed).toBe(false);

    controller.abort();

    expect(stub.isClosed).toBe(true);
    expect(conn.status).toBe("closed");
  });

  it("emits an 'aborted' error when the signal fires", async () => {
    const controller = new AbortController();
    const errors: SSEClientError[] = [];
    createSSEConnection<TestEvent>({
      url: "/api/workflows/run-1/stream",
      onEvent: jest.fn(),
      onError: (e) => errors.push(e),
      signal: controller.signal,
    });
    await flushMicrotasks();

    controller.abort();

    expect(errors).toHaveLength(1);
    expect(errors[0]?.type).toBe("aborted");
  });

  it("does NOT reconnect after abort", async () => {
    const controller = new AbortController();
    createSSEConnection<TestEvent>({
      url: "/api/workflows/run-1/stream",
      onEvent: jest.fn(),
      signal: controller.signal,
      backoff: { baseMs: 10, maxMs: 100, maxRetries: 5, factor: 2 },
    });
    await flushMicrotasks();

    controller.abort();

    jest.advanceTimersByTime(500);
    await flushMicrotasks();

    // Only the one original EventSource should have been created
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("returns a closed no-op handle if signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(); // abort before connecting

    const conn = createSSEConnection<TestEvent>({
      url: "/api/workflows/run-1/stream",
      onEvent: jest.fn(),
      signal: controller.signal,
    });
    await flushMicrotasks();

    // No EventSource should have been created
    expect(MockEventSource.instances).toHaveLength(0);
    expect(conn.status).toBe("closed");
  });
});

// ---------------------------------------------------------------------------
// Tests: terminal events auto-close
// ---------------------------------------------------------------------------

describe("createSSEConnection — terminal event handling", () => {
  it("auto-closes on workflow_completed event", async () => {
    const conn = createSSEConnection<{ type: string }>({
      url: "/api/workflows/run-1/stream",
      onEvent: jest.fn(),
    });
    await flushMicrotasks();

    const stub = MockEventSource.latest;
    stub.emit(JSON.stringify({ type: "workflow_completed", run_id: "run-1", event_id: "100", timestamp: "2026-01-01T00:00:00Z" }));

    expect(stub.isClosed).toBe(true);
    expect(conn.status).toBe("closed");
  });

  it("auto-closes on workflow_failed event", async () => {
    const conn = createSSEConnection<{ type: string }>({
      url: "/api/workflows/run-1/stream",
      onEvent: jest.fn(),
    });
    await flushMicrotasks();

    const stub = MockEventSource.latest;
    stub.emit(JSON.stringify({ type: "workflow_failed", run_id: "run-1", event_id: "101", timestamp: "2026-01-01T00:00:00Z", error: "something broke" }));

    expect(stub.isClosed).toBe(true);
    expect(conn.status).toBe("closed");
  });
});
