/**
 * KeysTab tests (FE-P4 / P4-05).
 *
 * Security gates (each assertion here IS a security check):
 *   1. Rows render with is_set status only — no secret value in DOM.
 *   2. PORTAL_DISABLE_AUTH and PORTAL_ALLOW_NETWORK render locked/disabled
 *      with no editable SecretField input affordance.
 *   3. Submitting a normal key calls putSecret with the typed value;
 *      on 403 SECRET_KEY_FORBIDDEN a non-retryable message shows (no retry).
 *   4. After successful submit the SecretField input is cleared (write-only).
 *
 * Mocking strategy:
 *   Mock useLlmSettings hooks at the module boundary (same pattern as
 *   ProfilesTab.test.tsx / ModelsTab.test.tsx). No real HTTP / MSW needed —
 *   hook stubs exercise the component integration layer fully.
 *
 *   @miethe/ui is auto-mocked via jest.config.ts moduleNameMapper
 *   (tests/mocks/miethe-ui.tsx) — SecretField stub exposes testable inputs
 *   without the real ESM dependency chain.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/client";
import { RestartRequiredProvider } from "@/components/settings/llm/restart-required-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { KeysTab } from "@/components/settings/llm/tabs/KeysTab";
import type { SecretKeyStatus } from "@/lib/api/llm-settings.types";

// ---------------------------------------------------------------------------
// Mock useLlmSettings hooks at module boundary
// ---------------------------------------------------------------------------

const mockMutateAsync = jest.fn<Promise<void>, [{ key: string; value: string }]>();
const mockReset = jest.fn();

jest.mock("@/hooks/useLlmSettings", () => ({
  useSecrets: jest.fn(),
  usePutSecret: jest.fn(),
}));

import { useSecrets, usePutSecret } from "@/hooks/useLlmSettings";

const mockUseSecrets = useSecrets as jest.MockedFunction<typeof useSecrets>;
const mockUsePutSecret = usePutSecret as jest.MockedFunction<typeof usePutSecret>;

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeSecret(overrides: Partial<SecretKeyStatus> = {}): SecretKeyStatus {
  return { key: "ANTHROPIC_API_KEY", is_set: true, ...overrides };
}

function makeSecretsResult(
  secrets: SecretKeyStatus[],
  overrides: Partial<ReturnType<typeof useSecrets>> = {},
): ReturnType<typeof useSecrets> {
  return {
    secrets,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    ...overrides,
  };
}

function makePutSecretResult(
  overrides: Partial<ReturnType<typeof usePutSecret>> = {},
): ReturnType<typeof usePutSecret> {
  return {
    mutateAsync: mockMutateAsync,
    isPending: false,
    reset: mockReset,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderKeysTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RestartRequiredProvider>
        <TooltipProvider delayDuration={0}>
          <KeysTab />
        </TooltipProvider>
      </RestartRequiredProvider>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockMutateAsync.mockResolvedValue(undefined);
  mockUseSecrets.mockReturnValue(
    makeSecretsResult([
      makeSecret({ key: "ANTHROPIC_API_KEY", is_set: true }),
      makeSecret({ key: "OPENAI_API_KEY", is_set: false }),
    ]),
  );
  mockUsePutSecret.mockReturnValue(makePutSecretResult());
});

afterEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// Security gate 1: is_set status only — no secret value in DOM
// ===========================================================================

describe("security: no secret value in DOM", () => {
  it("renders rows with is_set indicator only; inputs start empty (no pre-loaded value)", () => {
    renderKeysTab();

    // "Configured" badge appears for is_set=true key
    expect(
      screen.getByTestId("secret-field-is-set-ANTHROPIC_API_KEY"),
    ).toBeInTheDocument();

    // No "Configured" badge for is_set=false key
    expect(
      screen.queryByTestId("secret-field-is-set-OPENAI_API_KEY"),
    ).not.toBeInTheDocument();

    // SECURITY: Inputs for both editable keys start empty.
    // The stored secret value was NEVER passed into the component — only is_set.
    const anthropicInput = screen.getByTestId(
      "secret-field-input-ANTHROPIC_API_KEY",
    ) as HTMLInputElement;
    const openaiInput = screen.getByTestId(
      "secret-field-input-OPENAI_API_KEY",
    ) as HTMLInputElement;

    expect(anthropicInput.value).toBe("");
    expect(openaiInput.value).toBe("");
  });

  it("SecretField receives no value prop — confirmed by stub not rendering secret strings", () => {
    // The stub renders `secret-field-is-set-{key}` span when is_set=true,
    // and an empty password input. If a `value` prop existed it would
    // pre-fill the input — which would be a security leak.
    mockUseSecrets.mockReturnValue(
      makeSecretsResult([
        makeSecret({ key: "ANTHROPIC_API_KEY", is_set: true }),
      ]),
    );

    renderKeysTab();

    const input = screen.getByTestId(
      "secret-field-input-ANTHROPIC_API_KEY",
    ) as HTMLInputElement;

    // Input is empty — the real stored secret value was never passed in
    expect(input.value).toBe("");

    // The "Configured" badge shows only that a secret is set — not its value
    expect(
      screen.getByTestId("secret-field-is-set-ANTHROPIC_API_KEY"),
    ).toHaveTextContent("Configured");
  });
});

// ===========================================================================
// Security gate 2: forbidden keys locked/disabled
// ===========================================================================

describe("security: PORTAL_DISABLE_AUTH and PORTAL_ALLOW_NETWORK locked", () => {
  const forbiddenCases = [
    "PORTAL_DISABLE_AUTH",
    "PORTAL_ALLOW_NETWORK",
  ] as const;

  it.each(forbiddenCases)(
    "%s renders locked with no editable SecretField",
    (forbiddenKey) => {
      mockUseSecrets.mockReturnValue(
        makeSecretsResult([
          makeSecret({ key: "ANTHROPIC_API_KEY", is_set: true }),
          makeSecret({ key: forbiddenKey, is_set: false }),
        ]),
      );

      renderKeysTab();

      // Forbidden key is listed in the DOM
      expect(screen.getByText(forbiddenKey)).toBeInTheDocument();

      // SECURITY: No SecretField input should exist for this forbidden key.
      expect(
        screen.queryByTestId(`secret-field-input-${forbiddenKey}`),
      ).not.toBeInTheDocument();

      // SECURITY: No Save button for this key.
      expect(
        screen.queryByTestId(`secret-field-save-${forbiddenKey}`),
      ).not.toBeInTheDocument();

      // A locked indicator is present (aria-label on the span)
      expect(
        screen.getByLabelText(/Cannot be modified from the UI/i),
      ).toBeInTheDocument();
    },
  );

  it("normal key next to a forbidden key still renders an editable SecretField", () => {
    mockUseSecrets.mockReturnValue(
      makeSecretsResult([
        makeSecret({ key: "ANTHROPIC_API_KEY", is_set: true }),
        makeSecret({ key: "PORTAL_DISABLE_AUTH", is_set: false }),
      ]),
    );

    renderKeysTab();

    // The normal key has an editable input
    expect(
      screen.getByTestId("secret-field-input-ANTHROPIC_API_KEY"),
    ).toBeInTheDocument();

    // The forbidden key does not
    expect(
      screen.queryByTestId("secret-field-input-PORTAL_DISABLE_AUTH"),
    ).not.toBeInTheDocument();
  });
});

// ===========================================================================
// Security gate 3: successful submit calls PUT with value; 403 → non-retryable
// ===========================================================================

describe("security: PUT /secrets/{key} behaviour and 403 handling", () => {
  it("submitting a normal key calls mutateAsync with key and typed value", async () => {
    const user = userEvent.setup();

    mockUseSecrets.mockReturnValue(
      makeSecretsResult([makeSecret({ key: "ANTHROPIC_API_KEY", is_set: false })]),
    );
    mockMutateAsync.mockResolvedValue(undefined);

    renderKeysTab();

    await user.type(
      screen.getByTestId("secret-field-input-ANTHROPIC_API_KEY"),
      "sk-ant-test-value",
    );

    await user.click(screen.getByTestId("secret-field-save-ANTHROPIC_API_KEY"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        key: "ANTHROPIC_API_KEY",
        value: "sk-ant-test-value",
      });
    });
  });

  it("shows non-retryable message on 403 SECRET_KEY_FORBIDDEN; no retry button", async () => {
    const user = userEvent.setup();

    mockUseSecrets.mockReturnValue(
      makeSecretsResult([makeSecret({ key: "ANTHROPIC_API_KEY", is_set: false })]),
    );
    mockMutateAsync.mockRejectedValue(
      new ApiError(403, {
        code: "SECRET_KEY_FORBIDDEN",
        message: "Forbidden",
      }),
    );

    renderKeysTab();

    await user.type(
      screen.getByTestId("secret-field-input-ANTHROPIC_API_KEY"),
      "some-value",
    );

    await user.click(screen.getByTestId("secret-field-save-ANTHROPIC_API_KEY"));

    // Non-retryable error message must appear exactly once — as a role=alert
    // paragraph outside the SecretField (not via the error prop, which is
    // reserved for retryable inline errors).
    await waitFor(() => {
      expect(
        screen.getByRole("alert", { name: undefined }),
      ).toHaveTextContent(/this key cannot be modified from the UI/i);
    });

    // SECURITY: No "Retry" button — the error is non-retryable
    expect(
      screen.queryByRole("button", { name: /retry/i }),
    ).not.toBeInTheDocument();
  });
});

// ===========================================================================
// Security gate 4: input cleared after successful submit (write-only)
// ===========================================================================

describe("security: SecretField input cleared after successful submit", () => {
  it("clears the input and shows success message after 204 success", async () => {
    const user = userEvent.setup();

    mockUseSecrets.mockReturnValue(
      makeSecretsResult([makeSecret({ key: "ANTHROPIC_API_KEY", is_set: false })]),
    );
    mockMutateAsync.mockResolvedValue(undefined);

    renderKeysTab();

    const input = screen.getByTestId(
      "secret-field-input-ANTHROPIC_API_KEY",
    ) as HTMLInputElement;

    await user.type(input, "my-api-key");
    expect(input.value).toBe("my-api-key");

    await user.click(screen.getByTestId("secret-field-save-ANTHROPIC_API_KEY"));

    // After save, input must be cleared (write-only contract enforced by stub)
    await waitFor(() => {
      expect(input.value).toBe("");
    });

    // Success message visible
    expect(
      screen.getByText(/Saved — trigger a reload to activate/i),
    ).toBeInTheDocument();
  });
});

// ===========================================================================
// Additional behaviour: 422 CONFIG_INVALID
// ===========================================================================

describe("422 CONFIG_INVALID → inline retryable error", () => {
  it("shows inline error from 422 CONFIG_INVALID response", async () => {
    const user = userEvent.setup();

    mockUseSecrets.mockReturnValue(
      makeSecretsResult([makeSecret({ key: "OPENAI_API_KEY", is_set: false })]),
    );
    mockMutateAsync.mockRejectedValue(
      new ApiError(422, {
        code: "CONFIG_INVALID",
        message: "Value format is invalid.",
      }),
    );

    renderKeysTab();

    await user.type(
      screen.getByTestId("secret-field-input-OPENAI_API_KEY"),
      "bad-value",
    );

    await user.click(screen.getByTestId("secret-field-save-OPENAI_API_KEY"));

    await waitFor(() => {
      expect(
        screen.getByText(/Value format is invalid\./i),
      ).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// Loading / error / empty states
// ===========================================================================

describe("loading and error states", () => {
  it("renders a Spinner while secrets are loading", () => {
    mockUseSecrets.mockReturnValue(
      makeSecretsResult([], { isLoading: true }),
    );

    renderKeysTab();

    expect(
      screen.getByRole("status", { name: /Loading secrets/i }),
    ).toBeInTheDocument();
  });

  it("renders error alert when useSecrets reports an error", () => {
    mockUseSecrets.mockReturnValue(
      makeSecretsResult([], {
        isError: true,
        error: new Error("Network error"),
      }),
    );

    renderKeysTab();

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText(/Could not load secret keys/i),
    ).toBeInTheDocument();
  });

  it("renders empty state message when secrets list is empty", () => {
    mockUseSecrets.mockReturnValue(makeSecretsResult([]));

    renderKeysTab();

    expect(
      screen.getByText(/No secret keys configured/i),
    ).toBeInTheDocument();
  });
});
