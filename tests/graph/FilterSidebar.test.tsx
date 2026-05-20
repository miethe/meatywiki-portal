/**
 * FilterSidebar tests — P3-13 (a).
 *
 * Covers:
 *   (a) Renders all 16 dimensions in correct section order:
 *       Primary (4), Secondary (4), Advanced (8).
 *   - Collapse button collapses the sidebar (open → closed rail).
 *   - Expand button on the rail re-opens the sidebar.
 *   - ESC key collapses the sidebar.
 *   - Active filter count badge shown in header when activeFilterCount > 0.
 *   - Clear all button visible when activeFilterCount > 0 + onClearAll provided.
 *   - Clear all button calls onClearAll.
 *   - Search input visible when onSearchChange is provided.
 *   - Search clear button appears when searchValue is non-empty.
 */

import React from "react";
import { render, screen, fireEvent } from "../utils/render";
import { FilterSidebar } from "@/components/graph/FilterSidebar";

// ---------------------------------------------------------------------------
// jsdom does not implement window.matchMedia — stub it so breakpoint hooks work.
// ---------------------------------------------------------------------------

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderOpen(overrides?: Partial<React.ComponentProps<typeof FilterSidebar>>) {
  return render(
    <FilterSidebar open={true} onOpenChange={jest.fn()} {...overrides} />,
  );
}

// ---------------------------------------------------------------------------
// Section/dimension presence tests
// ---------------------------------------------------------------------------

describe("FilterSidebar — 16-dimension section layout (P3-13a)", () => {
  it("renders the Primary Filters section with 4 dimensions", () => {
    renderOpen();

    expect(screen.getByText("Primary Filters")).toBeInTheDocument();

    // Workspace, Artifact Type, Edges, Search are the 4 primary dims
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("Artifact Type")).toBeInTheDocument();
    expect(screen.getByText("Edges")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
  });

  it("renders the Secondary Filters section with 4 dimensions", () => {
    renderOpen();

    expect(screen.getByText("Secondary Filters")).toBeInTheDocument();

    expect(screen.getByText("Freshness")).toBeInTheDocument();
    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("Domain")).toBeInTheDocument();
    expect(screen.getByText("Date Range")).toBeInTheDocument();
  });

  it("renders the Advanced Filters section header", () => {
    renderOpen();
    expect(screen.getByText("Advanced Filters")).toBeInTheDocument();
  });

  it("Advanced section contains all 8 advanced dims when expanded", () => {
    renderOpen();

    // Expand the Advanced section
    const advancedBtn = screen.getByText("Advanced Filters");
    fireEvent.click(advancedBtn);

    expect(screen.getByText("Fidelity")).toBeInTheDocument();
    expect(screen.getByText("Freshness Score")).toBeInTheDocument();
    expect(screen.getByText("Confidence")).toBeInTheDocument();
    expect(screen.getByText("Lifecycle")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Verification")).toBeInTheDocument();
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("Semantic Neighbor")).toBeInTheDocument();
  });

  it("sections appear in Primary → Secondary → Advanced order", () => {
    renderOpen();

    const headers = screen
      .getAllByRole("button")
      .map((b) => b.textContent ?? "");

    const primaryIdx = headers.findIndex((t) => t.includes("Primary Filters"));
    const secondaryIdx = headers.findIndex((t) => t.includes("Secondary Filters"));
    const advancedIdx = headers.findIndex((t) => t.includes("Advanced Filters"));

    expect(primaryIdx).toBeLessThan(secondaryIdx);
    expect(secondaryIdx).toBeLessThan(advancedIdx);
  });
});

// ---------------------------------------------------------------------------
// Open/close behavior
// ---------------------------------------------------------------------------

describe("FilterSidebar — open/close behavior", () => {
  it("collapse button calls onOpenChange(false)", () => {
    const onOpenChange = jest.fn();
    renderOpen({ onOpenChange });

    const collapseBtn = screen.getByRole("button", {
      name: /collapse filter sidebar/i,
    });
    fireEvent.click(collapseBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("collapsed rail shows expand button that calls onOpenChange(true)", () => {
    const onOpenChange = jest.fn();
    render(
      <FilterSidebar open={false} onOpenChange={onOpenChange} />,
    );

    const expandBtn = screen.getByRole("button", {
      name: /expand graph filters/i,
    });
    fireEvent.click(expandBtn);

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("ESC key calls onOpenChange(false) when open", () => {
    const onOpenChange = jest.fn();
    const { container } = renderOpen({ onOpenChange });

    const aside = container.querySelector("aside")!;
    fireEvent.keyDown(aside, { key: "Escape" });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

// ---------------------------------------------------------------------------
// Active count badge
// ---------------------------------------------------------------------------

describe("FilterSidebar — active filter count badge", () => {
  it("shows activeFilterCount badge in header when count > 0", () => {
    renderOpen({ activeFilterCount: 3 });

    // The header badge (not the rail badge) — look for aria-label
    const badge = screen.getByLabelText("3 active");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("3");
  });

  it("does not show a badge when activeFilterCount is 0", () => {
    renderOpen({ activeFilterCount: 0 });

    expect(screen.queryByLabelText(/active/i)).not.toBeInTheDocument();
  });

  it("shows 99+ when activeFilterCount exceeds 99 (rail badge)", () => {
    render(<FilterSidebar open={false} activeFilterCount={120} />);
    // Rail badge is shown when collapsed
    const badge = screen.getByLabelText(/active filters?/i);
    expect(badge).toHaveTextContent("99+");
  });
});

// ---------------------------------------------------------------------------
// Clear all button
// ---------------------------------------------------------------------------

describe("FilterSidebar — clear all button", () => {
  it("shows clear all button when activeFilterCount > 0 and onClearAll provided", () => {
    renderOpen({ activeFilterCount: 2, onClearAll: jest.fn() });

    expect(
      screen.getByRole("button", { name: /clear all filters/i }),
    ).toBeInTheDocument();
  });

  it("calls onClearAll when clear all button is clicked", () => {
    const onClearAll = jest.fn();
    renderOpen({ activeFilterCount: 1, onClearAll });

    fireEvent.click(screen.getByRole("button", { name: /clear all filters/i }));

    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("does not show clear all button when activeFilterCount is 0", () => {
    renderOpen({ activeFilterCount: 0, onClearAll: jest.fn() });

    expect(
      screen.queryByRole("button", { name: /clear all filters/i }),
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Search input (dim 16)
// ---------------------------------------------------------------------------

describe("FilterSidebar — search input (dim 16)", () => {
  it("renders search input when onSearchChange is provided", () => {
    renderOpen({ onSearchChange: jest.fn() });

    expect(
      screen.getByRole("searchbox", { name: /search nodes/i }),
    ).toBeInTheDocument();
  });

  it("does not render search input when onSearchChange is absent", () => {
    renderOpen();

    expect(
      screen.queryByRole("searchbox"),
    ).not.toBeInTheDocument();
  });

  it("calls onSearchChange on input change", () => {
    const onSearchChange = jest.fn();
    renderOpen({ onSearchChange, searchValue: "" });

    const input = screen.getByRole("searchbox", { name: /search nodes/i });
    fireEvent.change(input, { target: { value: "concept" } });

    expect(onSearchChange).toHaveBeenCalledWith("concept");
  });

  it("shows clear button when searchValue is non-empty and calls onSearchChange('')", () => {
    const onSearchChange = jest.fn();
    renderOpen({ onSearchChange, searchValue: "hello" });

    const clearBtn = screen.getByRole("button", { name: /clear search/i });
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(onSearchChange).toHaveBeenCalledWith("");
  });
});
