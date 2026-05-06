/**
 * Tests for RoutingRecommendationCard (P2-4-08).
 *
 * Covers:
 *   - Renders nothing (null) when next_template is null (no match)
 *   - Renders card with template label, confidence, and rationale when match is present
 *   - "Run Workflow" button calls onRunWorkflow callback with template slug
 *   - "Dismiss" button hides the card (local state)
 *   - Loading state renders skeleton (aria-busy=true), not the card
 *   - Error state renders nothing (silent failure)
 *   - Unknown template slug falls back to raw slug as label
 *   - Confidence displayed as human-readable percentage
 *   - aria-label on the section region (WCAG 2.1 AA)
 *   - onRunWorkflow not required: button still renders without crash
 *   - "run" variant renders compact strip with confidence badge
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoutingRecommendationCard } from "@/components/artifact/routing-recommendation-card";
import { ApiError } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Mock getMLRoutingRecommendation — decouples from real fetch
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/artifacts", () => ({
  getMLRoutingRecommendation: jest.fn(),
}));

import { getMLRoutingRecommendation } from "@/lib/api/artifacts";
const mockGetRecommendation = getMLRoutingRecommendation as jest.MockedFunction<
  typeof getMLRoutingRecommendation
>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderCard(
  artifactId = "art-test-01",
  onRunWorkflow?: (slug: string) => void,
) {
  return render(
    <RoutingRecommendationCard
      artifactId={artifactId}
      onRunWorkflow={onRunWorkflow}
    />,
  );
}

function renderRunVariant(artifactId = "art-test-01", onRunWorkflow?: (slug: string) => void) {
  return render(
    <RoutingRecommendationCard
      artifactId={artifactId}
      variant="run"
      onRunWorkflow={onRunWorkflow}
    />,
  );
}

// ---------------------------------------------------------------------------
// Global mock reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockGetRecommendation.mockReset();
});

// ---------------------------------------------------------------------------
// No match
// ---------------------------------------------------------------------------

describe("RoutingRecommendationCard — no match", () => {
  it("renders nothing when next_template is null", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      next_template: null,
      confidence_score: 0,
      rationale: null,
    });

    const { container } = renderCard();

    await waitFor(() => {
      expect(mockGetRecommendation).toHaveBeenCalledWith("art-test-01");
    });

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Match present — artifact variant (default)
// ---------------------------------------------------------------------------

describe("RoutingRecommendationCard — match present", () => {
  it("renders card with human-readable template label", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      next_template: "research_synthesis_v1",
      confidence_score: 0.85,
      rationale: "Stale + unverified artifact benefits from synthesis.",
    });

    renderCard();

    await waitFor(() => {
      expect(screen.getByText("Research Synthesis")).toBeInTheDocument();
    });
  });

  it("renders rationale text", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      next_template: "research_synthesis_v1",
      confidence_score: 0.85,
      rationale: "Stale + unverified artifact benefits from synthesis.",
    });

    renderCard();

    await waitFor(() => {
      expect(
        screen.getByText(/stale \+ unverified artifact/i),
      ).toBeInTheDocument();
    });
  });

  it("displays confidence as percentage", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      next_template: "compile_v1",
      confidence_score: 0.85,
      rationale: null,
    });

    renderCard();

    await waitFor(() => {
      expect(screen.getByText(/85%.*confidence/i)).toBeInTheDocument();
    });
  });

  it("calls onRunWorkflow with the template slug when Run Workflow button clicked", async () => {
    const user = userEvent.setup();
    const onRunWorkflow = jest.fn();

    mockGetRecommendation.mockResolvedValueOnce({
      next_template: "research_synthesis_v1",
      confidence_score: 0.9,
      rationale: "Rationale text.",
    });

    renderCard("art-test-02", onRunWorkflow);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /run workflow/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /run workflow/i }));
    expect(onRunWorkflow).toHaveBeenCalledTimes(1);
    expect(onRunWorkflow).toHaveBeenCalledWith("research_synthesis_v1");
  });

  it("renders Run Workflow button even when onRunWorkflow is not provided", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      next_template: "verification_workflow_v1",
      confidence_score: 0.6,
      rationale: "Speculative fidelity.",
    });

    renderCard("art-no-handler");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /run workflow/i })).toBeInTheDocument();
    });
  });

  it("falls back to raw slug when template has no known label", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      next_template: "unknown_custom_workflow_v99",
      confidence_score: 0.5,
      rationale: "Custom workflow rationale.",
    });

    renderCard();

    await waitFor(() => {
      expect(screen.getByText("unknown_custom_workflow_v99")).toBeInTheDocument();
    });
  });

  it("has role=region with aria-label containing 'recommendation' (WCAG 2.1 AA)", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      next_template: "research_synthesis_v1",
      confidence_score: 0.7,
      rationale: "Some rationale.",
    });

    renderCard();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /recommendation/i }),
      ).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Dismiss behavior
// ---------------------------------------------------------------------------

describe("RoutingRecommendationCard — dismiss", () => {
  it("hides the card when Dismiss is clicked", async () => {
    const user = userEvent.setup();

    mockGetRecommendation.mockResolvedValueOnce({
      next_template: "compile_v1",
      confidence_score: 0.8,
      rationale: "Ready to compile.",
    });

    const { container } = renderCard();

    // Card has two dismiss controls: header X (aria-label "Dismiss routing suggestion")
    // and action row button (text content "Dismiss"). Click the action row one by text.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /dismiss this recommendation/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /dismiss this recommendation/i }));

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe("RoutingRecommendationCard — loading state", () => {
  it("renders loading skeleton (aria-busy) before fetch resolves", async () => {
    let resolvePromise!: (value: {
      next_template: null;
      confidence_score: number;
      rationale: null;
    }) => void;
    const pending = new Promise<{
      next_template: null;
      confidence_score: number;
      rationale: null;
    }>((res) => {
      resolvePromise = res;
    });
    mockGetRecommendation.mockReturnValueOnce(pending);

    const { container } = renderCard();

    const loadingEl = container.querySelector('[aria-busy="true"]');
    expect(loadingEl).toBeInTheDocument();

    act(() => {
      resolvePromise({ next_template: null, confidence_score: 0, rationale: null });
    });

    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe("RoutingRecommendationCard — error state", () => {
  it("renders nothing (silent failure) when the API call throws", async () => {
    mockGetRecommendation.mockRejectedValueOnce(
      new ApiError(500, { error: { code: "server_error", message: "Unexpected" } }),
    );

    const { container } = renderCard();

    await waitFor(() => {
      expect(mockGetRecommendation).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("renders nothing (silent 404) when artifact is not found", async () => {
    mockGetRecommendation.mockRejectedValueOnce(
      new ApiError(404, { error: { code: "not_found", message: "Not found" } }),
    );

    const { container } = renderCard();

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// "run" compact variant
// ---------------------------------------------------------------------------

describe('RoutingRecommendationCard — "run" variant', () => {
  it("renders compact strip with suggested next label", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      next_template: "compile_v1",
      confidence_score: 0.85,
      rationale: "Artifact has no compiled output yet.",
    });

    renderRunVariant();

    await waitFor(() => {
      expect(screen.getByText("Full Compile")).toBeInTheDocument();
    });
  });

  it("shows confidence percentage badge in compact strip", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      next_template: "compile_v1",
      confidence_score: 0.85,
      rationale: "Ready.",
    });

    renderRunVariant();

    await waitFor(() => {
      expect(screen.getByText("85%")).toBeInTheDocument();
    });
  });

  it("calls onRunWorkflow with template slug when Run is clicked in compact strip", async () => {
    const user = userEvent.setup();
    const onRunWorkflow = jest.fn();

    mockGetRecommendation.mockResolvedValueOnce({
      next_template: "compile_v1",
      confidence_score: 0.9,
      rationale: "Ready.",
    });

    renderRunVariant("art-run-01", onRunWorkflow);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /run.*compile/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /run.*compile/i }));
    expect(onRunWorkflow).toHaveBeenCalledWith("compile_v1");
  });

  it("hides compact strip when Dismiss is clicked", async () => {
    const user = userEvent.setup();

    mockGetRecommendation.mockResolvedValueOnce({
      next_template: "compile_v1",
      confidence_score: 0.8,
      rationale: "Ready.",
    });

    const { container } = renderRunVariant();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /dismiss/i }));

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("renders nothing in compact variant when next_template is null", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      next_template: null,
      confidence_score: 0,
      rationale: null,
    });

    const { container } = renderRunVariant();

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
