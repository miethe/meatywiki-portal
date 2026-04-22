/**
 * ArtifactDetailClient — Derivatives tab integration tests.
 *
 * Covers:
 *   - Source-type artifact (e.g. "raw_document") → Derivatives tab renders
 *   - Non-source artifact (e.g. "concept") → Derivatives tab NOT rendered
 *   - ?tab=derivatives + source-type → Derivatives tab active on mount
 *   - Clicking Derivatives tab triggers fetch and renders DerivativesList rows
 *
 * Mocking strategy:
 *   - `getArtifact` mocked at module boundary (mirrors artifact-detail.test.tsx)
 *   - `getDerivatives` mocked at module boundary for derivatives fetch assertions
 *   - `useArtifactWorkflowRuns` stubbed to avoid real fetch in WorkflowOSTab
 *   - `useArtifactEdges` stubbed to avoid real fetch in ContextRail
 *   - `next/navigation` overridden per-test via jest.mock factory for
 *     `useSearchParams` to control ?tab= query parameter
 *
 * library-source-rollup-v1 Phase 3 DETAIL-06.
 */

import React from "react";
import { renderWithProviders, screen, waitFor, fireEvent } from "../utils/render";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ArtifactDetailClient } from "@/app/(main)/artifact/[id]/ArtifactDetailClient";
import type { ArtifactDetail, DerivativeItem } from "@/types/artifact";
import { ApiError } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Mock getArtifact + getDerivatives at the module boundary
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/artifacts", () => ({
  ...jest.requireActual("@/lib/api/artifacts"),
  getArtifact: jest.fn(),
  getDerivatives: jest.fn(),
}));

import { getArtifact, getDerivatives } from "@/lib/api/artifacts";
const mockGetArtifact = getArtifact as jest.MockedFunction<typeof getArtifact>;
const mockGetDerivatives = getDerivatives as jest.MockedFunction<typeof getDerivatives>;

// ---------------------------------------------------------------------------
// Mock useArtifactWorkflowRuns (WorkflowOSTab dep)
// ---------------------------------------------------------------------------

