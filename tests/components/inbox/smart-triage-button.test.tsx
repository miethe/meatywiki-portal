/**
 * SmartTriageButton — routing recommendation wiring tests (P3-06).
 *
 * Covers:
 *   - Button renders with aria-label="Smart Triage"
 *   - Clicking button opens the dialog
 *   - Without artifactId: dialog shows static explainer copy (no fetch)
 *   - With artifactId: loading spinner appears immediately on open
 *   - Success (template present): recommendation chip + rationale rendered
 *   - Success (null template): "No recommendation available" shown
 *   - 404 error: "No recommendation available" shown
 *   - Other error: "Unable to load recommendation" shown
 *   - "Got it" button closes the dialog
 *   - Re-open triggers a new fetch
 *   - Compact mode: renders icon-only (no "Smart Triage" label text)
 *
 * Mocking strategy:
 *   Mock fetchRoutingRecommendation at the API module boundary.
 *   Dialog primitive is rendered for real (shadcn/ui) so focus and
 *   aria-modal work as in production.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "../../utils/userEvent";
import { SmartTriageButton } from "@/components/inbox/smart-triage-button";
import * as artifactsApi from "@/lib/api/artifacts";
import { ApiError } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/artifacts", () => ({
  ...jest.requireActual("@/lib/api/artifacts"),
  fetchRoutingRecommendation: jest.fn(),
}));

const mockFetch = artifactsApi.fetchRoutingRecommendation as jest.Mock;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function openDialog(artifactId?: string) {
  const user = userEvent.setup();
  render(<SmartTriageButton artifactId={artifactId} />);
  await user.click(screen.getByRole("button", { name: "Smart Triage" }));
  return user;
}

// ===========================================================================
// 1. Button renders
// ===========================================================================

describe("SmartTriageButton — button rendering", () => {
  it("renders a button with aria-label='Smart Triage'", () => {
    render(<SmartTriageButton />);
    expect(screen.getByRole("button", { name: "Smart Triage" })).toBeInTheDocument();
  });

  it("compact mode: does not render the text label", () => {
    render(<SmartTriageButton compact />);
    expect(screen.queryByText("Smart Triage")).not.toBeInTheDocument();
    // Button is still accessible
    expect(screen.getByRole("button", { name: "Smart Triage" })).toBeInTheDocument();
  });

  it("non-compact mode: renders the text label", () => {
    render(<SmartTriageButton />);
    expect(screen.getByText("Smart Triage")).toBeInTheDocument();
  });
});

// ===========================================================================
// 2. Dialog opens on click
// ===========================================================================

describe("SmartTriageButton — dialog open/close", () => {
  it("opens the Smart Triage dialog on button click", async () => {
    await openDialog();

    expect(
      screen.getByRole("dialog", { name: /smart triage/i }),
    ).toBeInTheDocument();
  });

  it("closes the dialog when 'Got it' is clicked", async () => {
    const user = await openDialog();

    // Wait for dialog to be visible
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /got it/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 3. Without artifactId — static copy
// ===========================================================================

describe("SmartTriageButton — no artifactId: static explainer", () => {
  it("shows static explainer copy when no artifactId is provided", async () => {
    await openDialog();

    await waitFor(() => {
      expect(
        screen.getByText(/automated classification of inbox items is not yet available/i),
      ).toBeInTheDocument();
    });
  });

  it("does not call fetchRoutingRecommendation when no artifactId", async () => {
    await openDialog();

    await waitFor(() => {
      expect(screen.getByText(/automated classification/i)).toBeInTheDocument();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 4. With artifactId — loading state
// ===========================================================================

describe("SmartTriageButton — loading state", () => {
  it("renders a loading spinner when dialog opens with an artifactId", async () => {
    mockFetch.mockReturnValue(new Promise(() => undefined));
    await openDialog("art-001");

    await waitFor(() => {
      expect(screen.getByText(/loading recommendation/i)).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 5. Success — template present
// ===========================================================================

describe("SmartTriageButton — success: template returned", () => {
  it("renders the suggestion chip with the template name", async () => {
    mockFetch.mockResolvedValue({
      template: "research_synthesis_v1",
      confidence: 0.9,
      rationale: "Sufficient source density for synthesis.",
    });
    await openDialog("art-001");

    await waitFor(() => {
      expect(screen.getByText("research_synthesis_v1")).toBeInTheDocument();
    });
  });

  it("renders the rationale when provided", async () => {
    mockFetch.mockResolvedValue({
      template: "research_synthesis_v1",
      confidence: 0.9,
      rationale: "Sufficient source density for synthesis.",
    });
    await openDialog("art-001");

    await waitFor(() => {
      expect(
        screen.getByText(/sufficient source density for synthesis/i),
      ).toBeInTheDocument();
    });
  });

  it("renders 'Suggested route' label above the chip", async () => {
    mockFetch.mockResolvedValue({
      template: "compile_v1",
      confidence: 0.75,
      rationale: null,
    });
    await openDialog("art-001");

    await waitFor(() => {
      expect(screen.getByText(/suggested route/i)).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 6. Success — null template
// ===========================================================================

describe("SmartTriageButton — success: null template", () => {
  it("renders 'No recommendation available' when template is null", async () => {
    mockFetch.mockResolvedValue({
      template: null,
      confidence: 0,
      rationale: null,
    });
    await openDialog("art-001");

    await waitFor(() => {
      expect(
        screen.getByText(/no recommendation available for this artifact/i),
      ).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 7. 404 error
// ===========================================================================

describe("SmartTriageButton — 404 error", () => {
  it("renders 'No recommendation available' on 404 ApiError", async () => {
    const err = new ApiError(404, "Not Found");
    mockFetch.mockRejectedValue(err);
    await openDialog("art-001");

    await waitFor(() => {
      expect(
        screen.getByText(/no recommendation available for this artifact/i),
      ).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 8. Other error
// ===========================================================================

describe("SmartTriageButton — other error", () => {
  it("renders 'Unable to load recommendation' on non-404 error", async () => {
    mockFetch.mockRejectedValue(new Error("Server error 500"));
    await openDialog("art-001");

    await waitFor(() => {
      expect(
        screen.getByText(/unable to load recommendation/i),
      ).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 9. Re-open triggers new fetch
// ===========================================================================

describe("SmartTriageButton — re-open behavior", () => {
  it("calls fetchRoutingRecommendation each time the dialog is opened", async () => {
    mockFetch.mockResolvedValue({
      template: "compile_v1",
      confidence: 0.8,
      rationale: null,
    });

    const user = userEvent.setup();
    render(<SmartTriageButton artifactId="art-001" />);

    // First open
    await user.click(screen.getByRole("button", { name: "Smart Triage" }));
    await waitFor(() => {
      expect(screen.getByText("compile_v1")).toBeInTheDocument();
    });

    // Close
    await user.click(screen.getByRole("button", { name: /got it/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // Second open
    await user.click(screen.getByRole("button", { name: "Smart Triage" }));
    await waitFor(() => {
      expect(screen.getByText("compile_v1")).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
