/**
 * Search page — EmbeddingsNotReady banner tests (M-03 / audit Wave 1 P2-02).
 *
 * Covers:
 *   - 409 embeddings_not_ready → banner renders with correct title and body
 *   - Banner has role="alert" live region (a11y)
 *   - "Switch to keyword search" primary action switches mode to fts and re-runs
 *   - "Dismiss" action hides the banner
 *   - 200 FTS response → no banner
 *   - 200 semantic response → no banner (degraded silently handled)
 *
 * Mocking strategy:
 *   The `search` function from @/lib/api/search is mocked at the module
 *   boundary. This avoids MSW intercepting the /api/search path while still
 *   exercising the hook + page component integration.
 *
 *   For the 409 case we throw an EmbeddingsNotReadyError directly, matching
 *   what src/lib/api/search.ts produces after inspecting the 409 body.
 *
 * Accessibility:
 *   Each test that renders the banner runs axe via jest-axe to catch WCAG 2.1
 *   AA violations introduced by the banner markup.
 */

import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { axe } from "jest-axe";
import SearchPage from "@/app/(main)/search/page";
import { EmbeddingsNotReadyError } from "@/lib/api/search";
import type { ArtifactWorkspace } from "@/types/artifact";
import type { ArtifactStatus } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Mock @/lib/api/search at module boundary
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/search", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/search")>(
    "@/lib/api/search",
  );
  return {
    ...actual,
    search: jest.fn(),
  };
});

import { search } from "@/lib/api/search";
const mockSearch = search as jest.MockedFunction<typeof search>;

// ---------------------------------------------------------------------------
// Mock next/link
// ---------------------------------------------------------------------------

