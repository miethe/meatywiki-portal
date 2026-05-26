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
  IntentCore,
  RouteCard,
  RoutePreference,
  DesiredOutput,
  CitationStrictness,
  SensitivityProfile,
  TimeProfile,
  CostSensitivity,
  ReuseLikelihood,
} from "@/types/workflows/research";
import { apiFetch } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Draft saved response
// ---------------------------------------------------------------------------

export interface SaveDraftResponse {
  /** ULID of the created workflow_runs row with status="draft". */
  run_id: string;
}

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
  // --- v2.4 additions ---
  /** Data sensitivity level. Default: "internal". */
  sensitivity_profile: SensitivityProfile;
  /** Free-form task type hint. */
  task_type: string;
  /** Target audience for the generated output. */
  audience: string;
  /** Urgency of the research task. Default: "standard". */
  time_profile: TimeProfile;
  /** Operator tolerance for per-run token cost. Default: "medium". */
  cost_sensitivity: CostSensitivity;
  /** Estimated likelihood of reuse. Default: "medium". */
  reuse_likelihood: ReuseLikelihood;
  /** Optional methodology/background context note. */
  background: string;
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
  // v2.4 defaults
  sensitivity_profile: "internal",
  task_type: "",
  audience: "",
  time_profile: "standard",
  cost_sensitivity: "medium",
  reuse_likelihood: "medium",
  background: "",
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

  /**
   * Distilled intent extracted by the routing analysis.
   * Null until routing analysis succeeds.
   */
  intent_core: IntentCore | null;

  /**
   * Named entities extracted from the research question and topic.
   * Empty array until routing analysis succeeds.
   */
  extracted_entities: string[];

  /**
   * Archival pattern archetypes detected from the request.
   * Empty array until routing analysis succeeds.
   */
  archival_archetypes: string[];

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
  error_scope: "routing" | "submit" | "draft" | null;

  /** True while save-as-draft POST is in flight. */
  is_saving_draft: boolean;

  /** Run ID of a successfully saved draft (cleared on RESET). */
  draft_run_id: string | null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type WizardAction<
  TFields extends Record<string, unknown> = ExternalResearchPackageFields,
> =
  | { type: "SET_PACKAGE_FIELD"; field: keyof TFields; value: TFields[keyof TFields] }
  | { type: "FETCH_ROUTES_START" }
  | { type: "FETCH_ROUTES_SUCCESS"; route_cards: RouteCard[]; intent_core: IntentCore; extracted_entities: string[]; archival_archetypes: string[] }
  | { type: "FETCH_ROUTES_ERROR"; error: string }
  | { type: "SELECT_VENUE"; venue: RoutePreference }
  | { type: "ADVANCE_TO_CONFIRM" }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS"; run_response: CreateRunResponse }
  | { type: "SUBMIT_ERROR"; error: string }
  | { type: "SAVE_DRAFT_START" }
  | { type: "SAVE_DRAFT_SUCCESS"; draft_run_id: string }
  | { type: "SAVE_DRAFT_ERROR"; error: string }
  | { type: "LOAD_DRAFT"; fields: TFields; draft_run_id: string; route_cards: RouteCard[]; selected_venue: RoutePreference }
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
    intent_core: null,
    extracted_entities: [],
    archival_archetypes: [],
    selected_venue: null,
    run_response: null,
    template_id,
    is_fetching_routes: false,
    is_submitting: false,
    is_saving_draft: false,
    draft_run_id: null,
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
        intent_core: action.intent_core,
        extracted_entities: action.extracted_entities,
        archival_archetypes: action.archival_archetypes,
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
    // Step 3 — save as draft
    // ------------------------------------------------------------------
    case "SAVE_DRAFT_START":
      return {
        ...state,
        is_saving_draft: true,
        error: null,
        error_scope: null,
      };

    case "SAVE_DRAFT_SUCCESS":
      return {
        ...state,
        is_saving_draft: false,
        draft_run_id: action.draft_run_id,
        error: null,
        error_scope: null,
      };

    case "SAVE_DRAFT_ERROR":
      return {
        ...state,
        is_saving_draft: false,
        error: action.error,
        error_scope: "draft",
      };

    // ------------------------------------------------------------------
    // Draft re-entry — loads saved draft at Step 3
    // ------------------------------------------------------------------
    case "LOAD_DRAFT":
      return {
        ...state,
        current_step: 3,
        package_fields: action.fields,
        route_cards: action.route_cards,
        selected_venue: action.selected_venue,
        draft_run_id: action.draft_run_id,
        is_fetching_routes: false,
        is_submitting: false,
        is_saving_draft: false,
        error: null,
        error_scope: null,
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
          intent_core: null,
          extracted_entities: [],
          archival_archetypes: [],
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
): Promise<import("@/types/workflows/research").RoutingAnalysisResponse> {
  return apiFetch<import("@/types/workflows/research").RoutingAnalysisResponse>(
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
          sensitivity_profile: fields.sensitivity_profile,
        },
      }),
    },
  );
}

