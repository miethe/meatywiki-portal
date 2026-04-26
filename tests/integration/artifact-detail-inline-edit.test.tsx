/**
 * Integration tests for useArtifactFieldSave — P2-07 gap (e).
 *
 * Tests the extracted hook that powers inline-edit saves on the Artifact Detail
 * screen.  We test the hook directly with renderHook + a real QueryClient
 * (wrapped in QueryClientProvider) rather than mounting the full
 * ArtifactDetailClient, which imports @miethe/ui — an ESM-only package that
 * cannot be parsed by Jest's CJS transform (pre-existing constraint).
 *
 * Coverage:
 *   (e) Optimistic rollback when patchArtifact rejects with ETagMismatchError
 *       → cache reverts to original value; "Edited elsewhere" toast shown.
 *   (e) Validation error path: ArtifactValidationError("status", "…")
 *       → cache reverts; "Invalid value: status" toast shown.
 *   (+) Happy path: patchArtifact resolves with updated data + new ETag
 *       → cache reflects new value; "Saved" toast shown.
 */

import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useArtifactFieldSave,
  type ToastKind,
} from "@/app/(main)/artifact/[id]/useArtifactFieldSave";
import { artifactQueryKey } from "@/hooks/useArtifact";
import {
  ETagMismatchError,
  ArtifactValidationError,
} from "@/lib/api/artifacts";
import type { ArtifactDetail } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Mock patchArtifact and fetchArtifactEtag so tests are purely in-memory.
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/artifacts", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/artifacts")>(
    "@/lib/api/artifacts",
  );
  return {
    ...actual,
    fetchArtifactEtag: jest.fn().mockResolvedValue('"initial-etag"'),
    patchArtifact: jest.fn(),
  };
});

import {
  patchArtifact,
  fetchArtifactEtag,
} from "@/lib/api/artifacts";

const mockPatchArtifact = patchArtifact as jest.MockedFunction<
  typeof patchArtifact
>;
const mockFetchArtifactEtag = fetchArtifactEtag as jest.MockedFunction<
  typeof fetchArtifactEtag
>;

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ARTIFACT_ID = "01HXYZ";
const INITIAL_ETAG = '"initial-etag"';
const NEW_ETAG = '"new-etag"';

const MOCK_ARTIFACT: ArtifactDetail = {
  id: ARTIFACT_ID,
  workspace: "library",
  type: "concept",
  title: "Original Title",
  status: "active",
  file_path: "/wiki/concepts/original.md",
};

const UPDATED_ARTIFACT: ArtifactDetail = {
  ...MOCK_ARTIFACT,
  title: "Updated Title",
};

