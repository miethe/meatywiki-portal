import { renderHook } from "@testing-library/react";
import {
  useCompileBatch,
  BATCH_WINDOW_MS,
} from "@/hooks/useCompileBatch";
import type { CompileBatchEntry } from "@/hooks/useCompileBatch";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function entry(
  artifactId: string,
  startTimeMs: number,
  overrides: Partial<CompileBatchEntry> = {},
): CompileBatchEntry {
  return {
    artifactId,
    startTimeMs,
    isTerminal: false,
    isSuccess: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useCompileBatch", () => {
  const BASE_TIME = 1_700_000_000_000; // arbitrary epoch ms

  describe("batch detection (≥2 entries within window)", () => {
    it("groups 5 entries within the window into a single batch", () => {
      const entries: CompileBatchEntry[] = [
        entry("art-1", BASE_TIME),
        entry("art-2", BASE_TIME + 500),
        entry("art-3", BASE_TIME + 1000),
        entry("art-4", BASE_TIME + 2000),
        entry("art-5", BASE_TIME + 4000),
      ];

      const { result } = renderHook(() => useCompileBatch({ entries }));

      expect(result.current.isBatch).toBe(true);
      expect(result.current.batch).not.toBeNull();
      expect(result.current.batch?.totalCount).toBe(5);
      expect(result.current.batch?.artifactIds).toHaveLength(5);
    });

    it("reports completedCount=0 when no entries are terminal", () => {
      const entries: CompileBatchEntry[] = [
        entry("art-1", BASE_TIME),
        entry("art-2", BASE_TIME + 1000),
        entry("art-3", BASE_TIME + 2000),
      ];

      const { result } = renderHook(() => useCompileBatch({ entries }));

      expect(result.current.batch?.completedCount).toBe(0);
      expect(result.current.batch?.allTerminal).toBe(false);
    });

    it("reports correct completedCount as artifacts reach terminal state", () => {
      const entries: CompileBatchEntry[] = [
        entry("art-1", BASE_TIME, { isTerminal: true, isSuccess: true }),
        entry("art-2", BASE_TIME + 500, { isTerminal: true, isSuccess: false }),
        entry("art-3", BASE_TIME + 1000),
        entry("art-4", BASE_TIME + 2000),
        entry("art-5", BASE_TIME + 4000),
      ];

      const { result } = renderHook(() => useCompileBatch({ entries }));

      expect(result.current.batch?.completedCount).toBe(2);
      expect(result.current.batch?.totalCount).toBe(5);
      expect(result.current.batch?.allTerminal).toBe(false);
    });

    it("sets allTerminal=true when all entries are terminal", () => {
      const entries: CompileBatchEntry[] = [
        entry("art-1", BASE_TIME, { isTerminal: true, isSuccess: true }),
        entry("art-2", BASE_TIME + 1000, { isTerminal: true, isSuccess: true }),
        entry("art-3", BASE_TIME + 2000, { isTerminal: true, isSuccess: false }),
      ];

      const { result } = renderHook(() => useCompileBatch({ entries }));

      expect(result.current.batch?.allTerminal).toBe(true);
      expect(result.current.batch?.completedCount).toBe(3);
    });

    it("includes only entries within BATCH_WINDOW_MS of the earliest start", () => {
      const entries: CompileBatchEntry[] = [
        entry("art-1", BASE_TIME),
        entry("art-2", BASE_TIME + 1000),
        // art-3 starts just outside the window — excluded from batch
        entry("art-3", BASE_TIME + BATCH_WINDOW_MS + 1),
      ];

      const { result } = renderHook(() => useCompileBatch({ entries }));

      // art-1 and art-2 are within window → batch of 2
      expect(result.current.isBatch).toBe(true);
      expect(result.current.batch?.totalCount).toBe(2);
      expect(result.current.batch?.artifactIds).toEqual(
        expect.arrayContaining(["art-1", "art-2"]),
      );
      expect(result.current.batch?.artifactIds).not.toContain("art-3");
    });

    it("exposes the windowStartMs as the earliest start time", () => {
      const entries: CompileBatchEntry[] = [
        entry("art-2", BASE_TIME + 200),
        entry("art-1", BASE_TIME),        // earliest
        entry("art-3", BASE_TIME + 500),
      ];

      const { result } = renderHook(() => useCompileBatch({ entries }));

      expect(result.current.batch?.windowStartMs).toBe(BASE_TIME);
    });
  });

  describe("standalone case (no batch chrome)", () => {
    it("returns isBatch=false and batch=null for a single entry", () => {
      const entries: CompileBatchEntry[] = [
        entry("art-solo", BASE_TIME),
      ];

      const { result } = renderHook(() => useCompileBatch({ entries }));

      expect(result.current.isBatch).toBe(false);
      expect(result.current.batch).toBeNull();
    });

    it("returns isBatch=false for an empty entries array", () => {
      const { result } = renderHook(() =>
        useCompileBatch({ entries: [] }),
      );

      expect(result.current.isBatch).toBe(false);
      expect(result.current.batch).toBeNull();
    });

    it("returns isBatch=false when only 1 entry falls within the window", () => {
      // art-1 starts at BASE_TIME; art-2 starts well outside the window
      const entries: CompileBatchEntry[] = [
        entry("art-1", BASE_TIME),
        entry("art-2", BASE_TIME + BATCH_WINDOW_MS + 10_000),
      ];

      const { result } = renderHook(() => useCompileBatch({ entries }));

      expect(result.current.isBatch).toBe(false);
      expect(result.current.batch).toBeNull();
    });
  });
});
