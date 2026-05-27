/**
 * useCostReport — TanStack Query hook for the Cost Report page (P4-FE-011).
 *
 * Fetches aggregate LLM cost telemetry from GET /api/cost-report?period_days=N.
 * The period is controlled externally (passed as parameter) so the page can
 * switch periods without re-mounting the hook.
 *
 * staleTime: 5 minutes — cost data rarely changes within a session.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchCostReport } from "@/lib/api/cost";
import type { CostReportDTO, CostReportPeriod } from "@/lib/api/cost";

export interface UseCostReportResult {
  data: CostReportDTO | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCostReport(periodDays: CostReportPeriod): UseCostReportResult {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["cost-report", periodDays],
    queryFn: () => fetchCostReport(periodDays),
    staleTime: 5 * 60 * 1000,
  });

  return {
    data,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}
