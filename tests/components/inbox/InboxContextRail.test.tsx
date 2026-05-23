/**
 * InboxContextRail — auto-route CTA tests (P7-02).
 *
 * Verifies:
 *   - Button renders when all three conditions are met:
 *       inbox_group === "needs_destination"
 *       routing_workspace is non-null
 *       routing_workspace !== workspace
 *   - Button does NOT render when any condition is absent
 *   - Button text includes the target workspace name
 *   - Button aria-label is descriptive
 *   - Click fires PATCH /api/artifacts/{id}/workspace
 *   - On success: undo notification appears with Undo button
 *   - Undo fires PATCH back to original workspace
 *   - Undo button is keyboard-accessible (role="button")
 *   - Dismiss (×) button collapses the undo notification
 *   - On PATCH failure: error message renders inline
 *   - Empty-state renders when selectedItem is null
 *   - Loading skeleton renders when isLoadingDetails is true
 *
 * Mocking strategy:
 *   - Mock patchArtifactWorkspace at module boundary to control network
 *   - Mock ContextRail so we don't pull in its full dep tree
 *   - Mock useToast to capture toast calls without a real provider
 */

import React from "react";
import { renderWithProviders, screen, waitFor, fireEvent, act } from "../../utils/render";
import { InboxContextRail } from "@/components/inbox/InboxContextRail";
import type { ArtifactCard } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/artifacts", () => ({
  ...jest.requireActual("@/lib/api/artifacts"),
  patchArtifactWorkspace: jest.fn(),
}));

// ContextRail renders its own hook-heavy internals (connections panel, SSE,
// etc.). Stub it out with a lightweight sentinel so our tests stay focused.
jest.mock("@/components/layout/ContextRail", () => ({
  ContextRail: () => <div data-testid="context-rail-stub" />,
}));

// useToast: replace with a simple spy so we can assert on toast calls.
const mockAddToast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toasts: [],
    add: mockAddToast,
    remove: jest.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Import after mocks are declared
// ---------------------------------------------------------------------------

import { patchArtifactWorkspace } from "@/lib/api/artifacts";

const mockPatch = patchArtifactWorkspace as jest.MockedFunction<
  typeof patchArtifactWorkspace
>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_ITEM: ArtifactCard = {
  id: "art-001",
  workspace: "inbox",
  type: "raw_note",
  title: "Test Note",
  status: "active",
  file_path: "/vault/raw/test.md",
};

/** Item with all three auto-route conditions satisfied. */
function makeRoutableItem(overrides?: Partial<ArtifactCard>): ArtifactCard {
  return {
    ...BASE_ITEM,
    inbox_group: "needs_destination",
    routing_workspace: "projects",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Auto-route button — conditional rendering
// ---------------------------------------------------------------------------

describe("InboxContextRail — auto-route button visibility", () => {
  it("renders the auto-route button when all three conditions are met", () => {
    const item = makeRoutableItem();
    renderWithProviders(<InboxContextRail selectedItem={item} />);

    expect(
      screen.getByRole("button", { name: /auto-route to projects/i }),
    ).toBeInTheDocument();
  });

  it("button text includes the target workspace name (capitalised)", () => {
    const item = makeRoutableItem({ routing_workspace: "research" });
    renderWithProviders(<InboxContextRail selectedItem={item} />);

    expect(
      screen.getByRole("button", { name: /auto-route to research/i }),
    ).toHaveTextContent("Auto-route to Research");
  });

  it("does NOT render the button when inbox_group is absent", () => {
    const item = makeRoutableItem({ inbox_group: null });
    renderWithProviders(<InboxContextRail selectedItem={item} />);

    expect(
      screen.queryByRole("button", { name: /auto-route/i }),
    ).not.toBeInTheDocument();
  });

  it("does NOT render the button when inbox_group is not 'needs_destination'", () => {
    const item = makeRoutableItem({ inbox_group: "classified" });
    renderWithProviders(<InboxContextRail selectedItem={item} />);

    expect(
      screen.queryByRole("button", { name: /auto-route/i }),
    ).not.toBeInTheDocument();
  });

  it("does NOT render the button when routing_workspace is null", () => {
    const item = makeRoutableItem({ routing_workspace: null });
    renderWithProviders(<InboxContextRail selectedItem={item} />);

    expect(
      screen.queryByRole("button", { name: /auto-route/i }),
    ).not.toBeInTheDocument();
  });

  it("does NOT render the button when routing_workspace equals current workspace", () => {
    const item = makeRoutableItem({
      workspace: "projects",
      routing_workspace: "projects",
    });
    renderWithProviders(<InboxContextRail selectedItem={item} />);

    expect(
      screen.queryByRole("button", { name: /auto-route/i }),
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Auto-route button — accessibility
// ---------------------------------------------------------------------------

describe("InboxContextRail — auto-route button accessibility", () => {
  it("button has a descriptive aria-label", () => {
    const item = makeRoutableItem({ routing_workspace: "library" });
    renderWithProviders(<InboxContextRail selectedItem={item} />);

    const btn = screen.getByRole("button", { name: "Auto-route to Library" });
    expect(btn).toHaveAttribute("aria-label", "Auto-route to Library");
  });
});

// ---------------------------------------------------------------------------
// Auto-route button — click: success path
// ---------------------------------------------------------------------------

describe("InboxContextRail — auto-route click (success)", () => {
  it("calls patchArtifactWorkspace with the correct id and workspace", async () => {
    mockPatch.mockResolvedValueOnce({ ...BASE_ITEM, workspace: "projects" });
    const item = makeRoutableItem();
    renderWithProviders(<InboxContextRail selectedItem={item} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /auto-route to projects/i }));
    });

    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch).toHaveBeenCalledWith("art-001", "projects");
  });

  it("shows the undo notification after a successful route", async () => {
    mockPatch.mockResolvedValueOnce({ ...BASE_ITEM, workspace: "projects" });
    const item = makeRoutableItem();
    renderWithProviders(<InboxContextRail selectedItem={item} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /auto-route to projects/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/routed to projects/i)).toBeInTheDocument();
    });
  });

  it("renders the Undo button in the undo notification", async () => {
    mockPatch.mockResolvedValueOnce({ ...BASE_ITEM, workspace: "projects" });
    const item = makeRoutableItem();
    renderWithProviders(<InboxContextRail selectedItem={item} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /auto-route to projects/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /undo routing/i })).toBeInTheDocument();
    });
  });

  it("undo button is keyboard-accessible (role=button)", async () => {
    mockPatch.mockResolvedValueOnce({ ...BASE_ITEM, workspace: "projects" });
    const item = makeRoutableItem();
    renderWithProviders(<InboxContextRail selectedItem={item} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /auto-route to projects/i }));
    });

    await waitFor(() => {
      const undoBtn = screen.getByRole("button", { name: /undo routing/i });
      expect(undoBtn.tagName).toBe("BUTTON");
    });
  });
});

