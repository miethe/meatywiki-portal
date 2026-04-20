/**
 * Tests for OfflineQueueManager.
 *
 * Uses fake-indexeddb to provide a clean in-memory IndexedDB for each test.
 */

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset IndexedDB to a fresh state before each test. */
function resetIDB() {
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
}

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

import { OfflineQueueManager } from "@/lib/pwa/offline-queue";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetIDB();
  jest.spyOn(console, "info").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// enqueue
// ---------------------------------------------------------------------------

describe("OfflineQueueManager.enqueue", () => {
  it("stores a record in offline_queue and returns an id", async () => {
    const id = await OfflineQueueManager.enqueue({
      endpoint: "/api/intake/note",
      method: "POST",
      bodyJson: { text: "hello" },
    });

    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
  });

  it("strips the Authorization header before storing (security invariant)", async () => {
    await OfflineQueueManager.enqueue({
      endpoint: "/api/intake/note",
      method: "POST",
      headers: {
        Authorization: "Bearer super-secret-token",
        "Content-Type": "application/json",
      },
      bodyJson: { text: "secure note" },
    });

    const records = await OfflineQueueManager.listQueued();
    expect(records).toHaveLength(1);

    const storedHeaders = records[0].headers;
    // Authorization must NOT be present.
    expect(storedHeaders["Authorization"]).toBeUndefined();
    expect(storedHeaders["authorization"]).toBeUndefined();
    // Other headers should be preserved.
    expect(storedHeaders["Content-Type"]).toBe("application/json");
  });

  it("stores bodyBlob for upload records, not bodyJson", async () => {
    const blob = new Blob(["audio data"], { type: "audio/webm" });
    await OfflineQueueManager.enqueue({
      endpoint: "/api/intake/upload",
      method: "POST",
      bodyBlob: blob,
      contentType: "audio/webm",
    });

    const records = await OfflineQueueManager.listQueued();
    // bodyBlob must be stored (Blob type preserved by IndexedDB/structuredClone).
    expect(records[0].bodyBlob).toBeDefined();
    expect(records[0].bodyJson).toBeUndefined();
    expect(records[0].contentType).toBe("audio/webm");
  });

  it("does not store Authorization token in any header field", async () => {
    await OfflineQueueManager.enqueue({
      endpoint: "/api/intake/note",
      method: "POST",
      headers: {
        Authorization: "Bearer secret",
      },
      bodyJson: { text: "test" },
    });

    const records = await OfflineQueueManager.listQueued();
    const record = records[0];
    // No Authorization in headers
    const headerValues = Object.values(record.headers);
    const hasToken = headerValues.some((v) => v.includes("secret"));
    expect(hasToken).toBe(false);
  });

  it("enqueues multiple records with incrementing ids", async () => {
    const id1 = await OfflineQueueManager.enqueue({
      endpoint: "/api/intake/note",
      method: "POST",
      bodyJson: { text: "one" },
    });
    const id2 = await OfflineQueueManager.enqueue({
      endpoint: "/api/intake/url",
      method: "POST",
      bodyJson: { url: "https://example.com" },
    });

    expect(id2).toBeGreaterThan(id1);
  });
});

// ---------------------------------------------------------------------------
// listQueued
// ---------------------------------------------------------------------------

describe("OfflineQueueManager.listQueued", () => {
  it("returns an empty array when queue is empty", async () => {
    const records = await OfflineQueueManager.listQueued();
    expect(records).toEqual([]);
  });

  it("returns records in insertion order (FIFO)", async () => {
    await OfflineQueueManager.enqueue({
      endpoint: "/api/intake/note",
      method: "POST",
      bodyJson: { text: "first" },
    });
    await OfflineQueueManager.enqueue({
      endpoint: "/api/intake/url",
      method: "POST",
      bodyJson: { url: "https://example.com" },
    });

    const records = await OfflineQueueManager.listQueued();
    expect(records).toHaveLength(2);
    expect((records[0].bodyJson as { text: string }).text).toBe("first");
    expect((records[1].bodyJson as { url: string }).url).toBe("https://example.com");
  });
});

// ---------------------------------------------------------------------------
// count
// ---------------------------------------------------------------------------

