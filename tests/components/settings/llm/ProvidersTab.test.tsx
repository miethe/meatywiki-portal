/**
 * ProvidersTab component tests (FE-P4 / P4-04).
 *
 * Covers:
 *   - Provider cards render with id, adapter, base_url, api_key_env, and
 *     the api_key_is_set boolean Badge ("Key set" / "No key").
 *   - CRITICAL: No api_key value is ever rendered in the DOM.
 *   - Inline edit opens and sends PUT /providers/{id} with the descriptor.
 *   - Only env-var NAME is editable here (api_key_env field), never a secret.
 *   - 422 CONFIG_INVALID → form-level error message shown.
 *   - 404 PROVIDER_NOT_FOUND → non-retryable inline notice, form closed.
 *   - Loading state renders Spinner.
 *
 * Mocking strategy:
 *   Mock both useLlmSettings hooks (useProviders + useUpsertProvider) at the
 *   module boundary. MSW is active via global setup (tests/setup.ts) but is
 *   not the primary mechanism here — direct mock-returns keep tests fast and
 *   deterministic.
 *
 *   @miethe/ui primitives are mocked to thin HTML equivalents so the test
 *   environment does not require the built package.
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProvidersTab } from "@/components/settings/llm/tabs/ProvidersTab";
import { ApiError } from "@/lib/api/client";
import type { ProviderRead } from "@/lib/api/llm-settings.types";

// ---------------------------------------------------------------------------
// Mock @miethe/ui — thin HTML equivalents; no build artefact needed in tests
// ---------------------------------------------------------------------------

jest.mock("@miethe/ui", () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card" {...props}>{children}</div>
  ),
  CardHeader: ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card-header" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
  Badge: ({
    children,
    variant,
    "aria-label": ariaLabel,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { variant?: string }) => (
    <span
      data-testid="badge"
      data-variant={variant}
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </span>
  ),
  FormField: ({
    label,
    htmlFor,
    error,
    hint,
    children,
  }: {
    label?: string;
    htmlFor?: string;
    error?: string;
    hint?: string;
    children?: React.ReactNode;
  }) => (
    <div>
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {error && <p role="alert">{error}</p>}
      {hint && <p>{hint}</p>}
    </div>
  ),
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    (props, ref) => <input ref={ref} {...props} />,
  ),
  Spinner: ({ "aria-label": ariaLabel }: { "aria-label"?: string; size?: string }) => (
    <span role="status" aria-label={ariaLabel ?? "Loading"} />
  ),
}));

// ---------------------------------------------------------------------------
// Mock useLlmSettings hooks
// ---------------------------------------------------------------------------

const mockMutateAsync = jest.fn();

jest.mock("@/hooks/useLlmSettings", () => ({
  useProviders: jest.fn(),
  useUpsertProvider: jest.fn(),
}));

import {
  useProviders,
  useUpsertProvider,
} from "@/hooks/useLlmSettings";

const mockUseProviders = useProviders as jest.MockedFunction<typeof useProviders>;
const mockUseUpsertProvider = useUpsertProvider as jest.MockedFunction<typeof useUpsertProvider>;

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Test wrapper
// ---------------------------------------------------------------------------

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function renderTab() {
  return render(
    <TestWrapper>
      <ProvidersTab />
    </TestWrapper>,
  );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockMutateAsync.mockResolvedValue(makeProvider());
  mockUseUpsertProvider.mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
    reset: jest.fn(),
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// 1. Loading state
// ===========================================================================

describe("ProvidersTab — loading state", () => {
  it("renders a Spinner while providers are loading", () => {
    mockUseProviders.mockReturnValue({
      providers: [],
      isLoading: true,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    renderTab();

    expect(screen.getByRole("status", { name: /loading providers/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// 2. Provider cards render with correct fields + Badge
// ===========================================================================

describe("ProvidersTab — provider cards", () => {
  it("renders a card for each provider with id, adapter, base_url, api_key_env, and is_set badge", () => {
    mockUseProviders.mockReturnValue({
      providers: [
        makeProvider({ id: "anthropic", adapter: "anthropic", api_key_is_set: true }),
        makeProvider({
          id: "openai",
          adapter: "openai",
          api_key_env: "OPENAI_API_KEY",
          api_key_is_set: false,
        }),
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    renderTab();

    // Both provider IDs visible (id + adapter share the same text; use getAllByText)
    expect(screen.getAllByText("anthropic").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("openai").length).toBeGreaterThanOrEqual(1);

    // is_set badges
    expect(screen.getByText("Key set")).toBeInTheDocument();
    expect(screen.getByText("No key")).toBeInTheDocument();

    // api_key_env names visible
    expect(screen.getByText("ANTHROPIC_API_KEY")).toBeInTheDocument();
    expect(screen.getByText("OPENAI_API_KEY")).toBeInTheDocument();
  });

  it("shows 'Key set' badge with default variant for api_key_is_set=true", () => {
    mockUseProviders.mockReturnValue({
      providers: [makeProvider({ api_key_is_set: true })],
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    renderTab();

    const badge = screen.getByText("Key set");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-variant", "default");
  });

  it("shows 'No key' badge with secondary variant for api_key_is_set=false", () => {
    mockUseProviders.mockReturnValue({
      providers: [makeProvider({ api_key_is_set: false })],
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    renderTab();

    const badge = screen.getByText("No key");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-variant", "secondary");
  });
});

// ===========================================================================
// 3. CRITICAL — no api_key value ever in DOM
// ===========================================================================

describe("ProvidersTab — api_key security invariant", () => {
  it("NEVER renders an api_key value in the DOM — only the env-var name and is_set boolean", () => {
    mockUseProviders.mockReturnValue({
      providers: [
        makeProvider({
          id: "anthropic",
          api_key_env: "ANTHROPIC_API_KEY",
          api_key_is_set: true,
        }),
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    const { container } = renderTab();

    // The env-var NAME is allowed
    expect(screen.getByText("ANTHROPIC_API_KEY")).toBeInTheDocument();

    // The is_set badge is allowed
    expect(screen.getByText("Key set")).toBeInTheDocument();

    // No secret-like patterns in the rendered HTML (sk-ant-, sk-, api-key values)
    const html = container.innerHTML;
    expect(html).not.toMatch(/sk-ant-/);
    expect(html).not.toMatch(/api_key['":\s]*['"]\w+/);

    // ProviderRead has no api_key field — confirm no field named api_key is rendered
    expect(html).not.toMatch(/api[_-]?key\s*[:=]\s*["']\w{8,}/);
  });

  it("edit form exposes only the env-var name field, not a secret input", () => {
    mockUseProviders.mockReturnValue({
      providers: [makeProvider({ api_key_env: "ANTHROPIC_API_KEY" })],
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    renderTab();

    // Open edit form
    fireEvent.click(screen.getByRole("button", { name: /edit provider anthropic/i }));

    // The env-var name input must be present
    expect(screen.getByLabelText(/API Key Env Var/i)).toBeInTheDocument();

    // No password or secret input field
    const inputs = screen.getAllByRole("textbox");
    for (const input of inputs) {
      expect(input).not.toHaveAttribute("type", "password");
      // No input should have a secret-pattern value already populated
      const value = (input as HTMLInputElement).value;
      expect(value).not.toMatch(/sk-ant-/);
      expect(value).not.toMatch(/^sk-/);
    }
  });
});

// ===========================================================================
// 4. Inline edit — save sends PUT /providers/{id} with descriptor
// ===========================================================================

describe("ProvidersTab — inline edit save", () => {
  it("opens edit form on Edit click and sends PUT with the descriptor on submit", async () => {
    mockUseProviders.mockReturnValue({
      providers: [
        makeProvider({
          id: "ollama",
          adapter: "ollama",
          base_url: "http://localhost:11434",
          api_key_env: null,
          api_key_is_set: false,
        }),
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    renderTab();

    // Open edit
    fireEvent.click(screen.getByRole("button", { name: /edit provider ollama/i }));

    // Edit form renders adapter input
    const adapterInput = screen.getByLabelText(/Adapter/i);
    expect(adapterInput).toBeInTheDocument();
    expect((adapterInput as HTMLInputElement).value).toBe("ollama");

    // Change base_url
    const baseUrlInput = screen.getByLabelText(/Base URL/i);
    fireEvent.change(baseUrlInput, { target: { value: "http://ollama:11434" } });

    // Submit
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: "ollama",
        body: {
          adapter: "ollama",
          base_url: "http://ollama:11434",
          api_key_env: null,
        },
      });
    });
  });

  it("closes the edit form after a successful save", async () => {
    mockUseProviders.mockReturnValue({
      providers: [makeProvider()],
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    renderTab();

    fireEvent.click(screen.getByRole("button", { name: /edit provider anthropic/i }));
    expect(screen.getByLabelText(/Adapter/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    });

    await waitFor(() => {
      expect(screen.queryByLabelText(/Adapter/i)).not.toBeInTheDocument();
    });
  });

  it("Cancel button closes the edit form without saving", () => {
    mockUseProviders.mockReturnValue({
      providers: [makeProvider()],
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    renderTab();

    fireEvent.click(screen.getByRole("button", { name: /edit provider anthropic/i }));
    expect(screen.getByLabelText(/Adapter/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByLabelText(/Adapter/i)).not.toBeInTheDocument();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 5. 422 CONFIG_INVALID → form error
// ===========================================================================

describe("ProvidersTab — 422 CONFIG_INVALID error", () => {
  it("shows a form error when PUT returns 422 CONFIG_INVALID", async () => {
    mockUseProviders.mockReturnValue({
      providers: [makeProvider()],
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    mockMutateAsync.mockRejectedValue(
      new ApiError(422, {
        code: "CONFIG_INVALID",
        message: "Adapter 'bad' is not registered.",
      }),
    );

    renderTab();

    fireEvent.click(screen.getByRole("button", { name: /edit provider anthropic/i }));

    const adapterInput = screen.getByLabelText(/Adapter/i);
    fireEvent.change(adapterInput, { target: { value: "bad" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByRole("alert", { name: "" }),
      ).toHaveTextContent("Adapter 'bad' is not registered.");
    });

    // Form remains open after CONFIG_INVALID
    expect(screen.getByLabelText(/Adapter/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// 6. 404 PROVIDER_NOT_FOUND → non-retryable inline message
// ===========================================================================

describe("ProvidersTab — 404 PROVIDER_NOT_FOUND error", () => {
  it("shows a non-retryable notice and closes the form on 404", async () => {
    mockUseProviders.mockReturnValue({
      providers: [makeProvider()],
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    mockMutateAsync.mockRejectedValue(
      new ApiError(404, {
        code: "PROVIDER_NOT_FOUND",
        message: "Provider 'anthropic' not found.",
      }),
    );

    renderTab();

    fireEvent.click(screen.getByRole("button", { name: /edit provider anthropic/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/provider not found/i);
    });

    // Edit form inputs are gone; non-retryable notice replaces them
    expect(screen.queryByLabelText(/Adapter/i)).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 7. Empty providers list
// ===========================================================================

describe("ProvidersTab — empty state", () => {
  it("shows an empty state message when no providers are configured", () => {
    mockUseProviders.mockReturnValue({
      providers: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    renderTab();

    expect(screen.getByText(/no providers configured/i)).toBeInTheDocument();
  });
});