// ---------------------------------------------------------------------------
// Undo flow
// ---------------------------------------------------------------------------

describe("InboxContextRail — undo flow", () => {
  it("fires patchArtifactWorkspace back to original workspace when Undo is clicked", async () => {
    // First PATCH: route to projects
    mockPatch.mockResolvedValueOnce({ ...BASE_ITEM, workspace: "projects" });
    // Second PATCH: undo back to inbox
    mockPatch.mockResolvedValueOnce({ ...BASE_ITEM, workspace: "inbox" });

    const item = makeRoutableItem();
    renderWithProviders(<InboxContextRail selectedItem={item} />);

    // Route
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /auto-route to projects/i }));
    });
    await waitFor(() => screen.getByRole("button", { name: /undo routing/i }));

    // Undo
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /undo routing/i }));
    });

    expect(mockPatch).toHaveBeenCalledTimes(2);
    expect(mockPatch).toHaveBeenNthCalledWith(2, "art-001", "inbox");
  });

  it("shows 'Routing undone' toast after successful undo", async () => {
    mockPatch.mockResolvedValueOnce({ ...BASE_ITEM, workspace: "projects" });
    mockPatch.mockResolvedValueOnce({ ...BASE_ITEM, workspace: "inbox" });

    const item = makeRoutableItem();
    renderWithProviders(<InboxContextRail selectedItem={item} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /auto-route to projects/i }));
    });
    await waitFor(() => screen.getByRole("button", { name: /undo routing/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /undo routing/i }));
    });

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Routing undone", type: "info" }),
      );
    });
  });

  it("dismiss button (×) collapses the undo notification", async () => {
    mockPatch.mockResolvedValueOnce({ ...BASE_ITEM, workspace: "projects" });
    const item = makeRoutableItem();
    renderWithProviders(<InboxContextRail selectedItem={item} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /auto-route to projects/i }));
    });
    await waitFor(() => screen.getByRole("button", { name: /dismiss routing notification/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /dismiss routing notification/i }));
    });

    await waitFor(() => {
      expect(screen.queryByText(/routed to projects/i)).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Auto-route button — click: error path
// ---------------------------------------------------------------------------

describe("InboxContextRail — auto-route click (error)", () => {
  it("shows an inline error message when PATCH fails", async () => {
    mockPatch.mockRejectedValueOnce(new Error("Network error"));
    const item = makeRoutableItem();
    renderWithProviders(<InboxContextRail selectedItem={item} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /auto-route to projects/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByRole("alert"),
      ).toHaveTextContent(/failed to route to projects/i);
    });
  });

  it("also shows an error toast when PATCH fails", async () => {
    mockPatch.mockRejectedValueOnce(new Error("500 Internal Server Error"));
    const item = makeRoutableItem();
    renderWithProviders(<InboxContextRail selectedItem={item} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /auto-route to projects/i }));
    });

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" }),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Empty state / loading skeleton (existing behaviour — regression guard)
// ---------------------------------------------------------------------------

describe("InboxContextRail — empty state and loading skeleton", () => {
  it("renders empty state when selectedItem is null", () => {
    renderWithProviders(<InboxContextRail selectedItem={null} />);

    expect(
      screen.getByRole("status", { name: /no inbox item selected/i }),
    ).toBeInTheDocument();
  });

  it("does NOT render auto-route button in empty state", () => {
    renderWithProviders(<InboxContextRail selectedItem={null} />);

    expect(
      screen.queryByRole("button", { name: /auto-route/i }),
    ).not.toBeInTheDocument();
  });

  it("renders loading skeleton when isLoadingDetails is true", () => {
    const item = makeRoutableItem();
    renderWithProviders(
      <InboxContextRail selectedItem={item} isLoadingDetails />,
    );

    expect(
      screen.getByRole("status", { name: /loading item details/i }),
    ).toBeInTheDocument();
  });

  it("does NOT render auto-route button when isLoadingDetails is true", () => {
    const item = makeRoutableItem();
    renderWithProviders(
      <InboxContextRail selectedItem={item} isLoadingDetails />,
    );

    expect(
      screen.queryByRole("button", { name: /auto-route/i }),
    ).not.toBeInTheDocument();
  });
});
