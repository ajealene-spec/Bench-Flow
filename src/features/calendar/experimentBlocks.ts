import type { Experiment, ExecutionEvent, ProtocolPhase, Step } from '../../types';
import { plannedStepMs, projectSchedule } from '../run/schedule';
import { addDays, dayDiff, dayKey, dayStartMs, DAY_MINUTES, MINUTE_MS, timestampAt } from './dates';

/** After a step that runs past midnight, the next step starts at this time the following morning. */
export const WORK_DAY_START_MIN = 9 * 60;
/** Shortest drawn block, so a zero-length phase is still visible. */
const MIN_BLOCK_MIN = 30;
/** Number of colors in the per-experiment palette (see calendar.css). */
export const SERIES_COUNT = 6;
const NO_PHASE = '__none';

/** Everything needed to draw one experiment on the calendar. */
export interface ExperimentSource {
  experiment: Experiment;
  /** Procedure title, used as the label prefix. Falls back to the run name. */
  title?: string;
  steps: Step[];
  phases: ProtocolPhase[];
  events: ExecutionEvent[];
}

export type BlockStatus = 'done' | 'current' | 'upcoming';

/** One phase on one calendar day. A phase that spans several days yields one block per day. */
export interface ExperimentBlock {
  id: string;
  experimentId: string;
  experimentName: string;
  phaseId: string;
  phaseName: string;
  /** Local day key. */
  date: string;
  /** 1 on the experiment's first day. */
  dayNumber: number;
  /** Minutes after local midnight, 0..1440. */
  startMin: number;
  endMin: number;
  label: string;
  status: BlockStatus;
  colorIndex: number;
  /** Drag this block to move the whole experiment. Only on the first block of an unstarted run. */
  moveHandle: boolean;
}

export interface PlacedStep {
  stepId: string;
  phaseId?: string;
  startAt: number;
  endAt: number;
}

/**
 * Lays steps end to end from a start time. A step that runs past midnight hands over at 09:00 the
 * next morning, so an overnight incubation pushes the following steps to the next day.
 */
export function placeSteps(steps: Step[], startAt: number): PlacedStep[] {
  let cursor = startAt;
  return steps.map((step) => {
    const begins = cursor;
    const endAt = begins + plannedStepMs(step);
    if (dayKey(endAt) !== dayKey(begins)) {
      const nextMorning = timestampAt(addDays(dayKey(begins), 1), WORK_DAY_START_MIN);
      cursor = Math.max(endAt, nextMorning);
    } else {
      cursor = endAt;
    }
    return { stepId: step.id, phaseId: step.phaseId, startAt: begins, endAt };
  });
}

/** Ids of steps the run has completed or skipped. */
export function finishedStepIds(events: ExecutionEvent[]): Set<string> {
  const ids = new Set<string>();
  for (const e of events) {
    if ((e.type === 'step_complete' || e.type === 'step_skip') && e.stepId) ids.add(e.stepId);
  }
  return ids;
}

/**
 * Planned times for every step of a run. An unstarted run is laid out from its plannedStart. A
 * started run keeps its finished steps where they were planned and moves the remaining steps to
 * the projected cursor from projectSchedule, so a pause and resume shifts what is left.
 */
export function scheduleSteps(source: ExperimentSource, now: number): PlacedStep[] | undefined {
  const { experiment, steps, events } = source;
  const anchor = experiment.startedAt ?? experiment.plannedStart;
  if (anchor === undefined || steps.length === 0) return undefined;

  const nominal = placeSteps(steps, anchor);
  if (experiment.startedAt === undefined) return nominal;

  const finished = finishedStepIds(events);
  if (experiment.endedAt !== undefined) steps.forEach((s) => finished.add(s.id));
  const remaining = steps.filter((s) => !finished.has(s.id));
  if (remaining.length === 0) return nominal;

  const first = projectSchedule(steps, events, now)[0];
  if (!first) return nominal;
  const shifted = new Map(placeSteps(remaining, first.startAt).map((p) => [p.stepId, p]));
  return nominal.map((p) => (finished.has(p.stepId) ? p : (shifted.get(p.stepId) ?? p)));
}

/**
 * Expands experiments into per-day phase blocks for the inclusive day range start..end.
 * Pure: pass the current time in (it only matters for started runs).
 */
export function expandExperimentBlocks(
  sources: ExperimentSource[],
  start: string,
  end: string,
  now: number,
): ExperimentBlock[] {
  const out: ExperimentBlock[] = [];
  for (const source of sources) {
    out.push(...blocksForExperiment(source, start, end, now));
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin || a.label.localeCompare(b.label));
}

