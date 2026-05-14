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
} from "@/hooks/useWorkflowWizardState";
import { ResearchPackageBuilder } from "@/components/workflow/research/ResearchPackageBuilder";
import { ResearchRouteSelection } from "@/components/workflow/research/ResearchRouteSelection";
import { PromptPackagePreview } from "@/components/workflow/research/PromptPackagePreview";
import { WizardStepper, type WizardStep } from "./wizard-stepper";
import { Step1Source } from "./step-1-source";
import { Step2Routing } from "./step-2-routing";
import { Step3Configure } from "./step-3-configure";
import type { SourceSelection } from "@/lib/api/workflow-templates";

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
 */
function ResearchInitiationWizard({
  onClose,
  className,
}: {
  onClose: () => void;
  className?: string;
}): React.JSX.Element {
  return (
    <WorkflowWizardProvider template_id="external_research_v1">
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
// State + reducer
// ---------------------------------------------------------------------------

interface WizardState {
  step: WizardStep;
  sourceSelection: SourceSelection;
  selectedTemplateId: string | null;
  params: Record<string, string | number | boolean>;
  submitError: string | null;
}

const INITIAL_STATE: WizardState = {
  step: 1,
  sourceSelection: { type: "all_library" },
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
  | { type: "RESET" };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step, submitError: null };
    case "SET_SOURCE":
      return { ...state, sourceSelection: action.selection };
    case "SET_TEMPLATE":
      // Clear params when template changes.
      return { ...state, selectedTemplateId: action.templateId, params: {} };
    case "SET_PARAM":
      return { ...state, params: { ...state.params, [action.name]: action.value } };
    case "SET_SUBMIT_ERROR":
      return { ...state, submitError: action.error };
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
    if (!state.sourceSelection.type) return "Please select a source scope.";
    return null;
  }
  if (state.step === 2) {
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
}

export function InitiationWizard({
  artifactId,
  onClose,
  className,
  template_id,
}: InitiationWizardProps) {
  // Research branch — completely separate state machine and step panels.
  if (template_id === "external_research_v1") {
    return <ResearchInitiationWizard onClose={onClose} className={className} />;
  }

  // Generic branch — continues below unchanged.
  return (
    <GenericInitiationWizard
      artifactId={artifactId}
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
  onClose,
  className,
}: {
  artifactId?: string;
  onClose: () => void;
  className?: string;
}) {
  const router = useRouter();
  const liveId = useId();

  const [state, dispatch] = useReducer(wizardReducer, INITIAL_STATE);

  const { templates, isLoading: isLoadingTemplates, error: templatesError } = useWorkflowTemplates();
  const { mutateAsync: createWorkflow, isPending: isSubmitting } = useCreateWorkflow();

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
          <Step1Source
            value={state.sourceSelection}
            onChange={(sel) => dispatch({ type: "SET_SOURCE", selection: sel })}
          />
        )}

        {state.step === 2 && (
          <Step2Routing
            artifactId={artifactId}
            templates={templates}
            selectedTemplateId={state.selectedTemplateId}
            onSelectTemplate={(id) => dispatch({ type: "SET_TEMPLATE", templateId: id })}
            isLoadingTemplates={isLoadingTemplates}
            templatesError={templatesError}
          />
        )}

        {state.step === 3 && selectedTemplate && (
          <Step3Configure
            template={selectedTemplate}
            sourceSelection={state.sourceSelection}
            params={state.params}
            onChange={(name, value) => dispatch({ type: "SET_PARAM", name, value })}
            submitError={state.submitError}
          />
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
            <WizardButton
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
              aria-label="Launch workflow run"
            >
              {isSubmitting ? "Launching…" : "Launch Workflow"}
            </WizardButton>
          )}
        </div>
      </div>
    </div>
  );
}
