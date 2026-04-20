/**
 * Tests for intakeFetch offline interceptor.
 *
 * Covers:
 *   - Offline path: enqueues + returns synthetic 202 queued response
 *   - Online path: passes through to apiFetch
 *   - Non-intake path: always passes through
 *   - Flag-off path: always passes through
 */

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";

// Reset IDB between tests.
beforeEach(() => {
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
  jest.spyOn(console, "info").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetModules();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    get: () => value,
    configurable: true,
  });
}

function setPwaFlag(value: string | undefined) {
  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_PORTAL_ENABLE_PWA;
  } else {
    process.env.NEXT_PUBLIC_PORTAL_ENABLE_PWA = value;
  }
}

// ---------------------------------------------------------------------------
// Mock apiFetch so we don't hit the real network
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn().mockResolvedValue({
    run_id: "real-run-123",
    status: "queued",
    created_at: "2026-04-20T00:00:00Z",
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { intakeFetch, isQueuedResponse } from "@/lib/pwa/intake-fetch";
import { OfflineQueueManager } from "@/lib/pwa/offline-queue";
import { apiFetch } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Offline path — enqueue + synthetic 202
// ---------------------------------------------------------------------------

describe("intakeFetch — offline path", () => {
  beforeEach(() => {
    setPwaFlag("1");
    setOnline(false);
  });

  afterEach(() => {
    setPwaFlag(undefined);
    setOnline(true);
  });

  it("returns a queued response when offline", async () => {
    const result = await intakeFetch("/intake/note", {
      method: "POST",
      body: JSON.stringify({ text: "hello" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(isQueuedResponse(result)).toBe(true);
    expect(result.status).toBe("offline_queued");
  });

  it("stores the request in IndexedDB when offline", async () => {
    await intakeFetch("/intake/note", {
      method: "POST",
      body: JSON.stringify({ text: "store me" }),
      headers: { "Content-Type": "application/json" },
    });

    const records = await OfflineQueueManager.listQueued();
    expect(records).toHaveLength(1);
    expect(records[0].endpoint).toBe("/api/intake/note");
  });

  it("does not call apiFetch when offline", async () => {
    await intakeFetch("/intake/url", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("enqueues blob bodies for upload endpoint", async () => {
    const blob = new Blob(["audio"], { type: "audio/webm" });
    await intakeFetch("/intake/upload", {
      method: "POST",
      body: blob,
      headers: { "Content-Type": "audio/webm" },
    });

    const records = await OfflineQueueManager.listQueued();
    expect(records).toHaveLength(1);
    // bodyBlob is stored (may be serialized by structuredClone as Blob or Blob-like object).
    expect(records[0].bodyBlob).toBeDefined();
    expect(records[0].bodyJson).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Online path — pass through
// ---------------------------------------------------------------------------

describe("intakeFetch — online path", () => {
  beforeEach(() => {
    setPwaFlag("1");
    setOnline(true);
    (apiFetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    setPwaFlag(undefined);
  });

  it("calls apiFetch when online", async () => {
    const result = await intakeFetch("/intake/note", {
      method: "POST",
      body: JSON.stringify({ text: "online" }),
    });

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(isQueuedResponse(result)).toBe(false);
    expect((result as { run_id: string }).run_id).toBe("real-run-123");
  });
});

// ---------------------------------------------------------------------------
// Flag-off path — always pass through
// ---------------------------------------------------------------------------

describe("intakeFetch — PWA flag disabled", () => {
  beforeEach(() => {
    setPwaFlag(undefined); // flag off
    setOnline(false); // offline, but flag is off
    (apiFetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    setOnline(true);
  });

  it("passes through to apiFetch even when offline if flag is off", async () => {
    await intakeFetch("/intake/note", {
      method: "POST",
      body: JSON.stringify({ text: "bypass" }),
    });

    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Non-intake path — always pass through
// ---------------------------------------------------------------------------

describe("intakeFetch — non-intake path", () => {
  beforeEach(() => {
    setPwaFlag("1");
    setOnline(false);
    (apiFetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    setPwaFlag(undefined);
    setOnline(true);
  });

  it("passes through for non-intake paths even when offline", async () => {
    await intakeFetch("/artifacts", { method: "GET" });
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("passes through for non-POST methods", async () => {
    await intakeFetch("/intake/note", { method: "GET" });
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
});