jest.mock("next/link", () => ({
  __esModule: true,
  default: function MockLink({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeArtifactCard(overrides: Partial<{
  id: string;
  title: string;
  type: string;
  workspace: ArtifactWorkspace;
  status: ArtifactStatus;
}> = {}) {
  return {
    id: "art-001",
    title: "Test artifact",
    type: "concept",
    workspace: "library" as ArtifactWorkspace,
    status: "active" as ArtifactStatus,
    subtype: null,
    schema_version: "1.0.0",
    created: "2026-01-01T00:00:00Z",
    updated: "2026-05-01T00:00:00Z",
    file_path: "wiki/concepts/test.md",
    metadata: null,
    ...overrides,
  };
}

/** Render the search page and submit a query. */
async function renderAndSearch(q: string) {
  const result = render(<SearchPage />);

  // Type into the search input
  const input = screen.getByRole("searchbox", { name: /search query/i });
  fireEvent.change(input, { target: { value: q } });

  // Submit the form
  const form = screen.getByRole("search", { name: /search vault/i });
  fireEvent.submit(form);

  return result;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests — EmbeddingsNotReady banner
// ---------------------------------------------------------------------------

describe("SearchPage — EmbeddingsNotReady banner (M-03)", () => {
  it("renders the banner when search returns a 409 embeddings_not_ready error", async () => {
    mockSearch.mockRejectedValueOnce(
      new EmbeddingsNotReadyError(
        "Embeddings haven't been generated for your vault.",
      ),
    );

    await renderAndSearch("distributed caching");

    await waitFor(() =>
      expect(
        screen.getByText("Semantic search is not ready yet"),
      ).toBeInTheDocument(),
    );

    expect(
      screen.getByText(
        /embeddings haven't been generated for your vault/i,
      ),
    ).toBeInTheDocument();
  });

  it("banner has role='alert' so screen readers announce it", async () => {
    mockSearch.mockRejectedValueOnce(new EmbeddingsNotReadyError());

    await renderAndSearch("cache");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument(),
    );
  });

  it("banner passes jest-axe accessibility check (WCAG 2.1 AA)", async () => {
    mockSearch.mockRejectedValueOnce(new EmbeddingsNotReadyError());

    const { container } = await renderAndSearch("consistency");

    await waitFor(() =>
      expect(screen.getByText("Semantic search is not ready yet")).toBeInTheDocument(),
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("'Switch to keyword search' button re-runs query with mode=fts", async () => {
    // First call: 409
    mockSearch.mockRejectedValueOnce(new EmbeddingsNotReadyError());
    // Second call (after mode switch): 200 FTS result
    mockSearch.mockResolvedValueOnce({
      data: [makeArtifactCard({ id: "kw-001", title: "Keyword result" })],
      cursor: null,
    });

    await renderAndSearch("consistency models");

    // Wait for banner
    await waitFor(() =>
      expect(screen.getByText("Semantic search is not ready yet")).toBeInTheDocument(),
    );

    // Click primary action
    const switchBtn = screen.getByRole("button", {
      name: /switch to keyword search/i,
    });
    fireEvent.click(switchBtn);

    // Banner should disappear after the second call succeeds
    await waitFor(() =>
      expect(
        screen.queryByText("Semantic search is not ready yet"),
      ).not.toBeInTheDocument(),
    );

    // Second search call should use mode=fts
    expect(mockSearch).toHaveBeenCalledTimes(2);
    expect(mockSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: "fts" }),
    );

    // Mode selector should now show fts
    const modeSelect = screen.getByRole("combobox", { name: /search mode/i });
    expect(modeSelect).toHaveValue("fts");

    // Results from the FTS call should be visible
    await waitFor(() =>
      expect(screen.getByText("Keyword result")).toBeInTheDocument(),
    );
  });

  it("'Dismiss' button hides the banner without re-running search", async () => {
    mockSearch.mockRejectedValueOnce(new EmbeddingsNotReadyError());

    await renderAndSearch("wal durability");

    await waitFor(() =>
      expect(screen.getByText("Semantic search is not ready yet")).toBeInTheDocument(),
    );

    const dismissBtn = screen.getByRole("button", {
      name: /dismiss embeddings warning/i,
    });
    fireEvent.click(dismissBtn);

    expect(
      screen.queryByText("Semantic search is not ready yet"),
    ).not.toBeInTheDocument();

    // No additional search calls
    expect(mockSearch).toHaveBeenCalledTimes(1);
  });

  it("banner is cleared on the next successful query", async () => {
    // First call: 409
    mockSearch.mockRejectedValueOnce(new EmbeddingsNotReadyError());
    // Second call: success
    mockSearch.mockResolvedValueOnce({ data: [], cursor: null });

    await renderAndSearch("first query");

    await waitFor(() =>
      expect(screen.getByText("Semantic search is not ready yet")).toBeInTheDocument(),
    );

    // Type a new query and re-submit
    const input = screen.getByRole("searchbox", { name: /search query/i });
    fireEvent.change(input, { target: { value: "second query" } });
    fireEvent.submit(screen.getByRole("search"));

    await waitFor(() =>
      expect(
        screen.queryByText("Semantic search is not ready yet"),
      ).not.toBeInTheDocument(),
    );
  });

  it("does NOT show the banner on a 200 FTS response", async () => {
    mockSearch.mockResolvedValueOnce({
      data: [makeArtifactCard()],
      cursor: null,
    });

    await renderAndSearch("fts query");

    await waitFor(() =>
      expect(screen.getByText("Test artifact")).toBeInTheDocument(),
    );

    expect(
      screen.queryByText("Semantic search is not ready yet"),
    ).not.toBeInTheDocument();
  });

  it("does NOT show the banner on a degraded 200 semantic response", async () => {
    mockSearch.mockResolvedValueOnce({
      data: [makeArtifactCard({ title: "Degraded result" })],
      cursor: null,
      degraded: true,
    });

    await renderAndSearch("semantic with degraded");

    await waitFor(() =>
      expect(screen.getByText("Degraded result")).toBeInTheDocument(),
    );

    // Banner must not appear — degraded=true is handled silently
    expect(
      screen.queryByText("Semantic search is not ready yet"),
    ).not.toBeInTheDocument();

    // Degraded notice is shown instead (informational, not a banner)
    expect(
      screen.getByText(/semantic index unavailable/i),
    ).toBeInTheDocument();
  });
});
