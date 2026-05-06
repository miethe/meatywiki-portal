/**
 * LibraryFilterBar smoke tests.
 *
 * Covers the real filter component used by the Library screen:
 * - Type/status chips call the lifted filter handler
 * - Sort changes emit the expected field/order pair
 * - Active filters can be cleared
 * - Lens filter panel (P4-09): expand/collapse, chip interactions, clear lens
 * - URL sync via useLensFilterUrlSync (P4-09)
 */

import React from "react";
import { fireEvent, renderWithProviders, screen, waitFor } from "../utils/render";
import { LibraryFilterBar, useLensFilterUrlSync } from "@/components/ui/library-filter-bar";
import type { LibraryFilters } from "@/hooks/useLibraryArtifacts";
import { renderHook, act } from "@testing-library/react";

const baseFilters: LibraryFilters = {
  types: [],
  statuses: [],
  sort: "updated",
  order: "desc",
  tags: [],
  lensFidelity: [],
  lensFreshness: [],
  lensVerification: [],
};

describe("LibraryFilterBar", () => {
  it("emits type and status filter updates", async () => {
    const onFiltersChange = jest.fn();

    renderWithProviders(
      <LibraryFilterBar
        filters={baseFilters}
        onFiltersChange={onFiltersChange}
        resultCount={12}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /filter by type: concept/i }));
    fireEvent.click(screen.getByRole("button", { name: /filter by status: active/i }));

    expect(onFiltersChange).toHaveBeenNthCalledWith(1, { types: ["concept"] });
    expect(onFiltersChange).toHaveBeenNthCalledWith(2, { statuses: ["active"] });
  });

  it("emits sort field and order changes", async () => {
    const onFiltersChange = jest.fn();

    renderWithProviders(
      <LibraryFilterBar
        filters={baseFilters}
        onFiltersChange={onFiltersChange}
      />,
    );

    fireEvent.change(screen.getByLabelText(/sort artifacts/i), {
      target: { value: "title:asc" },
    });

    expect(onFiltersChange).toHaveBeenCalledWith({ sort: "title", order: "asc" });
  });

  it("clears all active filters including lens filters", async () => {
    const onFiltersChange = jest.fn();

    renderWithProviders(
      <LibraryFilterBar
        filters={{
          ...baseFilters,
          types: ["concept"],
          statuses: ["active"],
          tags: ["ml"],
          lensFidelity: ["high"],
        }}
        onFiltersChange={onFiltersChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));

    expect(onFiltersChange).toHaveBeenCalledWith({
      types: [],
      statuses: [],
      facet: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      tags: [],
      lensFidelity: [],
      lensFreshness: [],
      lensVerification: [],
    });
  });

  it("emits tag filter updates and shows active chips", () => {
    const onFiltersChange = jest.fn();

    renderWithProviders(
      <LibraryFilterBar
        filters={{ ...baseFilters, tags: ["existing"] }}
        onFiltersChange={onFiltersChange}
      />,
    );

    fireEvent.change(screen.getByLabelText(/tags/i), {
      target: { value: "new-tag" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(onFiltersChange).toHaveBeenCalledWith({ tags: ["existing", "new-tag"] });
    expect(screen.getByRole("button", { name: /tag: existing/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Lens Filter Bar tests (P4-09)
// ---------------------------------------------------------------------------

describe("LibraryFilterBar — Lens Filter Panel (P4-09)", () => {
  it("renders the Lens toggle button", () => {
    renderWithProviders(
      <LibraryFilterBar filters={baseFilters} onFiltersChange={jest.fn()} />,
    );
    expect(
      screen.getByRole("button", { name: /expand lens filters/i }),
    ).toBeInTheDocument();
  });

  it("lens panel is hidden by default when no lens filters are active", () => {
    renderWithProviders(
      <LibraryFilterBar filters={baseFilters} onFiltersChange={jest.fn()} />,
    );
    // The lens panel should not be visible until expanded
    expect(screen.queryByRole("group", { name: /lens filters/i })).not.toBeInTheDocument();
  });

  it("expands lens panel when Lens button is clicked", () => {
    renderWithProviders(
      <LibraryFilterBar filters={baseFilters} onFiltersChange={jest.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /expand lens filters/i }));
    expect(screen.getByRole("group", { name: /lens filters/i })).toBeInTheDocument();
  });

  it("shows lens panel open when active lens filters are already set", () => {
    renderWithProviders(
      <LibraryFilterBar
        filters={{ ...baseFilters, lensFidelity: ["high"] }}
        onFiltersChange={jest.fn()}
      />,
    );
    // Panel should be pre-expanded because a lens filter is active
    expect(screen.getByRole("group", { name: /lens filters/i })).toBeInTheDocument();
  });

  it("emits fidelity filter changes from lens panel", () => {
    const onFiltersChange = jest.fn();
    renderWithProviders(
      <LibraryFilterBar
        filters={{ ...baseFilters, lensFidelity: ["high"] }}
        onFiltersChange={onFiltersChange}
      />,
    );

    // Panel open; click Medium chip
    fireEvent.click(
      screen.getByRole("button", { name: /filter by fidelity: medium/i }),
    );
    expect(onFiltersChange).toHaveBeenCalledWith({ lensFidelity: ["high", "medium"] });
  });

  it("emits freshness filter changes from lens panel", () => {
    const onFiltersChange = jest.fn();
    renderWithProviders(
      <LibraryFilterBar
        filters={{ ...baseFilters, lensFidelity: ["high"] }}
        onFiltersChange={onFiltersChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /filter by freshness: current/i }),
    );
    expect(onFiltersChange).toHaveBeenCalledWith({ lensFreshness: ["current"] });
  });

  it("emits verification filter changes from lens panel", () => {
    const onFiltersChange = jest.fn();
    renderWithProviders(
      <LibraryFilterBar
        filters={{ ...baseFilters, lensFidelity: ["high"] }}
        onFiltersChange={onFiltersChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /filter by verification: verified/i }),
    );
    expect(onFiltersChange).toHaveBeenCalledWith({ lensVerification: ["verified"] });
  });

  it("clears a quality filter from its active chip", () => {
    const onFiltersChange = jest.fn();
    renderWithProviders(
      <LibraryFilterBar
        filters={{
          ...baseFilters,
          types: ["concept"],
          lensFidelity: ["high"],
          lensFreshness: ["current"],
        }}
        onFiltersChange={onFiltersChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /quality: high/i }));
    expect(onFiltersChange).toHaveBeenCalledWith({
      lensFidelity: [],
    });
  });

  it("collapses lens panel when toggle is clicked a second time", () => {
    renderWithProviders(
      <LibraryFilterBar filters={baseFilters} onFiltersChange={jest.fn()} />,
    );

    const toggleBtn = screen.getByRole("button", { name: /expand lens filters/i });
    fireEvent.click(toggleBtn); // open
    expect(screen.getByRole("group", { name: /lens filters/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /collapse lens filters/i })); // close
    expect(screen.queryByRole("group", { name: /lens filters/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// URL sync tests (P4-09)
// ---------------------------------------------------------------------------

describe("useLensFilterUrlSync", () => {
  // Helper to set the current URL search string in jsdom
  function setSearch(search: string) {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, search, pathname: "/library" },
    });
  }

  beforeEach(() => {
    // Reset URL between tests
    setSearch("");
    // Stub replaceState
    jest.spyOn(window.history, "replaceState").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("readFromUrl returns empty arrays when no lens params in URL", () => {
    setSearch("");
    const { result } = renderHook(() => useLensFilterUrlSync());
    const read = result.current.readFromUrl();
    expect(read).not.toBeNull();
    expect(read!.lensFidelity).toEqual([]);
    expect(read!.lensFreshness).toEqual([]);
    expect(read!.lensVerification).toEqual([]);
  });

  it("readFromUrl parses lens params from URL", () => {
    setSearch("?date_from=2026-05-01&date_to=2026-05-05&tag[]=ml&lens_fidelity=high&lens_freshness=current&lens_verification=verified");
    const { result } = renderHook(() => useLensFilterUrlSync());
    const read = result.current.readFromUrl();
    expect(read!.dateFrom).toBe("2026-05-01");
    expect(read!.dateTo).toBe("2026-05-05");
    expect(read!.tags).toEqual(["ml"]);
    expect(read!.lensFidelity).toEqual(["high"]);
    expect(read!.lensFreshness).toEqual(["current"]);
    expect(read!.lensVerification).toEqual(["verified"]);
  });

  it("readFromUrl ignores invalid enum values in URL", () => {
    setSearch("?lens_fidelity=bad_value&lens_fidelity=high");
    const { result } = renderHook(() => useLensFilterUrlSync());
    const read = result.current.readFromUrl();
    expect(read!.lensFidelity).toEqual(["high"]); // "bad_value" filtered out
  });

  it("syncToUrl defers replaceState with correct URL", async () => {
    setSearch("?workspace=library");
    const { result } = renderHook(() => useLensFilterUrlSync());

    act(() => {
      result.current.syncToUrl({
        dateFrom: undefined,
        dateTo: undefined,
        tags: [],
        lensFidelity: ["high", "medium"],
        lensFreshness: ["current"],
        lensVerification: [],
      });
    });

    expect(window.history.replaceState).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalledWith(
        null,
        "",
        expect.stringContaining("lens_fidelity=high"),
      );
      expect(window.history.replaceState).toHaveBeenCalledWith(
        null,
        "",
        expect.stringContaining("lens_fidelity=medium"),
      );
      expect(window.history.replaceState).toHaveBeenCalledWith(
        null,
        "",
        expect.stringContaining("lens_freshness=current"),
      );
    });
  });

  it("syncToUrl preserves non-lens params", async () => {
    setSearch("?workspace=library&status=active");
    const { result } = renderHook(() => useLensFilterUrlSync());

    act(() => {
      result.current.syncToUrl({
        dateFrom: "2026-05-01",
        dateTo: undefined,
        tags: ["ml"],
        lensFidelity: ["high"],
        lensFreshness: [],
        lensVerification: [],
      });
    });

    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalledTimes(1);
    });
    const [[, , url]] = (window.history.replaceState as jest.Mock).mock.calls;
    expect(url).toContain("workspace=library");
    expect(url).toContain("status=active");
    expect(url).toContain("date_from=2026-05-01");
    expect(url).toContain("tag%5B%5D=ml");
    expect(url).toContain("lens_fidelity=high");
  });

  it("syncToUrl clears lens params when all arrays are empty", async () => {
    setSearch("?lens_fidelity=high");
    const { result } = renderHook(() => useLensFilterUrlSync());

    act(() => {
      result.current.syncToUrl({
        dateFrom: undefined,
        dateTo: undefined,
        tags: [],
        lensFidelity: [],
        lensFreshness: [],
        lensVerification: [],
      });
    });

    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalledTimes(1);
    });
    const [[, , url]] = (window.history.replaceState as jest.Mock).mock.calls;
    expect(url).not.toContain("lens_fidelity");
  });

  it("syncToUrl coalesces multiple same-tick filter changes into one URL write", async () => {
    setSearch("?workspace=library");
    const { result } = renderHook(() => useLensFilterUrlSync());

    act(() => {
      result.current.syncToUrl({
        dateFrom: undefined,
        dateTo: undefined,
        tags: [],
        lensFidelity: ["high"],
        lensFreshness: [],
        lensVerification: [],
      });
      result.current.syncToUrl({
        dateFrom: undefined,
        dateTo: undefined,
        tags: [],
        lensFidelity: ["medium"],
        lensFreshness: ["current"],
        lensVerification: [],
      });
    });

    expect(window.history.replaceState).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalledTimes(1);
    });
    const [[, , url]] = (window.history.replaceState as jest.Mock).mock.calls;
    expect(url).toContain("lens_fidelity=medium");
    expect(url).toContain("lens_freshness=current");
    expect(url).not.toContain("lens_fidelity=high");
  });
});
