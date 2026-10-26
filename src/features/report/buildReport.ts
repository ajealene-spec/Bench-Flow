import type {
  Experiment,
  ExperimentStatus,
  Hazard,
  HazardKind,
  Procedure,
  ProtocolTemplate,
  Reagent,
  RunState,
  Step,
  StepRecord,
} from '../../types';
import { formatElapsed } from '../data/time';

/** A timer whose actual elapsed time differs from the planned time by more than this fraction is a deviation. */
export const TIMER_DEVIATION_THRESHOLD = 0.1;

/** A calculator result saved to the run. Calculators supply these; the report only displays them. */
export interface CalculatorResult {
  stepId: string;
  label: string;
  value: number;
  unit?: string;
  note?: string;
}

export interface BuildReportInput {
  experiment: Experiment;
  /** The run's procedure snapshot. Its steps define the report order. */
  procedure?: Procedure;
  /** The template the run came from, if it still exists. Supplies the category and hazards. */
  template?: Pick<ProtocolTemplate, 'title' | 'category' | 'hazards'> | null;
  runState?: RunState;
  /** Every step record for the experiment. Records for steps no longer in the procedure are not shown per step. */
  records?: StepRecord[];
  calculatorResults?: CalculatorResult[];
  /** Timestamp to stamp on the report. Passed in so the builder stays pure. */
  generatedAt?: number;
}

export interface ReportNumber {
  label: string;
  value?: number;
  unit?: string;
  note?: string;
  recordedAt?: number;
}

export interface ReportTimer {
  label: string;
  plannedSec?: number;
  /** Elapsed time from first start to stop, pauses included. Undefined when the timer never ran. */
  actualSec?: number;
  startedAt?: number;
  stoppedAt?: number;
}

export interface ReportStep {
  /** 1-based position in the procedure. */
  number: number;
  stepId: string;
  title: string;
  instructions: string;
  cautions: string[];
  completed: boolean;
  numbers: ReportNumber[];
  timers: ReportTimer[];
  calculations: CalculatorResult[];
}

export type DeviationKind = 'not_completed' | 'skipped' | 'timer_variance';

export interface Deviation {
  kind: DeviationKind;
  /** Step the deviation belongs to, when it is about a step. */
  stepNumber?: number;
  message: string;
}

export interface ReportReagent {
  name: string;
  amount?: string;
  unit?: string;
  /** Step numbers that use this reagent, in procedure order, without repeats. */
  stepNumbers: number[];
}

export interface ReportHazard {
  name: string;
  kind: HazardKind;
  reason: string;
  ppe: string[];
}

export interface ReportSafetyItem {
  label: string;
  checked: boolean;
}

export interface Report {
  experimentId: string;
  title: string;
  protocol: { title: string; category?: string };
  status: ExperimentStatus;
  dates: {
    startedAt?: number;
    endedAt?: number;
    /** endedAt minus startedAt, in seconds. Undefined until both are known. */
    durationSec?: number;
  };
  safety: {
    confirmedAt?: number;
    items: ReportSafetyItem[];
    hazards: ReportHazard[];
  };
  steps: ReportStep[];
  notes: string;
  deviations: Deviation[];
  reagents: ReportReagent[];
  recordCount: number;
  generatedAt?: number;
}

/** Builds the report model from stored data. Pure: no database or clock access. */
export function buildReport(input: BuildReportInput): Report {
  const { experiment, procedure, template, runState, generatedAt } = input;
  const records = input.records ?? [];
  const calculatorResults = input.calculatorResults ?? [];
  const completed = new Set(runState?.completedStepIds ?? []);
  const steps = procedure?.steps ?? [];

  const reportSteps = steps.map((step, index) =>
    buildStep(step, index, records, calculatorResults, completed.has(step.id)),
  );

  return {
    experimentId: experiment.id,
    title: experiment.name,
    protocol: {
      title: procedure?.title ?? template?.title ?? 'Unknown protocol',
      category: template?.category,
    },
    status: experiment.status,
    dates: buildDates(experiment),
    safety: {
      confirmedAt: experiment.safetyConfirmedAt,
      items: (experiment.safetyChecklist ?? []).map((item) => ({ label: item.label, checked: item.checked })),
      hazards: (template?.hazards ?? []).map(toReportHazard),
    },
    steps: reportSteps,
    notes: experiment.notes?.trim() ?? '',
    deviations: buildDeviations(reportSteps),
    reagents: collectReagents(steps),
    recordCount: records.length,
    generatedAt,
  };
}

