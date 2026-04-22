/**
 * useDerivatives hook tests.
 *
 * Covers:
 *   - Loads derivatives for a valid source id (5 items)
 *   - Empty list — hook returns derivatives: []
 *   - 404 response → isNotFound: true, isError: true
 *   - Does not fetch when sourceId is empty string
 *   - hasMore is true when response envelope has a non-null cursor
 *   - hasMore is false / cursor is null on last page
 *   - refetch is callable without error
 *
 * Mocking strategy:
 *   getDerivatives is mocked at the module boundary (mirrors artifact-detail.test.tsx)
 *   to avoid the jsdom window-detection branch in apiFetch/getApiBase, which
 *   strips the host from the URL and causes MSW Node handlers to miss.
 *
 * library-source-rollup-v1 Phase 3 DETAIL-06.
 */

import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { useDerivatives } from "@/hooks/useDerivatives";
import type { DerivativeItem, ServiceModeEnvelope } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Mock getDerivatives at the module boundary
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/artifacts", () => ({
  ...jest.requireActual("@/lib/api/artifacts"),
  getDerivatives: jest.fn(),
}));

import { getDerivatives } from "@/lib/api/artifacts";
const mockGetDerivatives = getDerivatives as jest.MockedFunction<
  typeof getDerivatives
>;

// ---------------------------------------------------------------------------
// Wrapper — fresh QueryClient per test to avoid cross-test cache pollution
// ---------------------------------------------------------------------------

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return { Wrapper, queryClient };
}

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeDerivativeItem(
  overrides: Partial<DerivativeItem> = {},
): DerivativeItem {
  return {
    id: `deriv-${Math.random().toString(36).slice(2, 8)}`,
    artifact_type: "synthesis",
    title: "Stub derivative",
    updated_at: "2026-04-16T00:00:00Z",
    fidelity: "high",
    freshness: "current",
    verification_state: "verified",
    ...overrides,
  };
}

function makeItems(count: number): DerivativeItem[] {
  return Array.from({ length: count }, (_, i) =>
    makeDerivativeItem({ id: `deriv-${i + 1}`, title: `Derivative ${i + 1}` }),
  );
}

function makeEnvelope(
  items: DerivativeItem[],
  cursor: string | null = null,
): ServiceModeEnvelope<DerivativeItem> {
  return { data: items, cursor };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useDerivatives", () => {
  it("loads derivatives for a valid source id (5 items)", async () => {
    const items = makeItems(5);
    mockGetDerivatives.mockResolvedValue(makeEnvelope(items));

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useDerivatives("source-001"), {
      wrapper: Wrapper,
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.derivatives).toEqual([]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.derivatives).toHaveLength(5);
    expect(result.current.derivatives[0].title).toBe("Derivative 1");
    expect(result.current.derivatives[4].title).toBe("Derivative 5");
  });

  it("returns empty derivatives array when response has 0 items", async () => {
    mockGetDerivatives.mockResolvedValue(makeEnvelope([]));

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useDerivatives("source-empty"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.derivatives).toEqual([]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.cursor).toBeNull();
  });

  it("sets isNotFound and isError to true on a 404 response", async () => {
    mockGetDerivatives.mockRejectedValue(
      new ApiError(404, { detail: "not_found" }, "API error 404"),
    );

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useDerivatives("nonexistent-id"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.isNotFound).toBe(true);
    expect(result.current.derivatives).toEqual([]);
  });

  it("does not fetch when sourceId is empty string", () => {
    // mockGetDerivatives intentionally not set — if it fires the test will
    // surface the unexpected call via jest.clearAllMocks tracking.
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useDerivatives(""), {
      wrapper: Wrapper,
    });

    // Hook is disabled (enabled: false when sourceId is falsy)
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(result.current.derivatives).toEqual([]);
    expect(result.current.isError).toBe(false);
    expect(mockGetDerivatives).not.toHaveBeenCalled();
  });

  it("sets hasMore to true when the envelope cursor is non-null", async () => {
    const items = makeItems(5);
    mockGetDerivatives.mockResolvedValue(
      makeEnvelope(items, "next-page-opaque-token"),
    );

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useDerivatives("source-paged"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasMore).toBe(true);
    expect(result.current.cursor).toBe("next-page-opaque-token");
  });

  it("sets hasMore to false when the envelope cursor is null", async () => {
    mockGetDerivatives.mockResolvedValue(makeEnvelope(makeItems(3), null));

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useDerivatives("source-last-page"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasMore).toBe(false);
    expect(result.current.cursor).toBeNull();
  });

  it("exposes a refetch function that re-triggers the query", async () => {
    const items = makeItems(2);
    mockGetDerivatives.mockResolvedValue(makeEnvelope(items));

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useDerivatives("source-refetch"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.derivatives).toHaveLength(2);
    expect(mockGetDerivatives).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.derivatives).toHaveLength(2);
    expect(mockGetDerivatives).toHaveBeenCalledTimes(2);
  });

  it("isNotFound is false for non-404 errors (e.g. 500)", async () => {
    mockGetDerivatives.mockRejectedValue(
      new ApiError(500, { detail: "Internal server error" }, "API error 500"),
    );

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useDerivatives("source-500"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.isNotFound).toBe(false);
  });
});
