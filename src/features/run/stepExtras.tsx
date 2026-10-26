import type { Step } from '../../types';
import { StepCalculators } from '../assist/StepCalculators';

interface StepExtrasProps {
  step: Step;
  experimentId: string;
}

/**
 * Mount point for per-step tools (calculators and the like). Render order: below the step
 * content, above the data panel. Add new tools here instead of editing RunPage.
 */
export function StepExtras({ step, experimentId }: StepExtrasProps) {
  return <StepCalculators step={step} experimentId={experimentId} />;
}
