/**
 * InboxContextRail — "Request Review" wiring tests (P3-06).
 *
 * Covers:
 *   - Empty state renders when selectedItem is null
 *   - "Request Review" button is rendered when an item is selected
 *   - Clicking "Request Review" calls requestReview API with the item's id
 *   - Button is disabled (aria-disabled) while request is in-flight
 *   - Success: toast appears; button label changes to "Review Requested"
 *   - Error: error toast appears; button is re-enabled (label reverts to "Request Review")
 *   - Toast dismissal button removes the toast
 *   - Review state resets when a different item is selected
 *
 * Mocking strategy:
 *   Mock requestReview at the API module boundary.
 *   ContextRail sub-components are rendered real (they have no network calls
 *   that need stubbing for the target interactions).
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "../../utils/userEvent";
import { InboxContextRail } from "@/components/inbox/InboxContextRail";
import * as artifactsApi from "@/lib/api/artifacts";
import type { ArtifactCard } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/artifacts", () => ({
  ...jest.requireActual("@/lib/api/artifacts"),
  requestReview: jest.fn(),
}));

// Mock useArtifactEdges used inside ContextRail's ConnectionsPanel
jest.mock("@/hooks/useArtifactEdges", () => ({
  ...jest.requireActual("@/hooks/useArtifactEdges"),
  useArtifactEdges: jest.fn(() => ({
    data: { artifact_id: "art-001", incoming: [], outgoing: [] },
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
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

const mockRequestReview = artifactsApi.requestReview as jest.Mock;

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<ArtifactCard> = {}): ArtifactCard {
  return {
    id: "art-001",
    workspace: "inbox",
    type: "note",
    subtype: null,
    title: "Stub Inbox Item",
    status: "draft",
    schema_version: "1.0.0",
    created: "2026-04-01T00:00:00Z",
    updated: "2026-04-18T00:00:00Z",
    file_path: "raw/stub.md",
    metadata: null,
    preview: null,
    workflow_status: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// 1. Empty state (no item selected)
// ===========================================================================

describe("InboxContextRail — empty state", () => {
  it("renders the empty state when selectedItem is null", () => {
    render(<InboxContextRail selectedItem={null} />);

    expect(
      screen.getByRole("status", { name: /no inbox item selected/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/select an inbox item to see details/i),
    ).toBeInTheDocument();
  });

  it("does not render the Request Review button when no item is selected", () => {
    render(<InboxContextRail selectedItem={null} />);

    expect(
      screen.queryByRole("button", { name: /request review/i }),
    ).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 2. Request Review — happy path
// ===========================================================================

describe("InboxContextRail — Request Review: happy path", () => {
  it("renders the Request Review button when an item is selected", () => {
    render(<InboxContextRail selectedItem={makeItem()} />);

    expect(
      screen.getByRole("button", { name: /request a review for this artifact/i }),
    ).toBeInTheDocument();
  });

  it("calls requestReview with the item id on click", async () => {
    const user = userEvent.setup();
    mockRequestReview.mockResolvedValue({ id: "review-01" });
    render(<InboxContextRail selectedItem={makeItem({ id: "art-001" })} />);

    await user.click(
      screen.getByRole("button", { name: /request a review for this artifact/i }),
    );

    await waitFor(() => {
      expect(mockRequestReview).toHaveBeenCalledWith("art-001");
    });
  });

  it("shows a success toast after review is requested", async () => {
    const user = userEvent.setup();
    mockRequestReview.mockResolvedValue({ id: "review-01" });
    render(<InboxContextRail selectedItem={makeItem()} />);

    await user.click(
      screen.getByRole("button", { name: /request a review for this artifact/i }),
    );

    // Toast is the role="status" aria-live region (InlineToast component).
    // We look for the dismiss button which is unique to the toast.
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /dismiss notification/i }),
      ).toBeInTheDocument();
    });
  });

  it("changes the button label to 'Review Requested' after success", async () => {
    const user = userEvent.setup();
    mockRequestReview.mockResolvedValue({ id: "review-01" });
    render(<InboxContextRail selectedItem={makeItem()} />);

    await user.click(
      screen.getByRole("button", { name: /request a review for this artifact/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("Review Requested")).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 3. Request Review — loading/disabled state
// ===========================================================================

describe("InboxContextRail — Request Review: loading state", () => {
  it("button becomes disabled while the request is in-flight", async () => {
    const user = userEvent.setup();
    // Never-resolving promise keeps the component in loading state.
    mockRequestReview.mockReturnValue(new Promise(() => undefined));
    render(<InboxContextRail selectedItem={makeItem()} />);

    const reviewButton = screen.getByRole("button", {
      name: /request a review for this artifact/i,
    });
    await user.click(reviewButton);

    await waitFor(() => {
      // Button is disabled (aria-disabled="true" or disabled attribute)
      const btn = screen.getByRole("button", {
        name: /requesting review/i,
      });
      expect(btn).toBeDisabled();
    });
  });
});

// ===========================================================================
// 4. Request Review — error path
// ===========================================================================

describe("InboxContextRail — Request Review: error path", () => {
  it("shows an error toast when requestReview throws", async () => {
    const user = userEvent.setup();
    mockRequestReview.mockRejectedValue(new Error("Server error"));
    render(<InboxContextRail selectedItem={makeItem()} />);

    await user.click(
      screen.getByRole("button", { name: /request a review for this artifact/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/failed to request review/i)).toBeInTheDocument();
    });
  });

  it("re-enables the button (idle state) after an error", async () => {
    const user = userEvent.setup();
    mockRequestReview.mockRejectedValue(new Error("Timeout"));
    render(<InboxContextRail selectedItem={makeItem()} />);

    await user.click(
      screen.getByRole("button", { name: /request a review for this artifact/i }),
    );

    await waitFor(() => {
      // The button should return to its idle label after error
      expect(
        screen.getByRole("button", { name: /request a review for this artifact/i }),
      ).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 5. Toast dismissal
// ===========================================================================

describe("InboxContextRail — toast dismissal", () => {
  it("dismisses the success toast when the dismiss button is clicked", async () => {
    const user = userEvent.setup();
    mockRequestReview.mockResolvedValue({ id: "review-01" });
    render(<InboxContextRail selectedItem={makeItem()} />);

    await user.click(
      screen.getByRole("button", { name: /request a review for this artifact/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /dismiss notification/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /dismiss notification/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /dismiss notification/i }),
      ).not.toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 6. State reset on item change
// ===========================================================================

describe("InboxContextRail — state reset on item change", () => {
  it("resets review state to idle when a different item is selected", async () => {
    const user = userEvent.setup();
    mockRequestReview.mockResolvedValue({ id: "review-01" });

    const itemA = makeItem({ id: "art-001", title: "Item A" });
    const itemB = makeItem({ id: "art-002", title: "Item B" });

    const { rerender } = render(<InboxContextRail selectedItem={itemA} />);

    // Request review for itemA
    await user.click(
      screen.getByRole("button", { name: /request a review for this artifact/i }),
    );
    await waitFor(() => {
      expect(screen.getByText("Review Requested")).toBeInTheDocument();
    });

    // Switch to itemB — review state should reset
    rerender(<InboxContextRail selectedItem={itemB} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /request a review for this artifact/i }),
      ).toBeInTheDocument();
    });
  });
});
