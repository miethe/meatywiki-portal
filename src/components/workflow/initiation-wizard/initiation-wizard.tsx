"use client";

/**
 * InitiationWizardScreen — 3-step workflow creation dialog.
 *
 * Step 1: Source / scope selection (all library | recent drafts | selected)
 * Step 2: Routing confirmation (RoutingRecommendationCard + template dropdown)
 * Step 3: Configure parameters (template-specific param inputs)
 *
 * Submit: POST /api/workflows → navigate to /workflows/:run_id
 *
 * Traces FR-1.5-06 / P1.5-2-03.
 *
 * Stitch references:
 *   workflow-initiation-step-1-intake.html
 *   workflow-initiation-step-2-routing.html
 *   workflow-initiation-step-3-configure.html
 *
 * Accessibility:
 *   - Focus trap inside Dialog.Content (shadcn Dialog handles this)
 *   - Keyboard nav: Tab/Shift-Tab between controls, Esc to close
 *   - All inputs have explicit labels
 *   - Step change announced via aria-live="polite"
 *
 * State management:
 *   - Generic wizard: local useReducer (no global state needed).
 *   - Research wizard (template_id === "external_research_v1"):
 *     WorkflowWizardProvider + useWizardStateContext from useWorkflowWizardState.
 *
 * P4-06: conditional rendering — research branch vs generic branch.
 */

import { useCallback, useReducer, useId } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useWorkflowTemplates } from "@/hooks/useWorkflowTemplates";
import { useCreateWorkflow } from "@/hooks/useCreateWorkflow";
import {
  WorkflowWizardProvider,
  useWizardStateContext,
  type ExternalResearchPackageFields,
} from "@/hooks/useWorkflowWizardState";
import { ResearchPackageBuilder } from "@/components/workflow/research/ResearchPackageBuilder";
import { ResearchRouteSelection } from "@/components/workflow/research/ResearchRouteSelection";
import { PromptPackagePreview } from "@/components/workflow/research/PromptPackagePreview";
import { WizardStepper, type WizardStep } from "./wizard-stepper";
import { Step1Source } from "./step-1-source";
import { Step2Routing } from "./step-2-routing";
import { Step3Configure } from "./step-3-configure";
import { ResearchPackageForm } from "./research-package-form";
import { ResearchRouteCards } from "./research-route-cards";
import { ResearchPackageSummary } from "./research-package-summary";
import type { SourceSelection } from "@/lib/api/workflow-templates";
import type { RouteCard, RoutePreference } from "@/types/workflows/research";

// ---------------------------------------------------------------------------
// Research wizard — internal implementation
// ---------------------------------------------------------------------------

/**
 * Switches between the 3 research-flavoured step panels based on
 * state.current_step from useWizardStateContext().
 *
 * Must be rendered inside <WorkflowWizardProvider>.
 */
function ResearchWizardSwitcher(): React.JSX.Element | null {
  const { state } = useWizardStateContext();
  switch (state.current_step) {
    case 1:
      return <ResearchPackageBuilder />;
    case 2:
      return <ResearchRouteSelection />;
    case 3:
      return <PromptPackagePreview />;
    default:
      return null;
  }
}

/**
 * ResearchInitiationWizard — wizard shell for template_id === "external_research_v1".
 *
 * Owns the WorkflowWizardProvider so that all research step components can
 * read from useWizardStateContext(). Navigation (Back / Next) is driven by
 * state.current_step and the actions from the context hook — the generic
 * wizard's useReducer is NOT used here.
 *
 * initialDraft — when provided, wizard starts at Step 3 pre-populated from
 * a saved draft run (P5-03 draft re-entry).
 */
