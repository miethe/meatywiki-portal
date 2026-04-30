/**
 * PendingApprovalPanel component tests (P4-02).
 *
 * Covers:
 * 4. Section renders with count=0 and items=[] (no item rows shown).
 * 5. Scan Inbox button calls POST /api/admin/inbox/scan and shows toast.
 * 6. Select-all checkbox selects all items.
 * 7. Bulk approve calls the approve API for each selected item.
 *
 * Mocking strategy:
 *   Mock `approveIntake`, `rejectIntake`, and `scanInbox` at the module
 *   boundary so assertions can target call arguments directly without
 *   routing through the apiFetch client layer.
 *
 *   `PendingApprovalItem` uses `useQueryClient` internally, so the panel and
 *   all its children are wrapped in a QueryClientProvider.
 */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "../utils/userEvent";
import { PendingApprovalPanel } from "@/components/inbox/PendingApprovalPanel";
import type { IntakePendingItem } from "@/lib/api/intake";

// ---------------------------------------------------------------------------
// Mock intake API at module boundary
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/intake", () => ({
  ...jest.requireActual("@/lib/api/intake"),
  approveIntake: jest.fn(),
  rejectIntake: jest.fn(),
  scanInbox: jest.fn(),
}));

import { approveIntake, scanInbox } from "@/lib/api/intake";

const mockApproveIntake = approveIntake as jest.MockedFunction<typeof approveIntake>;
const mockScanInbox = scanInbox as jest.MockedFunction<typeof scanInbox>;

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

const mockItem2: IntakePendingItem = {
  run_id: "test-run-2",
  artifact_type: "concept",
  status: "pending_approval",
  created_at: FIXED_TIMESTAMP,
  payload: { original_filename: "test-concept.md" },
};

// ---------------------------------------------------------------------------
// Render helper — wraps with QueryClientProvider
// ---------------------------------------------------------------------------

interface PanelProps {
  items?: IntakePendingItem[];
  count?: number;
  isLoading?: boolean;
  error?: Error | null;
  refetch?: () => void;
}

function renderPanel({
  items = [],
  count = 0,
  isLoading = false,
  error = null,
  refetch = jest.fn(),
}: PanelProps = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PendingApprovalPanel
        items={items}
        count={count}
        isLoading={isLoading}
        error={error}
        refetch={refetch}
      />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PendingApprovalPanel", () => {
  beforeEach(() => {
    mockApproveIntake.mockResolvedValue({ status: "approved", run_id: "test-run-1" });
    mockScanInbox.mockResolvedValue({ files_enqueued: 3 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test 4: Section absent when count === 0
  it("renders section header with count pill and no item rows when count is 0", () => {
    renderPanel({ items: [], count: 0 });

    // Section header and count pill should render
    expect(screen.getByText(/pending approval/i)).toBeInTheDocument();

    // Count pill — aria-label="0 items"
    expect(screen.getByLabelText(/0 items/i)).toBeInTheDocument();

    // No item rows — the item list should not be present
    expect(screen.queryByRole("list", { name: /pending approval items/i })).not.toBeInTheDocument();

    // Scan Inbox button should still be present
    expect(screen.getByRole("button", { name: /scan inbox/i })).toBeInTheDocument();
  });

  // Test 5: Scan button triggers API and shows toast
  it("scan inbox button calls POST /api/admin/inbox/scan and shows files_enqueued in toast", async () => {
    const user = userEvent.setup();
    const refetch = jest.fn();

    renderPanel({ items: [mockItem], count: 1, refetch });

    const scanBtn = screen.getByRole("button", { name: /scan inbox/i });
    await user.click(scanBtn);

    await waitFor(() => {
      expect(mockScanInbox).toHaveBeenCalledTimes(1);
    });

    // Toast shows files_enqueued count (handler returns 3)
    await waitFor(() => {
      const toast = screen.getByRole("status");
      expect(toast).toHaveTextContent("3");
    });

    // refetch is called after scan
    expect(refetch).toHaveBeenCalled();
  });

  // Test 6: Select-all checkbox selects all items
  it("select-all checkbox marks all per-item checkboxes as checked", async () => {
    const user = userEvent.setup();

    renderPanel({ items: [mockItem, mockItem2], count: 2 });

    // Select-all checkbox
    const selectAll = screen.getByRole("checkbox", { name: /select all pending items/i });
    expect(selectAll).not.toBeChecked();

    await user.click(selectAll);

    // Both item checkboxes should now be checked
    await waitFor(() => {
      const itemCheckboxes = screen.getAllByRole("checkbox", {
        name: /select test-(note|concept)\.md/i,
      });
      expect(itemCheckboxes).toHaveLength(2);
      for (const checkbox of itemCheckboxes) {
        expect(checkbox).toBeChecked();
      }
    });
  });

  // Test 7: Bulk approve calls API for each selected item
  it("bulk approve calls approveIntake for each selected item", async () => {
    const user = userEvent.setup();
    const refetch = jest.fn();

    // Provide two items so there's something to bulk-select
    mockApproveIntake
      .mockResolvedValueOnce({ status: "approved", run_id: "test-run-1" })
      .mockResolvedValueOnce({ status: "approved", run_id: "test-run-2" });

    renderPanel({ items: [mockItem, mockItem2], count: 2, refetch });

    // Select all via the select-all checkbox
    const selectAll = screen.getByRole("checkbox", { name: /select all pending items/i });
    await user.click(selectAll);

    // Wait for item checkboxes to reflect selection
    await waitFor(() => {
      const itemCheckboxes = screen.getAllByRole("checkbox", {
        name: /select test-(note|concept)\.md/i,
      });
      for (const checkbox of itemCheckboxes) {
        expect(checkbox).toBeChecked();
      }
    });

    // Click "Approve selected" bulk action button
    // aria-label is dynamic: "Approve 2 selected items"
    const approveSelectedBtn = screen.getByRole("button", {
      name: /approve \d+ selected items/i,
    });
    await user.click(approveSelectedBtn);

    // Both items should have been approved
    await waitFor(() => {
      expect(mockApproveIntake).toHaveBeenCalledTimes(2);
    });

    expect(mockApproveIntake).toHaveBeenCalledWith("test-run-1");
    expect(mockApproveIntake).toHaveBeenCalledWith("test-run-2");

    // refetch is called after bulk approve completes
    expect(refetch).toHaveBeenCalled();
  });
});