jest.mock("@/hooks/useArtifactWorkflowRuns", () => ({
  useArtifactWorkflowRuns: jest.fn(() => ({
    runs: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Mock useArtifactEdges (ContextRail dep)
// ---------------------------------------------------------------------------

jest.mock("@/hooks/useArtifactEdges", () => ({
  ...jest.requireActual("@/hooks/useArtifactEdges"),
  useArtifactEdges: jest.fn(() => ({
    data: { artifact_id: "test", incoming: [], outgoing: [] },
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

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
// next/navigation mock — default: no ?tab= param.
// Individual tests override useSearchParams via jest.mocked().
// ---------------------------------------------------------------------------

// The global setup.ts already mocks next/navigation with useSearchParams
// returning new URLSearchParams(). We re-mock here so we can override per-test.
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), back: jest.fn(), forward: jest.fn() }),
  usePathname: () => "/",
  useSearchParams: jest.fn(() => new URLSearchParams()),
  redirect: jest.fn(),
}));

import { useSearchParams } from "next/navigation";
const mockUseSearchParams = useSearchParams as jest.MockedFunction<typeof useSearchParams>;

// ---------------------------------------------------------------------------
// Stub data
// ---------------------------------------------------------------------------

const SOURCE_ID = "source-artifact-001";
const CONCEPT_ID = "concept-artifact-001";

/** A source-type artifact — raw_document matches the raw_* prefix check */
const sourceArtifact: ArtifactDetail = {
  id: SOURCE_ID,
  workspace: "inbox",
  type: "raw_document",
  subtype: null,
  title: "Raw Source Document",
  status: "draft",
  schema_version: "1.0.0",
  created: "2026-04-01T00:00:00Z",
  updated: "2026-04-16T00:00:00Z",
  file_path: "raw/source-doc.md",
  metadata: null,
  summary: null,
  slug: null,
  content_hash: null,
  frontmatter_jsonb: null,
  raw_content: "# Source\n\nRaw source content.",
  compiled_content: null,
  draft_content: null,
  artifact_edges: null,
};

/** A derivative-type artifact — "concept" is not in SOURCE_TYPES */
const conceptArtifact: ArtifactDetail = {
  id: CONCEPT_ID,
  workspace: "library",
  type: "concept",
  subtype: null,
  title: "Concept Artifact",
  status: "active",
  schema_version: "1.0.0",
  created: "2026-04-02T00:00:00Z",
  updated: "2026-04-16T00:00:00Z",
  file_path: "wiki/concepts/concept-artifact.md",
  metadata: null,
  summary: "A compiled concept.",
  slug: "concept-artifact",
  content_hash: "def456",
  frontmatter_jsonb: null,
  raw_content: null,
  compiled_content: "<h1>Concept</h1>",
  draft_content: null,
  artifact_edges: null,
};

function makeDerivativeItem(
  overrides: Partial<DerivativeItem> = {},
): DerivativeItem {
  return {
    id: "deriv-001",
    artifact_type: "synthesis",
    title: "Synthesised derivative",
    updated_at: "2026-04-16T00:00:00Z",
    fidelity: "high",
    freshness: "current",
    verification_state: "verified",
    ...overrides,
  };
}

const stubDerivatives: DerivativeItem[] = [
  makeDerivativeItem({ id: "d1", title: "Derivative Alpha" }),
  makeDerivativeItem({ id: "d2", title: "Derivative Beta", artifact_type: "evidence" }),
  makeDerivativeItem({ id: "d3", title: "Derivative Gamma", artifact_type: "concept" }),
];

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderDetail(id: string) {
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
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Default: no query params
  mockUseSearchParams.mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>);

  // Default derivatives response: 3 items, no cursor
  mockGetDerivatives.mockResolvedValue({
    data: stubDerivatives,
    cursor: null,
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests — Tab visibility
// ---------------------------------------------------------------------------

describe("ArtifactDetailClient — Derivatives tab visibility", () => {
  it("shows Derivatives tab for a source-type artifact (raw_document)", async () => {
    mockGetArtifact.mockResolvedValue(sourceArtifact);

    renderDetail(SOURCE_ID);

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument(),
    );

    expect(screen.getByRole("tab", { name: /derivatives/i })).toBeInTheDocument();
  });

  it("does NOT show Derivatives tab for a non-source artifact (concept)", async () => {
    mockGetArtifact.mockResolvedValue(conceptArtifact);

    renderDetail(CONCEPT_ID);

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument(),
    );

    expect(screen.queryByRole("tab", { name: /derivatives/i })).not.toBeInTheDocument();
  });

  it("shows Derivatives tab for raw_note (another raw_ prefix type)", async () => {
    mockGetArtifact.mockResolvedValue({
      ...sourceArtifact,
      type: "raw_note",
      title: "Raw Note",
    });

    renderDetail(SOURCE_ID);

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument(),
    );

    expect(screen.getByRole("tab", { name: /derivatives/i })).toBeInTheDocument();
  });

  it("shows Derivatives tab for source_summary type", async () => {
    mockGetArtifact.mockResolvedValue({
      ...sourceArtifact,
      type: "source_summary",
      title: "Source Summary",
    });

    renderDetail(SOURCE_ID);

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument(),
    );

    expect(screen.getByRole("tab", { name: /derivatives/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — Deep-link ?tab=derivatives
// ---------------------------------------------------------------------------

describe("ArtifactDetailClient — ?tab=derivatives deep-link", () => {
  it("activates Derivatives tab on mount when ?tab=derivatives and artifact is source-type", async () => {
    mockGetArtifact.mockResolvedValue(sourceArtifact);
    // Simulate ?tab=derivatives query param
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("tab=derivatives") as ReturnType<typeof useSearchParams>,
    );

    renderDetail(SOURCE_ID);

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument(),
    );

    const derivativesTab = screen.getByRole("tab", { name: /derivatives/i });
    // Wait for the useEffect to fire and switch the tab
    await waitFor(() =>
      expect(derivativesTab).toHaveAttribute("aria-selected", "true"),
    );
  });

  it("does NOT activate Derivatives tab on ?tab=derivatives when artifact is NOT source-type", async () => {
    mockGetArtifact.mockResolvedValue(conceptArtifact);
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("tab=derivatives") as ReturnType<typeof useSearchParams>,
    );

    renderDetail(CONCEPT_ID);

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument(),
    );

    // Derivatives tab should not exist at all
    expect(screen.queryByRole("tab", { name: /derivatives/i })).not.toBeInTheDocument();
    // Source tab should still be active (default)
    expect(screen.getByRole("tab", { name: /source/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("stays on Source tab when ?tab param is something else", async () => {
    mockGetArtifact.mockResolvedValue(sourceArtifact);
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("tab=knowledge") as ReturnType<typeof useSearchParams>,
    );

    renderDetail(SOURCE_ID);

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument(),
    );

    // "tab=knowledge" does not match the deep-link condition (only "derivatives" triggers it)
    // Source tab remains active (the useEffect only checks for "derivatives")
    // Knowledge tab click would activate it, but the param alone doesn't drive that logic
    expect(screen.getByRole("tab", { name: /source/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — Tab click triggers fetch and renders DerivativesList
// ---------------------------------------------------------------------------

describe("ArtifactDetailClient — Derivatives tab click", () => {
  it("clicking Derivatives tab renders the derivatives list rows", async () => {
    mockGetArtifact.mockResolvedValue(sourceArtifact);

    renderDetail(SOURCE_ID);

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument(),
    );

    // Derivatives tab is present — click it
    const derivativesTab = screen.getByRole("tab", { name: /derivatives/i });
    fireEvent.click(derivativesTab);

    expect(derivativesTab).toHaveAttribute("aria-selected", "true");

    // DerivativesPanel mounts → useDerivatives fires → DerivativesList renders
    await waitFor(() =>
      expect(screen.getByText("Derivative Alpha")).toBeInTheDocument(),
    );

    // All 3 items should be visible
    expect(screen.getByText("Derivative Beta")).toBeInTheDocument();
    expect(screen.getByText("Derivative Gamma")).toBeInTheDocument();
  });

  it("renders empty state when derivatives fetch returns 0 items", async () => {
    mockGetArtifact.mockResolvedValue(sourceArtifact);
    mockGetDerivatives.mockResolvedValue({ data: [], cursor: null });

    renderDetail(SOURCE_ID);

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("tab", { name: /derivatives/i }));

    await waitFor(() =>
      expect(screen.getByText("No derivatives yet.")).toBeInTheDocument(),
    );
  });

  it("renders error retry button when derivatives fetch fails with 5xx", async () => {
    mockGetArtifact.mockResolvedValue(sourceArtifact);
    mockGetDerivatives.mockRejectedValue(
      new ApiError(500, { detail: "Internal server error" }, "API error 500"),
    );

    renderDetail(SOURCE_ID);

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("tab", { name: /derivatives/i }));

    await waitFor(() =>
      expect(screen.getByText("Failed to load derivatives")).toBeInTheDocument(),
    );

    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("renders empty state gracefully when derivatives fetch returns 404 (isNotFound)", async () => {
    mockGetArtifact.mockResolvedValue(sourceArtifact);
    mockGetDerivatives.mockRejectedValue(
      new ApiError(404, { detail: "not_a_source" }, "API error 404"),
    );

    renderDetail(SOURCE_ID);

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("tab", { name: /derivatives/i }));

    // 404 is treated as "no derivatives" — empty state shown gracefully
    await waitFor(() =>
      expect(screen.getByText("No derivatives yet.")).toBeInTheDocument(),
    );
  });
});
