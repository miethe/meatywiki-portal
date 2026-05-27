/**
 * Cost Report API — typed wrapper around the cost telemetry endpoint.
 *
 * Endpoint:
 *   GET /cost-report?period_days=N
 *
 * Returns aggregate LLM cost telemetry for the requested period.
 * USD values are null when no pricing model is configured on the backend.
 *
 * P4-FE-011: Cost report page.
 */

import { apiFetch } from "./client";

// ---------------------------------------------------------------------------
// DTO types
// ---------------------------------------------------------------------------

export interface CostStageRow {
  stage: string;
  tokens: number;
  usd_cents: number | null;
}

export interface CostReportArtifactRow {
  artifact_id: string;
  title: string;
  total_tokens: number;
  total_usd: number | null;
}

export interface CostReportDTO {
  period_days: number;
  total_tokens: number;
  total_usd: number | null;
  by_stage: CostStageRow[];
  top_artifacts: CostReportArtifactRow[];
}

// ---------------------------------------------------------------------------
// Period options
// ---------------------------------------------------------------------------

/** Canonical period values supported by the backend. */
export type CostReportPeriod = 7 | 30 | 365;

export const COST_REPORT_PERIODS: { label: string; value: CostReportPeriod }[] = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "All time", value: 365 },
];

// ---------------------------------------------------------------------------
// API function
// ---------------------------------------------------------------------------

export async function fetchCostReport(periodDays: CostReportPeriod): Promise<CostReportDTO> {
  return apiFetch<CostReportDTO>(`/cost-report?period_days=${periodDays}`);
}
