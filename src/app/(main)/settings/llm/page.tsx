/**
 * LLM Settings Page — /settings/llm
 *
 * Server component shell. Breadcrumb + page header mirror the
 * workflow-templates sub-route convention. The interactive content
 * is delegated to the LlmSettingsPage client island, which must be
 * wrapped in <RestartRequiredProvider> so its children can call
 * useRestartRequired() without wiring the context into a layout.
 *
 * Traces: portal-llm-settings-frontend FE-P3 (P3-01 shell).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { LlmSettingsPage } from "@/components/settings/llm/LlmSettingsPage";

export const metadata: Metadata = {
  title: "LLM Settings",
};

export default function LlmSettingsRoute() {
  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/settings"
          className="transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Settings
        </Link>
        <svg aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span aria-current="page" className="text-foreground font-medium">
          LLM Settings
        </span>
      </nav>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">LLM Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Configure LLM provider profiles, per-purpose model assignments,
          provider credentials, and secret keys used by the compilation engine.
        </p>
      </div>

      {/* Client island — RestartRequiredProvider lives inside LlmSettingsPage */}
      <LlmSettingsPage />
    </div>
  );
}
