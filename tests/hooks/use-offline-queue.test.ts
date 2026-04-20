/**
 * Tests for useOfflineQueue hook.
 *
 * Verifies:
 *   - queuedCount / failedCount reflect IndexedDB state
 *   - Counts react to 'offline-queue-change' custom event
 *   - isOnline tracks window online/offline events
 *   - retryFailed re-enqueues and drains failed items
 *   - Zero counts when PWA flag is off
 */

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { renderHook, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Reset IDB + mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
  process.env.NEXT_PUBLIC_PORTAL_ENABLE_PWA = "1";
  jest.spyOn(console, "info").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_PORTAL_ENABLE_PWA;
});

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { OfflineQueueManager } from "@/lib/pwa/offline-queue";

// ---------------------------------------------------------------------------
// Helper — trigger the queue-change event
// ---------------------------------------------------------------------------

function dispatchQueueChange() {
  window.dispatchEvent(new CustomEvent("offline-queue-change"));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useOfflineQueue", () => {
  it("initialises with zero counts", async () => {
    const { result } = renderHook(() => useOfflineQueue());

    // Wait for async count fetch.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.queuedCount).toBe(0);
    expect(result.current.failedCount).toBe(0);
  });

  it("reflects queued count after enqueue + queue-change event", async () => {
    const { result } = renderHook(() => useOfflineQueue());

    await act(async () => {
      await OfflineQueueManager.enqueue({
        endpoint: "/api/intake/note",
        method: "POST",
        bodyJson: { text: "queued item" },
      });
      dispatchQueueChange();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.queuedCount).toBe(1);
  });

  it("updates queuedCount after multiple enqueues", async () => {
    const { result } = renderHook(() => useOfflineQueue());

    await act(async () => {
      await OfflineQueueManager.enqueue({
        endpoint: "/api/intake/note",
        method: "POST",
        bodyJson: { text: "one" },
      });
      await OfflineQueueManager.enqueue({
        endpoint: "/api/intake/url",
        method: "POST",
        bodyJson: { url: "https://example.com" },
      });
      dispatchQueueChange();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.queuedCount).toBe(2);
  });

  it("tracks isOnline via window online/offline events", async () => {
    // Start online.
    Object.defineProperty(navigator, "onLine", { get: () => true, configurable: true });

    const { result } = renderHook(() => useOfflineQueue());

    expect(result.current.isOnline).toBe(true);

    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current.isOnline).toBe(false);

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current.isOnline).toBe(true);
  });

  it("returns zero counts when PWA flag is off", async () => {
    // Flag is off — hook should not query IndexedDB.
    delete process.env.NEXT_PUBLIC_PORTAL_ENABLE_PWA;

    const { result } = renderHook(() => useOfflineQueue());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.queuedCount).toBe(0);
    expect(result.current.failedCount).toBe(0);
  });

  it("retryFailed re-enqueues failed items and drains", async () => {
    // Fail during initial drain to move item to failed_queue.
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 } as Response);

    await OfflineQueueManager.enqueue({
      endpoint: "/api/intake/note",
      method: "POST",
      bodyJson: { text: "fail then retry" },
    });

    // Exhaust retries (3 drain calls).
    await OfflineQueueManager.drain();
    await OfflineQueueManager.drain();
    await OfflineQueueManager.drain();

    const { queued: q1, failed: f1 } = await OfflineQueueManager.count();
    expect(q1).toBe(0);
    expect(f1).toBe(1);

    // Now set fetch to succeed so retryFailed can drain successfully.
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 202 } as Response);

    const { result } = renderHook(() => useOfflineQueue());

    await act(async () => {
      await result.current.retryFailed();
      await new Promise((r) => setTimeout(r, 100));
    });

    // After successful retry drain, both queues should be empty.
    const { queued: q2, failed: f2 } = await OfflineQueueManager.count();
    expect(q2).toBe(0);
    expect(f2).toBe(0);
  });
});
