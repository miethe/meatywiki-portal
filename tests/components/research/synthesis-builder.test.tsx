/**
 * SynthesisBuilder component tests (P4-02).
 *
 * Uses jest.mock to stub `@/lib/api/workflows` and `@/hooks/useSSE`
 * rather than MSW — avoids jsdom/undici fetch compatibility issues and
 * is consistent with the existing quick-add-modal.test.tsx pattern.
 *
 * Covers:
 * - Form renders with sources textarea + scope + focus inputs + submit button
 * - Submit button starts enabled (validation fires on submit, not on change)
 * - Shows validation error when sources are empty on submit (no API call made)
 * - Successful POST → transitions to "running" phase showing run_id + StageTracker
 * - API error → inline error message shown on error phase
 * - "Reset form" / "Try again" button returns to form phase
 */

import React from "react";
import { renderWithProviders, screen, waitFor } from "../../utils/render";
import { userEvent } from "../../utils/userEvent";
import { SynthesisBuilder } from "@/components/research/synthesis-builder";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/workflows", () => ({
  ...jest.requireActual("@/lib/api/workflows"),
  submitSynthesis: jest.fn(),
}));

jest.mock("@/hooks/useSSE", () => ({
  useSSE: jest.fn(),
}));

import { submitSynthesis } from "@/lib/api/workflows";
import { useSSE } from "@/hooks/useSSE";

const mockSubmitSynthesis = submitSynthesis as jest.MockedFunction<typeof submitSynthesis>;
const mockUseSSE = useSSE as jest.MockedFunction<typeof useSSE>;

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

function defaultUseSseReturn() {
  return {
    events: [],
    status: "idle" as const,
    error: null,
    reconnect: jest.fn(),
    close: jest.fn(),
  };
}

beforeEach(() => {
  mockUseSSE.mockReturnValue(defaultUseSseReturn());
});

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Form rendering
// ---------------------------------------------------------------------------

