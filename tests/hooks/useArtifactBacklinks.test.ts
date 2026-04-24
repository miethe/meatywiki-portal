/**
 * useArtifactBacklinks hook tests (P7-04).
 *
 * Covers:
 *   - Primary path: returns server data when /backlinks endpoint succeeds
 *   - Fallback path: falls back to /edges when /backlinks returns 404
 *   - Fallback path: falls back to /edges on network error
 *   - edgeType filter applied server-side (param passed through)
 *   - edgeType filter applied client-side on fallback path
 *   - isFallback flag is false on primary, true on fallback
 *   - isLoading is true while primary is in-flight
 *   - isError propagates from fallback when both endpoints fail
 *
 * Mocking strategy:
 *   Mock both `usePrimaryBacklinks` internals via `apiFetch` and
 *   `useArtifactEdges` at module boundary — avoids real HTTP calls.
 *
 *   We mock:
 *     - @/lib/api/client (apiFetch) — controls /backlinks response
 *     - @/hooks/useArtifactEdges    — controls /edges fallback
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { ApiError } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/client", () => ({
  ...jest.requireActual("@/lib/api/client"),
  apiFetch: jest.fn(),
}));

jest.mock("@/hooks/useArtifactEdges", () => ({
  ...jest.requireActual("@/hooks/useArtifactEdges"),
  useArtifactEdges: jest.fn(),
}));

import { apiFetch } from "@/lib/api/client";
import { useArtifactEdges } from "@/hooks/useArtifactEdges";
import { useArtifactBacklinks } from "@/hooks/useArtifactBacklinks";
import type { ArtifactEdgesResponse } from "@/hooks/useArtifactEdges";

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;
const mockUseArtifactEdges = useArtifactEdges as jest.MockedFunction<typeof useArtifactEdges>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEdgesResponse(
  overrides: Partial<ArtifactEdgesResponse> = {},
): ArtifactEdgesResponse {
  return {
    artifact_id: "01HXYZ_SOURCE",
    incoming: [],
    outgoing: [],
    ...overrides,
  };
}

function defaultEdgesHook(
  data?: ArtifactEdgesResponse,
  overrides: { isLoading?: boolean; isError?: boolean; error?: Error | null } = {},
) {
  return {
    data,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    error: overrides.error ?? null,
    refetch: jest.fn(),
  };
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const ARTIFACT_ID = "01HXYZ0000000000000000001";

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Default: edges fallback returns empty data (prevents undefined errors)
  mockUseArtifactEdges.mockReturnValue(defaultEdgesHook(makeEdgesResponse()));
  // Default: primary endpoint resolves successfully with empty items
  mockApiFetch.mockResolvedValue({ data: [], cursor: null });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// 1. Primary path succeeds
// ===========================================================================

describe("useArtifactBacklinks — primary path", () => {
  it("returns items from the server envelope when /backlinks succeeds", async () => {
    const serverItems = [
      { artifact_id: "01AAA", type: "relates_to", title: "Alpha", subtype: "concept" },
      { artifact_id: "01BBB", type: "supports", title: "Beta", subtype: "evidence" },
    ];
    mockApiFetch.mockResolvedValue({ data: serverItems, cursor: null });

    const { result } = renderHook(
      () => useArtifactBacklinks(ARTIFACT_ID),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].artifact_id).toBe("01AAA");
    expect(result.current.isFallback).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it("calls apiFetch with the /backlinks path", async () => {
    mockApiFetch.mockResolvedValue({ data: [], cursor: null });

    const { result } = renderHook(
      () => useArtifactBacklinks(ARTIFACT_ID),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/artifacts/${ARTIFACT_ID}/backlinks`),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("appends edge_type query param when edgeType is provided", async () => {
    mockApiFetch.mockResolvedValue({ data: [], cursor: null });

    const { result } = renderHook(
      () => useArtifactBacklinks(ARTIFACT_ID, "contradicts"),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining("edge_type=contradicts"),
      expect.anything(),
    );
  });

  it("does not append edge_type when edgeType is null", async () => {
    mockApiFetch.mockResolvedValue({ data: [], cursor: null });

    const { result } = renderHook(
      () => useArtifactBacklinks(ARTIFACT_ID, null),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.not.stringContaining("edge_type"),
      expect.anything(),
    );
  });
});

// ===========================================================================
// 2. Fallback path — 404 from primary
// ===========================================================================

describe("useArtifactBacklinks — fallback on 404", () => {
  it("falls back to edge-walk when /backlinks returns 404", async () => {
    mockApiFetch.mockRejectedValue(
      new ApiError(404, { detail: "not_found" }, "API error 404"),
    );
    const fallbackEdges = makeEdgesResponse({
      incoming: [{ artifact_id: "01CCC", type: "derived_from", title: "Source Doc", subtype: null }],
      outgoing: [],
    });
    mockUseArtifactEdges.mockReturnValue(defaultEdgesHook(fallbackEdges));

    const { result } = renderHook(
      () => useArtifactBacklinks(ARTIFACT_ID),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isFallback).toBe(true);
    expect(result.current.incoming).toHaveLength(1);
    expect(result.current.incoming[0].artifact_id).toBe("01CCC");
    expect(result.current.isError).toBe(false);
  });

  it("applies edgeType filter client-side on fallback path", async () => {
    mockApiFetch.mockRejectedValue(
      new ApiError(404, { detail: "not_found" }, "API error 404"),
    );
    const fallbackEdges = makeEdgesResponse({
      incoming: [
        { artifact_id: "01AAA", type: "derived_from", title: "Source", subtype: null },
        { artifact_id: "01BBB", type: "contradicts", title: "Contradiction", subtype: null },
      ],
      outgoing: [],
    });
    mockUseArtifactEdges.mockReturnValue(defaultEdgesHook(fallbackEdges));

    const { result } = renderHook(
      () => useArtifactBacklinks(ARTIFACT_ID, "derived_from"),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isFallback).toBe(true);
    // Only derived_from edges should pass the filter
    expect(result.current.incoming).toHaveLength(1);
    expect(result.current.incoming[0].type).toBe("derived_from");
    expect(result.current.items).toHaveLength(1);
  });
});

// ===========================================================================
// 3. Fallback path — network error from primary
// ===========================================================================

describe("useArtifactBacklinks — fallback on network error", () => {
  it("falls back to edge-walk on generic network error from /backlinks", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network timeout"));
    const fallbackEdges = makeEdgesResponse({
      outgoing: [{ artifact_id: "01DDD", type: "supports", title: "Evidence", subtype: "evidence" }],
    });
    mockUseArtifactEdges.mockReturnValue(defaultEdgesHook(fallbackEdges));

    const { result } = renderHook(
      () => useArtifactBacklinks(ARTIFACT_ID),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isFallback).toBe(true);
    expect(result.current.outgoing).toHaveLength(1);
    expect(result.current.outgoing[0].artifact_id).toBe("01DDD");
  });
});

// ===========================================================================
// 4. Both paths fail
// ===========================================================================

describe("useArtifactBacklinks — both endpoints fail", () => {
  it("surfaces isError=true when both /backlinks and /edges fail", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network timeout"));
    mockUseArtifactEdges.mockReturnValue(
      defaultEdgesHook(undefined, {
        isError: true,
        error: new Error("Edges also failed"),
      }),
    );

    const { result } = renderHook(
      () => useArtifactBacklinks(ARTIFACT_ID),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isFallback).toBe(true);
    expect(result.current.isError).toBe(true);
    expect(result.current.error?.message).toContain("Edges also failed");
  });
});

// ===========================================================================
// 5. Skips when artifactId is falsy
// ===========================================================================

describe("useArtifactBacklinks — no artifactId", () => {
  it("returns empty state and no loading when artifactId is null", () => {
    const { result } = renderHook(
      () => useArtifactBacklinks(null),
      { wrapper: makeWrapper() },
    );

    // TanStack Query is disabled; hook never enters loading
    expect(result.current.items).toEqual([]);
    expect(result.current.incoming).toEqual([]);
    expect(result.current.outgoing).toEqual([]);
  });
});
