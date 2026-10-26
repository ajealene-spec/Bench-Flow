import type { ExecutionEvent, Experiment, RunValue, Step } from '../../types';

/** A reagent lot used in a run. stepId is '' for run-level use. */
export interface ReagentLot {
  stepId: string;
  name: string;
  lotNumber?: string;
  vendor?: string;
  catalogNumber?: string;
}

export interface LogTimerRun {
  label: string;
  plannedSec?: number;
  actualSec?: number;
  startedAt?: number;
  stoppedAt?: number;
}

export interface LogValue {
  varId: string;
  token: string;
  unit: string;
  planned: number;
  used: number;
  overridden: boolean;
}

export interface LogNote {
  at: number;
  text: string;
  deviation: boolean;
}

export interface LogStep {
  stepId: string;
  /** 1-based position in the procedure. */
  number: number;
  title: string;
  startedAt?: number;
  endedAt?: number;
  completed: boolean;
  skipped: boolean;
  reordered: boolean;
  timers: LogTimerRun[];
  values: LogValue[];
  notes: LogNote[];
  reagentLots: ReagentLot[];
}

export interface LogTimelineEntry {
  at: number;
  type: ExecutionEvent['type'];
  stepNumber?: number;
  text: string;
}

export interface LogPause {
  phaseId?: string;
  pausedAt?: number;
  resumedAt: number;
  gapMs: number;
}

export type LogDeviationKind = 'timer' | 'value' | 'skip' | 'order' | 'note';

export interface LogDeviation {
  kind: LogDeviationKind;
  stepNumber?: number;
  at?: number;
  message: string;
}

export interface ExecutionLog {
  experimentId: string;
  steps: LogStep[];
  timeline: LogTimelineEntry[];
  pauses: LogPause[];
  deviations: LogDeviation[];
  /** Past-tense Methods paragraph built from the log. */
  methodsText: string;
}

/**
 * Builds what actually happened in a run from the append-only event log. Pure: no database or clock.
 * Steps come out in procedure order; events are sorted by time (ties keep their log order).
 */
