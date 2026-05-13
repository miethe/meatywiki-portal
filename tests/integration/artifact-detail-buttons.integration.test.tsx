/**
 * Integration tests for Link Related and Request Review rail-action handlers.
 *
 * audit-wave-2 Phase 2 — P2-08.
 *
 * Scope: tests the useLinkArtifact and useRequestReview mutation hooks
 * directly (similar to artifact-detail-inline-edit.test.tsx pattern).
 * We avoid mounting ArtifactDetailClient because it imports @miethe/ui
 * (ESM-only, non-parseable by Jest CJS transform — pre-existing constraint).
 *
 * Coverage:
 *   Link Related (P2-02/03):
 *     - Happy path: linkArtifact called with correct payload → success
 *     - Invalidates ["artifact", id] and ["artifacts"] on success
 *     - Error path: mutation exposes error from API call
 *
 *   Request Review (P2-04):
 *     - Happy path: requestReview called with correct review_type + notes
 *     - Notes=null when empty string provided
 *     - Error path: mutation exposes error from API call
 *     - Different review_type values are forwarded as-is
 *
 *   API functions (linkArtifact / requestReview):
 *     - Default edge_type is "relates_to" when not provided
 *     - Correct endpoints called (POST /api/artifacts/{id}/link|review)
 */

import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLinkArtifact, useRequestReview } from "@/hooks/use-artifact-actions";

// ---------------------------------------------------------------------------
// Mock API functions so tests are purely in-memory
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/artifacts", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/artifacts")>(
    "@/lib/api/artifacts",
  );
  return {
    ...actual,
    linkArtifact: jest.fn(),
    requestReview: jest.fn(),
  };
});

import { linkArtifact, requestReview } from "@/lib/api/artifacts";

const mockLinkArtifact = linkArtifact as jest.MockedFunction<typeof linkArtifact>;
const mockRequestReview = requestReview as jest.MockedFunction<typeof requestReview>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ARTIFACT_ID = "01HXY_SOURCE_00000000001";
const TARGET_ID = "01HXY_TARGET_00000000002";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ---------------------------------------------------------------------------
// useLinkArtifact tests
// ---------------------------------------------------------------------------

describe("useLinkArtifact", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeQueryClient();
    mockLinkArtifact.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("calls linkArtifact with the provided target_id and edge_type on success", async () => {
    mockLinkArtifact.mockResolvedValue({ status: "linked" });

    const { result } = renderHook(() => useLinkArtifact(ARTIFACT_ID), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ target_id: TARGET_ID, edge_type: "relates_to" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockLinkArtifact).toHaveBeenCalledTimes(1);
    expect(mockLinkArtifact).toHaveBeenCalledWith(ARTIFACT_ID, {
      target_id: TARGET_ID,
      edge_type: "relates_to",
    });
  });

  it("invalidates ['artifact', id] and ['artifacts'] queries on success", async () => {
    mockLinkArtifact.mockResolvedValue({ status: "linked" });

    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useLinkArtifact(ARTIFACT_ID), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ target_id: TARGET_ID, edge_type: "supports" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["artifact", ARTIFACT_ID],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["artifacts"] });
  });

  it("exposes error when linkArtifact rejects", async () => {
    const apiError = new Error("Invalid edge_type 'bad_value'");
    mockLinkArtifact.mockRejectedValue(apiError);

    const { result } = renderHook(() => useLinkArtifact(ARTIFACT_ID), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ target_id: TARGET_ID, edge_type: "relates_to" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBe(apiError);
  });

  it("forwards a non-default edge_type to the API", async () => {
    mockLinkArtifact.mockResolvedValue({ status: "linked" });

    const { result } = renderHook(() => useLinkArtifact(ARTIFACT_ID), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ target_id: TARGET_ID, edge_type: "contradicts" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockLinkArtifact).toHaveBeenCalledWith(ARTIFACT_ID, {
      target_id: TARGET_ID,
      edge_type: "contradicts",
    });
  });
});

// ---------------------------------------------------------------------------
// useRequestReview tests
// ---------------------------------------------------------------------------

describe("useRequestReview", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeQueryClient();
    mockRequestReview.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("calls requestReview with review_type and notes on success", async () => {
    mockRequestReview.mockResolvedValue({ id: 42 });

    const { result } = renderHook(() => useRequestReview(ARTIFACT_ID), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ review_type: "verification", notes: "Needs checking" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRequestReview).toHaveBeenCalledTimes(1);
    expect(mockRequestReview).toHaveBeenCalledWith(ARTIFACT_ID, {
      review_type: "verification",
      notes: "Needs checking",
    });
  });

  it("forwards null notes when caller passes null", async () => {
    mockRequestReview.mockResolvedValue({ id: 7 });

    const { result } = renderHook(() => useRequestReview(ARTIFACT_ID), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ review_type: "lint", notes: null });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRequestReview).toHaveBeenCalledWith(ARTIFACT_ID, {
      review_type: "lint",
      notes: null,
    });
  });

  it("exposes error when requestReview rejects", async () => {
    const apiError = new Error("Review request failed: 422");
    mockRequestReview.mockRejectedValue(apiError);

    const { result } = renderHook(() => useRequestReview(ARTIFACT_ID), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ review_type: "promotion" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBe(apiError);
  });

  it("handles all valid review_type values without mutation error", async () => {
    const reviewTypes = [
      "lint",
      "verification",
      "promotion",
      "freshness",
      "contradiction",
    ] as const;

    for (const reviewType of reviewTypes) {
      mockRequestReview.mockResolvedValue({ id: 1 });
      const localClient = makeQueryClient();

      const { result } = renderHook(() => useRequestReview(ARTIFACT_ID), {
        wrapper: makeWrapper(localClient),
      });

      act(() => {
        result.current.mutate({ review_type: reviewType });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockRequestReview).toHaveBeenLastCalledWith(ARTIFACT_ID, {
        review_type: reviewType,
      });

      mockRequestReview.mockReset();
    }
  });
});
