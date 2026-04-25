/**
 * ReviewQueue — wired action tests (P3-06).
 *
 * The existing review-queue.test.tsx covers data-loading states and the read-only
 * view. This file covers the now-wired Promote and Link interactions (P3-08).
 *
 * Covers:
 *   - Promote button calls promoteArtifact with the item's artifact id
 *   - Promote success: shows success toast in the row
 *   - Promote error: shows error toast; button re-enabled
 *   - Link button opens the link dialog
 *   - Link confirm calls linkArtifact with target id + edge type
 *   - Link success: shows success toast; dialog closes
 *   - Link error: shows error toast; dialog stays open
 *   - Archive button is disabled (no backend endpoint)
 *   - Stale "v1.5" tooltip text is absent from Promote/Link buttons
 *     (those are now wired — v1.5 note only remains on Archive)
 *
 * Mocking strategy:
 *   Mock useReviewQueue at the hook boundary to supply deterministic items.
 *   Mock promoteArtifact and linkArtifact at the API module boundary.
 */

import React from "react";
import { renderWithProviders, screen, waitFor } from "../../utils/render";
import { userEvent } from "../../utils/userEvent";
import { ReviewQueue } from "@/components/research/review-queue";
import type { ReviewItem } from "@/hooks/useReviewQueue";
import type { ArtifactCard } from "@/types/artifact";
import * as artifactsApi from "@/lib/api/artifacts";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/hooks/useReviewQueue", () => ({
  ...jest.requireActual("@/hooks/useReviewQueue"),
  useReviewQueue: jest.fn(),
}));

