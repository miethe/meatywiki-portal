/**
 * Artifact Detail screen smoke tests (P3-06).
 *
 * Validates that:
 * - The loading skeleton renders while the query is in-flight
 * - After data resolves, artifact title and metadata render correctly
 * - Tab switching works: Source / Knowledge / Draft / Workflow OS
 * - Source reader displays raw_content
 * - Draft reader displays empty state when draft_content is null
 * - Workflow OS tab renders Phase 4 placeholder
 * - Action buttons are present and aria-disabled
 * - 404 error renders the NotFound state
 * - Generic server error renders the error state with retry button
 *
 * Mocking strategy:
 *   Mock `getArtifact` at the module boundary — avoids jsdom fetch/MSW
 *   URL routing issues (relative URLs vs absolute interceptor URLs).
 */

import React from "react";
import { renderWithProviders, screen, waitFor, fireEvent } from "../utils/render";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ArtifactDetailClient } from "@/app/(main)/artifact/[id]/ArtifactDetailClient";
import type { ArtifactDetail } from "@/types/artifact";
import { ApiError } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Mock getArtifact at the module boundary
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/artifacts", () => ({
  ...jest.requireActual("@/lib/api/artifacts"),
  getArtifact: jest.fn(),
}));

import { getArtifact } from "@/lib/api/artifacts";
const mockGetArtifact = getArtifact as jest.MockedFunction<typeof getArtifact>;

// ---------------------------------------------------------------------------
// Stub detail data
// ---------------------------------------------------------------------------

const TEST_ID = "01HXYZ0000000000000000001";

const stubDetail: ArtifactDetail = {
  id: TEST_ID,
  workspace: "inbox",
  type: "note",
  subtype: null,
  title: "Stub artifact",
  status: "active",
  schema_version: "1.0.0",
  created: "2026-04-01T00:00:00Z",
  updated: "2026-04-16T00:00:00Z",
  file_path: "raw/stub-artifact.md",
  metadata: { fidelity: "high", freshness: "current", verification_state: "verified" },
  summary: "A stub summary for the artifact.",
  slug: "stub-artifact",
  content_hash: "abc123",
  frontmatter_jsonb: { tags: ["test", "stub"], schema_version: "1.0.0" },
  raw_content: "# Stub\n\nRaw content here.",
  compiled_content: "<h1>Stub</h1><p>Compiled content here.</p>",
  draft_content: null,
  artifact_edges: null,
};

// ---------------------------------------------------------------------------
// Default: getArtifact resolves with stubDetail
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockGetArtifact.mockResolvedValue(stubDetail);
});

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderDetail(id = TEST_ID) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderWithProviders(
    <QueryClientProvider client={queryClient}>
      <ArtifactDetailClient id={id} />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ArtifactDetailClient", () => {
  it("renders loading skeleton on mount before data resolves", () => {
    // Freeze in loading state with a never-resolving promise
    mockGetArtifact.mockReturnValue(new Promise(() => {}));
    renderDetail();
    // Skeleton has aria-busy="true" and aria-label="Loading artifact"
    const skeleton = document.querySelector("[aria-busy='true'][aria-label='Loading artifact']");
    expect(skeleton).toBeTruthy();
  });

  it("renders artifact title after data resolves", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Stub artifact");
  });

  it("renders all four tabs", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: /source/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /knowledge/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /draft/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /workflow os/i })).toBeInTheDocument();
  });

  it("Source tab is active by default and shows raw content", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });
    const sourceTab = screen.getByRole("tab", { name: /source/i });
    expect(sourceTab).toHaveAttribute("aria-selected", "true");
    // raw_content: "# Stub\n\nRaw content here."
    expect(screen.getByText(/Raw content here/)).toBeInTheDocument();
  });

  it("switches to Knowledge tab and updates aria-selected", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("tab", { name: /knowledge/i }));
    expect(screen.getByRole("tab", { name: /knowledge/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: /source/i })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("Draft tab shows empty state when draft_content is null", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("tab", { name: /draft/i }));
    await waitFor(() => {
      expect(screen.getByText(/No draft content/i)).toBeInTheDocument();
    });
  });

  it("Workflow OS tab shows Phase 4 placeholder", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("tab", { name: /workflow os/i }));
    await waitFor(() => {
      expect(screen.getByText(/Coming in Phase 4/i)).toBeInTheDocument();
    });
  });

  it("action buttons are present and aria-disabled", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });
    const promoteBtn = screen.getByRole("button", { name: /promote artifact/i });
    expect(promoteBtn).toBeInTheDocument();
    expect(promoteBtn).toHaveAttribute("aria-disabled", "true");

    const compileBtn = screen.getByRole("button", { name: /trigger compilation/i });
    expect(compileBtn).toHaveAttribute("aria-disabled", "true");
  });

  it("renders tags from frontmatter_jsonb in sidebar", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });
    // Tags from frontmatter_jsonb: ["test", "stub"]
    expect(screen.getByText("test")).toBeInTheDocument();
    expect(screen.getByText("stub")).toBeInTheDocument();
  });

  it("renders 404 state when artifact is not found", async () => {
    mockGetArtifact.mockRejectedValue(
      new ApiError(404, { detail: "not_found" }, "API error 404"),
    );
    renderDetail("nonexistent-id");
    await waitFor(() => {
      expect(screen.getByText(/Artifact not found/i)).toBeInTheDocument();
    });
  });

  it("renders error state on server error with retry button", async () => {
    mockGetArtifact.mockRejectedValue(
      new ApiError(500, { detail: "Internal server error" }, "API error 500"),
    );
    renderDetail("error-id");
    await waitFor(() => {
      expect(screen.getByText(/Failed to load artifact/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