describe("SynthesisBuilder form", () => {
  it("renders the sources textarea", () => {
    renderWithProviders(<SynthesisBuilder />);
    expect(
      screen.getByRole("textbox", { name: /source artifacts/i }),
    ).toBeInTheDocument();
  });

  it("renders scope and focus inputs", () => {
    renderWithProviders(<SynthesisBuilder />);
    expect(screen.getByRole("textbox", { name: /scope/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /focus/i })).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    renderWithProviders(<SynthesisBuilder />);
    expect(
      screen.getByRole("button", { name: /launch synthesis/i }),
    ).toBeInTheDocument();
  });

  it("submit button is enabled initially", () => {
    renderWithProviders(<SynthesisBuilder />);
    expect(
      screen.getByRole("button", { name: /launch synthesis/i }),
    ).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Client-side validation
// ---------------------------------------------------------------------------

describe("SynthesisBuilder validation", () => {
  it("shows a validation error when sources are empty on submit", async () => {
    renderWithProviders(<SynthesisBuilder />);
    await userEvent.click(screen.getByRole("button", { name: /launch synthesis/i }));
    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(/at least one source/i);
  });

  it("does not call submitSynthesis when sources are empty", async () => {
    renderWithProviders(<SynthesisBuilder />);
    await userEvent.click(screen.getByRole("button", { name: /launch synthesis/i }));
    expect(mockSubmitSynthesis).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Successful POST flow
// ---------------------------------------------------------------------------

describe("SynthesisBuilder success flow", () => {
  beforeEach(() => {
    mockSubmitSynthesis.mockResolvedValue({
      run_id: "run-test-01",
      status: "queued",
      created_at: "2026-04-17T00:00:00Z",
    });
  });

  it("calls submitSynthesis with the entered sources", async () => {
    renderWithProviders(<SynthesisBuilder />);
    const textarea = screen.getByRole("textbox", { name: /source artifacts/i });
    await userEvent.type(textarea, "01HXYZ0000000000000000001");
    await userEvent.click(screen.getByRole("button", { name: /launch synthesis/i }));

    await waitFor(() => {
      expect(mockSubmitSynthesis).toHaveBeenCalledWith(
        expect.objectContaining({
          sources: ["01HXYZ0000000000000000001"],
        }),
      );
    });
  });

  it("transitions to running phase showing run_id after 202", async () => {
    renderWithProviders(<SynthesisBuilder />);
    const textarea = screen.getByRole("textbox", { name: /source artifacts/i });
    await userEvent.type(textarea, "01HXYZ0000000000000000001");
    await userEvent.click(screen.getByRole("button", { name: /launch synthesis/i }));

    await waitFor(() => {
      expect(screen.getByText(/synthesizing/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/run-test-01/)).toBeInTheDocument();
  });

  it("renders the StageTracker during the running phase", async () => {
    renderWithProviders(<SynthesisBuilder />);
    const textarea = screen.getByRole("textbox", { name: /source artifacts/i });
    await userEvent.type(textarea, "01HXYZ0000000000000000001");
    await userEvent.click(screen.getByRole("button", { name: /launch synthesis/i }));

    await waitFor(() => {
      expect(screen.getByText(/synthesizing/i)).toBeInTheDocument();
    });

    // StageTracker renders a list with aria-label containing "workflow stages"
    expect(screen.getByRole("list", { name: /workflow stages/i })).toBeInTheDocument();
  });

  it("forwards optional scope and focus to submitSynthesis", async () => {
    renderWithProviders(<SynthesisBuilder />);
    const textarea = screen.getByRole("textbox", { name: /source artifacts/i });
    const scopeInput = screen.getByRole("textbox", { name: /scope/i });
    const focusInput = screen.getByRole("textbox", { name: /focus/i });

    await userEvent.type(textarea, "01HXYZ0000000000000000001");
    await userEvent.type(scopeInput, "wiki/concepts/**");
    await userEvent.type(focusInput, "performance benchmarks");
    await userEvent.click(screen.getByRole("button", { name: /launch synthesis/i }));

    await waitFor(() => {
      expect(mockSubmitSynthesis).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "wiki/concepts/**",
          focus: "performance benchmarks",
        }),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// API error flow
// ---------------------------------------------------------------------------

describe("SynthesisBuilder error flow", () => {
  beforeEach(() => {
    mockSubmitSynthesis.mockRejectedValue(new Error("API 500 Internal Server Error"));
  });

  it("shows an error message when the API call fails", async () => {
    renderWithProviders(<SynthesisBuilder />);
    const textarea = screen.getByRole("textbox", { name: /source artifacts/i });
    await userEvent.type(textarea, "01HXYZ0000000000000000001");
    await userEvent.click(screen.getByRole("button", { name: /launch synthesis/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("shows a reset button after a POST error", async () => {
    renderWithProviders(<SynthesisBuilder />);
    const textarea = screen.getByRole("textbox", { name: /source artifacts/i });
    await userEvent.type(textarea, "01HXYZ0000000000000000001");
    await userEvent.click(screen.getByRole("button", { name: /launch synthesis/i }));

    await waitFor(() => {
      const resetBtn =
        screen.queryByRole("button", { name: /reset form/i }) ??
        screen.queryByRole("button", { name: /try again/i });
      expect(resetBtn).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Reset flow
// ---------------------------------------------------------------------------

describe("SynthesisBuilder reset", () => {
  it("resets to form phase after clicking 'Reset form' on POST error", async () => {
    mockSubmitSynthesis.mockRejectedValue(new Error("API error"));

    renderWithProviders(<SynthesisBuilder />);
    const textarea = screen.getByRole("textbox", { name: /source artifacts/i });
    await userEvent.type(textarea, "01HXYZ0000000000000000001");
    await userEvent.click(screen.getByRole("button", { name: /launch synthesis/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    const resetBtn =
      screen.queryByRole("button", { name: /reset form/i }) ??
      screen.queryByRole("button", { name: /try again/i });

    if (resetBtn) {
      await userEvent.click(resetBtn);
      expect(
        await screen.findByRole("button", { name: /launch synthesis/i }),
      ).toBeInTheDocument();
    }
  });
});
