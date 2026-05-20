/**
 * useGraphFilterState hook tests — P3-13 (b, c partial).
 *
 * Covers:
 *   (b) Server filter change triggers debounced URL push after 300ms.
 *       - Before the debounce window: router.push NOT called.
 *       - After 300ms: router.push called with the updated server params.
 *   - resetAll immediately calls router.push with pathname only.
 *   - Initial filter values hydrated from URLSearchParams on mount.
 *   - setFilter with client-side dims (fidelity_min, etc.) does NOT change
 *     the URL params for those dims (they are not serialized by this hook).
 */

import { renderHook, act } from "@testing-library/react";
import { useGraphFilterState } from "@/hooks/useGraphFilterState";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
const mockPathname = "/graph";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

let mockSearchParams = new URLSearchParams();

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockPush.mockClear();
  mockSearchParams = new URLSearchParams();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests — server filter debounce (P3-13b)
// ---------------------------------------------------------------------------

describe("useGraphFilterState — server filter debounce (P3-13b)", () => {
  it("does NOT call router.push before 300ms after a server dim change", () => {
    const { result } = renderHook(() => useGraphFilterState());

    act(() => {
      result.current.setFilter({ ws: ["library"] });
    });

    act(() => {
      jest.advanceTimersByTime(299);
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("calls router.push with updated ws[] param after 300ms debounce", () => {
    const { result } = renderHook(() => useGraphFilterState());

    act(() => {
      result.current.setFilter({ ws: ["library"] });
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(mockPush).toHaveBeenCalledTimes(1);
    const url: string = mockPush.mock.calls[0][0] as string;
    expect(url).toContain("ws%5B%5D=library");
  });

  it("debounces rapid sequential changes to a single router.push call", () => {
    const { result } = renderHook(() => useGraphFilterState());

    act(() => {
      result.current.setFilter({ ws: ["library"] });
      result.current.setFilter({ ws: ["library", "research"] });
      result.current.setFilter({ ws: ["library", "research", "projects"] });
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Only one push — the debounce collapsed the three updates
    expect(mockPush).toHaveBeenCalledTimes(1);
    const url: string = mockPush.mock.calls[0][0] as string;
    expect(url).toContain("ws%5B%5D=library");
    expect(url).toContain("ws%5B%5D=research");
    expect(url).toContain("ws%5B%5D=projects");
  });

  it("isPending is true during the debounce window", () => {
    const { result } = renderHook(() => useGraphFilterState());

    act(() => {
      result.current.setFilter({ ws: ["library"] });
    });

    // During debounce window isPending should be true
    expect(result.current.isPending).toBe(true);
  });

  it("serializes q (dim 16 free-text) in the URL after debounce", () => {
    const { result } = renderHook(() => useGraphFilterState());

    act(() => {
      result.current.setFilter({ q: "neural" });
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    const url: string = mockPush.mock.calls[0][0] as string;
    expect(url).toContain("q=neural");
  });
});

// ---------------------------------------------------------------------------
// Tests — resetAll
// ---------------------------------------------------------------------------

describe("useGraphFilterState — resetAll", () => {
  it("resetAll immediately calls router.push with just the pathname", () => {
    const { result } = renderHook(() => useGraphFilterState());

    act(() => {
      result.current.resetAll();
    });

    expect(mockPush).toHaveBeenCalledTimes(1);
    // resetAll pushes only the pathname (no query string)
    expect(mockPush.mock.calls[0][0]).toBe(mockPathname);
  });

  it("resetAll resets values to GRAPH_FILTERS_DEFAULT", () => {
    const { result } = renderHook(() => useGraphFilterState());

    act(() => {
      result.current.setFilter({ ws: ["library"], q: "test" });
    });

    act(() => {
      result.current.resetAll();
    });

    expect(result.current.values.ws).toEqual([]);
    expect(result.current.values.q).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Tests — URL hydration
// ---------------------------------------------------------------------------

describe("useGraphFilterState — URL hydration", () => {
  it("hydrates ws from URLSearchParams on mount", () => {
    mockSearchParams = new URLSearchParams("ws%5B%5D=library&ws%5B%5D=research");
    const { result } = renderHook(() => useGraphFilterState());

    expect(result.current.values.ws).toEqual(["library", "research"]);
  });

  it("hydrates q from URLSearchParams on mount", () => {
    mockSearchParams = new URLSearchParams("q=concept+map");
    const { result } = renderHook(() => useGraphFilterState());

    expect(result.current.values.q).toBe("concept map");
  });

  it("hydrates date_from and date_to from URLSearchParams", () => {
    mockSearchParams = new URLSearchParams(
      "date_from=2026-01-01&date_to=2026-03-31",
    );
    const { result } = renderHook(() => useGraphFilterState());

    expect(result.current.values.date_from).toBe("2026-01-01");
    expect(result.current.values.date_to).toBe("2026-03-31");
  });
});

// ---------------------------------------------------------------------------
// Tests — client dims NOT serialized to URL (P3-13c partial)
// ---------------------------------------------------------------------------

describe("useGraphFilterState — client dims not serialized", () => {
  it("setting fidelity_min does NOT push fidelity_min to URL", () => {
    const { result } = renderHook(() => useGraphFilterState());

    act(() => {
      result.current.setFilter({ fidelity_min: 0.5 });
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    const url: string = mockPush.mock.calls[0][0] as string;
    expect(url).not.toContain("fidelity_min");
  });

  it("setting conf_min does NOT push conf_min to URL", () => {
    const { result } = renderHook(() => useGraphFilterState());

    act(() => {
      result.current.setFilter({ conf_min: 0.3 });
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    const url: string = mockPush.mock.calls[0][0] as string;
    expect(url).not.toContain("conf_min");
  });
});
