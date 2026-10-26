/*
 * Reproducibility score: how completely a run was documented. This measures documentation
 * completeness, NOT experimental quality. Pure: no database or clock access.
 */
import type { Animal, ExecutionEvent, InventoryItem, SafetyChecklistItem } from '../../types';
import { TIMER_TOLERANCE } from '../run/deviation';

export interface ReproducibilityStep {
  id: string;
  title: string;
  instructions?: string;
}

export interface ReproducibilityInput {
  /** The run's procedure snapshot, in protocol order. */
  steps: ReproducibilityStep[];
  /** The execution log for the run, oldest first. */
  events: ExecutionEvent[];
  /** Inventory items linked to the run (reagent usage), resolved. */
  reagents: Array<Pick<InventoryItem, 'id' | 'kind' | 'name' | 'lotNumber' | 'rrid'>>;
  /** Animals listed on the run. */
  animals: Array<Pick<Animal, 'id' | 'rrid'>>;
  safetyChecklist?: SafetyChecklistItem[];
}

export type ReproducibilityComponentId =
  | 'stepsInOrder'
  | 'timerAdherence'
  | 'deviationsDocumented'
  | 'reagentLots'
  | 'rrids'
  | 'safety'
  | 'methods';

export interface ReproducibilityComponent {
  id: ReproducibilityComponentId;
  label: string;
  weight: number;
  /** 0 to 1. Null when the run has nothing this component can measure; its weight is then left out. */
  fraction: number | null;
  detail: string;
}

export interface ReproducibilityScore {
  /** 0 to 100, rounded. Null when no component applies to the run. */
  score: number | null;
  components: ReproducibilityComponent[];
}

/** Weights sum to 100. Each applicable component contributes weight × fraction, scaled to the applicable weight. */
export const REPRODUCIBILITY_WEIGHTS: Record<ReproducibilityComponentId, number> = {
  stepsInOrder: 20,
  timerAdherence: 15,
  deviationsDocumented: 15,
  reagentLots: 15,
  rrids: 10,
  safety: 15,
  methods: 10,
};

export function scoreReproducibility(input: ReproducibilityInput): ReproducibilityScore {
  const components: ReproducibilityComponent[] = [
    stepsInOrder(input),
    timerAdherence(input.events),
    deviationsDocumented(input.events),
    reagentLots(input.reagents),
    rrids(input.reagents, input.animals),
    safety(input.safetyChecklist),
    methods(input.steps),
  ];
  const applicable = components.filter((c) => c.fraction !== null);
  const totalWeight = applicable.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return { score: null, components };
  const earned = applicable.reduce((sum, c) => sum + c.weight * (c.fraction as number), 0);
  return { score: Math.round((earned / totalWeight) * 100), components };
}

function stepsInOrder(input: ReproducibilityInput): ReproducibilityComponent {
  const weight = REPRODUCIBILITY_WEIGHTS.stepsInOrder;
  const label = 'Steps completed in order';
  const total = input.steps.length;
  if (total === 0) return { id: 'stepsInOrder', label, weight, fraction: null, detail: 'No protocol steps on this run.' };
  const completed = new Set(input.events.filter((e) => e.type === 'step_complete' && e.stepId).map((e) => e.stepId));
  const reordered = new Set(input.events.filter((e) => e.type === 'step_reorder' && e.stepId).map((e) => e.stepId));
  let inOrder = 0;
  for (const step of input.steps) {
    if (completed.has(step.id) && !reordered.has(step.id)) inOrder += 1;
  }
  return {
    id: 'stepsInOrder',
    label,
    weight,
    fraction: inOrder / total,
    detail: `${inOrder} of ${total} steps completed in protocol order. Steps finished out of order or never completed do not count.`,
  };
}

function timerAdherence(events: ExecutionEvent[]): ReproducibilityComponent {
  const weight = REPRODUCIBILITY_WEIGHTS.timerAdherence;
  const label = 'Timer adherence (within 10%)';
  const timed = events.filter(
    (e) => e.type === 'timer_stop' && typeof e.planned === 'number' && e.planned > 0 && typeof e.actual === 'number',
  );
  if (timed.length === 0) return { id: 'timerAdherence', label, weight, fraction: null, detail: 'No timers were run.' };
  const within = timed.filter((e) => {
    const planned = e.planned as number;
    return Math.abs((e.actual as number) - planned) / planned <= TIMER_TOLERANCE;
  }).length;
  return {
    id: 'timerAdherence',
    label,
    weight,
    fraction: within / timed.length,
    detail: `${within} of ${timed.length} timers stopped within ${Math.round(TIMER_TOLERANCE * 100)}% of the planned time.`,
  };
}

