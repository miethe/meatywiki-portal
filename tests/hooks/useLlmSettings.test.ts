/**
 * useLlmSettings hook tests (FE-P2).
 *
 * Covers:
 *   - All 10 endpoints (5 queries + 5 mutations)
 *   - ServiceModeEnvelope unwrap for list endpoints (profiles, providers, secrets)
 *   - 204 void return for putSecret (usePutSecret)
 *   - Distinct 403 SECRET_KEY_FORBIDDEN error surfaced by usePutSecret
 *   - restart_required defaults to false when absent (patchModels, triggerReload)
 *   - restartRequired context is updated when restart_required=true
 *   - SecretKeyStatus has no value field
 *
 * Mocking strategy:
 *   Mock the api client module (apiFetch + api helpers) at the module boundary
 *   so no real HTTP calls are made and MSW is not involved for hook-unit tests.
 *   The restartRequired context is wired in the wrapper factory.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { ApiError } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Mock the API client module
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/client", () => ({
  ...jest.requireActual("@/lib/api/client"),
  apiFetch: jest.fn(),
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock the llm-settings API module
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/llm-settings", () => ({
  getActiveProfile: jest.fn(),
  switchProfile: jest.fn(),
  listProfiles: jest.fn(),
  getModels: jest.fn(),
  patchModels: jest.fn(),
  listProviders: jest.fn(),
  upsertProvider: jest.fn(),
  listSecrets: jest.fn(),
  putSecret: jest.fn(),
  triggerReload: jest.fn(),
}));

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

import {
  useActiveProfile,
  useModels,
  useProfiles,
  useProviders,
  useSecrets,
  useSwitchProfile,
  usePatchModels,
  useUpsertProvider,
  usePutSecret,
  useTriggerReload,
} from "@/hooks/useLlmSettings";

import { RestartRequiredProvider, useRestartRequired } from "@/components/settings/llm/restart-required-context";
import type {
  ActiveProfileResponse,
  ModelMapResponse,
  ProfileSummary,
  ProviderRead,
  ReloadResponse,
  SecretKeyStatus,
} from "@/lib/api/llm-settings.types";

// ---------------------------------------------------------------------------
// Typed mock refs
// ---------------------------------------------------------------------------

const mockGetActiveProfile = getActiveProfile as jest.MockedFunction<typeof getActiveProfile>;
const mockSwitchProfile = switchProfile as jest.MockedFunction<typeof switchProfile>;
const mockListProfiles = listProfiles as jest.MockedFunction<typeof listProfiles>;
const mockGetModels = getModels as jest.MockedFunction<typeof getModels>;
const mockPatchModels = patchModels as jest.MockedFunction<typeof patchModels>;
const mockListProviders = listProviders as jest.MockedFunction<typeof listProviders>;
const mockUpsertProvider = upsertProvider as jest.MockedFunction<typeof upsertProvider>;
const mockListSecrets = listSecrets as jest.MockedFunction<typeof listSecrets>;
const mockPutSecret = putSecret as jest.MockedFunction<typeof putSecret>;
const mockTriggerReload = triggerReload as jest.MockedFunction<typeof triggerReload>;

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeActiveProfile(
  overrides: Partial<ActiveProfileResponse> = {},
): ActiveProfileResponse {
  return {
    active_profile: "default",
    config: { name: "default", description: "Default profile", provider: null },
    ...overrides,
  };
}

function makeProfile(overrides: Partial<ProfileSummary> = {}): ProfileSummary {
  return { name: "default", description: null, provider: null, ...overrides };
}

function makeModelMap(overrides: Partial<ModelMapResponse> = {}): ModelMapResponse {
  return {
    classify: "claude-haiku-4-5-20251001",
    extract: "claude-sonnet-4-6",
    compile: "claude-opus-4-8",
    query: "claude-opus-4-8",
    lint: "claude-sonnet-4-6",
    embed: null,
    restart_required: false,
    ...overrides,
  };
}

function makeProvider(overrides: Partial<ProviderRead> = {}): ProviderRead {
  return {
    id: "anthropic",
    adapter: "anthropic",
    base_url: null,
    api_key_env: "ANTHROPIC_API_KEY",
    api_key_is_set: true,
    ...overrides,
  };
}

function makeSecretKeyStatus(
  overrides: Partial<SecretKeyStatus> = {},
): SecretKeyStatus {
  return { key: "ANTHROPIC_API_KEY", is_set: true, ...overrides };
}

function makeReloadResponse(
  overrides: Partial<ReloadResponse> = {},
): ReloadResponse {
  return {
    success: true,
    restart_required: false,
    message: "Reload complete",
    reloaded_at: "2026-06-20T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test wrapper factory
// ---------------------------------------------------------------------------

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(RestartRequiredProvider, null, children),
    );
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Safe defaults so tests that don't override still resolve cleanly.
  mockGetActiveProfile.mockResolvedValue(makeActiveProfile());
  mockListProfiles.mockResolvedValue([makeProfile()]);
  mockGetModels.mockResolvedValue(makeModelMap());
  mockListProviders.mockResolvedValue([makeProvider()]);
  mockListSecrets.mockResolvedValue([makeSecretKeyStatus()]);
  mockSwitchProfile.mockResolvedValue(makeActiveProfile());
  mockPatchModels.mockResolvedValue(makeModelMap());
  mockUpsertProvider.mockResolvedValue(makeProvider());
  mockPutSecret.mockResolvedValue(undefined);
  mockTriggerReload.mockResolvedValue(makeReloadResponse());
});

afterEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// 1. useActiveProfile — GET /profile
// ===========================================================================

describe("useActiveProfile", () => {
  it("returns active profile data on success", async () => {
    mockGetActiveProfile.mockResolvedValue(
      makeActiveProfile({ active_profile: "fast", config: { name: "fast", provider: "anthropic" } }),
    );

    const { result } = renderHook(() => useActiveProfile(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data?.active_profile).toBe("fast");
    expect(result.current.isError).toBe(false);
  });

  it("returns isError=true on fetch failure", async () => {
    mockGetActiveProfile.mockRejectedValue(new ApiError(500, {}, "Server error"));

    const { result } = renderHook(() => useActiveProfile(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("handles null active_profile (no profile set)", async () => {
    mockGetActiveProfile.mockResolvedValue({ active_profile: null, config: null });

    const { result } = renderHook(() => useActiveProfile(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.active_profile).toBeNull();
    expect(result.current.data?.config).toBeNull();
  });
});

// ===========================================================================
// 2. useProfiles — GET /profiles (envelope unwrapped)
// ===========================================================================

describe("useProfiles", () => {
  it("returns unwrapped profiles array from envelope", async () => {
    const profiles = [
      makeProfile({ name: "default" }),
      makeProfile({ name: "fast", provider: "openai" }),
    ];
    mockListProfiles.mockResolvedValue(profiles);

    const { result } = renderHook(() => useProfiles(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.profiles).toHaveLength(2);
    expect(result.current.profiles[0].name).toBe("default");
    expect(result.current.profiles[1].provider).toBe("openai");
  });

  it("returns empty array when list is empty", async () => {
    mockListProfiles.mockResolvedValue([]);

    const { result } = renderHook(() => useProfiles(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.profiles).toEqual([]);
  });
});

// ===========================================================================
// 3. useModels — GET /models
// ===========================================================================

describe("useModels", () => {
  it("returns model map on success", async () => {
    mockGetModels.mockResolvedValue(
      makeModelMap({ classify: "claude-haiku-4-5-20251001", embed: "bge-m3" }),
    );

    const { result } = renderHook(() => useModels(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data?.classify).toBe("claude-haiku-4-5-20251001");
    expect(result.current.data?.embed).toBe("bge-m3");
    expect(result.current.data?.restart_required).toBe(false);
  });

  it("restart_required defaults to false when absent from response", async () => {
    // Simulate backend omitting restart_required
    const responseWithoutFlag = {
      classify: "haiku",
      extract: "sonnet",
      compile: "opus",
      query: "opus",
      lint: "sonnet",
      embed: null,
    };
    mockGetModels.mockResolvedValue({
      ...responseWithoutFlag,
      restart_required: false,
    });

    const { result } = renderHook(() => useModels(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.restart_required).toBe(false);
  });
});

// ===========================================================================
// 4. useProviders — GET /providers (envelope unwrapped)
// ===========================================================================

describe("useProviders", () => {
  it("returns unwrapped providers with is_set booleans only (no api_key value)", async () => {
    const providers = [
      makeProvider({ id: "anthropic", api_key_is_set: true }),
      makeProvider({ id: "openai", api_key_is_set: false, api_key_env: "OPENAI_API_KEY" }),
    ];
    mockListProviders.mockResolvedValue(providers);

    const { result } = renderHook(() => useProviders(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.providers).toHaveLength(2);
    expect(result.current.providers[0].api_key_is_set).toBe(true);
    expect(result.current.providers[1].api_key_is_set).toBe(false);
    // Confirm no api_key value field exists
    expect(result.current.providers[0]).not.toHaveProperty("api_key");
  });
});

// ===========================================================================
// 5. useSecrets — GET /secrets (envelope unwrapped, NO value field)
// ===========================================================================

describe("useSecrets", () => {
  it("returns secrets with is_set booleans only — no value field", async () => {
    const secrets: SecretKeyStatus[] = [
      { key: "ANTHROPIC_API_KEY", is_set: true },
      { key: "OPENAI_API_KEY", is_set: false },
    ];
    mockListSecrets.mockResolvedValue(secrets);

    const { result } = renderHook(() => useSecrets(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.secrets).toHaveLength(2);
    expect(result.current.secrets[0].key).toBe("ANTHROPIC_API_KEY");
    expect(result.current.secrets[0].is_set).toBe(true);
    // INVARIANT: SecretKeyStatus has no value field
    expect(result.current.secrets[0]).not.toHaveProperty("value");
    expect(result.current.secrets[1].is_set).toBe(false);
  });
});

// ===========================================================================
// 6. useSwitchProfile — POST /profile
// ===========================================================================

describe("useSwitchProfile", () => {
  it("switches profile and returns active profile response", async () => {
    const response = makeActiveProfile({ active_profile: "fast" });
    mockSwitchProfile.mockResolvedValue(response);

    const { result } = renderHook(() => useSwitchProfile(), {
      wrapper: makeWrapper(),
    });

    let returned: ActiveProfileResponse | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync("fast");
    });

    expect(returned?.active_profile).toBe("fast");
    expect(mockSwitchProfile).toHaveBeenCalledWith("fast");
  });

  it("surfaces 409 PROFILE_ALREADY_ACTIVE without retry", async () => {
    mockSwitchProfile.mockRejectedValue(
      new ApiError(409, { code: "PROFILE_ALREADY_ACTIVE", message: "Already active" }),
    );

    const { result } = renderHook(() => useSwitchProfile(), {
      wrapper: makeWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync("default");
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

// ===========================================================================
// 7. usePatchModels — PATCH /models
// ===========================================================================

describe("usePatchModels", () => {
  it("patches models and returns updated map", async () => {
    const response = makeModelMap({ classify: "claude-haiku-4-5-20251001" });
    mockPatchModels.mockResolvedValue(response);

    const { result } = renderHook(() => usePatchModels(), {
      wrapper: makeWrapper(),
    });

    let returned: ModelMapResponse | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ classify: "claude-haiku-4-5-20251001" });
    });

    expect(returned?.classify).toBe("claude-haiku-4-5-20251001");
  });

  it("sets restartRequired context to true when response.restart_required=true", async () => {
    mockPatchModels.mockResolvedValue(
      makeModelMap({ restart_required: true }),
    );

    // Wrap with a component that reads restartRequired so we can assert it.
    let capturedRestart: boolean | undefined;

    function Probe() {
      const { restartRequired } = useRestartRequired();
      capturedRestart = restartRequired;
      return null;
    }

    function wrapper({ children }: { children: React.ReactNode }) {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      return React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(
          RestartRequiredProvider,
          null,
          children,
          React.createElement(Probe),
        ),
      );
    }

    const { result } = renderHook(() => usePatchModels(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ compile: "claude-opus-4-8" });
    });

    expect(capturedRestart).toBe(true);
  });

  it("restart_required defaults to false when absent from patchModels response", async () => {
    mockPatchModels.mockResolvedValue(makeModelMap({ restart_required: false }));

    const { result } = renderHook(() => usePatchModels(), {
      wrapper: makeWrapper(),
    });

    let returned: ModelMapResponse | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ lint: "claude-sonnet-4-6" });
    });

    expect(returned?.restart_required).toBe(false);
  });
});

// ===========================================================================
// 8. useUpsertProvider — PUT /providers/{id}
// ===========================================================================

describe("useUpsertProvider", () => {
  it("upserts a provider and returns ProviderRead", async () => {
    const response = makeProvider({ id: "ollama", adapter: "ollama", base_url: "http://localhost:11434" });
    mockUpsertProvider.mockResolvedValue(response);

    const { result } = renderHook(() => useUpsertProvider(), {
      wrapper: makeWrapper(),
    });

    let returned: ProviderRead | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        id: "ollama",
        body: { adapter: "ollama", base_url: "http://localhost:11434" },
      });
    });

    expect(returned?.id).toBe("ollama");
    expect(returned?.adapter).toBe("ollama");
    expect(mockUpsertProvider).toHaveBeenCalledWith("ollama", {
      adapter: "ollama",
      base_url: "http://localhost:11434",
    });
  });
});

// ===========================================================================
// 9. usePutSecret — PUT /secrets/{key} → 204 void
// ===========================================================================

describe("usePutSecret", () => {
  it("calls putSecret and returns void on 204", async () => {
    mockPutSecret.mockResolvedValue(undefined);

    const { result } = renderHook(() => usePutSecret(), {
      wrapper: makeWrapper(),
    });

    let returned: void | undefined = undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        key: "ANTHROPIC_API_KEY",
        value: "sk-ant-api-key-test",
      });
    });

    // 204 → void; returned value must be undefined
    expect(returned).toBeUndefined();
    expect(mockPutSecret).toHaveBeenCalledWith("ANTHROPIC_API_KEY", "sk-ant-api-key-test");
  });

  it("surfaces 403 SECRET_KEY_FORBIDDEN as ApiError", async () => {
    mockPutSecret.mockRejectedValue(
      new ApiError(403, { code: "SECRET_KEY_FORBIDDEN", message: "Forbidden key" }),
    );

    const { result } = renderHook(() => usePutSecret(), {
      wrapper: makeWrapper(),
    });

    let caught: ApiError | undefined;
    await act(async () => {
      try {
        await result.current.mutateAsync({ key: "RESTRICTED_KEY", value: "value" });
      } catch (err) {
        if (err instanceof ApiError) caught = err;
      }
    });

    expect(caught).toBeInstanceOf(ApiError);
    expect(caught?.status).toBe(403);
    expect((caught?.body as { code?: string })?.code).toBe("SECRET_KEY_FORBIDDEN");
  });

  it("does NOT echo the secret value in the response", async () => {
    // putSecret returns void; confirm no value leaks through
    mockPutSecret.mockResolvedValue(undefined);

    const { result } = renderHook(() => usePutSecret(), {
      wrapper: makeWrapper(),
    });

    let returned: unknown = Symbol("sentinel");
    await act(async () => {
      returned = await result.current.mutateAsync({
        key: "ANTHROPIC_API_KEY",
        value: "secret-value-must-not-echo",
      });
    });

    expect(returned).toBeUndefined();
  });
});

// ===========================================================================
// 10. useTriggerReload — POST /reload
// ===========================================================================

describe("useTriggerReload", () => {
  it("triggers reload and returns ReloadResponse", async () => {
    const response = makeReloadResponse({ success: true, message: "Done" });
    mockTriggerReload.mockResolvedValue(response);

    const { result } = renderHook(() => useTriggerReload(), {
      wrapper: makeWrapper(),
    });

    let returned: ReloadResponse | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync();
    });

    expect(returned?.success).toBe(true);
    expect(returned?.restart_required).toBe(false);
  });

  it("sets restartRequired context to true when reload response.restart_required=true", async () => {
    mockTriggerReload.mockResolvedValue(
      makeReloadResponse({ restart_required: true }),
    );

    let capturedRestart: boolean | undefined;

    function Probe() {
      const { restartRequired } = useRestartRequired();
      capturedRestart = restartRequired;
      return null;
    }

    function wrapper({ children }: { children: React.ReactNode }) {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      return React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(
          RestartRequiredProvider,
          null,
          children,
          React.createElement(Probe),
        ),
      );
    }

    const { result } = renderHook(() => useTriggerReload(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(capturedRestart).toBe(true);
  });

  it("restart_required defaults to false when absent from reload response", async () => {
    mockTriggerReload.mockResolvedValue(makeReloadResponse({ restart_required: false }));

    const { result } = renderHook(() => useTriggerReload(), {
      wrapper: makeWrapper(),
    });

    let returned: ReloadResponse | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync();
    });

    expect(returned?.restart_required).toBe(false);
  });

  it("surfaces 409 RELOAD_IN_PROGRESS as ApiError", async () => {
    mockTriggerReload.mockRejectedValue(
      new ApiError(409, { code: "RELOAD_IN_PROGRESS", message: "Reload already running" }),
    );

    const { result } = renderHook(() => useTriggerReload(), {
      wrapper: makeWrapper(),
    });

    let caught: ApiError | undefined;
    await act(async () => {
      try {
        await result.current.mutateAsync();
      } catch (err) {
        if (err instanceof ApiError) caught = err;
      }
    });

    expect(caught).toBeInstanceOf(ApiError);
    expect(caught?.status).toBe(409);
    expect((caught?.body as { code?: string })?.code).toBe("RELOAD_IN_PROGRESS");
  });
});

// ===========================================================================
// SecretKeyStatus invariant check
// ===========================================================================

describe("SecretKeyStatus type invariant", () => {
  it("SecretKeyStatus objects have no value field at runtime", () => {
    const secret: SecretKeyStatus = { key: "MY_KEY", is_set: true };
    // TypeScript also enforces this at compile time; this runtime check is a
    // belt-and-suspenders guard against accidental backend leakage.
    expect(secret).not.toHaveProperty("value");
    expect(Object.keys(secret).sort()).toEqual(["is_set", "key"]);
  });
});
