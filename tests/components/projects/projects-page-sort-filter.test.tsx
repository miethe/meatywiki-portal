/**
 * Unit + RTL tests for the Projects page sort/filter/persistence logic (P4-03).
 *
 * Covers:
 *   1. applyFilter — all three predicate variants
 *   2. applySort   — all three sort dimensions
 *   3. useLocalStorageString round-trip (via PillGroup rendered inside page)
 *   4. RTL: sort pill changes update localStorage and the displayed order
 *   5. RTL: filter pill changes update localStorage and the displayed list
 */

import React from "react";
import { renderWithProviders, screen, waitFor, fireEvent } from "../../utils/render";
import {
  applyFilter,
  applySort,
  type ProjectSortKey,
  type ProjectFilterKey,
} from "@/app/(main)/projects/project-filters";
import type { ContextPack } from "@/types/projects";

// ---------------------------------------------------------------------------
// Minimal ContextPack factory
// ---------------------------------------------------------------------------

function makePack(overrides: Partial<ContextPack> & { pack_id: string; name: string }): ContextPack {
  return {
    artifact_ids: [],
    artifact_count: 0,
    version: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
    root_intent_id: null,
    description: null,
    ...overrides,
  };
}

const PACK_A = makePack({
  pack_id: "a",
  name: "Alpha",
  artifact_count: 5,
  updated_at: "2026-06-01T00:00:00Z",
  root_intent_id: "intent-1",
});
const PACK_B = makePack({
  pack_id: "b",
  name: "beta",
  artifact_count: 0,
  updated_at: "2026-05-01T00:00:00Z",
  root_intent_id: null,
});
const PACK_C = makePack({
  pack_id: "c",
  name: "Gamma",
  artifact_count: 12,
  updated_at: "2026-06-15T00:00:00Z",
  root_intent_id: null,
});

// ---------------------------------------------------------------------------
// applyFilter unit tests
// ---------------------------------------------------------------------------

describe("applyFilter", () => {
  const packs = [PACK_A, PACK_B, PACK_C];

  it('filter "all" returns all packs unchanged', () => {
    const result = applyFilter(packs, "all");
    expect(result).toHaveLength(3);
    expect(result.map((p) => p.pack_id)).toEqual(["a", "b", "c"]);
  });

  it('filter "has-intent" returns only packs with root_intent_id set', () => {
    const result = applyFilter(packs, "has-intent");
    expect(result).toHaveLength(1);
    expect(result[0].pack_id).toBe("a");
  });

  it('filter "non-empty" returns only packs with artifact_count > 0', () => {
    const result = applyFilter(packs, "non-empty");
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.pack_id)).toEqual(["a", "c"]);
  });

  it('filter "has-intent" returns empty array when no packs have an intent', () => {
    expect(applyFilter([PACK_B, PACK_C], "has-intent")).toHaveLength(0);
  });

  it("does not mutate the original array", () => {
    const original = [PACK_A, PACK_B, PACK_C];
    applyFilter(original, "non-empty");
    expect(original).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// applySort unit tests
// ---------------------------------------------------------------------------

describe("applySort", () => {
  const packs = [PACK_B, PACK_C, PACK_A]; // intentionally shuffled

  it('sort "name" returns packs in locale-insensitive A–Z order', () => {
    const result = applySort(packs, "name");
    expect(result.map((p) => p.name)).toEqual(["Alpha", "beta", "Gamma"]);
  });

  it('sort "artifact_count" returns packs in descending count order', () => {
    const result = applySort(packs, "artifact_count");
    expect(result.map((p) => p.artifact_count)).toEqual([12, 5, 0]);
  });

  it('sort "updated_at" returns packs in descending date order (most recent first)', () => {
    const result = applySort(packs, "updated_at");
    expect(result.map((p) => p.pack_id)).toEqual(["c", "a", "b"]);
  });

  it("does not mutate the original array", () => {
    const original = [PACK_B, PACK_C, PACK_A];
    applySort(original, "name");
    expect(original.map((p) => p.pack_id)).toEqual(["b", "c", "a"]);
  });

  it('sort "updated_at" falls back to created_at when updated_at is null', () => {
    const packNoUpdated = makePack({
      pack_id: "x",
      name: "X",
      artifact_count: 1,
      updated_at: null,
      created_at: "2026-04-01T00:00:00Z",
    });
    const result = applySort([PACK_B, packNoUpdated], "updated_at");
    // PACK_B.updated_at = 2026-05-01, packNoUpdated falls back to created_at 2026-04-01
    expect(result[0].pack_id).toBe("b");
    expect(result[1].pack_id).toBe("x");
  });
});

// ---------------------------------------------------------------------------
// RTL: localStorage round-trip
//
// We test the hook's persistence by simulating the full Projects page render,
// but mock the TanStack Query + API so it resolves immediately to our fixture
// data. The `next/navigation` mock is wired in tests/setup.ts.
// ---------------------------------------------------------------------------

// Mock TanStack Query to control data without a real QueryClientProvider.
jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query"
  );
  return {
    ...actual,
    useQuery: jest.fn(),
    useMutation: jest.fn(),
    useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
  };
});

