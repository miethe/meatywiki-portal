/**
 * Barrel export for the Initiation Wizard module.
 *
 * Primary consumers:
 *   - Workflow Status Surface "New workflow" button
 *   - Artifact Detail context menu (optional artifact ID for routing recommendation)
 *
 * Traces FR-1.5-06 / P1.5-2-03.
 */

export { InitiationWizardDialog } from "./initiation-wizard-dialog";
export { InitiationWizard } from "./initiation-wizard";
export type { InitiationWizardProps } from "./initiation-wizard";
export type { InitiationWizardDialogProps } from "./initiation-wizard-dialog";
