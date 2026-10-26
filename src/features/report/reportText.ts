import type { ExecutionEvent, Procedure, StepRecord } from '../../types';
import { groupRecordsByStep, SUMMARY_HEADERS, summaryRows, toCSV } from '../data/summary';
import { formatElapsed, formatTimestamp } from '../data/time';
import type { Report } from './buildReport';
import type { ExecutionLog } from './buildExecutionLog';

const DASH = '—';

function when(ms: number | undefined): string {
  return ms === undefined ? DASH : formatTimestamp(ms);
}

function seconds(sec: number | undefined): string {
  return sec === undefined ? DASH : formatElapsed(sec);
}

function amountText(amount?: string, unit?: string): string {
  return [amount, unit].filter(Boolean).join(' ');
}

/** Plain-text report with Markdown headings, ready to paste into a lab notebook. */
export function reportToMarkdown(report: Report): string {
  const lines: string[] = [];
  const push = (...items: string[]) => lines.push(...items);

  push(`# ${report.title}`, '');
  push(`- Protocol: ${report.protocol.title}${report.protocol.category ? ` (${report.protocol.category})` : ''}`);
  push(`- Status: ${report.status.replace('_', ' ')}`);
  push(`- Started: ${when(report.dates.startedAt)}`);
  push(`- Ended: ${when(report.dates.endedAt)}`);
  push(`- Total duration: ${seconds(report.dates.durationSec)}`, '');

  push('## Safety', '');
  push(`Confirmed: ${when(report.safety.confirmedAt)}`);
  for (const item of report.safety.items) push(`- [${item.checked ? 'x' : ' '}] ${item.label}`);
  for (const hazard of report.safety.hazards) {
    push(`- Hazard: ${hazard.name} (${hazard.kind}) - ${hazard.reason}${hazard.ppe.length ? `; PPE: ${hazard.ppe.join(', ')}` : ''}`);
  }
  push('');

  push('## Steps', '');
  if (report.steps.length === 0) push('No steps.', '');
  for (const step of report.steps) {
    push(`### ${step.number}. ${step.title} ${step.completed ? '(completed)' : '(not completed)'}`, '');
    if (step.instructions) push(step.instructions, '');
    for (const caution of step.cautions) push(`- Caution: ${caution}`);
    for (const n of step.numbers) {
      push(`- ${n.label}: ${n.value ?? DASH}${n.unit ? ` ${n.unit}` : ''}${n.note ? ` (${n.note})` : ''}`);
    }
    for (const t of step.timers) {
      push(`- Timer ${t.label}: planned ${seconds(t.plannedSec)}, actual ${seconds(t.actualSec)}`);
    }
    for (const c of step.calculations) {
      push(`- Calculated ${c.label}: ${c.value}${c.unit ? ` ${c.unit}` : ''}${c.note ? ` (${c.note})` : ''}`);
    }
    push('');
  }

  push('## Deviations', '');
  if (report.deviations.length === 0) push('None.', '');
  for (const d of report.deviations) push(`- ${d.message}`);
  if (report.deviations.length) push('');

  push('## Reagents', '');
  if (report.reagents.length === 0) push('None listed.', '');
  for (const r of report.reagents) {
    const amount = amountText(r.amount, r.unit);
    push(`- ${r.name}${amount ? `: ${amount}` : ''} (steps ${r.stepNumbers.join(', ')})${r.rrid ? ` [${r.rrid}]` : ''}`);
  }
  if (report.reagents.length) push('');

  push('## Animals', '');
  if (report.animals.length === 0) push('None linked.', '');
  for (const a of report.animals) {
    push(`- ${a.label}: ${[a.species, a.strain, a.genotype, a.sex].filter(Boolean).join(', ') || 'no details'}${a.rrid ? ` [${a.rrid}]` : ''}`);
  }
  if (report.animals.length) push('');

  push('## Comments', '');
  if (report.comments.length === 0) push('None.', '');
  for (const c of report.comments) {
    push(`- ${c.author} (${when(c.createdAt)}${c.resolved ? ', resolved' : ''}): ${c.text}`);
  }
  if (report.comments.length) push('');

  push('## Notes', '');
  push(report.notes || 'None.', '');

  if (report.generatedAt !== undefined) push(`Generated ${when(report.generatedAt)}`);
  return lines.join('\n').trimEnd() + '\n';
}

/** All step records as CSV, grouped by step in procedure order. Reuses the data summary columns. */
export function reportToCSV(procedure: Procedure | undefined, records: StepRecord[]): string {
  const groups = groupRecordsByStep(procedure, records);
  return toCSV(SUMMARY_HEADERS, summaryRows(groups));
}

/** Every execution event, oldest first. One row per event, with the planned and actual values when present. */
export function reportToEventsCSV(events: ExecutionEvent[]): string {
  const headers = ['time', 'type', 'step_id', 'phase_id', 'planned', 'actual', 'unit', 'note', 'deviation_kind', 'deviation_delta'];
  const rows = [...events]
    .sort((a, b) => a.at - b.at)
    .map((e) => [
      formatTimestamp(e.at),
      e.type,
      e.stepId ?? '',
      e.phaseId ?? '',
      e.planned === undefined ? '' : String(e.planned),
      e.actual === undefined ? '' : String(e.actual),
      e.unit ?? '',
      e.note ?? '',
      e.deviation?.kind ?? '',
      e.deviation?.delta === undefined ? '' : String(e.deviation.delta),
    ]);
  return toCSV(headers, rows);
}

/** The report as JSON. Pass the execution log and events to include them alongside the report. */
export function reportToJSON(report: Report, extra?: { executionLog?: ExecutionLog; events?: ExecutionEvent[] }): string {
  return JSON.stringify({ ...report, ...extra }, null, 2);
}
