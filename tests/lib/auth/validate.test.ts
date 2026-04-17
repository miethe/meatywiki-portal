/**
 * Unit tests for validateTokenWithBackend (src/lib/auth/validate.ts).
 *
 * Covers:
 *   1. PORTAL_DISABLE_AUTH=1 path — returns { valid: true } without a network call
 *   2. Normal path — mocked fetch responses
 */

import { validateTokenWithBackend } from "@/lib/auth/validate";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORIGINAL_PORTAL_DISABLE_AUTH = process.env.PORTAL_DISABLE_AUTH;
const ORIGINAL_API_URL = process.env.MEATYWIKI_PORTAL_API_URL;

function setDisableAuth(value: string | undefined) {
  if (value === undefined) {
    delete process.env.PORTAL_DISABLE_AUTH;
  } else {
    process.env.PORTAL_DISABLE_AUTH = value;
  }
}

afterEach(() => {
  // Restore original env values after each test
  setDisableAuth(ORIGINAL_PORTAL_DISABLE_AUTH);
  if (ORIGINAL_API_URL === undefined) {
    delete process.env.MEATYWIKI_PORTAL_API_URL;
  } else {
    process.env.MEATYWIKI_PORTAL_API_URL = ORIGINAL_API_URL;
  }
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests: PORTAL_DISABLE_AUTH=1
// ---------------------------------------------------------------------------

describe("validateTokenWithBackend — PORTAL_DISABLE_AUTH=1", () => {
  beforeEach(() => {
    setDisableAuth("1");
  });

  it("returns { valid: true } for a non-empty token without hitting the network", async () => {
    // Mock fetch to throw so we confirm it is never called in disable-auth mode
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("fetch should not be called in disable-auth mode"));

    const result = await validateTokenWithBackend("any-token");

    expect(result).toEqual({ valid: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns { valid: true } even if fetch would throw", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network error"));

    const result = await validateTokenWithBackend("placeholder");

    expect(result.valid).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: normal path (mocked fetch — unit level, no real network)
// ---------------------------------------------------------------------------

describe("validateTokenWithBackend — normal path", () => {
  beforeEach(() => {
    setDisableAuth("0");
    process.env.MEATYWIKI_PORTAL_API_URL = "http://127.0.0.1:8765";
  });

  it("returns { valid: true } when the backend responds { valid: true } with 200", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ valid: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await validateTokenWithBackend("real-token");
    expect(result).toEqual({ valid: true });
  });

  it("returns { valid: false, reason } when the backend returns 401", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Token mismatch" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await validateTokenWithBackend("bad-token");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Token mismatch");
  });

  it("returns { valid: false } when the backend responds 200 but valid !== true", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await validateTokenWithBackend("token");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Backend rejected the token");
  });

  it("returns { valid: false } when the network is unreachable", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await validateTokenWithBackend("some-token");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Could not reach backend/);
  });
});
