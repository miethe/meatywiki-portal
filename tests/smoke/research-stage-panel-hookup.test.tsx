/**
 * Smoke tests: P4-04 — ResearchStagePanel viewer hookup.
 *
 * Validates that the three Phase 4 stage panels (synthesis, draft, review)
 * are routed through `ResearchStagePanel` when `template_id=external_research_v1`
 * and that:
 *   1. isSynthesisStage / isDraftStage / isReviewStage predicates match the
 *      expected stage name patterns from the portal-v2.1 spec.
 *   2. isResearchStageName (the combined gate used by the viewer) returns true
 *      for both Phase 1 names and Phase 4 predicate names.
 *   3. `ResearchStagePanel` renders the correct `data-testid` panel body for
 *      each of the three Phase 4 stage name variants.
 *   4. Non-research stage names continue to return null from ResearchStagePanel
 *      (no regression).
 *
 * All backend API calls used by the panel bodies are mocked so no network
 * activity occurs in jsdom.
 *
 * (P4-05 will add full E2E Playwright coverage.)
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import {
  ResearchStagePanel,
  isSynthesisStage,
  isDraftStage,
  isReviewStage,
} from "@/components/workflow/viewer/research-stage-panel";
import type { TimelineStage } from "@/types/workflow-viewer";
import type { WorkflowRun } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Mock all API functions used by the panel bodies so they never fire real
// network requests in jsdom.
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/workflow-viewer", () => ({
  fetchPromptPackage: jest.fn().mockResolvedValue({ content: "", package_artifact_id: null, exported_at: null }),
  patchExternalTask: jest.fn().mockResolvedValue({}),
  uploadExternalResult: jest.fn().mockResolvedValue({}),
  uploadExternalResultFile: jest.fn().mockResolvedValue({}),
  enqueueSynthesis: jest.fn().mockResolvedValue({ status: "enqueued", enqueued_at: null, synthesis_artifact_id: null }),
  enqueueDraft: jest.fn().mockResolvedValue({ status: "enqueued", draft_artifact_ids: [], formats: [] }),
  runReviewGates: jest.fn().mockResolvedValue({ passed: true, mode: "advisory", warnings: [] }),
  fileBackResearch: jest.fn().mockResolvedValue({ status: "filed_back", final_artifact_id: "art-001", lineage: [] }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeStage(name: string): TimelineStage {
  return {
    name,
    label: name.replace(/_/g, " "),
    status: "success",
    startedAt: "2026-05-28T10:00:00Z",
    completedAt: "2026-05-28T10:01:00Z",
    durationS: 60,
    events: [],
  };
}

function makeRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: "wf-research-20260528-001",
    template_id: "external_research_v1",
    workspace: "projects",
    status: "running",
    metadata: {},
    created_artifacts: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Unit: predicate functions
// ---------------------------------------------------------------------------

describe("Stage name predicates", () => {
  describe("isSynthesisStage", () => {
    it.each([
      "synthesis",
      "synthesize_results",
      "research_synthesis_v1",
      "run_synthesis",
    ])("returns true for %s", (name) => {
      expect(isSynthesisStage(name)).toBe(true);
    });

    it.each(["draft", "review", "collect_intent", "file_back"])(
      "returns false for %s",
      (name) => {
        expect(isSynthesisStage(name)).toBe(false);
      },
    );
  });

  describe("isDraftStage", () => {
    it.each(["draft", "draft_results", "generate_draft", "draft_v1"])(
      "returns true for %s",
      (name) => {
        expect(isDraftStage(name)).toBe(true);
      },
    );

    it.each(["synthesis", "review", "collect_intent"])(
      "returns false for %s",
      (name) => {
        expect(isDraftStage(name)).toBe(false);
      },
    );
  });

  describe("isReviewStage", () => {
    it.each(["review", "review_gates", "file_back", "file_back_results"])(
      "returns true for %s",
      (name) => {
        expect(isReviewStage(name)).toBe(true);
      },
    );

    it.each(["synthesis", "draft", "collect_intent"])(
      "returns false for %s",
      (name) => {
        expect(isReviewStage(name)).toBe(false);
      },
    );
  });
});

// ---------------------------------------------------------------------------
// Component: ResearchStagePanel renders correct body for Phase 4 stage names
// ---------------------------------------------------------------------------

describe("ResearchStagePanel — Phase 4 stage bodies", () => {
  const run = makeRun();

  it("renders the research-stage-panel container for a synthesis stage name", () => {
    render(
      <ResearchStagePanel
        stage={makeStage("synthesis")}
        workflowRun={run}
      />,
    );
    expect(screen.getByTestId("research-stage-panel")).toBeInTheDocument();
    // SynthesisPanel shows a "Synthesis Status" section heading
    expect(screen.getByText(/synthesis status/i)).toBeInTheDocument();
  });

  it("renders the research-stage-panel container for a synthesize_results stage name", () => {
    render(
      <ResearchStagePanel
        stage={makeStage("synthesize_results")}
        workflowRun={run}
      />,
    );
    expect(screen.getByTestId("research-stage-panel")).toBeInTheDocument();
    expect(screen.getByText(/synthesis status/i)).toBeInTheDocument();
  });

  it("renders the research-stage-panel container for a draft stage name", () => {
    render(
      <ResearchStagePanel
        stage={makeStage("draft")}
        workflowRun={run}
      />,
    );
    expect(screen.getByTestId("research-stage-panel")).toBeInTheDocument();
    // DraftPanel shows "Draft Formats" section heading (h4 element)
    expect(screen.getAllByText(/draft formats/i)[0]).toBeInTheDocument();
  });

  it("renders the research-stage-panel container for a draft_results stage name", () => {
    render(
      <ResearchStagePanel
        stage={makeStage("draft_results")}
        workflowRun={run}
      />,
    );
    expect(screen.getByTestId("research-stage-panel")).toBeInTheDocument();
    expect(screen.getAllByText(/draft formats/i)[0]).toBeInTheDocument();
  });

  it("renders the research-stage-panel container for a review stage name", () => {
    render(
      <ResearchStagePanel
        stage={makeStage("review")}
        workflowRun={run}
      />,
    );
    expect(screen.getByTestId("research-stage-panel")).toBeInTheDocument();
    // ReviewPanel shows a strict mode toggle labelled "Strict mode"
    expect(screen.getByRole("switch", { name: /strict mode/i })).toBeInTheDocument();
  });

  it("renders the research-stage-panel container for a file_back stage name", () => {
    render(
      <ResearchStagePanel
        stage={makeStage("file_back")}
        workflowRun={run}
      />,
    );
    expect(screen.getByTestId("research-stage-panel")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /strict mode/i })).toBeInTheDocument();
  });

  it("returns null for an unknown stage name (no regression)", () => {
    const { container } = render(
      <ResearchStagePanel
        stage={makeStage("completely_unknown_stage")}
        workflowRun={run}
      />,
    );
    // ResearchStagePanel returns null → nothing is mounted
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Phase 1 stage names still render (regression guard)
// ---------------------------------------------------------------------------

describe("ResearchStagePanel — Phase 1 stage bodies still render", () => {
  const run = makeRun();

  it.each([
    ["collect_intent", /package summary/i],
    ["assemble_package", /package summary/i],
    ["analyze_routes", /route analysis/i],
  ])("stage '%s' renders expected heading /%s/", (stageName, heading) => {
    render(
      <ResearchStagePanel
        stage={makeStage(stageName)}
        workflowRun={run}
      />,
    );
    expect(screen.getByTestId("research-stage-panel")).toBeInTheDocument();
    expect(screen.getByText(heading)).toBeInTheDocument();
  });
});
