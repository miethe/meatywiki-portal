/**
 * ArtifactDetailClient — action button wiring tests (P3-06).
 *
 * Covers:
 *   - Promote: calls POST /api/artifacts/:id/promote; shows success toast
 *   - Promote: shows error toast on failure
 *   - Link Related: opens the link dialog; calls POST /api/artifacts/:id/link
 *   - Link Related: shows success toast on confirm; closes dialog
 *   - Link Related: shows error toast on failure
 *   - Request Review: calls POST /api/artifacts/:id/review; shows success toast
 *   - Request Review: shows error toast on failure
 *   - Action stubs (Add Note): present but do not call any API
 *
 * Mocking strategy:
 *   - Mock promoteArtifact, linkArtifact, requestReview at the API boundary.
 *   - Mock getArtifact (useArtifact hook relies on it) to supply stub data.
 *   - Suppress other hooks that fire network calls in jsdom.
 */

import React from "react";
import { renderWithProviders, screen, waitFor } from "../utils/render";
import { userEvent } from "../utils/userEvent";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ArtifactDetailClient } from "@/app/(main)/artifact/[id]/ArtifactDetailClient";
import * as artifactsApi from "@/lib/api/artifacts";
import type { ArtifactDetail } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/artifacts", () => ({
  ...jest.requireActual("@/lib/api/artifacts"),
  getArtifact: jest.fn(),
  promoteArtifact: jest.fn(),
  linkArtifact: jest.fn(),
  requestReview: jest.fn(),
  getDerivatives: jest.fn(),
}));