function deviationsDocumented(events: ExecutionEvent[]): ReproducibilityComponent {
  const weight = REPRODUCIBILITY_WEIGHTS.deviationsDocumented;
  const label = 'Deviations documented';
  const deviations = events.filter((e) => e.deviation);
  if (events.length === 0) {
    return { id: 'deviationsDocumented', label, weight, fraction: null, detail: 'No execution events were logged for this run.' };
  }
  if (deviations.length === 0) {
    return { id: 'deviationsDocumented', label, weight, fraction: 1, detail: 'No deviations recorded, so nothing needed a note.' };
  }
  // A note on the same step at or after the deviation documents it.
  const notes = events.filter((e) => e.type === 'note' && e.stepId && e.note && e.note.trim() !== '');
  let documented = 0;
  for (const d of deviations) {
    const explained =
      d.deviation?.kind === 'note' ||
      notes.some((n) => n.stepId === d.stepId && n.at >= d.at);
    if (explained) documented += 1;
  }
  return {
    id: 'deviationsDocumented',
    label,
    weight,
    fraction: documented / deviations.length,
    detail: `${documented} of ${deviations.length} deviations have a note. Undocumented deviations count against the score.`,
  };
}

function reagentLots(reagents: ReproducibilityInput['reagents']): ReproducibilityComponent {
  const weight = REPRODUCIBILITY_WEIGHTS.reagentLots;
  const label = 'Reagent lots recorded';
  if (reagents.length === 0) return { id: 'reagentLots', label, weight, fraction: null, detail: 'No inventory items were linked to this run.' };
  const withLot = reagents.filter((r) => (r.lotNumber ?? '').trim() !== '').length;
  return {
    id: 'reagentLots',
    label,
    weight,
    fraction: withLot / reagents.length,
    detail: `${withLot} of ${reagents.length} linked reagents have a lot number.`,
  };
}

function rrids(reagents: ReproducibilityInput['reagents'], animals: ReproducibilityInput['animals']): ReproducibilityComponent {
  const weight = REPRODUCIBILITY_WEIGHTS.rrids;
  const label = 'RRIDs for antibodies and animals';
  const antibodies = reagents.filter((r) => r.kind === 'antibody');
  const total = antibodies.length + animals.length;
  if (total === 0) return { id: 'rrids', label, weight, fraction: null, detail: 'No antibodies or animals were linked to this run.' };
  const hasRrid = (rrid: string | undefined) => (rrid ?? '').trim() !== '';
  const withRrid = antibodies.filter((a) => hasRrid(a.rrid)).length + animals.filter((a) => hasRrid(a.rrid)).length;
  return {
    id: 'rrids',
    label,
    weight,
    fraction: withRrid / total,
    detail: `${withRrid} of ${total} antibodies and animals have an RRID.`,
  };
}

function safety(checklist: SafetyChecklistItem[] | undefined): ReproducibilityComponent {
  const weight = REPRODUCIBILITY_WEIGHTS.safety;
  const label = 'Safety checklist confirmed';
  if (!checklist || checklist.length === 0) {
    return { id: 'safety', label, weight, fraction: null, detail: 'This run has no safety checklist.' };
  }
  const checked = checklist.filter((c) => c.checked).length;
  return {
    id: 'safety',
    label,
    weight,
    fraction: checked / checklist.length,
    detail: `${checked} of ${checklist.length} safety checklist items confirmed.`,
  };
}

function methods(steps: ReproducibilityStep[]): ReproducibilityComponent {
  const weight = REPRODUCIBILITY_WEIGHTS.methods;
  const label = 'Methods exportable';
  if (steps.length === 0) {
    return { id: 'methods', label, weight, fraction: null, detail: 'No protocol steps are stored for this run.' };
  }
  const complete = steps.filter((s) => s.title.trim() !== '' && (s.instructions ?? '').trim() !== '').length;
  return {
    id: 'methods',
    label,
    weight,
    fraction: complete / steps.length,
    detail: `${complete} of ${steps.length} steps have a title and instructions for the methods text.`,
  };
}
