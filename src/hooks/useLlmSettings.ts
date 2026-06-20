"use client";

/**
 * useLlmSettings — TanStack Query hooks for the LLM Settings feature.
 *
 * Queries (read):
 *   useActiveProfile  — GET /portal/llm-settings/profile
 *   useProfiles       — GET /portal/llm-settings/profiles (list)
 *   useModels         — GET /portal/llm-settings/models
 *   useProviders      — GET /portal/llm-settings/providers (list, is_set booleans only)
 *   useSecrets        — GET /portal/llm-settings/secrets   (list, is_set booleans only)
 *
 * Mutations (write):
 *   useSwitchProfile  — POST /portal/llm-settings/profile
 *   usePatchModels    — PATCH /portal/llm-settings/models  (→ updates restartRequired ctx)
 *   useUpsertProvider — PUT /portal/llm-settings/providers/{id}
 *   usePutSecret      — PUT /portal/llm-settings/secrets/{key}  (204 void)
 *   useTriggerReload  — POST /portal/llm-settings/reload   (→ updates restartRequired ctx)
 *
 * Cache conventions:
 *   - staleTime: 30 s   (settings change rarely)
 *   - gcTime:    5 min
 *   - retry: false      (Portal is local-only)
 *
 * restartRequired context:
 *   usePatchModels and useTriggerReload call setRestartRequired(true) when the
 *   response carries restart_required=true. This requires a
 *   <RestartRequiredProvider> ancestor in the tree.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getActiveProfile,
  getModels,
  listProfiles,
  listProviders,
  listSecrets,
  patchModels,
  putSecret,
  switchProfile,
  triggerReload,
  upsertProvider,
} from "@/lib/api/llm-settings";
import { useRestartRequired } from "@/components/settings/llm/restart-required-context";
import type {
  ActiveProfileResponse,
  ModelMapPatchRequest,
  ModelMapResponse,
  ProfileSummary,
  ProviderDescriptor,
  ProviderRead,
  ReloadResponse,
  SecretKeyStatus,
} from "@/lib/api/llm-settings.types";

// ---------------------------------------------------------------------------
// Query key factories
// ---------------------------------------------------------------------------

export const llmSettingsKeys = {
  activeProfile: () => ["llm-settings", "active-profile"] as const,
  profiles: () => ["llm-settings", "profiles"] as const,
  models: () => ["llm-settings", "models"] as const,
  providers: () => ["llm-settings", "providers"] as const,
  secrets: () => ["llm-settings", "secrets"] as const,
};

// ---------------------------------------------------------------------------
// Shared query options
// ---------------------------------------------------------------------------

const QUERY_DEFAULTS = {
  staleTime: 30_000,   // 30 seconds — settings change rarely
  gcTime: 5 * 60_000,  // 5 minutes
  retry: false,        // Portal is local-only; network retries add noise
} as const;

// ---------------------------------------------------------------------------
// 1. useActiveProfile
// ---------------------------------------------------------------------------

export interface UseActiveProfileResult {
  data: ActiveProfileResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useActiveProfile(): UseActiveProfileResult {
  const { data, isLoading, isError, error, refetch } = useQuery<
    ActiveProfileResponse,
    Error
  >({
    queryKey: llmSettingsKeys.activeProfile(),
    queryFn: getActiveProfile,
    ...QUERY_DEFAULTS,
  });

  return { data, isLoading, isError, error: error as Error | null, refetch };
}

// ---------------------------------------------------------------------------
// 2. useProfiles
// ---------------------------------------------------------------------------

export interface UseProfilesResult {
  profiles: ProfileSummary[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useProfiles(): UseProfilesResult {
  const { data, isLoading, isError, error, refetch } = useQuery<
    ProfileSummary[],
    Error
  >({
    queryKey: llmSettingsKeys.profiles(),
    queryFn: listProfiles,
    ...QUERY_DEFAULTS,
  });

  return {
    profiles: data ?? [],
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}

// ---------------------------------------------------------------------------
// 3. useModels
// ---------------------------------------------------------------------------

export interface UseModelsResult {
  data: ModelMapResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useModels(): UseModelsResult {
  const { data, isLoading, isError, error, refetch } = useQuery<
    ModelMapResponse,
    Error
  >({
    queryKey: llmSettingsKeys.models(),
    queryFn: getModels,
    ...QUERY_DEFAULTS,
  });

  return { data, isLoading, isError, error: error as Error | null, refetch };
}

// ---------------------------------------------------------------------------
// 4. useProviders
//    Data carries only is_set booleans — no api_key values.
// ---------------------------------------------------------------------------

export interface UseProvidersResult {
  providers: ProviderRead[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useProviders(): UseProvidersResult {
  const { data, isLoading, isError, error, refetch } = useQuery<
    ProviderRead[],
    Error
  >({
    queryKey: llmSettingsKeys.providers(),
    queryFn: listProviders,
    ...QUERY_DEFAULTS,
  });

  return {
    providers: data ?? [],
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}

// ---------------------------------------------------------------------------
// 5. useSecrets
//    Data carries only { key, is_set } — no value field (write-only).
// ---------------------------------------------------------------------------

export interface UseSecretsResult {
  secrets: SecretKeyStatus[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useSecrets(): UseSecretsResult {
  const { data, isLoading, isError, error, refetch } = useQuery<
    SecretKeyStatus[],
    Error
  >({
    queryKey: llmSettingsKeys.secrets(),
    queryFn: listSecrets,
    ...QUERY_DEFAULTS,
  });

  return {
    secrets: data ?? [],
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}

// ---------------------------------------------------------------------------
// 6. useSwitchProfile
// ---------------------------------------------------------------------------

export interface UseSwitchProfileResult {
  mutateAsync: (name: string) => Promise<ActiveProfileResponse>;
  isPending: boolean;
  reset: () => void;
}

export function useSwitchProfile(): UseSwitchProfileResult {
  const queryClient = useQueryClient();

  const mutation = useMutation<ActiveProfileResponse, Error, string>({
    mutationFn: (name) => switchProfile(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: llmSettingsKeys.activeProfile() });
      void queryClient.invalidateQueries({ queryKey: llmSettingsKeys.profiles() });
    },
  });

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    reset: mutation.reset,
  };
}

// ---------------------------------------------------------------------------
// 7. usePatchModels
//    Updates restartRequired context when response.restart_required is true.
// ---------------------------------------------------------------------------

export interface UsePatchModelsResult {
  mutateAsync: (body: ModelMapPatchRequest) => Promise<ModelMapResponse>;
  isPending: boolean;
  reset: () => void;
}

export function usePatchModels(): UsePatchModelsResult {
  const queryClient = useQueryClient();
  const { setRestartRequired } = useRestartRequired();

  const mutation = useMutation<ModelMapResponse, Error, ModelMapPatchRequest>({
    mutationFn: (body) => patchModels(body),
    onSuccess: (response) => {
      // Persist the updated model map into the query cache immediately.
      queryClient.setQueryData(llmSettingsKeys.models(), response);
      // Unconditional: clears the banner when server reports false (DEC-FE-4).
      setRestartRequired(response.restart_required ?? false);
    },
  });

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    reset: mutation.reset,
  };
}

// ---------------------------------------------------------------------------
// 8. useUpsertProvider
// ---------------------------------------------------------------------------

export interface UseUpsertProviderResult {
  mutateAsync: (args: { id: string; body: ProviderDescriptor }) => Promise<ProviderRead>;
  isPending: boolean;
  reset: () => void;
}

export function useUpsertProvider(): UseUpsertProviderResult {
  const queryClient = useQueryClient();

  const mutation = useMutation<
    ProviderRead,
    Error,
    { id: string; body: ProviderDescriptor }
  >({
    mutationFn: ({ id, body }) => upsertProvider(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: llmSettingsKeys.providers() });
    },
  });

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    reset: mutation.reset,
  };
}

// ---------------------------------------------------------------------------
// 9. usePutSecret
//    Returns void on 204 — no echo of the secret value.
// ---------------------------------------------------------------------------

export interface UsePutSecretResult {
  mutateAsync: (args: { key: string; value: string }) => Promise<void>;
  isPending: boolean;
  reset: () => void;
}

export function usePutSecret(): UsePutSecretResult {
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, { key: string; value: string }>({
    mutationFn: ({ key, value }) => putSecret(key, value),
    onSuccess: () => {
      // Invalidate the secrets list so is_set flags refresh.
      void queryClient.invalidateQueries({ queryKey: llmSettingsKeys.secrets() });
    },
  });

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    reset: mutation.reset,
  };
}

// ---------------------------------------------------------------------------
// 10. useTriggerReload
//     Updates restartRequired context when response.restart_required is true.
// ---------------------------------------------------------------------------

export interface UseTriggerReloadResult {
  mutateAsync: () => Promise<ReloadResponse>;
  isPending: boolean;
  reset: () => void;
}

export function useTriggerReload(): UseTriggerReloadResult {
  const queryClient = useQueryClient();
  const { setRestartRequired } = useRestartRequired();

  const mutation = useMutation<ReloadResponse, Error, void>({
    mutationFn: triggerReload,
    onSuccess: (response) => {
      // Unconditional: clears the banner when server reports false (DEC-FE-4).
      setRestartRequired(response.restart_required ?? false);
      // Re-fetch everything after a reload so settings reflect the new state.
      void queryClient.invalidateQueries({ queryKey: ["llm-settings"] });
    },
  });

  return {
    // useMutation<TData, TError, void>.mutateAsync() requires an argument;
    // wrap it so callers can invoke with no arguments.
    mutateAsync: () => mutation.mutateAsync(),
    isPending: mutation.isPending,
    reset: mutation.reset,
  };
}