// ---------------------------------------------------------------------------
// Test wrapper: QueryClientProvider with a fresh client per test.
// ---------------------------------------------------------------------------

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useArtifactFieldSave", () => {
  let queryClient: QueryClient;
  let toastCalls: Array<{ kind: ToastKind; text: string }>;

  beforeEach(() => {
    queryClient = makeQueryClient();
    toastCalls = [];

    // Seed the cache with the initial artifact.
    queryClient.setQueryData<ArtifactDetail>(
      artifactQueryKey(ARTIFACT_ID),
      MOCK_ARTIFACT,
    );

    // Reset mocks.
    mockFetchArtifactEtag.mockResolvedValue(INITIAL_ETAG);
    mockPatchArtifact.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function showToast(kind: ToastKind, text: string) {
    toastCalls.push({ kind, text });
  }

  function renderHookWithProviders() {
    return renderHook(
      () =>
        useArtifactFieldSave({
          artifactId: ARTIFACT_ID,
          showToast,
        }),
      { wrapper: makeWrapper(queryClient) },
    );
  }

  // -------------------------------------------------------------------------
  // Gap (e) — ETag mismatch: optimistic rollback + "Edited elsewhere" toast
  // -------------------------------------------------------------------------

  it("rolls back optimistic cache update and shows 'Edited elsewhere' toast on ETagMismatchError", async () => {
    // patchArtifact rejects with ETagMismatchError on the first call.
    const mismatchError = new ETagMismatchError(NEW_ETAG);
    mockPatchArtifact.mockRejectedValue(mismatchError);

    const { result } = renderHookWithProviders();

    // Wait for fetchArtifactEtag to be called (hook mounts + fetches etag).
    await waitFor(() => {
      expect(mockFetchArtifactEtag).toHaveBeenCalledWith(ARTIFACT_ID);
    });

    // Trigger a title save — the optimistic update fires, then patchArtifact
    // rejects, which should roll back the cache.
    let thrownError: unknown;
    await act(async () => {
      try {
        await result.current.handleFieldSave("title", "Updated Title");
      } catch (err) {
        thrownError = err;
      }
    });

    // The hook must re-throw so the inline-edit component stays in edit mode.
    expect(thrownError).toBeInstanceOf(ETagMismatchError);

    // Cache must revert to the original artifact.
    const cached = queryClient.getQueryData<ArtifactDetail>(
      artifactQueryKey(ARTIFACT_ID),
    );
    expect(cached?.title).toBe("Original Title");

    // "Edited elsewhere — refresh to continue" toast must appear.
    expect(toastCalls).toHaveLength(1);
    expect(toastCalls[0].kind).toBe("error");
    expect(toastCalls[0].text).toMatch(/edited elsewhere/i);
  });

  // -------------------------------------------------------------------------
  // Gap (e) — Validation error: rollback + "Invalid value: status" toast
  // -------------------------------------------------------------------------

  it("rolls back optimistic cache update and shows 'Invalid value: status' toast on ArtifactValidationError", async () => {
    const validationError = new ArtifactValidationError("status", "invalid value for status");
    mockPatchArtifact.mockRejectedValue(validationError);

    const { result } = renderHookWithProviders();

    await waitFor(() => {
      expect(mockFetchArtifactEtag).toHaveBeenCalledWith(ARTIFACT_ID);
    });

    let thrownError: unknown;
    await act(async () => {
      try {
        await result.current.handleFieldSave("status", "bad-status");
      } catch (err) {
        thrownError = err;
      }
    });

    // Re-throws so inline-edit stays in edit mode.
    expect(thrownError).toBeInstanceOf(ArtifactValidationError);

    // Cache must revert — the optimistic update set status to "bad-status"
    // (coerced type); after rollback it's back to "active".
    const cached = queryClient.getQueryData<ArtifactDetail>(
      artifactQueryKey(ARTIFACT_ID),
    );
    expect(cached?.status).toBe("active");

    // Toast: "Invalid value: status"
    expect(toastCalls).toHaveLength(1);
    expect(toastCalls[0].kind).toBe("error");
    expect(toastCalls[0].text).toMatch(/invalid value: status/i);
  });

  // -------------------------------------------------------------------------
  // Positive path — successful save: cache updated + "Saved" toast
  // -------------------------------------------------------------------------

  it("updates cache with server response and shows 'Saved' toast on successful patchArtifact", async () => {
    mockPatchArtifact.mockResolvedValue({
      data: UPDATED_ARTIFACT,
      etag: NEW_ETAG,
    });

    const { result } = renderHookWithProviders();

    await waitFor(() => {
      expect(mockFetchArtifactEtag).toHaveBeenCalledWith(ARTIFACT_ID);
    });

    await act(async () => {
      await result.current.handleFieldSave("title", "Updated Title");
    });

    // Cache must reflect the server's canonical response.
    const cached = queryClient.getQueryData<ArtifactDetail>(
      artifactQueryKey(ARTIFACT_ID),
    );
    expect(cached?.title).toBe("Updated Title");

    // "Saved" toast must appear.
    expect(toastCalls).toHaveLength(1);
    expect(toastCalls[0].kind).toBe("success");
    expect(toastCalls[0].text).toBe("Saved");

    // The hook's etag state must update to the new ETag returned by the server.
    expect(result.current.etag).toBe(NEW_ETAG);
  });

  // -------------------------------------------------------------------------
  // ETag is passed to patchArtifact as the If-Match header value
  // -------------------------------------------------------------------------

  it("passes the current etag to patchArtifact", async () => {
    mockPatchArtifact.mockResolvedValue({
      data: UPDATED_ARTIFACT,
      etag: NEW_ETAG,
    });

    const { result } = renderHookWithProviders();

    // Wait for etag to be fetched and stored.
    await waitFor(() => {
      expect(result.current.etag).toBe(INITIAL_ETAG);
    });

    await act(async () => {
      await result.current.handleFieldSave("title", "Updated Title");
    });

    expect(mockPatchArtifact).toHaveBeenCalledWith(
      ARTIFACT_ID,
      { title: "Updated Title" },
      INITIAL_ETAG,
    );
  });

  // -------------------------------------------------------------------------
  // Generic error: shows "Save failed" toast and re-throws
  // -------------------------------------------------------------------------

  it("shows 'Save failed' toast and re-throws on unknown errors", async () => {
    const genericError = new Error("Network timeout");
    mockPatchArtifact.mockRejectedValue(genericError);

    const { result } = renderHookWithProviders();

    await waitFor(() => {
      expect(mockFetchArtifactEtag).toHaveBeenCalledWith(ARTIFACT_ID);
    });

    let thrownError: unknown;
    await act(async () => {
      try {
        await result.current.handleFieldSave("title", "New Title");
      } catch (err) {
        thrownError = err;
      }
    });

    expect(thrownError).toBe(genericError);
    expect(toastCalls[0].kind).toBe("error");
    expect(toastCalls[0].text).toBe("Save failed");
  });
});
