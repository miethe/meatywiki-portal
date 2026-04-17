/**
 * Integration test — SSE resource cleanup on mount/unmount cycles (P4-12).
 *
 * Verifies that EventSource instances subscribed via RunSSEBridge are closed
 * when the host component unmounts, and that repeated mount/unmount cycles do
 * not leak dangling connections.
 *
 * The MockEventSource stub tracks all instances and each's close state, so we
 * can assert post-unmount that every instance has readyState=CLOSED.
 */

import React from "react";
import { act, renderWithProviders } from "../../utils/render";
import { RunSSEBridge } from "@/components/workflow/run-sse-bridge";
import { MockEventSource } from "../../lib/sse/eventSourceStub";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers();
  MockEventSource.install();
});

afterEach(() => {
  jest.clearAllTimers();
  MockEventSource.uninstall();
  jest.useRealTimers();
});

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SSE memory management — RunSSEBridge", () => {
  it("closes the EventSource when RunSSEBridge unmounts", async () => {
    const { unmount } = renderWithProviders(
      <RunSSEBridge
        runId="wf-mem-01"
        applyEvent={() => undefined}
        notifySSEError={() => undefined}
      />,
    );
    await flushMicrotasks();

    expect(MockEventSource.instances).toHaveLength(1);
    const stub = MockEventSource.latest;
    expect(stub.isClosed).toBe(false);

    unmount();

    expect(stub.isClosed).toBe(true);
  });

  it("does not leak across 5 mount/unmount cycles (every EventSource is closed)", async () => {
    for (let i = 0; i < 5; i++) {
      const { unmount } = renderWithProviders(
        <RunSSEBridge
          runId={`wf-mem-cycle-${i}`}
          applyEvent={() => undefined}
          notifySSEError={() => undefined}
        />,
      );
      await flushMicrotasks();
      unmount();
    }

    // 5 instances should have been created, all closed
    expect(MockEventSource.instances).toHaveLength(5);
    for (const instance of MockEventSource.instances) {
      expect(instance.isClosed).toBe(true);
    }
  });

  it("closes EventSource when multiple bridges are mounted and all unmount", async () => {
    const runIds = ["wf-multi-a", "wf-multi-b", "wf-multi-c"];

    const { unmount } = renderWithProviders(
      <>
        {runIds.map((id) => (
          <RunSSEBridge
            key={id}
            runId={id}
            applyEvent={() => undefined}
            notifySSEError={() => undefined}
          />
        ))}
      </>,
    );
    await flushMicrotasks();

    expect(MockEventSource.instances).toHaveLength(3);
    // Verify each bridge opened its own stream URL
    const urls = MockEventSource.instances.map((i) => i.url);
    for (const id of runIds) {
      expect(urls.some((u) => u.includes(id))).toBe(true);
    }

    unmount();

    for (const instance of MockEventSource.instances) {
      expect(instance.isClosed).toBe(true);
    }
  });

  it("rerendering with a new runId tears down the old EventSource", async () => {
    const { rerender } = renderWithProviders(
      <RunSSEBridge
        runId="wf-rerender-1"
        applyEvent={() => undefined}
        notifySSEError={() => undefined}
      />,
    );
    await flushMicrotasks();

    const firstStub = MockEventSource.latest;
    expect(firstStub.isClosed).toBe(false);

    // Swap runId — the hook should close the old connection and open a new one
    rerender(
      <RunSSEBridge
        runId="wf-rerender-2"
        applyEvent={() => undefined}
        notifySSEError={() => undefined}
      />,
    );
    await flushMicrotasks();

    expect(firstStub.isClosed).toBe(true);
    expect(MockEventSource.instances).toHaveLength(2);
    expect(MockEventSource.latest.url).toContain("wf-rerender-2");
    expect(MockEventSource.latest.isClosed).toBe(false);
  });
});