jest.mock("@/hooks/useArtifactWorkflowRuns", () => ({
  useArtifactWorkflowRuns: jest.fn(() => ({
    runs: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

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

jest.mock("@/hooks/useArtifactBacklinks", () => ({
  ...jest.requireActual("@/hooks/useArtifactBacklinks"),
  useArtifactBacklinks: jest.fn(() => ({
    incoming: [],
    outgoing: [],
    items: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    isFallback: false,
  })),
}));

jest.mock("@/hooks/useArtifactActivity", () => ({
  useArtifactActivity: jest.fn(() => ({
    activity: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

jest.mock("@/hooks/useContradictionCount", () => ({
  useContradictionCount: jest.fn(() => ({
    count: 0,
    isLoading: false,
    isError: false,
    error: null,
  })),
}));

jest.mock("@/hooks/useCompileArtifact", () => ({
  useCompileArtifact: jest.fn(() => ({
    compile: jest.fn(),
    isCompiling: false,
    error: null,
  })),
}));

jest.mock("@/hooks/useLineage", () => ({
  useLineage: jest.fn(() => ({
    data: null,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

jest.mock("@/hooks/useQualityGates", () => ({
  useQualityGates: jest.fn(() => ({
    gates: null,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: jest.fn(() => new URLSearchParams()),
  redirect: jest.fn(),
}));

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

// @miethe/ui ArticleViewer — plain passthrough to avoid heavy dep
jest.mock("@miethe/ui", () => ({
  ArticleViewer: ({ content }: { content: string }) => (
    <div data-testid="article-viewer">{content}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Access mocked functions
// ---------------------------------------------------------------------------

const mockGetArtifact = artifactsApi.getArtifact as jest.Mock;
const mockPromote = artifactsApi.promoteArtifact as jest.Mock;
const mockLink = artifactsApi.linkArtifact as jest.Mock;
const mockRequestReview = artifactsApi.requestReview as jest.Mock;

// ---------------------------------------------------------------------------
// Stub data
// ---------------------------------------------------------------------------

const TEST_ID = "01HXYZ0000000000000000099";

const stubDetail: ArtifactDetail = {
  id: TEST_ID,
  workspace: "library",
  type: "concept",
  subtype: null,
  title: "Actions Test Artifact",
  status: "active",
  schema_version: "1.0.0",
  created: "2026-04-01T00:00:00Z",
  updated: "2026-04-21T00:00:00Z",
  file_path: "wiki/concepts/actions-test.md",
  metadata: null,
  summary: null,
  slug: "actions-test",
  content_hash: "xyz789",
  frontmatter_jsonb: {},
  raw_content: "# Actions Test Artifact",
  compiled_content: "<h1>Actions Test Artifact</h1>",
  draft_content: null,
  artifact_edges: null,
};

// ---------------------------------------------------------------------------
// Render helper
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
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockGetArtifact.mockResolvedValue(stubDetail);
});

// ---------------------------------------------------------------------------
// Wait for artifact to load
// ---------------------------------------------------------------------------

async function waitForArtifact() {
  await waitFor(() => {
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
}

// ===========================================================================
// 1. Promote action
// ===========================================================================

describe("ArtifactDetailClient — Promote action", () => {
  it("calls promoteArtifact with the correct artifact id", async () => {
    const user = userEvent.setup();
    mockPromote.mockResolvedValue({ lifecycle_stage: "archive", artifact_id: TEST_ID });
    renderDetail();
    await waitForArtifact();

    await user.click(
      screen.getByRole("button", { name: /promote artifact to archive lifecycle stage/i }),
    );

    await waitFor(() => {
      expect(mockPromote).toHaveBeenCalledWith(TEST_ID);
    });
  });

  it("shows a success toast after promote succeeds", async () => {
    const user = userEvent.setup();
    mockPromote.mockResolvedValue({ lifecycle_stage: "archive", artifact_id: TEST_ID });
    renderDetail();
    await waitForArtifact();

    await user.click(
      screen.getByRole("button", { name: /promote artifact to archive lifecycle stage/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/promoted to archive/i)).toBeInTheDocument();
    });
  });

  it("shows an error toast when promote fails", async () => {
    const user = userEvent.setup();
    mockPromote.mockRejectedValue(new Error("Promote failed"));
    renderDetail();
    await waitForArtifact();

    await user.click(
      screen.getByRole("button", { name: /promote artifact to archive lifecycle stage/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/promote failed/i)).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 2. Link Related action
// ===========================================================================

describe("ArtifactDetailClient — Link Related action", () => {
  it("opens the link dialog when 'Link Related' is clicked", async () => {
    const user = userEvent.setup();
    renderDetail();
    await waitForArtifact();

    await user.click(
      screen.getByRole("button", {
        name: /link this artifact to a related artifact/i,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: /link to artifact/i }),
      ).toBeInTheDocument();
    });
  });

  it("calls linkArtifact with the entered target id on confirm", async () => {
    const user = userEvent.setup();
    mockLink.mockResolvedValue({ data: { status: "linked" } });
    renderDetail();
    await waitForArtifact();

    await user.click(
      screen.getByRole("button", {
        name: /link this artifact to a related artifact/i,
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/target artifact id/i), "other-artifact-001");
    await user.click(screen.getByRole("button", { name: /^link$/i }));

    await waitFor(() => {
      expect(mockLink).toHaveBeenCalledWith(
        TEST_ID,
        expect.objectContaining({ target_id: "other-artifact-001" }),
      );
    });
  });

  it("shows a success toast and closes the dialog after link succeeds", async () => {
    const user = userEvent.setup();
    mockLink.mockResolvedValue({ data: { status: "linked" } });
    renderDetail();
    await waitForArtifact();

    await user.click(
      screen.getByRole("button", {
        name: /link this artifact to a related artifact/i,
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/target artifact id/i), "other-001");
    await user.click(screen.getByRole("button", { name: /^link$/i }));

    await waitFor(() => {
      expect(screen.getByText(/link created successfully/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("shows an error toast when link fails", async () => {
    const user = userEvent.setup();
    mockLink.mockRejectedValue(new Error("Link failed"));
    renderDetail();
    await waitForArtifact();

    await user.click(
      screen.getByRole("button", {
        name: /link this artifact to a related artifact/i,
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/target artifact id/i), "bad-id");
    await user.click(screen.getByRole("button", { name: /^link$/i }));

    await waitFor(() => {
      expect(screen.getByText(/link failed/i)).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 3. Request Review action
// ===========================================================================

describe("ArtifactDetailClient — Request Review action", () => {
  it("calls requestReview with the artifact id", async () => {
    const user = userEvent.setup();
    mockRequestReview.mockResolvedValue({ id: "review-stub" });
    renderDetail();
    await waitForArtifact();

    await user.click(
      screen.getByRole("button", {
        name: /add this artifact to the review queue/i,
      }),
    );

    await waitFor(() => {
      expect(mockRequestReview).toHaveBeenCalledWith(TEST_ID);
    });
  });

  it("shows a success toast after review is queued", async () => {
    const user = userEvent.setup();
    mockRequestReview.mockResolvedValue({ id: "review-stub" });
    renderDetail();
    await waitForArtifact();

    await user.click(
      screen.getByRole("button", {
        name: /add this artifact to the review queue/i,
      }),
    );

    await waitFor(() => {
      expect(screen.getByText(/added to review queue/i)).toBeInTheDocument();
    });
  });

  it("shows an error toast when requestReview fails", async () => {
    const user = userEvent.setup();
    mockRequestReview.mockRejectedValue(new Error("Request review failed"));
    renderDetail();
    await waitForArtifact();

    await user.click(
      screen.getByRole("button", {
        name: /add this artifact to the review queue/i,
      }),
    );

    await waitFor(() => {
      expect(screen.getByText(/request review failed/i)).toBeInTheDocument();
    });
  });

  it("disables the button after a successful review request", async () => {
    const user = userEvent.setup();
    mockRequestReview.mockResolvedValue({ id: "review-stub" });
    renderDetail();
    await waitForArtifact();

    await user.click(
      screen.getByRole("button", {
        name: /add this artifact to the review queue/i,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /review already queued/i }),
      ).toBeDisabled();
    });
  });
});

// ===========================================================================
// 4. Action stubs (Add Note)
// ===========================================================================

describe("ArtifactDetailClient — stub actions", () => {
  it("renders the 'Add Note' button without calling any API on click", async () => {
    const user = userEvent.setup();
    renderDetail();
    await waitForArtifact();

    const addNoteBtn = screen.getByRole("button", {
      name: /add a note to this artifact/i,
    });
    expect(addNoteBtn).toBeInTheDocument();

    await user.click(addNoteBtn);

    // No API should have been called
    expect(mockPromote).not.toHaveBeenCalled();
    expect(mockLink).not.toHaveBeenCalled();
    expect(mockRequestReview).not.toHaveBeenCalled();
  });
});
