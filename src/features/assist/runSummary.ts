import type { Step } from '../../types';
import type { Report } from '../report/buildReport';
import { MAX_STEP_LINE_CHARS, type RunSummary } from './assistPrompts';

const MAX_INSTRUCTIONS_CHARS = 300;
const MAX_NOTES_CHARS = 500;

function clip(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/** Compact run parameters from the report model. Only what the troubleshooting prompt needs. */
export function compactRunSummary(report: Report): RunSummary {
  return {
    experimentName: report.title,
    status: report.status,
    durationSec: report.dates.durationSec,
    notes: report.notes ? clip(report.notes, MAX_NOTES_CHARS) : undefined,
    steps: report.steps.map((step) => ({
      number: step.number,
      title: step.title,
      instructions: clip(step.instructions, MAX_INSTRUCTIONS_CHARS),
      completed: step.completed,
      cautions: step.cautions.length ? step.cautions.slice(0, 5) : undefined,
      timers: step.timers.length
        ? step.timers.map((t) => ({ label: t.label, plannedSec: t.plannedSec, actualSec: t.actualSec }))
        : undefined,
      numbers: step.numbers.length
        ? step.numbers.map((n) => ({ label: n.label, value: n.value, unit: n.unit, note: n.note }))
        : undefined,
      calculations: step.calculations.length
        ? step.calculations.map((c) => ({ label: c.label, value: c.value, unit: c.unit }))
        : undefined,
    })),
    reagents: report.reagents.map((r) => ({
      name: r.name,
      amount: r.amount,
      unit: r.unit,
      stepNumbers: r.stepNumbers,
    })),
    deviations: report.deviations.map((d) => d.message),
  };
}

/** One short line per template step (title and clipped instructions), for the literature request. */
export function stepLines(steps: Step[]): string[] {
  return steps.map((step) => {
    const instructions = step.instructions.trim();
    return clip(instructions ? `${step.title}: ${instructions}` : step.title, MAX_STEP_LINE_CHARS);
  });
}