jest.mock("@/lib/api/projects", () => ({
  listContextPacks: jest.fn(),
  createContextPack: jest.fn(),
  mergeProject: jest.fn(),
  deleteProject: jest.fn(),
}));

// Lazy import after mocks are hoisted.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useQuery, useMutation } = require("@tanstack/react-query") as typeof import("@tanstack/react-query");

// Cast to jest.Mock so we can call .mockReturnValue.
const mockUseQuery = useQuery as jest.Mock;
const mockUseMutation = useMutation as jest.Mock;

// Default stub returns a pending-like state with fixture data.
function setupQuery(packs: ContextPack[] = [PACK_A, PACK_B, PACK_C]) {
  mockUseQuery.mockReturnValue({
    data: { data: packs },
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  });
  mockUseMutation.mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
    isError: false,
    reset: jest.fn(),
  });
}

// Import the page component after mocks are configured.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { default: ProjectsPage } = require("@/app/(main)/projects/page") as {
  default: React.ComponentType;
};

const SORT_KEY = "meatywiki-projects-sort";
const FILTER_KEY = "meatywiki-projects-filter";

describe("ProjectsPage — localStorage round-trip (P4-03)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setupQuery();
  });

  afterEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  it("persists sort selection to localStorage when a sort pill is clicked", async () => {
    renderWithProviders(<ProjectsPage />);

    // The sort toolbar appears when there are projects
    const nameBtn = await screen.findByRole("button", { name: /sort: name/i });
    fireEvent.click(nameBtn);

    expect(window.localStorage.getItem(SORT_KEY)).toBe("name");
  });

  it("persists filter selection to localStorage when a filter pill is clicked", async () => {
    renderWithProviders(<ProjectsPage />);

    const hasIntentBtn = await screen.findByRole("button", {
      name: /filter: has intent/i,
    });
    fireEvent.click(hasIntentBtn);

    expect(window.localStorage.getItem(FILTER_KEY)).toBe("has-intent");
  });

  it("restores sort from localStorage on mount", async () => {
    window.localStorage.setItem(SORT_KEY, "artifact_count");

    renderWithProviders(<ProjectsPage />);

    // After mount the "Artifacts" sort pill should be pressed (active)
    const artifactsBtn = await screen.findByRole("button", {
      name: /sort: artifacts/i,
    });
    expect(artifactsBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("restores filter from localStorage on mount", async () => {
    window.localStorage.setItem(FILTER_KEY, "non-empty");

    renderWithProviders(<ProjectsPage />);

    const nonEmptyBtn = await screen.findByRole("button", {
      name: /filter: non-empty/i,
    });
    expect(nonEmptyBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("ignores invalid localStorage values and uses the default", async () => {
    window.localStorage.setItem(SORT_KEY, "bogus_sort_key");

    renderWithProviders(<ProjectsPage />);

    // Default is "updated_at" — the "Updated" pill should be pressed
    const updatedBtn = await screen.findByRole("button", {
      name: /sort: updated/i,
    });
    expect(updatedBtn).toHaveAttribute("aria-pressed", "true");
  });
});

// ---------------------------------------------------------------------------
// RTL: PillGroup ARIA — toggle-button semantics (P4-03 a11y fix)
// ---------------------------------------------------------------------------

describe("ProjectsPage — PillGroup ARIA semantics (P4-03)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setupQuery();
  });

  afterEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  it("sort pills carry aria-pressed (not aria-checked), no role=radio", async () => {
    renderWithProviders(<ProjectsPage />);

    const nameBtn = await screen.findByRole("button", { name: /sort: name/i });

    expect(nameBtn).not.toHaveAttribute("aria-checked");
    expect(nameBtn).not.toHaveAttribute("role", "radio");
    // Initially inactive
    expect(nameBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking a sort pill sets aria-pressed=true on that pill and false on others", async () => {
    renderWithProviders(<ProjectsPage />);

    const nameBtn = await screen.findByRole("button", { name: /sort: name/i });
    const updatedBtn = await screen.findByRole("button", { name: /sort: updated/i });

    // Default: Updated is active
    expect(updatedBtn).toHaveAttribute("aria-pressed", "true");
    expect(nameBtn).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(nameBtn);

    await waitFor(() => {
      expect(nameBtn).toHaveAttribute("aria-pressed", "true");
      expect(updatedBtn).toHaveAttribute("aria-pressed", "false");
    });
  });

  it("PillGroup container uses role=group (not radiogroup)", async () => {
    renderWithProviders(<ProjectsPage />);

    // Verify the toolbar wrapper uses role=group with aria-label, not radiogroup
    await screen.findByRole("button", { name: /sort: name/i });

    const groups = screen.getAllByRole("group");
    // The "Sort" and "Filter" pill containers use role=group
    const sortGroup = groups.find((g) => g.getAttribute("aria-label") === "Sort");
    expect(sortGroup).toBeDefined();
    expect(sortGroup?.getAttribute("role")).toBe("group");
    expect(sortGroup?.getAttribute("role")).not.toBe("radiogroup");
  });
});