export function buildExecutionLog(
  experiment: Pick<Experiment, 'id'>,
  steps: Step[],
  events: ExecutionEvent[],
  runValues: RunValue[] = [],
  reagentLots: ReagentLot[] = [],
): ExecutionLog {
  const sorted = events.map((e, i) => ({ e, i })).sort((a, b) => a.e.at - b.e.at || a.i - b.i).map((x) => x.e);
  const numberOf = new Map(steps.map((s, i) => [s.id, i + 1]));
  const stepNumber = (stepId?: string) => (stepId === undefined ? undefined : numberOf.get(stepId));

  const logSteps: LogStep[] = steps.map((step, index) => ({
    stepId: step.id,
    number: index + 1,
    title: step.title,
    completed: false,
    skipped: false,
    reordered: false,
    timers: [],
    values: [],
    notes: [],
    reagentLots: reagentLots.filter((lot) => lot.stepId === step.id),
  }));
  const byId = new Map(logSteps.map((s) => [s.stepId, s]));

  const deviations: LogDeviation[] = [];
  const timeline: LogTimelineEntry[] = [];
  const pauses: LogPause[] = [];
  const timerStarts = new Map<string, number>();
  const pendingPause = new Map<string, number>();

  for (const ev of sorted) {
    const step = ev.stepId !== undefined ? byId.get(ev.stepId) : undefined;
    const n = stepNumber(ev.stepId);
    const label = n !== undefined ? `step ${n}` : 'a step';
    timeline.push({ at: ev.at, type: ev.type, stepNumber: n, text: '' });
    const entry = timeline[timeline.length - 1];

    switch (ev.type) {
      case 'step_start':
        if (step && step.startedAt === undefined) step.startedAt = ev.at;
        entry.text = `Started ${label}${step ? ` "${step.title}"` : ''}`;
        break;
      case 'step_complete':
        if (step && step.endedAt === undefined) {
          step.endedAt = ev.at;
          step.completed = true;
        }
        entry.text = `Completed ${label}`;
        break;
      case 'step_skip':
        if (step) step.skipped = true;
        entry.text = `Skipped ${label}`;
        deviations.push({ kind: 'skip', stepNumber: n, at: ev.at, message: `Step ${n} was skipped` });
        break;
      case 'step_reorder':
        if (step) step.reordered = true;
        entry.text = `${capitalize(label)} completed out of order`;
        deviations.push({ kind: 'order', stepNumber: n, at: ev.at, message: `Step ${n} was completed out of order` });
        break;
      case 'timer_start': {
        const key = `${ev.stepId}|${ev.note ?? ''}`;
        timerStarts.set(key, ev.at);
        entry.text = `Timer "${ev.note ?? 'timer'}" started in ${label}`;
        break;
      }
      case 'timer_stop': {
        const key = `${ev.stepId}|${ev.note ?? ''}`;
        const startedAt = timerStarts.get(key);
        timerStarts.delete(key);
        const actualSec = typeof ev.actual === 'number' ? ev.actual : undefined;
        const plannedSec = typeof ev.planned === 'number' ? ev.planned : undefined;
        step?.timers.push({ label: ev.note ?? 'timer', plannedSec, actualSec, startedAt, stoppedAt: ev.at });
        entry.text = `Timer "${ev.note ?? 'timer'}" stopped in ${label}: ran ${durationText(actualSec)}`;
        if (ev.deviation) {
          deviations.push({
            kind: 'timer',
            stepNumber: n,
            at: ev.at,
            message: `Timer "${ev.note ?? 'timer'}" in step ${n} ran ${durationText(actualSec)}, planned ${durationText(plannedSec)}`,
          });
        }
        break;
      }
      case 'value_change':
        entry.text = `${ev.note ?? 'value'} set to ${ev.actual ?? '—'}${ev.unit ? ` ${ev.unit}` : ''} in ${label}`;
        break;
      case 'note':
        if (step) step.notes.push({ at: ev.at, text: ev.note ?? '', deviation: Boolean(ev.deviation) });
        entry.text = `Note on ${label}: ${ev.note ?? ''}`;
        if (ev.deviation) deviations.push({ kind: 'note', stepNumber: n, at: ev.at, message: `Note in step ${n}: ${ev.note ?? ''}` });
        break;
      case 'phase_pause':
        if (ev.phaseId !== undefined) pendingPause.set(ev.phaseId, ev.at);
        entry.text = `Paused${ev.note ? `: ${ev.note}` : ''}`;
        break;
      case 'phase_resume': {
        const pausedAt = ev.phaseId !== undefined ? pendingPause.get(ev.phaseId) : undefined;
        if (ev.phaseId !== undefined) pendingPause.delete(ev.phaseId);
        const gapMs = ev.unit === 'ms' && typeof ev.actual === 'number' ? ev.actual : pausedAt !== undefined ? ev.at - pausedAt : 0;
        pauses.push({ phaseId: ev.phaseId, pausedAt, resumedAt: ev.at, gapMs });
        entry.text = `Resumed after ${durationText(gapMs / 1000)} gap`;
        break;
      }
    }
  }

  // Values: the run's own values, compared with the planned value of each step variable.
  for (const step of steps) {
    const logStep = byId.get(step.id);
    if (!logStep) continue;
    for (const variable of step.variables ?? []) {
      const used = runValues.find((rv) => rv.stepId === step.id && rv.varId === variable.id);
      if (!used) continue;
      const overridden = used.value !== variable.value;
      logStep.values.push({
        varId: variable.id,
        token: variable.token,
        unit: used.unit || variable.unit,
        planned: variable.value,
        used: used.value,
        overridden,
      });
      if (overridden) {
        deviations.push({
          kind: 'value',
          stepNumber: logStep.number,
          message: `${variable.token} in step ${logStep.number} was ${used.value} ${used.unit || variable.unit}, planned ${variable.value} ${variable.unit}`,
        });
      }
    }
  }

  deviations.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));

  return {
    experimentId: experiment.id,
    steps: logSteps,
    timeline,
    pauses,
    deviations,
    methodsText: buildMethodsText(logSteps, reagentLots.filter((lot) => lot.stepId === '')),
  };
}

function buildMethodsText(steps: LogStep[], runLots: ReagentLot[]): string {
  const sentences: string[] = [];
  for (const step of steps) {
    const performed = step.startedAt !== undefined || step.completed || step.timers.length > 0 || step.values.length > 0;
    if (!performed) continue;

    let sentence = `Step ${step.number}, "${step.title}," was ${step.completed ? 'completed' : 'started but not completed'}`;
    for (const timer of step.timers) {
      const planned = timer.plannedSec !== undefined ? ` (planned ${durationText(timer.plannedSec)})` : '';
      sentence += ` for ${durationText(timer.actualSec)}${planned} during ${timer.label}`;
    }
    if (step.values.length > 0) {
      const values = step.values.map((v) => {
        const over = v.overridden ? ` (overridden from ${v.planned} ${v.unit})` : '';
        return `${v.token} ${v.used} ${v.unit}${over}`;
      });
      sentence += `, using ${values.join(', ')}`;
    }
    const lots = step.reagentLots.map(lotText);
    if (lots.length > 0) sentence += `, with ${lots.join(', ')}`;
    sentences.push(`${sentence}.`);
  }
  if (runLots.length > 0) sentences.push(`Reagent lots used were ${runLots.map(lotText).join(', ')}.`);
  return sentences.join(' ');
}

function lotText(lot: ReagentLot): string {
  const details = [lot.lotNumber ? `lot ${lot.lotNumber}` : '', lot.vendor ?? '', lot.catalogNumber ? `cat. ${lot.catalogNumber}` : '']
    .filter(Boolean)
    .join(', ');
  return details ? `${lot.name} (${details})` : lot.name;
}

/** Minutes for 60 s and above, seconds below that. Undefined renders as an em dash. */
function durationText(sec: number | undefined): string {
  if (sec === undefined) return '—';
  if (sec >= 60) return `${Math.round(sec / 60)} min`;
  return `${Math.round(sec)} s`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
