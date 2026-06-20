"use client";

/**
 * LlmSettingsTabs — four-tab panel for LLM Settings.
 *
 * Tabs: Profiles | Models | Providers | Keys (default: Profiles)
 *
 * Tab bodies are the real panel components wired in FE-P4. React Query's
 * caching means switching tabs never triggers a redundant network fetch —
 * do NOT add remount-forcing keys here.
 *
 * Keyboard navigation is handled by Radix Tabs (arrow keys move between
 * triggers; Tab/Shift-Tab moves focus in/out of the tab list).
 *
 * Traces: portal-llm-settings-frontend FE-P4 (tab wiring).
 */

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@miethe/ui";
import { ProfilesTab } from "@/components/settings/llm/tabs/ProfilesTab";
import { ModelsTab } from "@/components/settings/llm/tabs/ModelsTab";
import { ProvidersTab } from "@/components/settings/llm/tabs/ProvidersTab";
import { KeysTab } from "@/components/settings/llm/tabs/KeysTab";

// Tab value constants — exported so panel components can reference them.
export const LLM_SETTINGS_TAB = {
  PROFILES: "profiles",
  MODELS: "models",
  PROVIDERS: "providers",
  KEYS: "keys",
} as const;

export type LlmSettingsTabValue =
  (typeof LLM_SETTINGS_TAB)[keyof typeof LLM_SETTINGS_TAB];

// ── LlmSettingsTabs ──────────────────────────────────────────────────────────

export function LlmSettingsTabs() {
  return (
    <Tabs defaultValue={LLM_SETTINGS_TAB.PROFILES}>
      <TabsList aria-label="LLM Settings sections">
        <TabsTrigger value={LLM_SETTINGS_TAB.PROFILES}>Profiles</TabsTrigger>
        <TabsTrigger value={LLM_SETTINGS_TAB.MODELS}>Models</TabsTrigger>
        <TabsTrigger value={LLM_SETTINGS_TAB.PROVIDERS}>Providers</TabsTrigger>
        <TabsTrigger value={LLM_SETTINGS_TAB.KEYS}>Keys</TabsTrigger>
      </TabsList>

      <TabsContent value={LLM_SETTINGS_TAB.PROFILES}>
        <ProfilesTab />
      </TabsContent>

      <TabsContent value={LLM_SETTINGS_TAB.MODELS}>
        <ModelsTab />
      </TabsContent>

      <TabsContent value={LLM_SETTINGS_TAB.PROVIDERS}>
        <ProvidersTab />
      </TabsContent>

      <TabsContent value={LLM_SETTINGS_TAB.KEYS}>
        <KeysTab />
      </TabsContent>
    </Tabs>
  );
}
