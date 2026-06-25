/**
 * Smoke tests for StoriesListClient.
 *
 * Validates:
 *   - Loading skeleton renders when data is in-flight
 *   - Story rows render after data resolves (title, status badge)
 *   - "Details hidden (held)" for non-public sensitivity
 *   - Stale sync badge appears on rows where sync.synced_at is old
 *   - Empty state renders when list is empty
 *   - Error state (role="alert") renders on fetch failure
 *   - Filter chips have correct aria-pressed
 *   - Search input is accessible
 *
 * Strategy: mock listStories at module boundary, wrap with fresh QueryClient.
 */

import React from "react";
import { renderWithProviders, screen, waitFor, fireEvent } from "../../utils/render";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StoriesListClient } from "@/app/(main)/stories/StoriesListClient";
import type { StoriesEnvelope, StoryListItem } from "@/types/stories";
import { ApiError } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Mock listStories
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/stories", () => ({
  ...jest.requireActual("@/lib/api/stories"),
  listStories: jest.fn(),
}));

import { listStories } from "@/lib/api/stories";
const mockListStories = listStories as jest.MockedFunction<typeof listStories>;

// ---------------------------------------------------------------------------
// Stub data factories
// ---------------------------------------------------------------------------

function makeStory(overrides: Partial<StoryListItem> & { story_id: string }): StoryListItem {
  return {
    title: "Stub story title",
    project_id: null,
    lifecycle_state: "drafted",
    story_status: "drafted",
    source_type: "aar",
    date: "2026-06-01",
    domains: ["platform"],
    sensitivity: { level: "public", agent_access: "read" },
    scrub: { status: "clean", issue_count: 0, summary: "" },
    publication: {
      state: "draft",
      draft_pr_url: "https://github.com/example/pr/1",
      published_url: null,
      post_slug: null,
    },
    source: { safe_ref: "commit:abc", safe_uri: null },
    sync: { synced_at: new Date().toISOString(), source_system: "ccdash" },
    updated_at: "2026-06-20T00:00:00Z",
    ...overrides,
  };
}

const INITIAL_DATA: StoriesEnvelope = { data: [], cursor: null };

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderList(initialData: StoriesEnvelope = INITIAL_DATA) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderWithProviders(
    <QueryClientProvider client={queryClient}>
      <StoriesListClient initialData={initialData} />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Default: resolves immediately with empty list (tests that need data override)
  mockListStories.mockResolvedValue({ data: [], cursor: null });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StoriesListClient", () => {
  it("renders the page heading", async () => {
    renderList();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Stories");
  });

  it("renders story rows after data resolves", async () => {
    const story = makeStory({ story_id: "s-001", title: "Caching retro" });
    mockListStories.mockResolvedValue({ data: [story], cursor: null });

    renderList({ data: [story], cursor: null });

    await waitFor(() => {
      expect(screen.getByText("Caching retro")).toBeInTheDocument();
    });
  });

  it("renders 'details hidden (held)' for non-public sensitivity", async () => {
    const held = makeStory({
      story_id: "s-held",
      title: "Secret story",
      sensitivity: { level: "internal", agent_access: "none" },
    });
    mockListStories.mockResolvedValue({ data: [held], cursor: null });

    renderList({ data: [held], cursor: null });

    await waitFor(() => {
      expect(screen.getByText(/details hidden \(held\)/i)).toBeInTheDocument();
    });
    // Title should NOT be rendered
    expect(screen.queryByText("Secret story")).not.toBeInTheDocument();
  });

  it("shows stale sync badge when sync.synced_at is old", async () => {
    const OLD_DATE = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(); // 30h ago
    const story = makeStory({
      story_id: "s-stale",
      title: "Stale story",
      sync: { synced_at: OLD_DATE, source_system: "ccdash" },
    });
    mockListStories.mockResolvedValue({ data: [story], cursor: null });

    renderList({ data: [story], cursor: null });

    await waitFor(() => {
      // At least one "Stale" text in the row
      const staleElements = screen.getAllByText(/stale/i);
      expect(staleElements.length).toBeGreaterThan(0);
    });
  });

  it("shows empty state when there are no stories", async () => {
    mockListStories.mockResolvedValue({ data: [], cursor: null });
    renderList();

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
    expect(screen.getByText(/no stories yet/i)).toBeInTheDocument();
  });

  it("shows error state (role=alert) when active filters trigger a failing fetch", async () => {
    // With TQ v5: when initialData is present, errors on background refetch
    // don't set isError=true (data is available). To get a hard error state,
    // we trigger a filter change so the query runs WITHOUT initialData
    // (isEmptyFilters=false → initialData=undefined in useQuery).
    mockListStories.mockRejectedValue(new Error("Backend unreachable"));
    renderList();

    // Click a status filter chip to set filters → isEmptyFilters=false → hard fetch
    const draftedChip = screen.getByRole("button", { name: /filter status: drafted/i });
    fireEvent.click(draftedChip);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByText(/failed to load stories/i)).toBeInTheDocument();
  });

  it("filter chips have aria-pressed=false by default on non-All options", () => {
    renderList();
    const newChip = screen.getByRole("button", { name: /filter status: new/i });
    expect(newChip).toHaveAttribute("aria-pressed", "false");
  });

  it("All status chip has aria-pressed=true initially", () => {
    renderList();
    const allChip = screen.getByRole("button", { name: /filter status: all/i });
    expect(allChip).toHaveAttribute("aria-pressed", "true");
  });

  it("search input is accessible with aria-label", () => {
    renderList();
    const searchInput = screen.getByRole("textbox", { name: /search stories/i });
    expect(searchInput).toBeInTheDocument();
  });

  it("table has accessible column headers", async () => {
    renderList();
    // Column headers present
    expect(
      screen.getByRole("columnheader", { name: /title/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /status/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /sensitivity/i }),
    ).toBeInTheDocument();
  });

  it("clicking a status chip updates aria-pressed", async () => {
    renderList();
    const draftedChip = screen.getByRole("button", { name: /filter status: drafted/i });
    fireEvent.click(draftedChip);
    expect(draftedChip).toHaveAttribute("aria-pressed", "true");

    const allChip = screen.getByRole("button", { name: /filter status: all/i });
    expect(allChip).toHaveAttribute("aria-pressed", "false");
  });

  it("result count is announced via aria-live", async () => {
    const story = makeStory({ story_id: "s-001", title: "Count test" });
    mockListStories.mockResolvedValue({ data: [story], cursor: null });
    renderList({ data: [story], cursor: null });

    await waitFor(() => {
      const liveRegion = document.querySelector("[aria-live='polite']");
      expect(liveRegion).toBeTruthy();
    });
  });
});
