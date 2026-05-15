"use client";

/**
 * useWorkflowWizardState — React Context + useReducer state machine for the
 * 3-step external-research workflow wizard.
 *
 * Design contract: meatywiki/.claude/context/key-context/research-wizard-state-machine.md
 *
 * Step 1 — Package: user fills topic, question, and optional fields.
 * Step 2 — Route:   backend runs routing analysis; user picks a venue.
 * Step 3 — Confirm: user reviews and submits; wizard creates the run.
 *
 * The reducer is pure — no async logic. All network calls live in the named
 * action helpers (submitPackage, handoff) which dispatch before/after each
 * fetch. See §4 "Side-effect boundary" in the design doc.
 *
 * P4-02 scaffold. TODO bodies are filled in by P4-03/04/05.
 */

import React, { createContext, useCallback, useContext, useReducer } from "react";
import type {
  CreateExternalResearchBody,
  CreateRunResponse,
  RouteCard,
  RoutePreference,
  DesiredOutput,
  CitationStrictness,
} from "@/types/workflows/research";
import { apiFetch } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Package fields
// ---------------------------------------------------------------------------

/**
 * All fields the user can set in Step 1.
 *
 * Mirrors CreateExternalResearchBody but kept separate so the wizard state
 * can hold partial/draft values without conflicting with backend-required
 * field constraints (topic and research_question must be non-empty on POST).
 */
export interface ExternalResearchPackageFields {
  topic: string;
  research_question: string;
  project: string[];
  domain: string[];
  selected_artifact_ids: string[];
  route_preference: RoutePreference;
  desired_output: DesiredOutput;
  freshness_window: string;
  citation_strictness: CitationStrictness;
  save_prompt_package: boolean;
  /** Index signature — required for Record<string, unknown> compat in generic WizardState. */
  [key: string]: unknown;
}

export const DEFAULT_PACKAGE_FIELDS: ExternalResearchPackageFields = {
  topic: "",
  research_question: "",
  project: [],
  domain: [],
  selected_artifact_ids: [],
  route_preference: "auto",
  desired_output: "briefing",
  freshness_window: "current",
  citation_strictness: "advisory",
  save_prompt_package: true,
};

// ---------------------------------------------------------------------------
// Wizard step
// ---------------------------------------------------------------------------

export type WizardStep = 1 | 2 | 3;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * Core wizard state — generic over package fields.
 *
 * TFields defaults to ExternalResearchPackageFields for this wizard.
 * Future templates can substitute their own field type.
 */
export interface WizardState<
  TFields extends Record<string, unknown> = ExternalResearchPackageFields,