function buildDates(experiment: Experiment): Report['dates'] {
  const { startedAt, endedAt } = experiment;
  const dates: Report['dates'] = { startedAt, endedAt };
  if (startedAt !== undefined && endedAt !== undefined) {
    dates.durationSec = Math.max(0, endedAt - startedAt) / 1000;
  }
  return dates;
}

function toReportHazard(hazard: Hazard): ReportHazard {
  return { name: hazard.name, kind: hazard.kind, reason: hazard.reason, ppe: [...hazard.ppe] };
}

function buildStep(
  step: Step,
  index: number,
  records: StepRecord[],
  calculatorResults: CalculatorResult[],
  completed: boolean,
): ReportStep {
  const stepRecords = records
    .filter((r) => r.stepId === step.id)
    .sort((a, b) => a.createdAt - b.createdAt);

  const numbers: ReportNumber[] = stepRecords
    .filter((r) => r.kind === 'number')
    .map((r) => ({ label: r.label, value: r.value, unit: r.unit, note: r.note, recordedAt: r.createdAt }));

  const runs = stepRecords.filter((r) => r.kind === 'timer');
  const timers: ReportTimer[] = runs.map((r) => ({
    label: r.label,
    plannedSec: plannedSecFor(step, r.label),
    actualSec: r.elapsedSec,
    startedAt: r.startedAt,
    stoppedAt: r.stoppedAt,
  }));
  // Planned timers that never ran still appear, so the report shows what was skipped.
  for (const timer of step.timers) {
    if (!runs.some((r) => r.label === timer.label)) {
      timers.push({ label: timer.label, plannedSec: timer.durationSec });
    }
  }

  return {
    number: index + 1,
    stepId: step.id,
    title: step.title,
    instructions: step.instructions,
    cautions: [...step.cautions],
    completed,
    numbers,
    timers,
    calculations: calculatorResults.filter((c) => c.stepId === step.id),
  };
}

function plannedSecFor(step: Step, label: string): number | undefined {
  return step.timers.find((t) => t.label === label)?.durationSec;
}

function buildDeviations(steps: ReportStep[]): Deviation[] {
  const deviations: Deviation[] = [];
  const lastCompletedIndex = steps.reduce((last, s, i) => (s.completed ? i : last), -1);

  steps.forEach((step, index) => {
    if (!step.completed) {
      const skipped = index < lastCompletedIndex;
      deviations.push({
        kind: skipped ? 'skipped' : 'not_completed',
        stepNumber: step.number,
        message: skipped
          ? `Step ${step.number} (${step.title}) was skipped`
          : `Step ${step.number} (${step.title}) was not completed`,
      });
    }

    for (const timer of step.timers) {
      if (timer.plannedSec === undefined || timer.plannedSec <= 0 || timer.actualSec === undefined) continue;
      const variance = (timer.actualSec - timer.plannedSec) / timer.plannedSec;
      if (Math.abs(variance) > TIMER_DEVIATION_THRESHOLD) {
        const percent = Math.round(variance * 100);
        const sign = percent > 0 ? '+' : '';
        deviations.push({
          kind: 'timer_variance',
          stepNumber: step.number,
          message: `Timer "${timer.label}" in step ${step.number} ran ${formatElapsed(timer.actualSec)}, planned ${formatElapsed(timer.plannedSec)} (${sign}${percent}%)`,
        });
      }
    }
  });
  return deviations;
}

/** Reagents from every step, merged by name (case-insensitive), in order of first use. */
function collectReagents(steps: Step[]): ReportReagent[] {
  const byName = new Map<string, ReportReagent>();
  steps.forEach((step, index) => {
    const stepNumber = index + 1;
    for (const reagent of step.reagents as Reagent[]) {
      const name = reagent.name.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      let entry = byName.get(key);
      if (!entry) {
        entry = { name, amount: reagent.amount, unit: reagent.unit, stepNumbers: [] };
        byName.set(key, entry);
      }
      if (!entry.stepNumbers.includes(stepNumber)) entry.stepNumbers.push(stepNumber);
    }
  });
  return [...byName.values()];
}
