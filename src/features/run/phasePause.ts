import type { ProtocolPhase, Step } from '../../types';

export interface PhaseEnd {
  phase: ProtocolPhase;
  /** 1-based position of the phase in the protocol, shown as "Day N". */
  day: number;
}

/** 1-based day number for a phase id, or undefined when the phase is not in the list. */
export function dayNumber(phases: ProtocolPhase[] | undefined, phaseId: string | undefined): number | undefined {
  if (!phaseId || !phases) return undefined;
  const at = phases.findIndex((p) => p.id === phaseId);
  return at === -1 ? undefined : at + 1;
}

/**
 * Returns the phase that ends with the step at `index`, when that step is the last one of its phase
 * and more steps follow. The final step of the whole protocol is not a pause point.
 */
export function phaseEndedAt(
  steps: Step[],
  phases: ProtocolPhase[] | undefined,
  index: number,
): PhaseEnd | undefined {
  const step = steps[index];
  const next = steps[index + 1];
  if (!step?.phaseId || !next) return undefined;
  if (next.phaseId === step.phaseId) return undefined;
  const phase = phases?.find((p) => p.id === step.phaseId);
  const day = dayNumber(phases, step.phaseId);
  if (!phase || day === undefined) return undefined;
  return { phase, day };
}

/** "18h 20m", "45m" or "30s". Used for the gap note when a paused run resumes. */
export function formatGap(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  if (totalMin < 1) return `${Math.max(0, Math.round(ms / 1000))}s`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
