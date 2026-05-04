import { renderHook, waitFor } from "@testing-library/react";
import { useWorkflowTimeline } from "@/hooks/useWorkflowTimeline";
import { fetchWorkflowTimeline } from "@/lib/api/workflow-viewer";
import type { WorkflowEvent } from "@/types/workflow-viewer";

jest.mock("@/lib/api/workflow-viewer", () => ({
  fetchWorkflowTimeline: jest.fn(),
}));

const mockFetchWorkflowTimeline = fetchWorkflowTimeline as jest.MockedFunction<
  typeof fetchWorkflowTimeline
>;

function event(overrides: Partial<WorkflowEvent>): WorkflowEvent {
  return {
    id: "evt-01",
    run_id: "run-01",
    stage: "compile",
    event_type: "stage_start",
    event_payload: null,
    created_at: "2026-04-18T10:00:00Z",
    ...overrides,
  };
}

describe("useWorkflowTimeline", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("marks backend stage_complete events as successful", async () => {
    mockFetchWorkflowTimeline.mockResolvedValue([
      event({ id: "evt-start", event_type: "stage_start" }),
      event({
        id: "evt-complete",
        event_type: "stage_complete",
        created_at: "2026-04-18T10:02:00Z",
      }),
    ]);

    const { result } = renderHook(() => useWorkflowTimeline("run-01"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.stages).toHaveLength(1);
    expect(result.current.stages[0]).toMatchObject({
      name: "compile",
      status: "success",
      completedAt: "2026-04-18T10:02:00Z",
    });
  });

  it("marks backend stage_start and stage_error events as active or failed", async () => {
    mockFetchWorkflowTimeline.mockResolvedValue([
      event({ id: "evt-start", stage: "extract", event_type: "stage_start" }),
      event({ id: "evt-error", stage: "compile", event_type: "stage_error" }),
    ]);

    const { result } = renderHook(() => useWorkflowTimeline("run-01"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "extract", status: "in_progress" }),
        expect.objectContaining({ name: "compile", status: "error" }),
      ]),
    );
  });
});