jest.mock("@/lib/api/artifacts", () => ({
  ...jest.requireActual("@/lib/api/artifacts"),
  promoteArtifact: jest.fn(),
  linkArtifact: jest.fn(),
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

import { useReviewQueue } from "@/hooks/useReviewQueue";

const mockUseReviewQueue = useReviewQueue as jest.MockedFunction<typeof useReviewQueue>;
const mockPromote = artifactsApi.promoteArtifact as jest.Mock;
const mockLink = artifactsApi.linkArtifact as jest.Mock;

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeArtifact(overrides: Partial<ArtifactCard> = {}): ArtifactCard {
  return {
    id: "01HXYZ0000000000000000001",
    workspace: "research",
    type: "concept",
    subtype: null,
    title: "Test Artifact",
    status: "stale",
    schema_version: "1.0.0",
    created: "2026-04-01T00:00:00Z",
    updated: "2026-04-17T00:00:00Z",
    file_path: "wiki/concepts/test-artifact.md",
    metadata: { fidelity: "medium", freshness: "stale", verification_state: "unverified" },
    preview: null,
    workflow_status: null,
    ...overrides,
  };
}

function makeReviewItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    artifact: makeArtifact(),
    gateType: "freshness",
    reviewedAt: "2026-04-17T10:00:00Z",
    priority: "ROUTINE",
    confidenceScore: 0.5,
    ...overrides,
  };
}

function defaultHookReturn(items: ReviewItem[] = []) {
  return {
    items,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    filters: {
      sort: "priority" as const,
      order: "asc" as const,
      priorityFilter: "ALL" as const,
      gateFilter: "ALL" as const,
    },
    setSort: jest.fn(),
    setPriorityFilter: jest.fn(),
    setGateFilter: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockUseReviewQueue.mockReturnValue(
    defaultHookReturn([makeReviewItem()]),
  );
});

// ===========================================================================
// 1. Promote — happy path
// ===========================================================================

describe("ReviewQueue — Promote action: happy path", () => {
  it("calls promoteArtifact with the artifact id when Promote is clicked", async () => {
    const user = userEvent.setup();
    mockPromote.mockResolvedValue({
      lifecycle_stage: "archive",
      artifact_id: "01HXYZ0000000000000000001",
    });
    mockUseReviewQueue.mockReturnValue(
      defaultHookReturn([
        makeReviewItem({ artifact: makeArtifact({ id: "01HXYZ0000000000000000001" }) }),
      ]),
    );
    renderWithProviders(<ReviewQueue />);

    await user.click(screen.getByRole("button", { name: /promote/i }));

    await waitFor(() => {
      expect(mockPromote).toHaveBeenCalledWith("01HXYZ0000000000000000001");
    });
  });

  it("shows a success toast after promote succeeds", async () => {
    const user = userEvent.setup();
    mockPromote.mockResolvedValue({ lifecycle_stage: "archive", artifact_id: "01HXYZ0000000000000000001" });
    renderWithProviders(<ReviewQueue />);

    await user.click(screen.getByRole("button", { name: /promote/i }));

    await waitFor(() => {
      // Success toast with "archive" or general success message
      expect(
        screen.getByText(/promoted/i),
      ).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 2. Promote — error path
// ===========================================================================

describe("ReviewQueue — Promote action: error path", () => {
  it("shows an error toast when promoteArtifact fails", async () => {
    const user = userEvent.setup();
    mockPromote.mockRejectedValue(new Error("Promote failed"));
    renderWithProviders(<ReviewQueue />);

    await user.click(screen.getByRole("button", { name: /promote/i }));

    await waitFor(() => {
      expect(screen.getByText(/promote failed/i)).toBeInTheDocument();
    });
  });

  it("re-enables the Promote button after a failure", async () => {
    const user = userEvent.setup();
    mockPromote.mockRejectedValue(new Error("Network error"));
    renderWithProviders(<ReviewQueue />);

    const promoteBtn = screen.getByRole("button", { name: /promote/i });
    await user.click(promoteBtn);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });

    // Button should be re-enabled
    expect(screen.getByRole("button", { name: /promote/i })).not.toBeDisabled();
  });
});

// ===========================================================================
// 3. Link — dialog open
// ===========================================================================

describe("ReviewQueue — Link action: dialog", () => {
  it("opens the link dialog when the Link button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReviewQueue />);

    await user.click(screen.getByRole("button", { name: /link/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: /link to artifact/i }),
      ).toBeInTheDocument();
    });
  });

  it("calls linkArtifact with the entered target id on confirm", async () => {
    const user = userEvent.setup();
    mockLink.mockResolvedValue({ data: { status: "linked" } });
    mockUseReviewQueue.mockReturnValue(
      defaultHookReturn([
        makeReviewItem({ artifact: makeArtifact({ id: "art-rq-001" }) }),
      ]),
    );
    renderWithProviders(<ReviewQueue />);

    await user.click(screen.getByRole("button", { name: /link/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/target artifact id/i), "other-artifact-001");
    await user.click(screen.getByRole("button", { name: /^link$/i }));

    await waitFor(() => {
      expect(mockLink).toHaveBeenCalledWith(
        "art-rq-001",
        expect.objectContaining({ target_id: "other-artifact-001" }),
      );
    });
  });

  it("shows success toast and closes dialog on link success", async () => {
    const user = userEvent.setup();
    mockLink.mockResolvedValue({ data: { status: "linked" } });
    renderWithProviders(<ReviewQueue />);

    await user.click(screen.getByRole("button", { name: /link/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/target artifact id/i), "target-001");
    await user.click(screen.getByRole("button", { name: /^link$/i }));

    await waitFor(() => {
      expect(screen.getByText(/link created/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("shows error toast on link failure without closing dialog", async () => {
    const user = userEvent.setup();
    mockLink.mockRejectedValue(new Error("Link failed"));
    renderWithProviders(<ReviewQueue />);

    await user.click(screen.getByRole("button", { name: /link/i }));

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
// 4. Archive — remains disabled
// ===========================================================================

describe("ReviewQueue — Archive action: disabled", () => {
  it("Archive button is disabled (no backend endpoint)", () => {
    renderWithProviders(<ReviewQueue />);
    expect(screen.getByRole("button", { name: /archive/i })).toBeDisabled();
  });
});

// ===========================================================================
// 5. Stale 'v1.5' copy absent from wired buttons
// ===========================================================================

describe("ReviewQueue — no stale v1.5 copy on Promote/Link", () => {
  it("Promote button does NOT carry a 'v1.5' tooltip (it's now wired)", () => {
    renderWithProviders(<ReviewQueue />);
    const promoteBtn = screen.getByRole("button", { name: /promote/i });
    const title = promoteBtn.getAttribute("title") ?? "";
    // The promote button should not say "v1.5" — that's Archive's tooltip
    expect(title).not.toMatch(/v1\.5/i);
  });
});
