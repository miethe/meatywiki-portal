/**
 * Tests for QualityGateIndicator (P1.5-1-05).
 *
 * The hook (useQualityGates) is mocked so tests are fully deterministic.
 * All 10+ cases are covered:
 *
 *   1.  Returns null when gates is null (no data case — graceful hidden state)
 *   2.  Returns null when rules is an empty array
 *   3.  Returns null when isLoading is true (no flash of empty badge)
 *   4.  Returns null when isError is true (silent degradation)
 *   5.  Shows collapsed badge when data is present (all-pass case)
 *   6.  Shows collapsed badge when data is present (some-fail case)
 *   7.  Accordion opens on click — panel with rule list is visible
 *   8.  Each rule shows its name, condition text, and pass/fail state
 *   9.  Accordion closes on second click
 *  10.  ARIA: aria-expanded on trigger (false when closed, true when open)
 *  11.  ARIA: aria-controls matches panel id; panel has role="region"
 *  12.  ARIA: aria-label on trigger reflects gate status
 *  13.  Pass count badge displays correct fraction (passCount / total)
 *  14.  workflowRunId prop is forwarded to useQualityGates
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QualityGateIndicator } from "@/components/artifact/quality-gate-indicator";
import type { QualityGateRule } from "@/lib/api/artifacts";

// ---------------------------------------------------------------------------
// Mock useQualityGates
// ---------------------------------------------------------------------------

const mockUseQualityGates = jest.fn();

jest.mock("@/hooks/useQualityGates", () => ({
  useQualityGates: (...args: unknown[]) => mockUseQualityGates(...args),
}));

// ---------------------------------------------------------------------------
// Stub data
// ---------------------------------------------------------------------------

const allPassRules: QualityGateRule[] = [
  { name: "required_frontmatter", passed: true, condition: "All required frontmatter fields are present" },
  { name: "schema_version_valid", passed: true, condition: "schema_version matches 1.0.0 or 1.1.0" },
  { name: "title_not_empty", passed: true, condition: "title field is non-empty string" },
];

const mixedRules: QualityGateRule[] = [
  { name: "required_frontmatter", passed: true, condition: "All required frontmatter fields are present" },
  { name: "fidelity_range", passed: false, condition: "fidelity must be one of: high, medium, low" },
  { name: "no_contradictions", passed: false, condition: "No outgoing contradicts edges flagged by lint stage" },
];

const singleFailRule: QualityGateRule[] = [
  { name: "schema_version_valid", passed: false, condition: "schema_version matches 1.0.0 or 1.1.0" },
];

// ---------------------------------------------------------------------------
// Helper: set the mock return value
// ---------------------------------------------------------------------------

function mockGates(gates: { rules: QualityGateRule[] } | null, isLoading = false, isError = false) {
  mockUseQualityGates.mockReturnValue({
    gates,
    isLoading,
    isError,
    error: isError ? new Error("fetch failed") : null,
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockUseQualityGates.mockReset();
});

describe("QualityGateIndicator — null / hidden states", () => {
  it("1. returns null when gates is null (no quality gate data)", () => {
    mockGates(null);
    const { container } = render(
      <QualityGateIndicator artifactId="art-001" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("2. returns null when rules array is empty", () => {
    mockGates({ rules: [] });
    const { container } = render(
      <QualityGateIndicator artifactId="art-001" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("3. returns null while isLoading is true (no flash of empty badge)", () => {
    mockGates(null, true);
    const { container } = render(
      <QualityGateIndicator artifactId="art-001" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("4. returns null when isError is true (silent degradation)", () => {
    mockGates(null, false, true);
    const { container } = render(
      <QualityGateIndicator artifactId="art-001" />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("QualityGateIndicator — collapsed badge (data present)", () => {
  it("5. shows collapsed badge with 'passed' label when all rules pass", () => {
    mockGates({ rules: allPassRules });
    render(<QualityGateIndicator artifactId="art-001" />);
    // The word "passed" is in a <span> inside the trigger; findByText in the button
    expect(screen.getByText("passed")).toBeInTheDocument();
  });

  it("6. shows collapsed badge with fail count when some rules fail", () => {
    mockGates({ rules: mixedRules });
    render(<QualityGateIndicator artifactId="art-001" />);
    // 2 rules failed out of 3. Text may be split across spans so check aria-label
    const trigger = screen.getByRole("button");
    expect(trigger.getAttribute("aria-label")).toMatch(/2.*fail|fail.*2/i);
  });

  it("13. pass count badge shows correct fraction (passCount / total)", () => {
    mockGates({ rules: mixedRules }); // 1 pass, 2 fail
    render(<QualityGateIndicator artifactId="art-001" />);
    // Fraction pill: "1/3"
    expect(screen.getByText("1/3")).toBeInTheDocument();
  });

  it("shows correct fraction for all-pass case", () => {
    mockGates({ rules: allPassRules }); // 3 pass, 0 fail
    render(<QualityGateIndicator artifactId="art-001" />);
    expect(screen.getByText("3/3")).toBeInTheDocument();
  });

  it("shows singular 'gate failed' for a single failure", () => {
    mockGates({ rules: singleFailRule });
    render(<QualityGateIndicator artifactId="art-001" />);
    // Text is split across spans; use the aria-label which is a single string
    const trigger = screen.getByRole("button");
    expect(trigger.getAttribute("aria-label")).toMatch(/1.*fail/i);
  });
});

describe("QualityGateIndicator — accordion interaction", () => {
  it("7. accordion panel is not visible by default (collapsed state)", () => {
    mockGates({ rules: allPassRules });
    render(<QualityGateIndicator artifactId="art-001" />);
    // Panel content should not be visible
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("7. accordion opens on click — rule list is visible", async () => {
    mockGates({ rules: allPassRules });
    const user = userEvent.setup();
    render(<QualityGateIndicator artifactId="art-001" />);

    const trigger = screen.getByRole("button");
    await user.click(trigger);

    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("8. each rule shows its name", async () => {
    mockGates({ rules: allPassRules });
    const user = userEvent.setup();
    render(<QualityGateIndicator artifactId="art-001" />);

    await user.click(screen.getByRole("button"));

    for (const rule of allPassRules) {
      expect(screen.getByText(rule.name)).toBeInTheDocument();
    }
  });

  it("8. each rule shows its condition text", async () => {
    mockGates({ rules: allPassRules });
    const user = userEvent.setup();
    render(<QualityGateIndicator artifactId="art-001" />);

    await user.click(screen.getByRole("button"));

    for (const rule of allPassRules) {
      expect(screen.getByText(rule.condition)).toBeInTheDocument();
    }
  });

  it("8. pass rules show 'pass' label, fail rules show 'fail' label", async () => {
    mockGates({ rules: mixedRules });
    const user = userEvent.setup();
    render(<QualityGateIndicator artifactId="art-001" />);

    await user.click(screen.getByRole("button"));

    // 1 pass label visible
    const passLabels = screen.getAllByText("pass");
    expect(passLabels.length).toBeGreaterThanOrEqual(1);

    // 2 fail labels visible
    const failLabels = screen.getAllByText("fail");
    expect(failLabels.length).toBeGreaterThanOrEqual(2);
  });

  it("9. accordion closes on second click", async () => {
    mockGates({ rules: allPassRules });
    const user = userEvent.setup();
    render(<QualityGateIndicator artifactId="art-001" />);

    const trigger = screen.getByRole("button");

    // Open
    await user.click(trigger);
    expect(screen.getByRole("region")).toBeInTheDocument();

    // Close
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.queryByRole("region")).not.toBeInTheDocument();
    });
  });
});

describe("QualityGateIndicator — WCAG 2.1 AA", () => {
  it("10. trigger has aria-expanded=false when collapsed", () => {
    mockGates({ rules: allPassRules });
    render(<QualityGateIndicator artifactId="art-001" />);

    const trigger = screen.getByRole("button");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("10. trigger has aria-expanded=true when expanded", async () => {
    mockGates({ rules: allPassRules });
    const user = userEvent.setup();
    render(<QualityGateIndicator artifactId="art-001" />);

    const trigger = screen.getByRole("button");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("11. aria-controls on trigger matches panel id", async () => {
    mockGates({ rules: allPassRules });
    const user = userEvent.setup();
    render(<QualityGateIndicator artifactId="art-002" />);

    const trigger = screen.getByRole("button");
    const panelId = trigger.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();

    await user.click(trigger);
    const panel = screen.getByRole("region");
    expect(panel).toHaveAttribute("id", panelId!);
  });

  it("11. accordion panel has role=region with aria-labelledby pointing at trigger", async () => {
    mockGates({ rules: allPassRules });
    const user = userEvent.setup();
    render(<QualityGateIndicator artifactId="art-003" />);

    await user.click(screen.getByRole("button"));

    const panel = screen.getByRole("region");
    const labelledBy = panel.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();

    const trigger = document.getElementById(labelledBy!);
    expect(trigger).not.toBeNull();
  });

  it("12. aria-label on trigger reflects all-pass status", () => {
    mockGates({ rules: allPassRules });
    render(<QualityGateIndicator artifactId="art-004" />);

    const trigger = screen.getByRole("button");
    expect(trigger.getAttribute("aria-label")).toMatch(/all.*passed|passed.*gates/i);
  });

  it("12. aria-label on trigger reflects fail count for failed gates", () => {
    mockGates({ rules: mixedRules });
    render(<QualityGateIndicator artifactId="art-005" />);

    const trigger = screen.getByRole("button");
    const label = trigger.getAttribute("aria-label") ?? "";
    expect(label).toMatch(/2.*fail|fail.*2/i);
  });
});

describe("QualityGateIndicator — prop forwarding", () => {
  it("14. workflowRunId is forwarded to useQualityGates", () => {
    mockGates(null);
    render(
      <QualityGateIndicator artifactId="art-006" workflowRunId="run-abc-01" />,
    );
    expect(mockUseQualityGates).toHaveBeenCalledWith("art-006", "run-abc-01");
  });

  it("calls useQualityGates with just artifactId when workflowRunId is omitted", () => {
    mockGates(null);
    render(<QualityGateIndicator artifactId="art-007" />);
    expect(mockUseQualityGates).toHaveBeenCalledWith("art-007", undefined);
  });

  it("className prop is forwarded to the container element", () => {
    mockGates({ rules: allPassRules });
    const { container } = render(
      <QualityGateIndicator artifactId="art-008" className="custom-class" />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("custom-class");
  });
});
