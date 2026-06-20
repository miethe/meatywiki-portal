"use client";

/**
 * LlmSettingsTabs — four-tab panel for LLM Settings.
 *
 * Tabs: Profiles | Models | Providers | Keys (default: Profiles)
 *
 * Tab bodies are placeholders with a loading spinner; FE-P4 will replace
 * each TabsContent with the real panel component. FE-P4 imports this
 * component and swaps in panel bodies without touching the shell.
 *
 * Keyboard navigation is handled by Radix Tabs (arrow keys move between
 * triggers; Tab/Shift-Tab moves focus in/out of the tab list).
 *
 * Traces: portal-llm-settings-frontend FE-P3.
 */

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Spinner,
} from "@miethe/ui";

// Tab value constants — exported so FE-P4 can reference them when composing
// the real panel components.
export const LLM_SETTINGS_TAB = {
  PROFILES: "profiles",
  MODELS: "models",
  PROVIDERS: "providers",
  KEYS: "keys",
} as const;

export type LlmSettingsTabValue =
  (typeof LLM_SETTINGS_TAB)[keyof typeof LLM_SETTINGS_TAB];

// ── Placeholder panel ────────────────────────────────────────────────────────

function PlaceholderPanel({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border p-10 text-muted-foreground">
      <Spinner size="md" aria-label={`Loading ${label}`} />
      <p className="text-sm">
        {label} — coming up
      </p>
    </div>
  );
}

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
        <PlaceholderPanel label="Profiles" />
      </TabsContent>

      <TabsContent value={LLM_SETTINGS_TAB.MODELS}>
        <PlaceholderPanel label="Models" />
      </TabsContent>

      <TabsContent value={LLM_SETTINGS_TAB.PROVIDERS}>
        <PlaceholderPanel label="Providers" />
      </TabsContent>

      <TabsContent value={LLM_SETTINGS_TAB.KEYS}>
        <PlaceholderPanel label="Keys" />
      </TabsContent>
    </Tabs>
  );
}
