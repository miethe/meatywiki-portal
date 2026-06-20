"use client";

/**
 * LlmSettingsPage — client island for /settings/llm.
 *
 * Mounts the RestartRequiredProvider so useRestartRequired() is available to
 * all children. Renders the persistent restart banner, the engine reload
 * action, and the tabbed settings panels.
 *
 * Traces: portal-llm-settings-frontend FE-P3 (shell).
 */

import { RestartRequiredProvider } from "@/components/settings/llm/restart-required-context";
import { RestartRequiredBanner } from "@/components/settings/llm/RestartRequiredBanner";
import { ReloadAction } from "@/components/settings/llm/ReloadAction";
import { LlmSettingsTabs } from "@/components/settings/llm/LlmSettingsTabs";

export function LlmSettingsPage() {
  return (
    <RestartRequiredProvider>
      <div className="flex flex-col gap-4">
        {/* Persistent amber banner — renders only when restartRequired is true */}
        <RestartRequiredBanner />

        {/* Engine reload + tabbed content */}
        <div className="flex flex-col gap-6">
          {/* Reload action sits above the tabs as a page-level control */}
          <div className="flex justify-end">
            <ReloadAction />
          </div>

          {/* Tabbed panels: Profiles | Models | Providers | Keys */}
          <LlmSettingsTabs />
        </div>
      </div>
    </RestartRequiredProvider>
  );
}
