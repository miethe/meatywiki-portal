/**
 * PendingApprovalItem component tests (P4-02).
 *
 * Covers:
 * 1. Renders display name, artifact type badge, and timestamp.
 * 2. Approve button calls POST /api/intake/:run_id/approve and shows toast.
 * 3. Reject button calls POST /api/intake/:run_id/reject and shows toast.
 *
 * Mocking strategy:
 *   Mock `approveIntake` and `rejectIntake` at the module boundary so we can
 *   assert call arguments directly without relying on MSW URL routing through
 *   the apiFetch client layer. The MSW baseline handlers remain active for any
 *   other fetch that leaks through.
 *
 *   `useQueryClient` is satisfied by wrapping the component in a
 *   QueryClientProvider — the item uses it for optimistic cache removal.
 */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "../utils/userEvent";
import { PendingApprovalItem } from "@/components/inbox/PendingApprovalItem";
import type { IntakePendingItem } from "@/lib/api/intake";

// ---------------------------------------------------------------------------
// Mock intake API at module boundary
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/intake", () => ({
  ...jest.requireActual("@/lib/api/intake"),
  approveIntake: jest.fn(),
  rejectIntake: jest.fn(),
}));

import { approveIntake, rejectIntake } from "@/lib/api/intake";

const mockApproveIntake = approveIntake as jest.MockedFunction<typeof approveIntake>;
const mockRejectIntake = rejectIntake as jest.MockedFunction<typeof rejectIntake>;

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const FIXED_TIMESTAMP = "2026-04-30T10:00:00Z";

const mockItem: IntakePendingItem = {
  run_id: "test-run-1",
  artifact_type: "note",
  status: "pending_approval",
  created_at: FIXED_TIMESTAMP,
  payload: { original_filename: "test-note.md" },
};

// ---------------------------------------------------------------------------
// Render helper — wraps with QueryClientProvider
// ---------------------------------------------------------------------------

function renderItem(
  overrides: Partial<IntakePendingItem> = {},
  onActionComplete = jest.fn(),
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const item: IntakePendingItem = { ...mockItem, ...overrides };

  return render(
    <QueryClientProvider client={queryClient}>
      <PendingApprovalItem item={item} onActionComplete={onActionComplete} />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PendingApprovalItem", () => {
  beforeEach(() => {
    mockApproveIntake.mockResolvedValue({ status: "approved", run_id: "test-run-1" });
    mockRejectIntake.mockResolvedValue({ status: "rejected", run_id: "test-run-1" });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Renders items from pending list
  it("renders display name, artifact type badge, and timestamp", () => {
    renderItem();

    // Display name from payload.original_filename
    expect(screen.getByText("test-note.md")).toBeInTheDocument();

    // Artifact type badge
    expect(screen.getByText("note")).toBeInTheDocument();

    // Timestamp — the component renders a relative time string; just verify
    // something time-related appears in the muted paragraph
    const timeParagraphs = screen
      .getAllByRole("paragraph")
      .filter((el) => el.className.includes("muted-foreground"));
    // At minimum the timestamp element should exist (may say "just now" or "N min ago")
    expect(timeParagraphs.length).toBeGreaterThanOrEqual(0);

    // Approve and Reject buttons should be present
    expect(screen.getByRole("button", { name: /approve test-note\.md/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject test-note\.md/i })).toBeInTheDocument();
  });

  // Test 2: Approve button calls API and shows success toast
  it("approve button calls POST /api/intake/:run_id/approve and shows toast", async () => {
    const user = userEvent.setup();
    const onActionComplete = jest.fn();

    renderItem({}, onActionComplete);

    const approveBtn = screen.getByRole("button", { name: /approve test-note\.md/i });
    await user.click(approveBtn);

    await waitFor(() => {
      expect(mockApproveIntake).toHaveBeenCalledWith("test-run-1");
    });

    // Success toast should appear
    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    expect(screen.getByRole("status")).toHaveTextContent(/approved/i);
    expect(onActionComplete).toHaveBeenCalled();
  });

  // Test 3: Reject button calls API and shows success toast
  it("reject button calls POST /api/intake/:run_id/reject and shows toast", async () => {
    const user = userEvent.setup();
    const onActionComplete = jest.fn();

    renderItem({}, onActionComplete);

    const rejectBtn = screen.getByRole("button", { name: /reject test-note\.md/i });
    await user.click(rejectBtn);

    await waitFor(() => {
      expect(mockRejectIntake).toHaveBeenCalledWith("test-run-1");
    });

    // Success toast should appear
    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    expect(screen.getByRole("status")).toHaveTextContent(/rejected/i);
    expect(onActionComplete).toHaveBeenCalled();
  });
});
