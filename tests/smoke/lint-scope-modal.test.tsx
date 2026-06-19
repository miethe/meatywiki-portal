/**
 * LintScopeModal seam tests (P2-S1 — Remediation Bundle v1).
 *
 * Verifies the full FE↔BE seam for the lint-scope flow:
 *   1. Modal renders open with a scope selector and "Run Lint" button.
 *   2. Selecting a scope and submitting fires PATCH /api/artifacts/:id/lint-scope
 *      with the correct { scope } body via lintArtifactScope.
 *   3. On success, the returned LintScopeResponse renders:
 *        - severity badge
 *        - checks_passed / checks_run totals
 *        - total_issues count
 *        - violations grouped by check name with per-row severity badges
 *   4. Error path: endpoint failure → inline role="alert" error banner.
 *   5. Scope selector renders all three scope options.
 *
 * Mocking strategy:
 *   Mock `lintArtifactScope` from `@/lib/api/artifacts` — same boundary used
 *   by quick-add-modal.test.tsx (jest.mock on the module function, not MSW).
 *   `ApiError` is imported from `@/lib/api/client` (re-exported as actual so
 *   the component's `instanceof ApiError` check works correctly).
 *
 * Remediation Bundle v1 — P2-S1.
 */

import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Mock lintArtifactScope — keep the rest of the module real so ApiError
// instanceof checks in the component work correctly.
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/artifacts", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/artifacts")>(
    "@/lib/api/artifacts",
  );
  return {
    ...actual,
    lintArtifactScope: jest.fn(),
  };
});

import { lintArtifactScope } from "@/lib/api/artifacts";
import type { LintScopeResponse } from "@/types/artifact";

const mockLintArtifactScope = lintArtifactScope as jest.MockedFunction<
  typeof lintArtifactScope
>;

// ---------------------------------------------------------------------------
// Import component under test after mocks are registered
// ---------------------------------------------------------------------------

import { LintScopeModal } from "@/components/artifact/LintScopeModal";

// ---------------------------------------------------------------------------
// Stub data
// ---------------------------------------------------------------------------

const TEST_ARTIFACT_ID = "01HXYZ0000000000000000042";

/** Clean LintScopeResponse with two violations across two checks */
const STUB_RESPONSE_WITH_VIOLATIONS: LintScopeResponse = {
  artifact_id: TEST_ARTIFACT_ID,
  scope: "all",
  severity: "error",
  checks_run: 5,
  checks_passed: 3,
  checks_failed: 2,
  total_issues: 2,
  run_id: "run-lint-stub-001",
  trace_id: null,
  template_id: null,
  results: [
    { check: "frontmatter_required_fields", severity: "error", passed: false, violations: 1 },
    { check: "content_structure", severity: "warning", passed: false, violations: 1 },
    { check: "slug_format", severity: "ok", passed: true, violations: 0 },
    { check: "schema_version", severity: "ok", passed: true, violations: 0 },
    { check: "tag_format", severity: "ok", passed: true, violations: 0 },
  ],
  violations: [
    {
      check: "frontmatter_required_fields",
      severity: "error",
      artifact_id: TEST_ARTIFACT_ID,
      file_path: "wiki/concepts/stub-artifact.md",
      message: "Missing required field: domain",
      fixable: true,
      fix_detail: "Add `domain: <value>` to frontmatter",
    },
    {
      check: "content_structure",
      severity: "warning",
      artifact_id: TEST_ARTIFACT_ID,
      file_path: "wiki/concepts/stub-artifact.md",
      message: "No H2 section headers found",
      fixable: false,
      fix_detail: null,
    },
  ],
};

