/**
 * Tests for AssessmentModal (P1.5-1-04).
 *
 * Covers:
 *   - Renders nothing when open=false
 *   - Renders dialog with heading when open=true
 *   - Cancel button closes modal (calls onOpenChange(false))
 *   - Backdrop click closes modal
 *   - Pre-populates numeric fields from initialValues
 *   - Pre-populates categorical selects from initialValues
 *   - Submit with no changes calls onOpenChange(false) without PATCH
 *   - Submit with changes calls patchArtifactLens
 *   - Success: closes modal and calls onSuccess with updated metadata
 *   - API error: shows error banner, keeps modal open
 *   - Diff logic: only changed fields are sent in patch body
 *   - All inputs have associated labels (accessibility)
 *   - dialog has role=dialog, aria-modal=true, aria-labelledby
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssessmentModal } from "@/components/artifact/assessment-modal";
import type { AssessmentInitialValues } from "@/components/artifact/assessment-modal";
import type { ArtifactMetadataResponse } from "@/types/artifact";
import { ApiError } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Mock patchArtifactLens — decouples from real fetch
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/artifacts", () => ({
  ...jest.requireActual("@/lib/api/artifacts"),
  patchArtifactLens: jest.fn(),
}));

import { patchArtifactLens } from "@/lib/api/artifacts";
const mockPatch = patchArtifactLens as jest.MockedFunction<
  typeof patchArtifactLens
>;

const ARTIFACT_ID = "test-artifact-001";

// Default success response factory
function makeEnvelope(
  overrides: Partial<ArtifactMetadataResponse> = {},
) {
  return {
    data: [
      {
        artifact_id: ARTIFACT_ID,
        fidelity_level: null,
        freshness_class: null,
        verification_status: null,
        novelty: null,
        clarity: null,
        significance: null,
        originality: null,
        rigor: null,
        utility: null,
        lens_rationale_jsonb: {},
        ...overrides,
      } satisfies ArtifactMetadataResponse,
    ],
    cursor: null,
    etag: null,
  };
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderModal(
  open = true,
  overrides?: {
    initialValues?: AssessmentInitialValues | null;
    onSuccess?: jest.Mock;
    onOpenChange?: jest.Mock;
  },
) {
  const onOpenChange = overrides?.onOpenChange ?? jest.fn();
  const onSuccess = overrides?.onSuccess ?? jest.fn();
  return {
    onOpenChange,
    onSuccess,
    ...render(
      <AssessmentModal
        open={open}
        onOpenChange={onOpenChange}
        artifactId={ARTIFACT_ID}
        initialValues={overrides?.initialValues}
        onSuccess={onSuccess}
      />,
    ),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

describe("AssessmentModal — visibility", () => {
  it("renders nothing when open=false", () => {
    const { container } = renderModal(false);
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog when open=true", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Lens Assessment")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Cancel / close behaviour
// ---------------------------------------------------------------------------

describe("AssessmentModal — cancel and close", () => {
  it("calls onOpenChange(false) when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onOpenChange(false) when X button is clicked", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();
    await user.click(
      screen.getByRole("button", { name: /close assessment modal/i }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onOpenChange(false) when backdrop is clicked", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();
    const backdrop = document.querySelector(
      "[aria-hidden='true']",
    ) as HTMLElement;
    await user.click(backdrop);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

// ---------------------------------------------------------------------------
// Pre-population
// ---------------------------------------------------------------------------

describe("AssessmentModal — initial values", () => {
  const initialValues: AssessmentInitialValues = {
    novelty: 7,
    clarity: 5,
    verification_status: "partial",
    fidelity: "contested",
    lens_rationale_jsonb: {
      novelty: { rationale: "very novel stuff" },
    },
  };

  it("pre-fills novelty score from initialValues", () => {
    renderModal(true, { initialValues });
    const input = screen.getByLabelText(/^Novelty$/i) as HTMLInputElement;
    expect(input.value).toBe("7");
  });

  it("pre-fills clarity score from initialValues", () => {
    renderModal(true, { initialValues });
    const input = screen.getByLabelText(/^Clarity$/i) as HTMLInputElement;
    expect(input.value).toBe("5");
  });

  it("pre-selects verification_status from initialValues", () => {
    renderModal(true, { initialValues });
    const select = screen.getByRole("combobox", {
      name: /verification status/i,
    }) as HTMLSelectElement;
    expect(select.value).toBe("partial");
  });

  it("pre-selects fidelity from initialValues", () => {
    renderModal(true, { initialValues });
    const select = screen.getByLabelText(/^Fidelity$/i) as HTMLSelectElement;
    expect(select.value).toBe("contested");
  });
});

// ---------------------------------------------------------------------------
// Submit — no changes
// ---------------------------------------------------------------------------

describe("AssessmentModal — submit with no changes", () => {
  it("closes without calling patchArtifactLens when nothing changed", async () => {
    const user = userEvent.setup();
    const initialValues: AssessmentInitialValues = {
      novelty: 5,
      verification_status: "partial",
      fidelity: "contested",
    };
    const { onOpenChange, onSuccess } = renderModal(true, { initialValues });

    await user.click(
      screen.getByRole("button", { name: /save assessment/i }),
    );

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(mockPatch).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Submit — with changes
// ---------------------------------------------------------------------------

describe("AssessmentModal — submit with changes", () => {
  it("calls patchArtifactLens and invokes onSuccess on success", async () => {
    const user = userEvent.setup();
    mockPatch.mockResolvedValueOnce(makeEnvelope({ novelty: 8 }));

    const onSuccess = jest.fn();
    const onOpenChange = jest.fn();
    renderModal(true, { onSuccess, onOpenChange });

    const noveltyInput = screen.getByLabelText(/^Novelty$/i);
    await user.clear(noveltyInput);
    await user.type(noveltyInput, "8");

    await user.click(
      screen.getByRole("button", { name: /save assessment/i }),
    );

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        ARTIFACT_ID,
        expect.objectContaining({ novelty: 8 }),
      );
    });
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ artifact_id: ARTIFACT_ID, novelty: 8 }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sends only changed fields (diff logic)", async () => {
    const user = userEvent.setup();
    mockPatch.mockResolvedValueOnce(makeEnvelope({ novelty: 3, clarity: 3 }));

    const initialValues: AssessmentInitialValues = {
      novelty: 5, // will change to 3
      clarity: 3, // will NOT change
    };
    renderModal(true, { initialValues });

    const noveltyInput = screen.getByLabelText(/^Novelty$/i);
    await user.clear(noveltyInput);
    await user.type(noveltyInput, "3");

    await user.click(
      screen.getByRole("button", { name: /save assessment/i }),
    );

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalled();
    });

    const [, patchBody] = mockPatch.mock.calls[0];
    // novelty changed: must be in patch
    expect(patchBody).toHaveProperty("novelty", 3);
    // clarity unchanged: must NOT be in patch
    expect(patchBody).not.toHaveProperty("clarity");
  });

  it("sends verification_status when changed", async () => {
    const user = userEvent.setup();
    mockPatch.mockResolvedValueOnce(
      makeEnvelope({ novelty: 1, verification_status: "verified" }),
    );

    const initialValues: AssessmentInitialValues = {
      novelty: 1, // same; unchanged
      verification_status: "unverified",
    };
    renderModal(true, { initialValues });

    const vsSelect = screen.getByRole("combobox", { name: /verification status/i });
    await user.selectOptions(vsSelect, "verified");

    await user.click(
      screen.getByRole("button", { name: /save assessment/i }),
    );

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalled();
    });
    const [, patchBody] = mockPatch.mock.calls[0];
    expect(patchBody).toHaveProperty("verification_status", "verified");
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe("AssessmentModal — error state", () => {
  it("shows error banner on API failure, keeps modal open", async () => {
    const user = userEvent.setup();
    mockPatch.mockRejectedValueOnce(
      new ApiError(422, { detail: "Validation error: novelty out of range" }),
    );

    const onOpenChange = jest.fn();
    renderModal(true, { onOpenChange });

    const noveltyInput = screen.getByLabelText(/^Novelty$/i);
    await user.clear(noveltyInput);
    await user.type(noveltyInput, "9");

    await user.click(
      screen.getByRole("button", { name: /save assessment/i }),
    );

    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows generic error message for non-ApiError failures", async () => {
    const user = userEvent.setup();
    mockPatch.mockRejectedValueOnce(new Error("Network error"));

    renderModal();

    const noveltyInput = screen.getByLabelText(/^Novelty$/i);
    await user.clear(noveltyInput);
    await user.type(noveltyInput, "5");

    await user.click(
      screen.getByRole("button", { name: /save assessment/i }),
    );

    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(screen.getByText(/network error/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

describe("AssessmentModal — accessibility", () => {
  it("has role=dialog with aria-modal and aria-labelledby", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby");
  });

  it("all numeric dimension inputs have explicit labels", () => {
    renderModal();
    for (const label of [
      "Novelty",
      "Clarity",
      "Significance",
      "Originality",
      "Rigor",
      "Utility",
    ]) {
      expect(screen.getByLabelText(new RegExp(`^${label}$`, "i"))).toBeInTheDocument();
    }
  });

  it("categorical selects have labels", () => {
    renderModal();
    expect(
      screen.getByRole("combobox", { name: /verification status/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /^Fidelity$/i }),
    ).toBeInTheDocument();
  });
});