function ResearchInitiationWizard({
  onClose,
  className,
  initialDraft,
}: {
  onClose: () => void;
  className?: string;
  initialDraft?: {
    fields: ExternalResearchPackageFields;
    draft_run_id: string;
    route_cards: RouteCard[];
    selected_venue: RoutePreference;
  };
}): React.JSX.Element {
  return (
    <WorkflowWizardProvider
      template_id="external_research_v1"
      initialDraft={initialDraft}
    >
      <ResearchInitiationWizardInner onClose={onClose} className={className} />
    </WorkflowWizardProvider>
  );
}

function ResearchInitiationWizardInner({
  onClose,
  className,
}: {
  onClose: () => void;
  className?: string;
}): React.JSX.Element {
  const liveId = useId();
  const router = useRouter();
  const { state, dispatch, actions } = useWizardStateContext();

  const handleBack = useCallback(() => {
    dispatch({ type: "GO_BACK" });
  }, [dispatch]);

  const handleNext = useCallback(async () => {
    if (state.current_step === 1) {
      await actions.submitPackage();
    } else if (state.current_step === 2) {
      dispatch({ type: "ADVANCE_TO_CONFIRM" });
    }
  }, [state.current_step, actions, dispatch]);

  const handleLaunch = useCallback(async () => {
    await actions.handoff();
    if (state.run_response?.run_id) {
      router.push(`/workflows/${state.run_response.run_id}`);
      onClose();
    }
  }, [actions, state.run_response, router, onClose]);

  const isLoading = state.is_fetching_routes || state.is_submitting;

  return (
    <div
      className={cn("flex flex-col", className)}
      data-testid="initiation-wizard"
      data-template="external_research_v1"
    >
      {/* Live region for step announcements */}
      <div id={liveId} aria-live="polite" aria-atomic="true" className="sr-only">
        {`Step ${state.current_step} of 3`}
      </div>

      {/* Stepper */}
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <WizardStepper currentStep={state.current_step as WizardStep} />
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
        <ResearchWizardSwitcher />

        {state.error && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {state.error}
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between border-t border-border px-6 py-4">
        <div className="flex items-center gap-2">
          {state.current_step === 1 ? (
            <WizardButton variant="secondary" onClick={onClose} aria-label="Cancel wizard">
              Cancel
            </WizardButton>
          ) : (
            <WizardButton
              variant="secondary"
              onClick={handleBack}
              disabled={isLoading}
              aria-label="Go to previous step"
            >
              ← Back
            </WizardButton>
          )}
        </div>

        <div className="flex items-center gap-2">
          {state.current_step < 3 ? (
            <WizardButton
              variant="primary"
              onClick={() => void handleNext()}
              disabled={isLoading}
              aria-label="Advance to next step"
            >
              {state.is_fetching_routes ? "Analysing…" : "Next →"}
            </WizardButton>
          ) : (
            <WizardButton
              variant="primary"
              onClick={() => void handleLaunch()}
              disabled={state.is_submitting}
              aria-label="Launch research workflow run"
            >
              {state.is_submitting ? "Launching…" : "Launch Research"}
            </WizardButton>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Research package payload types (P3-01: kind discriminator)
// ---------------------------------------------------------------------------

/**
 * Route card returned by POST /api/workflows/external-research/routing-analysis.
 * Mirrors backend RouteCard schema.
 */
export interface ResearchRouteCard {
  route: string;
  score: number;
  rationale: string;
  prompt_preview: string;
  expected_output: string;
}

/**
 * Research package payload assembled across wizard Steps 1–3.
 * Coexists with sourceSelection — does NOT replace it.
 */
export interface ResearchPackage {
  /** Short topic label (required for submission). */
  topic: string;
  /** Primary research question (required for submission). */
  research_question: string;
  /** Optional background context markdown. */
  background_context: string;
  /** Optional project slugs. */
  project: string[];
  /** Optional domain hint tags. */
  domain: string[];
  /** ULIDs of selected corpus artifacts. */
  selected_artifact_ids: string[];
  /** Desired output type. */
  desired_output: "briefing" | "topic_note" | "blog" | "prd";
  /** Whether to save the prompt package artifact to the vault. */
  save_package: boolean;
  /** Venue preference — "auto" = let analyzer decide. */
  route_preference: string;
  /** Selected venue route from Step 2 analysis. */
  selected_route: ResearchRouteCard | null;
}

const INITIAL_RESEARCH_PACKAGE: ResearchPackage = {
  topic: "",
  research_question: "",
  background_context: "",
  project: [],
  domain: [],
  selected_artifact_ids: [],
  desired_output: "briefing",
  save_package: true,
  route_preference: "auto",
  selected_route: null,
};

// ---------------------------------------------------------------------------
// State + reducer
// ---------------------------------------------------------------------------

/**
 * Discriminator for the current wizard mode.
 * - "generic": standard source-selection → routing-confirmation → configure flow
 * - "research": external_research_v1 flow with ResearchPackage payload
 *
 * Coexists with sourceSelection; no existing fields removed.
 */
type WizardKind = "generic" | "research";

interface WizardState {
  step: WizardStep;
  /** Discriminator added in P3-01. Coexists with sourceSelection. */
  kind: WizardKind;
  sourceSelection: SourceSelection;
  /** Research package payload (populated when kind === "research"). */
  researchPackage: ResearchPackage;
  selectedTemplateId: string | null;
  params: Record<string, string | number | boolean>;
  submitError: string | null;
}

const INITIAL_STATE: WizardState = {
  step: 1,
  kind: "generic",
  sourceSelection: { type: "all_library" },
  researchPackage: INITIAL_RESEARCH_PACKAGE,
  selectedTemplateId: null,
  params: {},
  submitError: null,
};

type WizardAction =
  | { type: "SET_STEP"; step: WizardStep }
  | { type: "SET_SOURCE"; selection: SourceSelection }
  | { type: "SET_TEMPLATE"; templateId: string }
  | { type: "SET_PARAM"; name: string; value: string | number | boolean }
  | { type: "SET_SUBMIT_ERROR"; error: string | null }
  | { type: "SET_RESEARCH_PACKAGE"; patch: Partial<ResearchPackage> }
  | { type: "RESET" };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step, submitError: null };
    case "SET_SOURCE":
      return { ...state, sourceSelection: action.selection };
    case "SET_TEMPLATE": {
      // Detect research template and set kind discriminator.
      const isResearch = action.templateId === "external_research_v1";
      return {
        ...state,
        selectedTemplateId: action.templateId,
        params: {},
        kind: isResearch ? "research" : "generic",
        // Reset research package when switching away from research template.
        researchPackage: isResearch ? state.researchPackage : INITIAL_RESEARCH_PACKAGE,
      };
    }
    case "SET_PARAM":
      return { ...state, params: { ...state.params, [action.name]: action.value } };
    case "SET_SUBMIT_ERROR":
      return { ...state, submitError: action.error };
    case "SET_RESEARCH_PACKAGE":
      return {
        ...state,
        researchPackage: { ...state.researchPackage, ...action.patch },
      };
    case "RESET":
      return { ...INITIAL_STATE };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Validation per step
// ---------------------------------------------------------------------------

function validateStep(state: WizardState): string | null {
  if (state.step === 1) {
    if (state.kind === "research") {
      if (!state.researchPackage.topic.trim()) return "Topic is required.";
      if (!state.researchPackage.research_question.trim()) return "Research question is required.";
      return null;
    }
    if (!state.sourceSelection.type) return "Please select a source scope.";
    return null;
  }
  if (state.step === 2) {
    if (state.kind === "research") {
      if (!state.researchPackage.selected_route) return "Please select a venue route.";
      return null;
    }
    if (!state.selectedTemplateId) return "Please select a workflow template.";
    return null;
  }
  // Step 3: required params
  return null;
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

interface WizardButtonProps {
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  variant?: "primary" | "secondary";
  children: React.ReactNode;
  "aria-label"?: string;
}

function WizardButton({
  onClick,
  type = "button",
  disabled,
  variant = "secondary",
  children,
  "aria-label": ariaLabel,
}: WizardButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex min-h-[38px] items-center justify-center gap-2 rounded-md px-5 text-sm font-semibold",
        "transition-colors duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "bg-foreground text-background hover:bg-foreground/90",
        variant === "secondary" &&
          "border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------

export interface InitiationWizardProps {
  /**
   * Optional artifact ID — if provided, Step 2 will render the
   * RoutingRecommendationCard pre-scoped to this artifact.
   */
  artifactId?: string;
  /**
   * Optional initial template ID — pre-selects a template and advances to
   * the appropriate step. Used by "New Research Run" CTA (P3-05) to open
   * the wizard with external_research_v1 pre-selected.
   */
  initialTemplateId?: string;
  /** Called when the wizard should close (no submission). */
  onClose: () => void;
  className?: string;
  /**
   * Workflow template ID. When set to "external_research_v1" the research-
   * flavoured 3-step wizard is rendered; all other values (or undefined) fall
   * through to the generic wizard.
   *
   * P4-06: conditional rendering branch.
   */
  template_id?: string;
  /**
   * When provided, the research wizard opens at Step 3 pre-populated from a
   * saved draft run. Only applies when template_id === "external_research_v1".
   *
   * P5-03: draft run re-entry.
   */
  initialDraft?: {
    fields: ExternalResearchPackageFields;
    draft_run_id: string;
    route_cards: RouteCard[];
    selected_venue: RoutePreference;
  };
}

export function InitiationWizard({
  artifactId,
  initialTemplateId,
  onClose,
  className,
  template_id,
  initialDraft,
}: InitiationWizardProps) {
  // Research branch — completely separate state machine and step panels.
  if (template_id === "external_research_v1") {
    return (
      <ResearchInitiationWizard
        onClose={onClose}
        className={className}
        initialDraft={initialDraft}
      />
    );
  }

  // Generic branch — continues below unchanged.
  return (
    <GenericInitiationWizard
      artifactId={artifactId}
      initialTemplateId={initialTemplateId}
      onClose={onClose}
      className={className}
    />
  );
}

// ---------------------------------------------------------------------------
// Generic wizard — original implementation, extracted to keep it unmodified
// ---------------------------------------------------------------------------

function GenericInitiationWizard({
  artifactId,
  initialTemplateId,
  onClose,
  className,
}: {
  artifactId?: string;
  initialTemplateId?: string;
  onClose: () => void;
  className?: string;
}) {
  const router = useRouter();
  const liveId = useId();

  const initialState: WizardState = initialTemplateId
    ? {
        ...INITIAL_STATE,
        selectedTemplateId: initialTemplateId,
        kind: initialTemplateId === "external_research_v1" ? "research" : "generic",
      }
    : INITIAL_STATE;

  const [state, dispatch] = useReducer(wizardReducer, initialState);

  const { templates, isLoading: isLoadingTemplates, error: templatesError } = useWorkflowTemplates();
  const { mutateAsync: createWorkflow, isPending: isSubmitting } = useCreateWorkflow();

  const isResearchTemplate = state.kind === "research";

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleNext = useCallback(() => {
    const err = validateStep(state);
    if (err) {
      dispatch({ type: "SET_SUBMIT_ERROR", error: err });
      return;
    }
    if (state.step < 3) {
      dispatch({ type: "SET_STEP", step: (state.step + 1) as WizardStep });
    }
  }, [state]);

  const handleBack = useCallback(() => {
    if (state.step > 1) {
      dispatch({ type: "SET_STEP", step: (state.step - 1) as WizardStep });
    }
  }, [state.step]);

  const handleSubmit = useCallback(async () => {
    if (!state.selectedTemplateId) {
      dispatch({ type: "SET_SUBMIT_ERROR", error: "No template selected." });
      return;
    }

    try {
      const result = await createWorkflow({
        template_id: state.selectedTemplateId,
        params: state.params,
        source_selection: state.sourceSelection,
      });
      // Navigate to the new run in Workflow Status Surface.
      router.push(`/workflows/${result.run_id}`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start workflow.";
      dispatch({ type: "SET_SUBMIT_ERROR", error: msg });
    }
  }, [state.selectedTemplateId, state.params, state.sourceSelection, createWorkflow, router, onClose]);

  const selectedTemplate = templates.find((t) => t.id === state.selectedTemplateId) ?? null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className={cn("flex flex-col", className)}
      data-testid="initiation-wizard"
    >
      {/* Live region for step announcements */}
      <div
        id={liveId}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {`Step ${state.step} of 3`}
      </div>

      {/* Stepper */}
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <WizardStepper currentStep={state.step} />
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
        {state.step === 1 && (
          isResearchTemplate ? (
            <ResearchPackageForm
              value={state.researchPackage}
              onChange={(patch) => dispatch({ type: "SET_RESEARCH_PACKAGE", patch })}
            />
          ) : (
            <Step1Source
              value={state.sourceSelection}
              onChange={(sel) => dispatch({ type: "SET_SOURCE", selection: sel })}
            />
          )
        )}

        {state.step === 2 && (
          isResearchTemplate ? (
            <ResearchRouteCards
              researchPackage={state.researchPackage}
              onSelectRoute={(card) =>
                dispatch({ type: "SET_RESEARCH_PACKAGE", patch: { selected_route: card } })
              }
              submitError={state.submitError}
            />
          ) : (
            <Step2Routing
              artifactId={artifactId}
              templates={templates}
              selectedTemplateId={state.selectedTemplateId}
              onSelectTemplate={(id) => dispatch({ type: "SET_TEMPLATE", templateId: id })}
              isLoadingTemplates={isLoadingTemplates}
              templatesError={templatesError}
            />
          )
        )}

        {state.step === 3 && (
          isResearchTemplate ? (
            <ResearchPackageSummary
              researchPackage={state.researchPackage}
              onPackageChange={(patch) => dispatch({ type: "SET_RESEARCH_PACKAGE", patch })}
              onClose={onClose}
              submitError={state.submitError}
              onSubmitError={(err) => dispatch({ type: "SET_SUBMIT_ERROR", error: err })}
            />
          ) : (
            selectedTemplate && (
              <Step3Configure
                template={selectedTemplate}
                sourceSelection={state.sourceSelection}
                params={state.params}
                onChange={(name, value) => dispatch({ type: "SET_PARAM", name, value })}
                submitError={state.submitError}
              />
            )
          )
        )}

        {/* Validation / step error (shown in steps 1 & 2) */}
        {state.submitError && state.step !== 3 && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {state.submitError}
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between border-t border-border px-6 py-4">
        {/* Left: Cancel / Back */}
        <div className="flex items-center gap-2">
          {state.step === 1 ? (
            <WizardButton variant="secondary" onClick={onClose} aria-label="Cancel wizard">
              Cancel
            </WizardButton>
          ) : (
            <WizardButton variant="secondary" onClick={handleBack} aria-label="Go to previous step">
              ← Back
            </WizardButton>
          )}
        </div>

        {/* Right: Next / Launch */}
        <div className="flex items-center gap-2">
          {state.step < 3 ? (
            <WizardButton
              variant="primary"
              onClick={handleNext}
              aria-label="Advance to next step"
            >
              Next →
            </WizardButton>
          ) : (
            /* Research template: Step 3 (ResearchPackageSummary) owns its own submit CTA.
               Generic template: wizard footer renders the Launch button. */
            !isResearchTemplate && (
              <WizardButton
                variant="primary"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
                aria-label="Launch workflow run"
              >
                {isSubmitting ? "Launching…" : "Launch Workflow"}
              </WizardButton>
            )
          )}
        </div>
      </div>
    </div>
  );
}
