"use client";

/**
 * /workflows/[runId] — Workflow Viewer (Screen B).
 *
 * Route chunk for the WorkflowViewerScreen. Mounts the 4-panel viewer for
 * a single workflow run identified by `params.runId`.
 *
 * Shell: Standard (inherits layout.tsx shell from (main) route group).
 * Stitch reference: workflow-viewer-screen-b.html / .png (Stitch export).
 *
 * Links from:
 *   - WorkflowStatusPanel run rows ("View run" link)
 *   - WorkflowOsTab artifact detail tab (when a workflow run is associated)
 *
 * FR-1.5-07 (P1.5-2-02).
 */

import { use } from "react";
import { WorkflowViewerScreen } from "@/components/workflow/viewer/workflow-viewer-screen";

interface WorkflowDetailPageProps {
  params: Promise<{ runId: string }>;
}

export default function WorkflowDetailPage({ params }: WorkflowDetailPageProps) {
  const { runId } = use(params);

  return <WorkflowViewerScreen runId={runId} />;
}
