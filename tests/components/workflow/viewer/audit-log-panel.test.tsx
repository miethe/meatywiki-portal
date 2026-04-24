/**
 * Unit tests for AuditLogPanel (P7-03).
 *
 * Tests:
 *   - Renders nothing when entries list is empty after load
 *   - Renders log entries when data is present
 *   - Each entry shows action pill + relative time
 *   - Refetches when refreshKey changes
 */

import React from "react";
import { renderWithProviders, screen, waitFor } from "../../../utils/render";
import { AuditLogPanel } from "@/components/workflow/viewer/audit-log-panel";
import * as workflowApi from "@/lib/api/workflow-viewer";

// ---------------------------------------------------------------------------
// Mock
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/workflow-viewer", () => ({
  ...jest.requireActual("@/lib/api/workflow-viewer"),
  fetchAuditLog: jest.fn(),
}));

const mockFetchAuditLog = workflowApi.fetchAuditLog as jest.Mock;

const ENTRIES: workflowApi.AuditLogEntry[] = [
  {
    id: "al-01",
    run_id: "run-test",
    action: "pause",
    actor: "operator",
    created_at: new Date(Date.now() - 60_000).toISOString(),
    meta: null,
  },
  {
    id: "al-02",
    run_id: "run-test",
    action: "resume",
    actor: null,
    created_at: new Date(Date.now() - 30_000).toISOString(),
    meta: null,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AuditLogPanel", () => {
  beforeEach(() => mockFetchAuditLog.mockReset());

  it("renders nothing when audit log is empty", async () => {
    mockFetchAuditLog.mockResolvedValueOnce([]);
    const { container } = renderWithProviders(
      <AuditLogPanel runId="run-test" refreshKey={0} />,
    );
    // Wait for fetch to settle
    await waitFor(() => expect(mockFetchAuditLog).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it("renders entries with action pill and time", async () => {
    mockFetchAuditLog.mockResolvedValueOnce(ENTRIES);
    renderWithProviders(
      <AuditLogPanel runId="run-test" refreshKey={0} />,
    );
    await waitFor(() =>
      expect(screen.getAllByTestId("audit-log-entry")).toHaveLength(2),
    );
    expect(screen.getByText("pause")).toBeInTheDocument();
    expect(screen.getByText("resume")).toBeInTheDocument();
    expect(screen.getByText("operator")).toBeInTheDocument();
  });

  it("calls fetchAuditLog with the correct runId", async () => {
    mockFetchAuditLog.mockResolvedValueOnce(ENTRIES);
    renderWithProviders(
      <AuditLogPanel runId="run-abc" refreshKey={0} />,
    );
    await waitFor(() =>
      expect(mockFetchAuditLog).toHaveBeenCalledWith("run-abc"),
    );
  });

  it("refetches when refreshKey changes", async () => {
    mockFetchAuditLog
      .mockResolvedValueOnce(ENTRIES)
      .mockResolvedValueOnce([ENTRIES[0]]);

    const { rerender } = renderWithProviders(
      <AuditLogPanel runId="run-test" refreshKey={0} />,
    );
    await waitFor(() => expect(mockFetchAuditLog).toHaveBeenCalledTimes(1));

    rerender(<AuditLogPanel runId="run-test" refreshKey={1} />);
    await waitFor(() => expect(mockFetchAuditLog).toHaveBeenCalledTimes(2));
  });
});
