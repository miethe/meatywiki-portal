"use client";

/**
 * QualityGateIndicator — compact quality gate status badge with accordion detail.
 *
 * Displays a badge on an artifact card/detail indicating the pass/fail status
 * of quality gate checks from the most recent compile workflow run.
 *
 * Behaviour:
 *   - Renders nothing (returns null) when no quality gate data exists for the
 *     artifact — this is the expected state for artifacts with no compile history.
 *   - Shows a collapsed badge summarising overall pass/fail (green/red) when data
 *     is available.
 *   - On click, expands an accordion listing each rule with its name, pass/fail
 *     state (check/cross icon), and triggering condition text.
 *   - Loading and error states are hidden (null) — the component degrades
 *     silently rather than cluttering the artifact card UI.
 *
 * WCAG 2.1 AA:
 *   - Accordion trigger carries aria-expanded and aria-controls.
 *   - aria-label on the trigger describes the gate status.
 *   - Pass/fail icons carry aria-hidden; text state is visible.
 *
 * Traces FR-1.5-04 (Portal v1.5 Phase 1).
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useQualityGates } from "@/hooks/useQualityGates";
import type { QualityGateRule } from "@/lib/api/artifacts";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface QualityGateIndicatorProps {
  /** Artifact ULID — required; determines which gates to load */
  artifactId: string;
  /**
   * Optional workflow run ID. When provided it narrows the query-cache key
   * so the result can be invalidated after a specific run completes.
   * When omitted the most recent run's gates are shown.
   */
  workflowRunId?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeOverallStatus(rules: QualityGateRule[]): "pass" | "fail" {
  return rules.every((r) => r.passed) ? "pass" : "fail";
}

function PassIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-3.5 w-3.5", className)}
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 8l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FailIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-3.5 w-3.5", className)}
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.5 5.5l5 5M10.5 5.5l-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "h-3 w-3 shrink-0 transition-transform duration-200",
        expanded && "rotate-180",
      )}
      aria-hidden="true"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Rule row
// ---------------------------------------------------------------------------

function RuleRow({ rule }: { rule: QualityGateRule }) {
  return (
    <li className="flex items-start gap-2 py-1.5">
      <span
        className={cn(
          "mt-0.5 shrink-0",
          rule.passed ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400",
        )}
      >
        {rule.passed ? <PassIcon /> : <FailIcon />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground leading-tight">
          {rule.name}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
          {rule.condition}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 text-[10px] font-semibold uppercase tracking-wide",
          rule.passed ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400",
        )}
      >
        {rule.passed ? "pass" : "fail"}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * QualityGateIndicator — renders nothing when no quality gate data is available.
 *
 * Fetches via ``useQualityGates`` and returns null on:
 *   - Missing / null gate data (artifact has no compile history)
 *   - Loading state (prevents layout shift)
 *   - Error state (degrades silently; error is not surfaced here)
 */
export function QualityGateIndicator({
  artifactId,
  workflowRunId,
  className,
}: QualityGateIndicatorProps) {
  const [expanded, setExpanded] = useState(false);
  const { gates, isLoading } = useQualityGates(artifactId, workflowRunId);

  // Do not render during load — prevents a flash of empty badge.
  if (isLoading) return null;
  // Do not render when no gate data is available (graceful hidden state).
  if (!gates || gates.rules.length === 0) return null;

  const status = computeOverallStatus(gates.rules);
  const passCount = gates.rules.filter((r) => r.passed).length;
  const failCount = gates.rules.length - passCount;

  const panelId = `quality-gate-panel-${artifactId}`;
  const triggerId = `quality-gate-trigger-${artifactId}`;

  const badgeLabel =
    status === "pass"
      ? `Quality gates: all ${gates.rules.length} passed`
      : `Quality gates: ${failCount} of ${gates.rules.length} failed`;

  return (
    <div className={cn("rounded-md border bg-card", className)}>
      {/* Accordion trigger / badge */}
      <button
        id={triggerId}
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={badgeLabel}
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium",
          "transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          status === "pass"
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400",
        )}
      >
        {/* Status icon */}
        {status === "pass" ? (
          <PassIcon className="shrink-0" />
        ) : (
          <FailIcon className="shrink-0" />
        )}

        {/* Label */}
        <span className="flex-1 leading-tight">
          {status === "pass" ? (
            <>Gates <span className="font-semibold">passed</span></>
          ) : (
            <><span className="font-semibold">{failCount}</span> gate{failCount !== 1 ? "s" : ""} failed</>
          )}
        </span>

        {/* Count pill */}
        <span
          className={cn(
            "inline-flex items-center rounded-sm px-1 text-[10px] font-semibold",
            status === "pass"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
          )}
          aria-hidden="true"
        >
          {passCount}/{gates.rules.length}
        </span>

        <ChevronIcon expanded={expanded} />
      </button>

      {/* Accordion panel */}
      {expanded && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          className="border-t px-2 pb-2 pt-1"
        >
          <ul className="divide-y divide-border">
            {gates.rules.map((rule, idx) => (
              <RuleRow key={`${rule.name}-${idx}`} rule={rule} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
