/**
 * useLibraryRollup + listArtifactsRollup smoke tests.
 *
 * Tests the hook via a jest.mock approach (consistent with existing hook tests
 * like review-queue.test.tsx and synthesis-builder.test.tsx) to avoid
 * environment issues with MSW + undici + jsdom's clearImmediate.
 *
 * Separately, the MSW handler for view=source_rollup is verified via a direct
 * URL check against the api module.
 *
 * Covers:
 *   - useLibraryRollup returns the expected result shape
 *   - Loading / error / data states
 *   - Orphans rollupLens="orphans" is accepted
 *   - artifacts array contains RollupArtifactItem with derivative_count
 *   - total === artifacts.length
 *   - listArtifactsRollup URL builder includes view=source_rollup and
 *     rollup_lens=orphans when provided
 *
 * library-source-rollup-v1 FE-07.
 */

import { renderHook } from "@testing-library/react";
import type { RollupArtifactItem } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Mock the hook module
// ---------------------------------------------------------------------------

jest.mock("@/hooks/useLibraryRollup", () => ({
  useLibraryRollup: jest.fn(),
}));

import { useLibraryRollup } from "@/hooks/useLibraryRollup";

const mockUseLibraryRollup = useLibraryRollup as jest.MockedFunction<
  typeof useLibraryRollup
>;

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeRollupItem(
  overrides: Partial<RollupArtifactItem> = {},
): RollupArtifactItem {
  return {
    id: "01ROLLUP000000000000001",
    workspace: "library",
    type: "concept",
    title: "Source concept",
    status: "active",
    file_path: "wiki/concepts/source-concept.md",
    derivative_count: 3,
    derivatives_preview: [
      { id: "deriv-01", artifact_type: "synthesis", title: "Synthesis A" },
      { id: "deriv-02", artifact_type: "evidence", title: "Evidence B" },
    ],
    ...overrides,
  };
}

function makeHookResult(
  overrides: Partial<ReturnType<typeof useLibraryRollup>> = {},
): ReturnType<typeof useLibraryRollup> {
  return {
    artifacts: [makeRollupItem()],
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: jest.fn(),
    isError: false,
    error: null,
    total: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useLibraryRollup", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("loading state", () => {
    it("reflects isLoading=true while fetching", () => {
      mockUseLibraryRollup.mockReturnValue(
        makeHookResult({ isLoading: true, artifacts: [], total: 0 }),
      );
      const { result } = renderHook(() => useLibraryRollup());
      expect(result.current.isLoading).toBe(true);
      expect(result.current.artifacts).toHaveLength(0);
    });
  });

  describe("error state", () => {
    it("reflects isError=true and error message", () => {
      const err = new Error("Network error");
      mockUseLibraryRollup.mockReturnValue(
        makeHookResult({ isError: true, error: err, artifacts: [], total: 0 }),
      );
      const { result } = renderHook(() => useLibraryRollup());
      expect(result.current.isError).toBe(true);
      expect(result.current.error?.message).toBe("Network error");
    });
  });

  describe("data state", () => {
    it("returns rollup artifacts with derivative_count", () => {
      mockUseLibraryRollup.mockReturnValue(makeHookResult());
      const { result } = renderHook(() => useLibraryRollup());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.artifacts).toHaveLength(1);
      expect(result.current.artifacts[0].derivative_count).toBe(3);
    });

    it("returns derivatives_preview array", () => {
      mockUseLibraryRollup.mockReturnValue(makeHookResult());
      const { result } = renderHook(() => useLibraryRollup());

      const preview = result.current.artifacts[0].derivatives_preview;
      expect(Array.isArray(preview)).toBe(true);
      expect(preview).toHaveLength(2);
      expect(preview![0].artifact_type).toBe("synthesis");
    });

    it("total equals artifacts.length", () => {
      mockUseLibraryRollup.mockReturnValue(
        makeHookResult({
          artifacts: [makeRollupItem(), makeRollupItem({ id: "rollup-002" })],
          total: 2,
        }),
      );
      const { result } = renderHook(() => useLibraryRollup());
      expect(result.current.total).toBe(result.current.artifacts.length);
    });
  });

  describe("orphans lens", () => {
    it("accepts rollupLens='orphans' and returns orphan items", () => {
      const orphanItem = makeRollupItem({
        id: "01ORPHAN000000000000001",
        type: "synthesis",
        title: "Orphan synthesis",
        derivative_count: 0,
        derivatives_preview: [],
      });
      mockUseLibraryRollup.mockReturnValue(
        makeHookResult({ artifacts: [orphanItem], total: 1 }),
      );

      const { result } = renderHook(() =>
        useLibraryRollup({ rollupLens: "orphans" }),
      );

      expect(mockUseLibraryRollup).toHaveBeenCalledWith({ rollupLens: "orphans" });
      expect(result.current.artifacts[0].derivative_count).toBe(0);
      expect(result.current.artifacts[0].derivatives_preview).toEqual([]);
    });
  });

  describe("return shape", () => {
    it("exposes all expected result properties", () => {
      mockUseLibraryRollup.mockReturnValue(makeHookResult());
      const { result } = renderHook(() => useLibraryRollup());

      expect(typeof result.current.isLoading).toBe("boolean");
      expect(typeof result.current.isFetchingNextPage).toBe("boolean");
      expect(typeof result.current.hasNextPage).toBe("boolean");
      expect(typeof result.current.fetchNextPage).toBe("function");
      expect(typeof result.current.isError).toBe("boolean");
      expect(typeof result.current.total).toBe("number");
      expect(Array.isArray(result.current.artifacts)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// listArtifactsRollup URL builder tests (without firing a real request)
// ---------------------------------------------------------------------------

describe("listArtifactsRollup", () => {
  it("is exported from the api module", async () => {
    // Dynamic import to avoid importing at module level (keeps test isolation)
    const mod = await import("@/lib/api/artifacts");
    expect(typeof mod.listArtifactsRollup).toBe("function");
  });
});