function blocksForExperiment(source: ExperimentSource, start: string, end: string, now: number): ExperimentBlock[] {
  const { experiment, steps, phases } = source;
  const placed = scheduleSteps(source, now);
  const anchor = experiment.startedAt ?? experiment.plannedStart;
  if (!placed || anchor === undefined) return [];

  const started = experiment.startedAt !== undefined;
  const finished = started ? finishedStepIds(source.events) : new Set<string>();
  if (started && experiment.endedAt !== undefined) steps.forEach((s) => finished.add(s.id));
  const firstDay = dayKey(anchor);
  const title = source.title?.trim() || experiment.name;
  const colorIndex = seriesIndex(experiment.id);

  // Phases in procedure order, then any steps that belong to no phase.
  const groups = orderedGroups(placed, phases);
  const currentPhase = started ? groups.find((g) => g.items.some((p) => !finished.has(p.stepId)))?.phaseId : undefined;

  const out: ExperimentBlock[] = [];
  groups.forEach((group, groupIndex) => {
    const minStart = Math.min(...group.items.map((p) => p.startAt));
    const maxEnd = Math.max(...group.items.map((p) => p.endAt));
    const allDone = group.items.every((p) => finished.has(p.stepId));
    const status: BlockStatus = allDone ? 'done' : group.phaseId === currentPhase ? 'current' : 'upcoming';
    const phaseName = phaseNameFor(group.phaseId, phases);

    const lastDay = dayKey(Math.max(minStart, maxEnd - 1));
    let day = dayKey(minStart);
    while (day <= lastDay) {
      if (day >= start && day <= end) {
        const dayBase = dayStartMs(day);
        const startMin = day === dayKey(minStart) ? minutesIntoDay(minStart, dayBase) : 0;
        let endMin = day === lastDay ? minutesIntoDay(maxEnd, dayBase) : DAY_MINUTES;
        endMin = Math.min(DAY_MINUTES, Math.max(endMin, startMin + MIN_BLOCK_MIN));
        const dayNumber = dayDiff(firstDay, day) + 1;
        out.push({
          id: `${experiment.id}:${group.phaseId}:${day}`,
          experimentId: experiment.id,
          experimentName: experiment.name,
          phaseId: group.phaseId,
          phaseName,
          date: day,
          dayNumber,
          startMin,
          endMin,
          label: `${title} — Day ${dayNumber}: ${phaseName}`,
          status,
          colorIndex,
          moveHandle: !started && groupIndex === 0 && day === firstDay,
        });
      }
      day = addDays(day, 1);
    }
  });
  return out;
}

function orderedGroups(
  placed: PlacedStep[],
  phases: ProtocolPhase[],
): Array<{ phaseId: string; items: PlacedStep[] }> {
  const byPhase = new Map<string, PlacedStep[]>();
  for (const p of placed) {
    const id = p.phaseId ?? NO_PHASE;
    byPhase.set(id, [...(byPhase.get(id) ?? []), p]);
  }
  const order = [...phases.map((p) => p.id), NO_PHASE];
  const seen = new Set<string>();
  const groups: Array<{ phaseId: string; items: PlacedStep[] }> = [];
  for (const id of [...order, ...byPhase.keys()]) {
    const items = byPhase.get(id);
    if (!items || seen.has(id)) continue;
    seen.add(id);
    groups.push({ phaseId: id, items });
  }
  return groups;
}

function phaseNameFor(phaseId: string, phases: ProtocolPhase[]): string {
  if (phaseId === NO_PHASE) return 'Steps';
  return phases.find((p) => p.id === phaseId)?.name ?? 'Steps';
}

function minutesIntoDay(ms: number, dayBase: number): number {
  return Math.min(DAY_MINUTES, Math.max(0, Math.round((ms - dayBase) / MINUTE_MS)));
}

/** Stable palette slot for an experiment id. */
export function seriesIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % SERIES_COUNT;
}

/**
 * New plannedStart after dragging a run's first day to another day. The time of day is kept.
 * Local calendar arithmetic, so daylight saving changes do not move the clock time.
 */
export function shiftPlannedStart(plannedStart: number, fromDay: string, toDay: string): number {
  const shift = dayDiff(fromDay, toDay);
  const d = new Date(plannedStart);
  d.setDate(d.getDate() + shift);
  return d.getTime();
}