/** POST /api/workflows/external-research with save_as_draft=true */
async function saveResearchDraft(
  fields: ExternalResearchPackageFields,
  selectedVenue: RoutePreference,
): Promise<SaveDraftResponse> {
  const body: CreateExternalResearchBody & { save_as_draft: boolean } = {
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
    sensitivity_profile: fields.sensitivity_profile,
    task_type: fields.task_type || undefined,
    audience: fields.audience || undefined,
    time_profile: fields.time_profile,
    cost_sensitivity: fields.cost_sensitivity,
    reuse_likelihood: fields.reuse_likelihood,
    background: fields.background || undefined,
    save_as_draft: true,
  };

  return apiFetch<SaveDraftResponse>("/workflows/external-research", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** PATCH /api/workflows/{run_id}/external-research/task — draft → created */
async function enqueueResearchDraft(
  draftRunId: string,
): Promise<CreateRunResponse> {
  return apiFetch<CreateRunResponse>(
    `/workflows/${encodeURIComponent(draftRunId)}/external-research/task`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "created" }),
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
    // v2.4 optional fields — only included when non-default to keep payload clean
    sensitivity_profile: fields.sensitivity_profile,
    task_type: fields.task_type || undefined,
    audience: fields.audience || undefined,
    time_profile: fields.time_profile,
    cost_sensitivity: fields.cost_sensitivity,
    reuse_likelihood: fields.reuse_likelihood,
    background: fields.background || undefined,
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
     * POST /api/workflows/external-research (normal — creates + enqueues run).
     *
     * Dispatches SUBMIT_START → SUBMIT_SUCCESS | SUBMIT_ERROR.
     * No-op if already submitting or selected_venue is null.
     * After SUBMIT_SUCCESS, read state.run_response to open the viewer.
     *
     * If state.draft_run_id is set (re-entering a draft), this PATCHes
     * the draft run to transition draft → created instead of creating a new run.
     */
    handoff: () => Promise<void>;

    /**
     * POST /api/workflows/external-research with save_as_draft=true.
     *
     * Dispatches SAVE_DRAFT_START → SAVE_DRAFT_SUCCESS | SAVE_DRAFT_ERROR.
     * On success, state.draft_run_id is set.
     * No-op if already submitting or saving or selected_venue is null.
     */
    saveAsDraft: () => Promise<void>;
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWorkflowWizardState(
  template_id: string,
  initialDraft?: {
    fields: ExternalResearchPackageFields;
    draft_run_id: string;
    route_cards: RouteCard[];
    selected_venue: RoutePreference;
  },
): UseWizardResult {
  const [state, dispatch] = useReducer(
    reducer as React.Reducer<
      WizardState<ExternalResearchPackageFields>,
      WizardAction<ExternalResearchPackageFields>
    >,
    { template_id, initialDraft },
    ({ template_id: tid, initialDraft: draft }) => {
      const base = makeInitialState(tid);
      if (!draft) return base;
      // Pre-populate from draft — start at Step 3
      return {
        ...base,
        current_step: 3 as const,
        package_fields: draft.fields,
        route_cards: draft.route_cards,
        selected_venue: draft.selected_venue,
        draft_run_id: draft.draft_run_id,
      };
    },
  );

  const submitPackage = useCallback(async (): Promise<void> => {
    if (state.is_fetching_routes) return;

    dispatch({ type: "FETCH_ROUTES_START" });
    try {
      const response = await analyseRouting(state.package_fields);
      dispatch({
        type: "FETCH_ROUTES_SUCCESS",
        route_cards: response.route_cards,
        intent_core: response.intent_core,
        extracted_entities: response.extracted_entities ?? [],
        archival_archetypes: response.archival_archetypes ?? [],
      });
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
      let response: CreateRunResponse;
      if (state.draft_run_id !== null) {
        // Draft re-entry: PATCH draft → created (enqueues the existing run)
        response = await enqueueResearchDraft(state.draft_run_id);
      } else {
        // Normal: create a new run and enqueue
        response = await createExternalResearch(
          state.package_fields,
          state.selected_venue,
        );
      }
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
  }, [state.is_submitting, state.selected_venue, state.package_fields, state.draft_run_id]);

  const saveAsDraft = useCallback(async (): Promise<void> => {
    if (state.is_submitting || state.is_saving_draft) return;
    if (state.selected_venue === null) return;

    dispatch({ type: "SAVE_DRAFT_START" });
    try {
      const response = await saveResearchDraft(
        state.package_fields,
        state.selected_venue,
      );
      dispatch({ type: "SAVE_DRAFT_SUCCESS", draft_run_id: response.run_id });
    } catch (err) {
      dispatch({
        type: "SAVE_DRAFT_ERROR",
        error:
          err instanceof Error
            ? err.message
            : "Failed to save draft — please try again.",
      });
    }
  }, [state.is_submitting, state.is_saving_draft, state.selected_venue, state.package_fields]);

  return {
    state,
    dispatch,
    actions: { submitPackage, handoff, saveAsDraft },
  };
}

// ---------------------------------------------------------------------------
// Context + Provider
// ---------------------------------------------------------------------------

export const WizardStateContext = createContext<UseWizardResult | null>(null);

/**
 * Mount at the wizard root. Provides wizard state to all sub-components.
 *
 * Pass `initialDraft` to pre-populate wizard state from a saved draft run
 * (re-entry from /research → ActiveResearchRuns draft card click).
 *
 * Usage (normal):
 *   <WorkflowWizardProvider template_id="external_research_v1">
 *     ...
 *   </WorkflowWizardProvider>
 *
 * Usage (draft re-entry):
 *   <WorkflowWizardProvider template_id="external_research_v1" initialDraft={draftState}>
 *     ...
 *   </WorkflowWizardProvider>
 */
export function WorkflowWizardProvider({
  template_id,
  initialDraft,
  children,
}: {
  template_id: string;
  /** When provided, wizard starts at Step 3 pre-populated from the draft run. */
  initialDraft?: {
    fields: ExternalResearchPackageFields;
    draft_run_id: string;
    route_cards: RouteCard[];
    selected_venue: RoutePreference;
  };
  children: React.ReactNode;
}): React.JSX.Element {
  const value = useWorkflowWizardState(template_id, initialDraft);
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
