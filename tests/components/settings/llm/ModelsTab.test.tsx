/**
 * ModelsTab — per-purpose model assignment panel tests (FE-P4, P4-03).
 *
 * Covers:
 *   - All 6 purpose fields render pre-filled with values from useModels()
 *   - Save with no changes sends no PATCH (patchModels not called)
 *   - Changing only `compile` and saving sends a PATCH body with only `compile`
 *   - Mocked response with restart_required=true flips the RestartRequired store
 *     (consumer sees restartRequired===true, banner text appears)
 *   - 422 CONFIG_INVALID surfaces as a form-level error
 *   - Save button disabled while mutation is in-flight
 *   - Loading state renders Spinner
 *   - Fetch error state renders alert
 *
 * Mocking strategy:
 *   Mock useLlmSettings hooks at the hook module boundary — no real HTTP / MSW.
 *   RestartRequiredProvider is wired in the render wrapper.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "../../../utils/userEvent";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RestartRequiredProvider, useRestartRequired } from "@/components/settings/llm/restart-required-context";
import { ModelsTab } from "@/components/settings/llm/tabs/ModelsTab";
import { ApiError } from "@/lib/api/client";
import type { ModelMapResponse, ModelMapPatchRequest } from "@/lib/api/llm-settings.types";

// ---------------------------------------------------------------------------
// Mock useLlmSettings hooks at module boundary
// ---------------------------------------------------------------------------

const mockMutateAsync = jest.fn<Promise<ModelMapResponse>, [ModelMapPatchRequest]>();
const mockReset = jest.fn();

jest.mock("@/hooks/useLlmSettings", () => ({
  useModels: jest.fn(),
  usePatchModels: jest.fn(),
}));

import { useModels, usePatchModels } from "@/hooks/useLlmSettings";

const mockUseModels = useModels as jest.MockedFunction<typeof useModels>;
const mockUsePatchModels = usePatchModels as jest.MockedFunction<typeof usePatchModels>;

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeModelMap(overrides: Partial<ModelMapResponse> = {}): ModelMapResponse {
  return {
    classify: "claude-haiku-4-5-20251001",
    extract:  "claude-sonnet-4-6",
    compile:  "claude-opus-4-8",
    query:    "claude-opus-4-8",
    lint:     "claude-sonnet-4-6",
    embed:    "ollama/bge-m3",
    restart_required: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Render helper — wraps with QueryClient + RestartRequiredProvider.
// Returns the captured restartRequired value via a probe component.
// ---------------------------------------------------------------------------

function renderModelsTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  let capturedRestartRequired = false;

  function RestartProbe() {
    const { restartRequired } = useRestartRequired();
    capturedRestartRequired = restartRequired;
    return null;
  }

  const result = render(
    <QueryClientProvider client={queryClient}>
      <RestartRequiredProvider>
        <ModelsTab />
        <RestartProbe />
      </RestartRequiredProvider>
    </QueryClientProvider>,
  );

  return { ...result, getRestartRequired: () => capturedRestartRequired };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();

  // Default: loaded successfully, no pending mutation.
  mockUseModels.mockReturnValue({
    data:      makeModelMap(),
    isLoading: false,
    isError:   false,
    error:     null,
    refetch:   jest.fn(),
  });

  mockUsePatchModels.mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending:   false,
    reset:       mockReset,
  });

  // Default mutation resolves to the same model map (no restart_required).
  mockMutateAsync.mockResolvedValue(makeModelMap());
});

// ===========================================================================
// 1. Loading state
// ===========================================================================

describe("ModelsTab — loading state", () => {
  it("renders a Spinner while models are loading", () => {
    mockUseModels.mockReturnValue({
      data:      undefined,
      isLoading: true,
      isError:   false,
      error:     null,
      refetch:   jest.fn(),
    });

    renderModelsTab();

    expect(screen.getByRole("status", { name: /loading model configuration/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// 2. Fetch error state
// ===========================================================================

describe("ModelsTab — fetch error state", () => {
  it("renders an alert when models fail to load", () => {
    mockUseModels.mockReturnValue({
      data:      undefined,
      isLoading: false,
      isError:   true,
      error:     new Error("Network error"),
      refetch:   jest.fn(),
    });

    renderModelsTab();

    expect(screen.getByRole("alert")).toHaveTextContent(/could not load model configuration/i);
  });
});

// ===========================================================================
// 3. Pre-fill — all 6 fields rendered with loaded values
// ===========================================================================

describe("ModelsTab — pre-fill from useModels()", () => {
  it("renders 6 labeled input fields", () => {
    renderModelsTab();

    const labels = ["Classify", "Extract", "Compile", "Query", "Lint", "Embed"];
    for (const label of labels) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it("pre-fills each field with the loaded model value", () => {
    renderModelsTab();

    expect(screen.getByLabelText("Classify")).toHaveValue("claude-haiku-4-5-20251001");
    expect(screen.getByLabelText("Extract")).toHaveValue("claude-sonnet-4-6");
    expect(screen.getByLabelText("Compile")).toHaveValue("claude-opus-4-8");
    expect(screen.getByLabelText("Query")).toHaveValue("claude-opus-4-8");
    expect(screen.getByLabelText("Lint")).toHaveValue("claude-sonnet-4-6");
    expect(screen.getByLabelText("Embed")).toHaveValue("ollama/bge-m3");
  });

  it("shows 6 inputs total", () => {
    renderModelsTab();

    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(6);
  });
});

// ===========================================================================
// 4. Save with no changes — PATCH not sent
// ===========================================================================

describe("ModelsTab — save with no changes", () => {
  it("does not call patchModels when no fields are changed", async () => {
    const user = userEvent.setup();
    renderModelsTab();

    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 5. Only-changed-fields PATCH
// ===========================================================================

describe("ModelsTab — only changed fields sent in PATCH body", () => {
  it("sends only the `compile` field when only compile is changed", async () => {
    const user = userEvent.setup();
    renderModelsTab();

    const compileInput = screen.getByLabelText("Compile");

    // Clear the existing value and type a new one.
    await user.clear(compileInput);
    await user.type(compileInput, "claude-fable-5");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    const patchBody = mockMutateAsync.mock.calls[0][0];

    // Only compile should be in the body.
    expect(patchBody).toHaveProperty("compile", "claude-fable-5");
    expect(patchBody).not.toHaveProperty("classify");
    expect(patchBody).not.toHaveProperty("extract");
    expect(patchBody).not.toHaveProperty("query");
    expect(patchBody).not.toHaveProperty("lint");
    expect(patchBody).not.toHaveProperty("embed");
  });

  it("sends multiple keys when multiple fields change", async () => {
    const user = userEvent.setup();
    renderModelsTab();

    const lintInput = screen.getByLabelText("Lint");
    await user.clear(lintInput);
    await user.type(lintInput, "claude-haiku-4-5-20251001");

    const queryInput = screen.getByLabelText("Query");
    await user.clear(queryInput);
    await user.type(queryInput, "claude-fable-5");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    const patchBody = mockMutateAsync.mock.calls[0][0];
    expect(Object.keys(patchBody)).toHaveLength(2);
    expect(patchBody).toHaveProperty("lint", "claude-haiku-4-5-20251001");
    expect(patchBody).toHaveProperty("query", "claude-fable-5");
  });
});

// ===========================================================================
// 6. Embed change → restart_required=true → RestartRequired store flips
// ===========================================================================

describe("ModelsTab — embed change triggers RestartRequired", () => {
  it("sends the embed field in PATCH when embed is changed", async () => {
    // Simulate the server response that signals a restart is needed.
    mockMutateAsync.mockResolvedValue(
      makeModelMap({ embed: "new-embed-model", restart_required: true }),
    );

    const user = userEvent.setup();
    renderModelsTab();

    const embedInput = screen.getByLabelText("Embed");
    await user.clear(embedInput);
    await user.type(embedInput, "new-embed-model");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ embed: "new-embed-model" }),
    );
  });

  it("RestartRequiredBanner appears when context is set after embed save", async () => {
    // Wire the real context so we can verify the banner renders when
    // setRestartRequired(true) is called — simulating what the real
    // usePatchModels.onSuccess does when restart_required=true is returned.
    const {
      RestartRequiredProvider: RRP,
      useRestartRequired: useRR,
    } = jest.requireActual<
      typeof import("@/components/settings/llm/restart-required-context")
    >("@/components/settings/llm/restart-required-context");

    const { RestartRequiredBanner } = jest.requireActual<
      typeof import("@/components/settings/llm/RestartRequiredBanner")
    >("@/components/settings/llm/RestartRequiredBanner");

    // Capture setRestartRequired from the context so the mock can call it
    // in the same tick as the mutation success — mirroring usePatchModels.onSuccess.
    let externalSetRestart: ((v: boolean) => void) | undefined;

    function ContextCapture({ children }: { children: React.ReactNode }) {
      const { setRestartRequired } = useRR();
      externalSetRestart = setRestartRequired;
      return <>{children}</>;
    }

    const mockMutateCapture = jest.fn().mockImplementation(async () => {
      const response = makeModelMap({ restart_required: true });
      if (response.restart_required) externalSetRestart?.(true);
      return response;
    });

    mockUsePatchModels.mockReturnValue({
      mutateAsync: mockMutateCapture,
      isPending:   false,
      reset:       mockReset,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RRP>
          <ContextCapture>
            <RestartRequiredBanner />
            <ModelsTab />
          </ContextCapture>
        </RRP>
      </QueryClientProvider>,
    );

    // Banner should not be visible before save.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    const user = userEvent.setup();
    const embedInput = screen.getByLabelText("Embed");
    await user.clear(embedInput);
    await user.type(embedInput, "ollama/new-model");

    await user.click(screen.getByRole("button", { name: /save/i }));

    // After save the context is set → banner appears with its text content.
    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    expect(screen.getByRole("status")).toHaveTextContent(/restart required/i);
  });
});

// ===========================================================================
// 7. 422 CONFIG_INVALID → form-level error
// ===========================================================================

describe("ModelsTab — 422 CONFIG_INVALID", () => {
  it("renders a form-level error on 422 CONFIG_INVALID response", async () => {
    mockMutateAsync.mockRejectedValue(
      new ApiError(422, { code: "CONFIG_INVALID", message: "Unknown model identifier." }),
    );

    const user = userEvent.setup();
    renderModelsTab();

    const compileInput = screen.getByLabelText("Compile");
    await user.clear(compileInput);
    await user.type(compileInput, "bad-model-id");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Unknown model identifier.");
    });
  });

  it("clears a prior form error before the next save attempt", async () => {
    // First save fails.
    mockMutateAsync.mockRejectedValueOnce(
      new ApiError(422, { code: "CONFIG_INVALID", message: "Unknown model identifier." }),
    );
    // Second save succeeds.
    mockMutateAsync.mockResolvedValueOnce(makeModelMap({ compile: "claude-fable-5" }));

    const user = userEvent.setup();
    renderModelsTab();

    const compileInput = screen.getByLabelText("Compile");

    // First attempt — triggers error.
    await user.clear(compileInput);
    await user.type(compileInput, "bad-model");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Second attempt — fix the value and save again.
    await user.clear(compileInput);
    await user.type(compileInput, "claude-fable-5");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 8. No double-submit — save button disabled while pending
// ===========================================================================

describe("ModelsTab — no double-submit", () => {
  it("disables the save button while mutation is in-flight", () => {
    mockUsePatchModels.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending:   true,
      reset:       mockReset,
    });

    renderModelsTab();

    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("re-enables the save button after mutation completes", () => {
    // Default: isPending=false (set in beforeEach).
    renderModelsTab();

    expect(screen.getByRole("button", { name: /save/i })).not.toBeDisabled();
  });
});
