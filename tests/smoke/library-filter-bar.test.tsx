/**
 * LibraryFilterBar smoke tests.
 *
 * Covers the real filter component used by the Library screen:
 * - Type/status chips call the lifted filter handler
 * - Sort changes emit the expected field/order pair
 * - Active filters can be cleared
 */

import React from "react";
import { fireEvent, renderWithProviders, screen } from "../utils/render";
import { LibraryFilterBar } from "@/components/ui/library-filter-bar";
import type { LibraryFilters } from "@/hooks/useLibraryArtifacts";

const baseFilters: LibraryFilters = {
  types: [],
  statuses: [],
  sort: "updated",
  order: "desc",
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

  it("clears active filters", async () => {
    const onFiltersChange = jest.fn();

    renderWithProviders(
      <LibraryFilterBar
        filters={{ ...baseFilters, types: ["concept"], statuses: ["active"] }}
        onFiltersChange={onFiltersChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));

    expect(onFiltersChange).toHaveBeenCalledWith({ types: [], statuses: [] });
  });
});