/** Clean response — no violations */
const STUB_RESPONSE_CLEAN: LintScopeResponse = {
  artifact_id: TEST_ARTIFACT_ID,
  scope: "frontmatter",
  severity: "ok",
  checks_run: 3,
  checks_passed: 3,
  checks_failed: 0,
  total_issues: 0,
  run_id: "run-lint-stub-002",
  trace_id: null,
  template_id: null,
  results: [
    { check: "frontmatter_required_fields", severity: "ok", passed: true, violations: 0 },
    { check: "schema_version", severity: "ok", passed: true, violations: 0 },
    { check: "tag_format", severity: "ok", passed: true, violations: 0 },
  ],
  violations: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderModal(props: { open?: boolean; onOpenChange?: jest.Mock } = {}) {
  const onOpenChange = props.onOpenChange ?? jest.fn();
  render(
    <LintScopeModal
      artifactId={TEST_ARTIFACT_ID}
      open={props.open ?? true}
      onOpenChange={onOpenChange}
    />,
  );
  return { onOpenChange };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LintScopeModal (P2-S1 seam test)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Initial render / modal structure
  // -------------------------------------------------------------------------

  describe("Initial render", () => {
    it("renders the dialog landmark with correct title when open=true", () => {
      mockLintArtifactScope.mockResolvedValue(STUB_RESPONSE_WITH_VIOLATIONS);
      renderModal();

      expect(screen.getByRole("dialog", { name: /lint artifact/i })).toBeInTheDocument();
    });

    it("renders nothing when open=false", () => {
      renderModal({ open: false });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("renders the scope selector with all three scope options", () => {
      mockLintArtifactScope.mockResolvedValue(STUB_RESPONSE_WITH_VIOLATIONS);
      renderModal();

      const select = screen.getByRole("combobox", { name: /lint scope/i }) as HTMLSelectElement;
      expect(select).toBeInTheDocument();

      // All three scope values present as options
      const optionValues = Array.from(select.options).map((o) => o.value);
      expect(optionValues).toContain("frontmatter");
      expect(optionValues).toContain("content");
      expect(optionValues).toContain("all");
    });

    it("renders the 'Run Lint' submit button", () => {
      mockLintArtifactScope.mockResolvedValue(STUB_RESPONSE_WITH_VIOLATIONS);
      renderModal();

      expect(
        screen.getByRole("button", { name: /run lint/i }),
      ).toBeInTheDocument();
    });

    it("renders the 'Cancel' button", () => {
      mockLintArtifactScope.mockResolvedValue(STUB_RESPONSE_WITH_VIOLATIONS);
      renderModal();

      expect(
        screen.getByRole("button", { name: /cancel/i }),
      ).toBeInTheDocument();
    });

    it("defaults to scope 'all'", () => {
      mockLintArtifactScope.mockResolvedValue(STUB_RESPONSE_WITH_VIOLATIONS);
      renderModal();

      const select = screen.getByRole("combobox", { name: /lint scope/i }) as HTMLSelectElement;
      expect(select.value).toBe("all");
    });
  });

  // -------------------------------------------------------------------------
  // API seam — correct PATCH call with scope body
  // -------------------------------------------------------------------------

  describe("API seam — lintArtifactScope call", () => {
    it("calls lintArtifactScope with artifact ID and default scope 'all' on submit", async () => {
      mockLintArtifactScope.mockResolvedValue(STUB_RESPONSE_WITH_VIOLATIONS);
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole("button", { name: /run lint/i }));

      await waitFor(() => {
        expect(mockLintArtifactScope).toHaveBeenCalledTimes(1);
      });

      expect(mockLintArtifactScope).toHaveBeenCalledWith(
        TEST_ARTIFACT_ID,
        "all",
      );
    });

    it("calls lintArtifactScope with scope 'frontmatter' when that scope is selected", async () => {
      mockLintArtifactScope.mockResolvedValue(STUB_RESPONSE_CLEAN);
      const user = userEvent.setup();
      renderModal();

      // Change scope to frontmatter
      const select = screen.getByRole("combobox", { name: /lint scope/i });
      await user.selectOptions(select, "frontmatter");

      await user.click(screen.getByRole("button", { name: /run lint/i }));

      await waitFor(() => {
        expect(mockLintArtifactScope).toHaveBeenCalledTimes(1);
      });

      expect(mockLintArtifactScope).toHaveBeenCalledWith(
        TEST_ARTIFACT_ID,
        "frontmatter",
      );
    });

    it("calls lintArtifactScope with scope 'content' when that scope is selected", async () => {
      mockLintArtifactScope.mockResolvedValue(STUB_RESPONSE_CLEAN);
      const user = userEvent.setup();
      renderModal();

      const select = screen.getByRole("combobox", { name: /lint scope/i });
      await user.selectOptions(select, "content");

      await user.click(screen.getByRole("button", { name: /run lint/i }));

      await waitFor(() => {
        expect(mockLintArtifactScope).toHaveBeenCalledWith(
          TEST_ARTIFACT_ID,
          "content",
        );
      });
    });

    it("disables the submit button while the request is in flight", async () => {
      // Never resolves during this test — keeps the loading state active
      mockLintArtifactScope.mockReturnValue(new Promise(() => {}));
      const user = userEvent.setup();
      renderModal();

      const submitBtn = screen.getByRole("button", { name: /run lint/i });
      await user.click(submitBtn);

      // Button becomes disabled (shows "Linting…" state)
      await waitFor(() => {
        expect(screen.getByText(/linting/i)).toBeInTheDocument();
      });
      expect(submitBtn).toBeDisabled();
    });
  });

  // -------------------------------------------------------------------------
  // Success path — results rendering
  // -------------------------------------------------------------------------

  describe("Success path — results panel", () => {
    async function submitAndWaitForResults() {
      mockLintArtifactScope.mockResolvedValue(STUB_RESPONSE_WITH_VIOLATIONS);
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole("button", { name: /run lint/i }));

      // Wait for results panel to appear
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /run again with different scope/i }),
        ).toBeInTheDocument();
      });
    }

    it("renders the overall severity badge after a successful run", async () => {
      await submitAndWaitForResults();
      // Summary row: aria-label "Lint result: Error" — check by aria-label scope
      expect(
        screen.getByLabelText(/lint result: error/i),
      ).toBeInTheDocument();
    });

    it("renders checks_passed / checks_run totals", async () => {
      await submitAndWaitForResults();
      // "3/5 checks passed"
      expect(screen.getByText(/3\/5 checks passed/i)).toBeInTheDocument();
    });

    it("renders total_issues count", async () => {
      await submitAndWaitForResults();
      // "2 issues"
      expect(screen.getByText(/2 issues?/i)).toBeInTheDocument();
    });

    it("renders the scope in the summary row", async () => {
      await submitAndWaitForResults();
      // "Scope: all"
      expect(screen.getByText(/scope:\s*all/i)).toBeInTheDocument();
    });

    it("renders the violations list grouped by check name", async () => {
      await submitAndWaitForResults();

      // aria-label "Lint violations" list
      expect(screen.getByRole("list", { name: /lint violations/i })).toBeInTheDocument();

      // Check group labels
      expect(screen.getByText(/frontmatter_required_fields/i)).toBeInTheDocument();
      expect(screen.getByText(/content_structure/i)).toBeInTheDocument();
    });

    it("renders violation messages", async () => {
      await submitAndWaitForResults();

      expect(screen.getByText(/missing required field: domain/i)).toBeInTheDocument();
      expect(screen.getByText(/no H2 section headers found/i)).toBeInTheDocument();
    });

    it("renders severity badges on each violation row", async () => {
      await submitAndWaitForResults();

      // "ERROR" badge for the first violation (severity: error → "Error" label uppercased)
      expect(screen.getByText("ERROR")).toBeInTheDocument();
      // "WARNING" badge for the second violation
      expect(screen.getByText("WARNING")).toBeInTheDocument();
    });

    it("renders the fix_detail when present", async () => {
      await submitAndWaitForResults();

      expect(
        screen.getByText(/add `domain: <value>` to frontmatter/i),
      ).toBeInTheDocument();
    });

    it("renders 'no violations' message on a clean run", async () => {
      mockLintArtifactScope.mockResolvedValue(STUB_RESPONSE_CLEAN);
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole("button", { name: /run lint/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/no violations found/i),
        ).toBeInTheDocument();
      });
    });

    it("hides the scope picker form after a successful run", async () => {
      await submitAndWaitForResults();
      // The scope selector should no longer be in the DOM
      expect(
        screen.queryByRole("combobox", { name: /lint scope/i }),
      ).not.toBeInTheDocument();
    });

    it("renders 'Run again' button that restores the scope picker", async () => {
      mockLintArtifactScope.mockResolvedValue(STUB_RESPONSE_WITH_VIOLATIONS);
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole("button", { name: /run lint/i }));

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /run again with different scope/i }),
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", { name: /run again with different scope/i }),
      );

      // Scope picker should be back
      await waitFor(() => {
        expect(
          screen.getByRole("combobox", { name: /lint scope/i }),
        ).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Error path — API failure renders error banner
  // -------------------------------------------------------------------------

  describe("Error path", () => {
    it("renders an error alert when the API call fails with ApiError", async () => {
      mockLintArtifactScope.mockRejectedValue(
        new ApiError(500, { error: { message: "Internal server error" } }),
      );
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole("button", { name: /run lint/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      expect(screen.getByText(/internal server error/i)).toBeInTheDocument();
    });

    it("renders error message from ApiError detail string", async () => {
      mockLintArtifactScope.mockRejectedValue(
        new ApiError(422, { detail: "Scope parameter invalid" }),
      );
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole("button", { name: /run lint/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      expect(screen.getByText(/scope parameter invalid/i)).toBeInTheDocument();
    });

    it("renders a generic error message for non-ApiError failures", async () => {
      mockLintArtifactScope.mockRejectedValue(new Error("Network timeout"));
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole("button", { name: /run lint/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      expect(screen.getByText(/network timeout/i)).toBeInTheDocument();
    });

    it("keeps the scope picker form visible after an error", async () => {
      mockLintArtifactScope.mockRejectedValue(
        new ApiError(503, { detail: "Service unavailable" }),
      );
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole("button", { name: /run lint/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      // Scope picker still present — user can retry
      expect(
        screen.getByRole("combobox", { name: /lint scope/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /run lint/i }),
      ).toBeInTheDocument();
    });

    it("re-enables the submit button after an error so the user can retry", async () => {
      mockLintArtifactScope.mockRejectedValue(
        new ApiError(500, { error: { message: "Internal server error" } }),
      );
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole("button", { name: /run lint/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: /run lint/i })).not.toBeDisabled();
    });

    it("renders the api_error code as fallback when no message is present", async () => {
      mockLintArtifactScope.mockRejectedValue(new ApiError(404, null));
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole("button", { name: /run lint/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      expect(screen.getByText(/api error 404/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Accessibility — WCAG 2.1 AA
  // -------------------------------------------------------------------------

  describe("Accessibility", () => {
    it("dialog has role=dialog and aria-modal=true", () => {
      mockLintArtifactScope.mockResolvedValue(STUB_RESPONSE_WITH_VIOLATIONS);
      renderModal();

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });

    it("dialog has aria-labelledby pointing to the 'Lint artifact' heading", () => {
      mockLintArtifactScope.mockResolvedValue(STUB_RESPONSE_WITH_VIOLATIONS);
      const { container } = render(
        <LintScopeModal
          artifactId={TEST_ARTIFACT_ID}
          open={true}
          onOpenChange={jest.fn()}
        />,
      );

      const heading = screen.getByRole("heading", { name: /lint artifact/i });
      const headingId = heading.id;
      expect(headingId).toBeTruthy();

      const dialog = container.querySelector(`[aria-labelledby="${headingId}"]`);
      expect(dialog).toBeInTheDocument();
    });

    it("close button has a descriptive aria-label", () => {
      mockLintArtifactScope.mockResolvedValue(STUB_RESPONSE_WITH_VIOLATIONS);
      renderModal();

      expect(
        screen.getByRole("button", { name: /close lint scope dialog/i }),
      ).toBeInTheDocument();
    });

    it("error region has role=alert and aria-live=assertive", async () => {
      mockLintArtifactScope.mockRejectedValue(
        new ApiError(500, { error: { message: "Server error" } }),
      );
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole("button", { name: /run lint/i }));

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toHaveAttribute("aria-live", "assertive");
      });
    });

    it("violation severity badge has aria-label with severity name", async () => {
      mockLintArtifactScope.mockResolvedValue(STUB_RESPONSE_WITH_VIOLATIONS);
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole("button", { name: /run lint/i }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /run again/i })).toBeInTheDocument();
      });

      // aria-label on severity badge spans
      expect(screen.getByLabelText(/severity: error/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/severity: warning/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Close / dismiss behaviour
  // -------------------------------------------------------------------------

  describe("Close behaviour", () => {
    it("calls onOpenChange(false) when Cancel is clicked", async () => {
      mockLintArtifactScope.mockResolvedValue(STUB_RESPONSE_WITH_VIOLATIONS);
      const user = userEvent.setup();
      const onOpenChange = jest.fn();
      renderModal({ onOpenChange });

      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("calls onOpenChange(false) when close (X) button is clicked", async () => {
      mockLintArtifactScope.mockResolvedValue(STUB_RESPONSE_WITH_VIOLATIONS);
      const user = userEvent.setup();
      const onOpenChange = jest.fn();
      renderModal({ onOpenChange });

      await user.click(
        screen.getByRole("button", { name: /close lint scope dialog/i }),
      );

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("calls onOpenChange(false) when backdrop is clicked", async () => {
      mockLintArtifactScope.mockResolvedValue(STUB_RESPONSE_WITH_VIOLATIONS);
      const user = userEvent.setup();
      const onOpenChange = jest.fn();
      renderModal({ onOpenChange });

      // Click the backdrop (aria-hidden overlay div is the first child of the fragment)
      const backdrop = document.querySelector('[aria-hidden="true"]');
      expect(backdrop).not.toBeNull();
      await user.click(backdrop!);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("does not call onOpenChange while submitting", async () => {
      mockLintArtifactScope.mockReturnValue(new Promise(() => {}));
      const user = userEvent.setup();
      const onOpenChange = jest.fn();
      renderModal({ onOpenChange });

      await user.click(screen.getByRole("button", { name: /run lint/i }));

      // Wait for loading state
      await waitFor(() => {
        expect(screen.getByText(/linting/i)).toBeInTheDocument();
      });

      // Cancel is disabled during submit; click has no effect
      const cancelBtn = screen.getByRole("button", { name: /cancel/i });
      expect(cancelBtn).toBeDisabled();
    });
  });
});
