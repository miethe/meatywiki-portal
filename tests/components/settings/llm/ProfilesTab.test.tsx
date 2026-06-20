/**
 * ProfilesTab component tests (FE-P4 / P4-02).
 *
 * Covers:
 *   1. Renders profile cards from MSW-mocked GET /portal/llm-settings/profiles.
 *   2. Active profile (from GET /portal/llm-settings/profile) gets an "Active" badge.
 *   3. Non-active profiles have a "Use" button; active profile does not.
 *   4. Clicking "Use" on a non-active profile calls POST /portal/llm-settings/profile.
 *   5. 409 PROFILE_ALREADY_ACTIVE → no error text shown (treated as benign).
 *   6. 404 PROFILE_NOT_FOUND → non-retryable inline error shown on the card.
 *   7. Loading state → Spinner rendered.
 *   8. Empty profiles list → "No profiles configured" message.
 *
 * Mocking strategy:
 *   - The useLlmSettings hooks are mocked at the module boundary so the component
 *     is tested in isolation from TanStack Query internals. This mirrors the approach
 *     in useLlmSettings.test.ts but targets the rendered component.
 *   - MSW (server.ts) is wired globally via tests/setup.ts and intercepted at the
 *     react-query layer; we still mock the hook module for deterministic control
 *     over loading / error / mutation states.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfilesTab } from "@/components/settings/llm/tabs/ProfilesTab";

// ---------------------------------------------------------------------------
// Mock the hooks module so tests control loading, error, and mutation states
// ---------------------------------------------------------------------------

jest.mock("@/hooks/useLlmSettings", () => ({
  useProfiles: jest.fn(),
  useActiveProfile: jest.fn(),
  useSwitchProfile: jest.fn(),
}));

import {
  useProfiles,
  useActiveProfile,
  useSwitchProfile,
} from "@/hooks/useLlmSettings";

import { ApiError } from "@/lib/api/client";
import type {
  UseActiveProfileResult,
  UseProfilesResult,
  UseSwitchProfileResult,
} from "@/hooks/useLlmSettings";

const mockUseProfiles = useProfiles as jest.MockedFunction<typeof useProfiles>;
const mockUseActiveProfile = useActiveProfile as jest.MockedFunction<typeof useActiveProfile>;
const mockUseSwitchProfile = useSwitchProfile as jest.MockedFunction<typeof useSwitchProfile>;

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeProfilesResult(
  overrides: Partial<UseProfilesResult> = {},
): UseProfilesResult {
  return {
    profiles: [
      { name: "default", description: "Default profile", provider: "anthropic" },
      { name: "fast", description: "Fast inference", provider: "openai" },
    ],
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    ...overrides,
  };
}

function makeActiveProfileResult(
  overrides: Partial<UseActiveProfileResult> = {},
): UseActiveProfileResult {
  return {
    data: { active_profile: "default", config: { name: "default", provider: "anthropic" } },
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    ...overrides,
  };
}

function makeSwitchProfileResult(
  mutateAsyncImpl: (name: string) => Promise<unknown> = jest.fn().mockResolvedValue({
    active_profile: "fast",
    config: { name: "fast", provider: "openai" },
  }),
): UseSwitchProfileResult {
  return {
    mutateAsync: mutateAsyncImpl as UseSwitchProfileResult["mutateAsync"],
    isPending: false,
    reset: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Safe defaults — two profiles, "default" active, mutation resolves
  mockUseProfiles.mockReturnValue(makeProfilesResult());
  mockUseActiveProfile.mockReturnValue(makeActiveProfileResult());
  mockUseSwitchProfile.mockReturnValue(makeSwitchProfileResult());
});

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderTab() {
  return render(<ProfilesTab />);
}

// ===========================================================================
// 1. Profile list renders
// ===========================================================================

describe("ProfilesTab — list rendering", () => {
  it("renders a card for each profile", () => {
    renderTab();
    expect(screen.getByText("default")).toBeInTheDocument();
    expect(screen.getByText("fast")).toBeInTheDocument();
  });

  it("shows provider label when present", () => {
    renderTab();
    expect(screen.getByText("Provider: anthropic")).toBeInTheDocument();
    expect(screen.getByText("Provider: openai")).toBeInTheDocument();
  });

  it("shows description when present", () => {
    renderTab();
    expect(screen.getByText("Default profile")).toBeInTheDocument();
    expect(screen.getByText("Fast inference")).toBeInTheDocument();
  });
});

// ===========================================================================
// 2. Active badge on the active profile
// ===========================================================================

describe("ProfilesTab — active badge", () => {
  it("renders an 'Active' badge on the active profile card", () => {
    renderTab();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("does not render a 'Use' button for the active profile", () => {
    renderTab();
    // Only the non-active "fast" profile should have a Use button
    const useButtons = screen.getAllByRole("button", { name: /use profile/i });
    expect(useButtons).toHaveLength(1);
    expect(useButtons[0]).toHaveAccessibleName("Use profile fast");
  });

  it("renders 'Use' buttons for all non-active profiles", () => {
    mockUseActiveProfile.mockReturnValue(
      makeActiveProfileResult({ data: { active_profile: null, config: null } }),
    );
    renderTab();
    // When no profile is active, both profiles get a Use button
    const useButtons = screen.getAllByRole("button", { name: /use profile/i });
    expect(useButtons).toHaveLength(2);
  });
});

// ===========================================================================
// 3. Clicking "Use" calls POST /profile (useSwitchProfile)
// ===========================================================================

describe("ProfilesTab — switching profiles", () => {
  it("calls mutateAsync with the profile name when Use is clicked", async () => {
    const mutateAsync = jest.fn().mockResolvedValue({
      active_profile: "fast",
      config: { name: "fast" },
    });
    mockUseSwitchProfile.mockReturnValue(makeSwitchProfileResult(mutateAsync));

    renderTab();

    const useButton = screen.getByRole("button", { name: "Use profile fast" });
    await userEvent.click(useButton);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith("fast");
    });
  });
});

// ===========================================================================
// 4. 409 PROFILE_ALREADY_ACTIVE → silent (no error text)
// ===========================================================================

describe("ProfilesTab — 409 PROFILE_ALREADY_ACTIVE", () => {
  it("shows no error text when POST returns 409 PROFILE_ALREADY_ACTIVE", async () => {
    const mutateAsync = jest.fn().mockRejectedValue(
      new ApiError(409, { code: "PROFILE_ALREADY_ACTIVE", message: "Already active" }),
    );
    mockUseSwitchProfile.mockReturnValue(makeSwitchProfileResult(mutateAsync));

    renderTab();

    const useButton = screen.getByRole("button", { name: "Use profile fast" });
    await userEvent.click(useButton);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalled();
    });

    // No alert or error text should appear
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/already active/i)).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 5. 404 PROFILE_NOT_FOUND → non-retryable inline error
// ===========================================================================

describe("ProfilesTab — 404 PROFILE_NOT_FOUND", () => {
  it("shows an inline non-retryable error when POST returns 404 PROFILE_NOT_FOUND", async () => {
    const mutateAsync = jest.fn().mockRejectedValue(
      new ApiError(404, {
        code: "PROFILE_NOT_FOUND",
        message: "Profile not found",
      }),
    );
    mockUseSwitchProfile.mockReturnValue(makeSwitchProfileResult(mutateAsync));

    renderTab();

    const useButton = screen.getByRole("button", { name: "Use profile fast" });
    await userEvent.click(useButton);

    // Error should appear as role="alert"
    const errorMessage = await screen.findByRole("alert");
    expect(errorMessage).toHaveTextContent(/not found/i);
  });

  it("disables the Use button after a 404 so it cannot be retried", async () => {
    const mutateAsync = jest.fn().mockRejectedValue(
      new ApiError(404, { code: "PROFILE_NOT_FOUND", message: "Profile not found" }),
    );
    mockUseSwitchProfile.mockReturnValue(makeSwitchProfileResult(mutateAsync));

    renderTab();

    const useButton = screen.getByRole("button", { name: "Use profile fast" });
    await userEvent.click(useButton);

    // After 404, button should be disabled (non-retryable)
    await waitFor(() => {
      expect(useButton).toBeDisabled();
    });
  });
});

// ===========================================================================
// 6. Loading state
// ===========================================================================

describe("ProfilesTab — loading state", () => {
  it("renders a spinner while profiles are loading", () => {
    mockUseProfiles.mockReturnValue(makeProfilesResult({ isLoading: true, profiles: [] }));
    renderTab();
    // Spinner renders role="status"
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders a spinner while active profile is loading", () => {
    mockUseActiveProfile.mockReturnValue(
      makeActiveProfileResult({ isLoading: true, data: undefined }),
    );
    renderTab();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

// ===========================================================================
// 7. Error state
// ===========================================================================

describe("ProfilesTab — error state", () => {
  it("renders an alert when profiles fail to load", () => {
    mockUseProfiles.mockReturnValue(
      makeProfilesResult({
        profiles: [],
        isError: true,
        error: new Error("Network error"),
      }),
    );
    renderTab();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/could not load profiles/i);
  });
});

// ===========================================================================
// 8. Empty state
// ===========================================================================

describe("ProfilesTab — empty state", () => {
  it("renders 'No profiles configured' when the list is empty", () => {
    mockUseProfiles.mockReturnValue(makeProfilesResult({ profiles: [] }));
    renderTab();
    expect(screen.getByText(/no profiles configured/i)).toBeInTheDocument();
  });

  it("does not render any profile cards when empty", () => {
    mockUseProfiles.mockReturnValue(makeProfilesResult({ profiles: [] }));
    renderTab();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 9. No create / edit UI
// ===========================================================================

describe("ProfilesTab — no create/edit UI (DEC-FE-3)", () => {
  it("does not render any form inputs or create buttons", () => {
    renderTab();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /create|add|new|edit/i }),
    ).not.toBeInTheDocument();
  });
});
