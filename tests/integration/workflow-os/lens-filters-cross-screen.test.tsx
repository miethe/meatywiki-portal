/**
 * Integration test — Lens filters cross-screen consistency (P4-12).
 *
 * Verifies:
 *   1. LibraryFilterBar state changes produce the correct lens_* query params
 *      when a fetch is issued via listArtifacts.
 *   2. The same filter state feeds identical params for Library and Research
 *      calls (ensuring cross-screen behaviour is consistent by construction —
 *      both screens build their useInfiniteQuery call on the same API).
 *   3. Clearing filters via the "Clear filters" control resets filter state.
 */

import React from "react";
import { act, renderWithProviders, screen } from "../../utils/render";
import { userEvent } from "../../utils/render";
import { LibraryFilterBar } from "@/components/ui/library-filter-bar";
import {
  DEFAULT_LIBRARY_FILTERS,
  type LibraryFilters,
} from "@/hooks/useLibraryArtifacts";
import { listArtifacts } from "@/lib/api/artifacts";

// ---------------------------------------------------------------------------
// Stub fetch — record URLs passed to apiFetch
// ---------------------------------------------------------------------------

let fetchSpy: jest.SpyInstance;
let capturedUrls: string[];

beforeEach(() => {
  capturedUrls = [];
  fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    capturedUrls.push(url);
    return new Response(JSON.stringify({ data: [], cursor: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
});

afterEach(() => {
  fetchSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Tests — API-level wire format
// ---------------------------------------------------------------------------

describe("Lens filter wire format (API level)", () => {
  it("includes lens_fidelity/freshness/verification query params for Library calls", async () => {
    await listArtifacts({
      workspace: "library",
      lensFidelity: ["high", "medium"],
      lensFreshness: ["current"],
      lensVerification: ["verified"],
    });

    expect(capturedUrls).toHaveLength(1);
    const url = capturedUrls[0];
    expect(url).toContain("workspace=library");
    expect(url).toContain("lens_fidelity=high");
    expect(url).toContain("lens_fidelity=medium");
    expect(url).toContain("lens_freshness=current");
    expect(url).toContain("lens_verification=verified");
  });

  it("produces identical lens_* params for Library and Research (cross-screen)", async () => {
    const lensFilters = {
      lensFidelity: ["high"] as ("high" | "medium" | "low")[],
      lensFreshness: ["stale"] as ("current" | "stale" | "outdated")[],
      lensVerification: ["disputed"] as ("verified" | "disputed" | "unverified")[],
    };

    await listArtifacts({ workspace: "library", ...lensFilters });
    await listArtifacts({ workspace: "research", ...lensFilters });

    expect(capturedUrls).toHaveLength(2);
    const [libraryUrl, researchUrl] = capturedUrls;

    // Extract lens params from each URL and compare — they must match exactly
    function lensParamsOf(url: string): string[] {
      const qs = url.split("?")[1] ?? "";
      return qs
        .split("&")
        .filter((p) => p.startsWith("lens_"))
        .sort();
    }

    expect(lensParamsOf(libraryUrl)).toEqual(lensParamsOf(researchUrl));
  });

  it("omits lens_* params entirely when filter arrays are empty", async () => {
    await listArtifacts({
      workspace: "library",
      lensFidelity: [],
      lensFreshness: [],
      lensVerification: [],
    });

    const url = capturedUrls[0];
    expect(url).not.toContain("lens_fidelity");
    expect(url).not.toContain("lens_freshness");
    expect(url).not.toContain("lens_verification");
  });
});

// ---------------------------------------------------------------------------
// Tests — Filter bar UI interaction
// ---------------------------------------------------------------------------

describe("LibraryFilterBar — user interaction reaches onFiltersChange", () => {
  function Harness({
    initial,
    onChange,
  }: {
    initial: LibraryFilters;
    onChange: (patch: Partial<LibraryFilters>) => void;
  }) {
    const [filters, setFilters] = React.useState<LibraryFilters>(initial);
    return (
      <LibraryFilterBar
        filters={filters}
        onFiltersChange={(patch) => {
          onChange(patch);
          setFilters((prev) => ({ ...prev, ...patch }));
        }}
      />
    );
  }

  it("emits lens filter patches when a lens chip is toggled", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    renderWithProviders(
      <Harness initial={DEFAULT_LIBRARY_FILTERS} onChange={onChange} />,
    );

    // Open lens panel
    const lensToggle = screen.getByRole("button", { name: /expand lens filters/i });
    await user.click(lensToggle);

    // Click a fidelity chip
    const highChip = screen.getByRole("button", { name: /Fidelity: High/i });
    await user.click(highChip);

    // onFiltersChange should have been called with a lensFidelity patch
    const fidelityCalls = onChange.mock.calls.filter(
      ([patch]) => "lensFidelity" in (patch as object),
    );
    expect(fidelityCalls.length).toBeGreaterThan(0);
    expect(fidelityCalls.at(-1)?.[0]).toMatchObject({ lensFidelity: ["high"] });
  });

  it("Clear filters resets all multi-select fields to empty arrays", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    const activeFilters: LibraryFilters = {
      ...DEFAULT_LIBRARY_FILTERS,
      types: ["concept"],
      statuses: ["active"],
      lensFidelity: ["high"],
      lensFreshness: ["current"],
      lensVerification: ["verified"],
    };

    renderWithProviders(
      <Harness initial={activeFilters} onChange={onChange} />,
    );

    const clearBtn = await screen.findByRole("button", { name: /^Clear filters$/i });
    await act(async () => {
      await user.click(clearBtn);
    });

    // The last call should clear all filter arrays
    const patch = onChange.mock.calls.at(-1)?.[0] as Partial<LibraryFilters>;
    expect(patch).toMatchObject({
      types: [],
      statuses: [],
      lensFidelity: [],
      lensFreshness: [],
      lensVerification: [],
    });
  });
});
