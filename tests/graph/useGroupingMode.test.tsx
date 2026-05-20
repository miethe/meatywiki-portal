/**
 * useGroupingMode hook tests — P3-13 (g / URL round-trip).
 *
 * Covers:
 *   - Default mode is 'none' when no URL param present.
 *   - setMode updates the URL with `grouping=` param via router.push.
 *   - Setting default mode ('none') removes the param from the URL.
 *   - Invalid param values fall back to 'none'.
 *   - Mode is read from the URLSearchParams on mount.
 */

import { renderHook, act } from "@testing-library/react";
import { useGroupingMode } from "@/hooks/useGroupingMode";

// ---------------------------------------------------------------------------
// Mocks
//
// next/navigation is mocked globally in tests/setup.ts with a push that uses
// a plain jest.fn(). Here we override per-test to capture the exact call.
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
const mockPathname = "/graph";

// Override the global setup.ts mock with per-test control
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
  useTransition: () => [false, (fn: () => void) => fn()],
}));

// We'll mutate this to simulate different URL states
let mockSearchParams = new URLSearchParams();

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockPush.mockClear();
  mockSearchParams = new URLSearchParams();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useGroupingMode — initial state (P3-13g)", () => {
  it("defaults to 'none' when grouping param is absent", () => {
    const { result } = renderHook(() => useGroupingMode());
    expect(result.current.mode).toBe("none");
  });

  it("reads the mode from the URL searchParam on mount", () => {
    mockSearchParams = new URLSearchParams("grouping=workspace");
    const { result } = renderHook(() => useGroupingMode());
    expect(result.current.mode).toBe("workspace");
  });

  it("falls back to 'none' for an invalid grouping param", () => {
    mockSearchParams = new URLSearchParams("grouping=invalid_mode");
    const { result } = renderHook(() => useGroupingMode());
    expect(result.current.mode).toBe("none");
  });
});

describe("useGroupingMode — setMode URL writes (P3-13g)", () => {
  it("setMode('workspace') calls router.push with ?grouping=workspace", () => {
    const { result } = renderHook(() => useGroupingMode());

    act(() => {
      result.current.setMode("workspace");
    });

    expect(mockPush).toHaveBeenCalledTimes(1);
    const url: string = mockPush.mock.calls[0][0] as string;
    expect(url).toContain("grouping=workspace");
  });

  it("setMode('none') removes grouping param from the URL", () => {
    mockSearchParams = new URLSearchParams("grouping=workspace");
    const { result } = renderHook(() => useGroupingMode());

    act(() => {
      result.current.setMode("none");
    });

    const url: string = mockPush.mock.calls[0][0] as string;
    // When default, param should be absent (URL should not contain grouping=)
    expect(url).not.toContain("grouping=");
  });

  it("setMode('artifact_type') pushes the correct param", () => {
    const { result } = renderHook(() => useGroupingMode());

    act(() => {
      result.current.setMode("artifact_type");
    });

    const url: string = mockPush.mock.calls[0][0] as string;
    expect(url).toContain("grouping=artifact_type");
  });

  it("setMode preserves unrelated URL params", () => {
    mockSearchParams = new URLSearchParams("ws[]=library&types[]=concept");
    const { result } = renderHook(() => useGroupingMode());

    act(() => {
      result.current.setMode("domain");
    });

    const url: string = mockPush.mock.calls[0][0] as string;
    expect(url).toContain("grouping=domain");
    // Unrelated params should be preserved
    expect(url).toContain("ws%5B%5D=library");
  });
});
