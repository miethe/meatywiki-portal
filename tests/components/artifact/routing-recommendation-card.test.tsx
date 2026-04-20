/**
 * Tests for RoutingRecommendationCard (P1.5-1-06).
 *
 * Covers:
 *   - Renders nothing (null) when recommendation has template=null (no match)
 *   - Renders card with template label and rationale when match is present
 *   - "Start Workflow" button is present and calls onStart callback with template slug
 *   - Loading state renders skeleton (aria-busy=true), not the card
 *   - Error state renders nothing (silent failure)
 *   - Unknown template slug falls back to raw slug as label
 *   - aria-label on the section region (WCAG 2.1 AA)
 *   - onStart not required: button still renders without crash
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoutingRecommendationCard } from "@/components/artifact/routing-recommendation-card";
import { ApiError } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Mock getRoutingRecommendation — decouples from real fetch
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/artifacts", () => ({
  getRoutingRecommendation: jest.fn(),
}));

import { getRoutingRecommendation } from "@/lib/api/artifacts";
const mockGetRecommendation = getRoutingRecommendation as jest.MockedFunction<
  typeof getRoutingRecommendation
>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderCard(
  artifactId = "art-test-01",
  onStart?: (slug: string) => void,
) {
  return render(
    <RoutingRecommendationCard
      artifactId={artifactId}
      onStart={onStart}
    />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RoutingRecommendationCard — no match", () => {
  it("renders nothing when recommendation has template=null", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      template: null,
      rationale: null,
    });

    const { container } = renderCard();

    // Wait for loading to finish
    await waitFor(() => {
      expect(mockGetRecommendation).toHaveBeenCalledWith("art-test-01");
    });

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});

describe("RoutingRecommendationCard — match present", () => {
  it("renders card with human-readable template label", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      template: "research_synthesis_v1",
      rationale: "Stale + unverified artifact benefits from synthesis.",
    });

    renderCard();

    await waitFor(() => {
      expect(screen.getByText("Research Synthesis")).toBeInTheDocument();
    });
  });

  it("renders rationale text", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      template: "research_synthesis_v1",
      rationale: "Stale + unverified artifact benefits from synthesis.",
    });

    renderCard();

    await waitFor(() => {
      expect(
        screen.getByText(/stale \+ unverified artifact/i),
      ).toBeInTheDocument();
    });
  });

  it("calls onStart with the template slug when Start button clicked", async () => {
    const user = userEvent.setup();
    const onStart = jest.fn();

    mockGetRecommendation.mockResolvedValueOnce({
      template: "research_synthesis_v1",
      rationale: "Rationale text.",
    });

    renderCard("art-test-02", onStart);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start.*workflow/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /start.*workflow/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith("research_synthesis_v1");
  });

  it("renders Start Workflow button even when onStart is not provided", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      template: "verification_workflow_v1",
      rationale: "Speculative fidelity.",
    });

    renderCard("art-no-handler");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start.*workflow/i })).toBeInTheDocument();
    });
  });

  it("falls back to raw slug when template has no known label", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      template: "unknown_custom_workflow_v99",
      rationale: "Custom workflow rationale.",
    });

    renderCard();

    await waitFor(() => {
      expect(screen.getByText("unknown_custom_workflow_v99")).toBeInTheDocument();
    });
  });

  it("has role=region with aria-label 'Workflow recommendation' (WCAG 2.1 AA)", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      template: "research_synthesis_v1",
      rationale: "Some rationale.",
    });

    renderCard();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /workflow recommendation/i }),
      ).toBeInTheDocument();
    });
  });
});

describe("RoutingRecommendationCard — loading state", () => {
  it("renders loading skeleton (aria-busy) before fetch resolves", async () => {
    // Create a promise we control
    let resolvePromise!: (value: { template: null; rationale: null }) => void;
    const pending = new Promise<{ template: null; rationale: null }>(
      (res) => { resolvePromise = res; },
    );
    mockGetRecommendation.mockReturnValueOnce(pending);

    const { container } = renderCard();

    // Should have a loading element visible now (before resolve)
    const loadingEl = container.querySelector('[aria-busy="true"]');
    expect(loadingEl).toBeInTheDocument();

    // Resolve the promise so we don't leave dangling async work
    act(() => {
      resolvePromise({ template: null, rationale: null });
    });

    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
    });
  });
});

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