describe("OfflineQueueManager.count", () => {
  it("returns { queued: 0, failed: 0 } initially", async () => {
    const { queued, failed } = await OfflineQueueManager.count();
    expect(queued).toBe(0);
    expect(failed).toBe(0);
  });

  it("increments queued count after enqueue", async () => {
    await OfflineQueueManager.enqueue({
      endpoint: "/api/intake/note",
      method: "POST",
      bodyJson: { text: "test" },
    });
    const { queued } = await OfflineQueueManager.count();
    expect(queued).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// dequeueNext
// ---------------------------------------------------------------------------

describe("OfflineQueueManager.dequeueNext", () => {
  it("returns undefined when queue is empty", async () => {
    const record = await OfflineQueueManager.dequeueNext();
    expect(record).toBeUndefined();
  });

  it("returns and removes the oldest record (FIFO)", async () => {
    await OfflineQueueManager.enqueue({
      endpoint: "/api/intake/note",
      method: "POST",
      bodyJson: { text: "first" },
    });
    await OfflineQueueManager.enqueue({
      endpoint: "/api/intake/url",
      method: "POST",
      bodyJson: { url: "https://example.com" },
    });

    const record = await OfflineQueueManager.dequeueNext();
    expect(record).toBeDefined();
    expect((record!.bodyJson as { text: string }).text).toBe("first");

    // Remaining queue should have 1 item.
    const { queued } = await OfflineQueueManager.count();
    expect(queued).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// drain — success path
// ---------------------------------------------------------------------------

describe("OfflineQueueManager.drain (success)", () => {
  it("replays all queued items and reports correct counts", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 202,
    } as Response);

    await OfflineQueueManager.enqueue({
      endpoint: "/api/intake/note",
      method: "POST",
      bodyJson: { text: "note one" },
    });
    await OfflineQueueManager.enqueue({
      endpoint: "/api/intake/url",
      method: "POST",
      bodyJson: { url: "https://example.com" },
    });

    const result = await OfflineQueueManager.drain();
    expect(result.replayed).toBe(2);
    expect(result.failed).toBe(0);

    // Queue should be empty after successful drain.
    const { queued } = await OfflineQueueManager.count();
    expect(queued).toBe(0);
  });

  it("does not include Authorization header in replayed fetch (security invariant)", async () => {
    const capturedHeaders: Record<string, string> = {};
    global.fetch = jest.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const h = new Headers(init?.headers);
      h.forEach((v, k) => { capturedHeaders[k] = v; });
      return Promise.resolve({ ok: true, status: 202 } as Response);
    });

    await OfflineQueueManager.enqueue({
      endpoint: "/api/intake/note",
      method: "POST",
      // Include Authorization in the input — it should be stripped at enqueue time.
      headers: { Authorization: "Bearer token123" },
      bodyJson: { text: "secure" },
    });

    await OfflineQueueManager.drain();

    expect(capturedHeaders["authorization"]).toBeUndefined();
    expect(capturedHeaders["Authorization"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// drain — retry + exhaustion
// ---------------------------------------------------------------------------

describe("OfflineQueueManager.drain (retries)", () => {
  it("moves record to failed_queue after MAX_RETRIES exhausted", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await OfflineQueueManager.enqueue({
      endpoint: "/api/intake/note",
      method: "POST",
      bodyJson: { text: "will fail" },
    });

    // Call drain 3 times to exhaust MAX_RETRIES=3.
    await OfflineQueueManager.drain(); // attempt 1 → retries=1, re-enqueued
    await OfflineQueueManager.drain(); // attempt 2 → retries=2, re-enqueued
    await OfflineQueueManager.drain(); // attempt 3 → retries=3, moved to failed

    const { queued, failed } = await OfflineQueueManager.count();
    expect(queued).toBe(0);
    expect(failed).toBe(1);
  });

  it("reports drain failure when item goes to failed_queue", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 } as Response);

    await OfflineQueueManager.enqueue({
      endpoint: "/api/intake/note",
      method: "POST",
      bodyJson: { text: "fail me" },
    });

    await OfflineQueueManager.drain();
    await OfflineQueueManager.drain();
    const result = await OfflineQueueManager.drain(); // exhausted on 3rd drain

    expect(result.failed).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// listFailed
// ---------------------------------------------------------------------------

describe("OfflineQueueManager.listFailed", () => {
  it("returns records in failed_queue", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 } as Response);

    await OfflineQueueManager.enqueue({
      endpoint: "/api/intake/note",
      method: "POST",
      bodyJson: { text: "doomed" },
    });

    await OfflineQueueManager.drain();
    await OfflineQueueManager.drain();
    await OfflineQueueManager.drain();

    const failedItems = await OfflineQueueManager.listFailed();
    expect(failedItems.length).toBeGreaterThanOrEqual(1);
    expect(failedItems[0].endpoint).toBe("/api/intake/note");
    // Authorization must NOT be present in failed records either.
    expect(failedItems[0].headers["Authorization"]).toBeUndefined();
  });
});