> {
  current_step: WizardStep;

  /** Mutable package fields — reflect live form values. */
  package_fields: TFields;

  /**
   * Route cards from POST /api/workflows/external-research/routing-analysis.
   * Null until fetched.
   */
  route_cards: RouteCard[] | null;

  /** Venue selected by the user in Step 2. Null until user picks one. */
  selected_venue: RoutePreference | null;

  /**
   * Run creation response from POST /api/workflows/external-research.
   * Null until Step 3 submission succeeds.
   */
  run_response: CreateRunResponse | null;

  /** The workflow template ID injected at initialisation. */
  template_id: string;

  /** True while routing analysis fetch is in flight. */
  is_fetching_routes: boolean;

  /** True while run creation POST is in flight. */
  is_submitting: boolean;

  /** Non-null when an operation failed. Cleared on the next async start or RESET. */
  error: string | null;

  /** Which operation produced the current error. */
  error_scope: "routing" | "submit" | null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type WizardAction<
  TFields extends Record<string, unknown> = ExternalResearchPackageFields,
> =
  | { type: "SET_PACKAGE_FIELD"; field: keyof TFields; value: TFields[keyof TFields] }
  | { type: "FETCH_ROUTES_START" }
  | { type: "FETCH_ROUTES_SUCCESS"; route_cards: RouteCard[] }
  | { type: "FETCH_ROUTES_ERROR"; error: string }
  | { type: "SELECT_VENUE"; venue: RoutePreference }
  | { type: "ADVANCE_TO_CONFIRM" }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS"; run_response: CreateRunResponse }
  | { type: "SUBMIT_ERROR"; error: string }
  | { type: "GO_BACK" }
  | { type: "RESET" };

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

function makeInitialState(
  template_id: string,
): WizardState<ExternalResearchPackageFields> {
  return {
    current_step: 1,
    package_fields: { ...DEFAULT_PACKAGE_FIELDS },
    route_cards: null,
    selected_venue: null,
    run_response: null,
    template_id,
    is_fetching_routes: false,
    is_submitting: false,
    error: null,
    error_scope: null,
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer<TFields extends Record<string, unknown>>(
  state: WizardState<TFields>,
  action: WizardAction<TFields>,
): WizardState<TFields> {
  switch (action.type) {
    // ------------------------------------------------------------------
    // Step 1 field editing
    // ------------------------------------------------------------------
    case "SET_PACKAGE_FIELD":
      return {
        ...state,
        package_fields: {
          ...state.package_fields,
          [action.field]: action.value,
        },
        // Clear error when user corrects the form
        error: null,
        error_scope: null,
      };

    // ------------------------------------------------------------------
    // Step 1 → Step 2 routing analysis
    // ------------------------------------------------------------------
    case "FETCH_ROUTES_START":
      return {
        ...state,
        is_fetching_routes: true,
        error: null,
        error_scope: null,
      };

    case "FETCH_ROUTES_SUCCESS": {
      const topVenue = action.route_cards[0]?.route ?? null;
      return {
        ...state,
        is_fetching_routes: false,
        current_step: 2,
        route_cards: action.route_cards,
        selected_venue: topVenue,
        error: null,
        error_scope: null,
      };
    }

    case "FETCH_ROUTES_ERROR":
      return {
        ...state,
        is_fetching_routes: false,
        error: action.error,
        error_scope: "routing",
      };

    // ------------------------------------------------------------------
    // Step 2 — venue selection + advance
    // ------------------------------------------------------------------
    case "SELECT_VENUE":
      return { ...state, selected_venue: action.venue };

    case "ADVANCE_TO_CONFIRM":
      return { ...state, current_step: 3, error: null, error_scope: null };

    // ------------------------------------------------------------------
    // Step 3 — run submission
    // ------------------------------------------------------------------
    case "SUBMIT_START":
      return {
        ...state,
        is_submitting: true,
        error: null,
        error_scope: null,
      };

    case "SUBMIT_SUCCESS":
      return {
        ...state,
        is_submitting: false,
        run_response: action.run_response,
        error: null,
        error_scope: null,
      };

    case "SUBMIT_ERROR":
      return {
        ...state,
        is_submitting: false,
        error: action.error,
        error_scope: "submit",
      };

    // ------------------------------------------------------------------
    // Navigation
    // ------------------------------------------------------------------
    case "GO_BACK": {
      if (state.current_step === 1) return state; // already at first step

      if (state.current_step === 2) {
        return {
          ...state,
          current_step: 1,
          route_cards: null,
          selected_venue: null,
          error: null,
          error_scope: null,
        };
      }

      // Step 3 → Step 2: keep route_cards + selected_venue
      return {
        ...state,
        current_step: 2,
        error: null,
        error_scope: null,
      };
    }

    // ------------------------------------------------------------------
    // Reset
    // ------------------------------------------------------------------
    case "RESET":
      return makeInitialState(state.template_id) as unknown as WizardState<TFields>;

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// API helpers (TODO: move to src/lib/api/external-research.ts in P4-03)
// ---------------------------------------------------------------------------

/** POST /api/workflows/external-research/routing-analysis */
async function analyseRouting(
  fields: ExternalResearchPackageFields,
): Promise<{ route_cards: RouteCard[] }> {
  // TODO P4-03: wire to real endpoint using apiFetch
  return apiFetch<{ route_cards: RouteCard[] }>(
    "/workflows/external-research/routing-analysis",
    {
      method: "POST",
      body: JSON.stringify({
        topic: fields.topic,
        research_question: fields.research_question,
        corpus_artifact_ids: fields.selected_artifact_ids,
        route_preference: fields.route_preference,
        constraints: {
          freshness_window: fields.freshness_window,
          citation_strictness: fields.citation_strictness,
        },
      }),
    },
  );
}

/** POST /api/workflows/external-research */
async function createExternalResearch(
  fields: ExternalResearchPackageFields,
  selectedVenue: RoutePreference,
): Promise<CreateRunResponse> {
  const body: CreateExternalResearchBody = {
    topic: fields.topic,
    research_question: fields.research_question,
    project: fields.project.length > 0 ? fields.project : undefined,
    domain: fields.domain.length > 0 ? fields.domain : undefined,
    selected_artifact_ids:
      fields.selected_artifact_ids.length > 0
        ? fields.selected_artifact_ids
        : undefined,
    route_preference: selectedVenue,
    desired_output: fields.desired_output,
    freshness_window: fields.freshness_window,
    citation_strictness: fields.citation_strictness,
    save_prompt_package: fields.save_prompt_package,
  };

  // TODO P4-03: wire to real endpoint using apiFetch
  return apiFetch<CreateRunResponse>("/workflows/external-research", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Public hook result
// ---------------------------------------------------------------------------

export interface UseWizardResult {
  state: WizardState<ExternalResearchPackageFields>;
  dispatch: React.Dispatch<WizardAction<ExternalResearchPackageFields>>;
  actions: {
    /**
     * POST /api/workflows/external-research/routing-analysis.
     *
     * Dispatches FETCH_ROUTES_START → FETCH_ROUTES_SUCCESS | FETCH_ROUTES_ERROR.
     * No-op if already fetching.
     */
    submitPackage: () => Promise<void>;

    /**
     * POST /api/workflows/external-research.
     *
     * Dispatches SUBMIT_START → SUBMIT_SUCCESS | SUBMIT_ERROR.
     * No-op if already submitting or selected_venue is null.
     * After SUBMIT_SUCCESS, read state.run_response to open the viewer.
     */
    handoff: () => Promise<void>;
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWorkflowWizardState(template_id: string): UseWizardResult {
  const [state, dispatch] = useReducer(
    reducer as React.Reducer<
      WizardState<ExternalResearchPackageFields>,
      WizardAction<ExternalResearchPackageFields>
    >,
    template_id,
    makeInitialState,
  );

  const submitPackage = useCallback(async (): Promise<void> => {
    if (state.is_fetching_routes) return;

    dispatch({ type: "FETCH_ROUTES_START" });
    try {
      const response = await analyseRouting(state.package_fields);
      dispatch({ type: "FETCH_ROUTES_SUCCESS", route_cards: response.route_cards });
    } catch (err) {
      dispatch({
        type: "FETCH_ROUTES_ERROR",
        error:
          err instanceof Error
            ? err.message
            : "Routing analysis failed — please try again.",
      });
    }
  }, [state.is_fetching_routes, state.package_fields]);

  const handoff = useCallback(async (): Promise<void> => {
    if (state.is_submitting) return;
    if (state.selected_venue === null) return;

    dispatch({ type: "SUBMIT_START" });
    try {
      const response = await createExternalResearch(
        state.package_fields,
        state.selected_venue,
      );
      dispatch({ type: "SUBMIT_SUCCESS", run_response: response });
    } catch (err) {
      dispatch({
        type: "SUBMIT_ERROR",
        error:
          err instanceof Error
            ? err.message
            : "Failed to create research run — please try again.",
      });
    }
  }, [state.is_submitting, state.selected_venue, state.package_fields]);

  return {
    state,
    dispatch,
    actions: { submitPackage, handoff },
  };
}

// ---------------------------------------------------------------------------
// Context + Provider
// ---------------------------------------------------------------------------

export const WizardStateContext = createContext<UseWizardResult | null>(null);

/**
 * Mount at the wizard root. Provides wizard state to all sub-components.
 *
 * Usage:
 *   <WorkflowWizardProvider template_id="external_research_v1">
 *     <WizardStepNav />
 *     <WizardStepPanel />
 *   </WorkflowWizardProvider>
 */
export function WorkflowWizardProvider({
  template_id,
  children,
}: {
  template_id: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const value = useWorkflowWizardState(template_id);
  return (
    <WizardStateContext.Provider value={value}>
      {children}
    </WizardStateContext.Provider>
  );
}

/**
 * Convenience hook for sub-components. Throws if used outside WorkflowWizardProvider.
 *
 * Usage in a step panel:
 *   const { state, dispatch, actions } = useWizardStateContext();
 */
export function useWizardStateContext(): UseWizardResult {
  const ctx = useContext(WizardStateContext);
  if (ctx === null) {
    throw new Error(
      "useWizardStateContext must be used inside <WorkflowWizardProvider>.",
    );
  }
  return ctx;
}
