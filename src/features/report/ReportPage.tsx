import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import { db } from '../../db';
import { getExperiment, getProcedureForExperiment, getRunState, listStepRecords } from '../../db/helpers';
import { getTemplate } from '../../db/templates';
import type { Procedure, StepRecord } from '../../types';
import { formatElapsed, formatTimestamp } from '../data/time';
import { buildReport, type Report } from './buildReport';
import { reportToCSV, reportToJSON, reportToMarkdown } from './reportText';
import './report.css';

const BUTTON =
  'inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 font-medium text-slate-900 active:bg-slate-100';
const SECTION = 'report-section mt-8 border-t border-slate-300 pt-4';
const SECTION_BREAK = `${SECTION} report-section--break`;

interface ReportData {
  report: Report;
  procedure?: Procedure;
  records: StepRecord[];
}

/** Loads everything the report needs for one experiment. Resolves to null when the experiment does not exist. */
async function loadReportData(experimentId: string): Promise<ReportData | null> {
  const experiment = await getExperiment(experimentId, db);
  if (!experiment) return null;
  const [procedure, runState, records, template] = await Promise.all([
    getProcedureForExperiment(experimentId, db),
    getRunState(experimentId, db),
    listStepRecords(experimentId, db),
    experiment.templateId ? getTemplate(experiment.templateId, db) : Promise.resolve(undefined),
  ]);
  const report = buildReport({
    experiment,
    procedure,
    template: template ?? null,
    runState,
    records,
    generatedAt: Date.now(),
  });
  return { report, procedure, records };
}

/** Printable report for one experiment. Print, CSV, JSON and plain-text export. */
export default function ReportPage() {
  const { id = '' } = useParams();
  const data = useLiveQuery(() => loadReportData(id), [id]);

  if (data === undefined) return <main className="p-6 text-slate-500">Loading report…</main>;
  if (data === null) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
        <Link to="/" className="inline-flex min-h-12 w-fit items-center text-teal-700 underline">
          Back to experiments
        </Link>
        <h1 className="text-2xl font-semibold">Experiment not found</h1>
      </main>
    );
  }
  return <ReportView data={data} />;
}

function ReportView({ data }: { data: ReportData }) {
  const { report, procedure, records } = data;
  const [message, setMessage] = useState('');

  const fileBase = slugify(report.title);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(reportToMarkdown(report));
      setMessage('Copied report text.');
    } catch {
      setMessage('Could not copy. Use Download JSON or Print instead.');
    }
  };

  return (
    <div className="px-4 pb-12 pt-4">
      <div className="no-print mx-auto flex w-full max-w-3xl flex-wrap gap-2">
        <Link to={`/experiment/${report.experimentId}`} className={BUTTON}>
          Back to experiment
        </Link>
        <button type="button" className={BUTTON} onClick={() => window.print()}>
          Print / Save as PDF
        </button>
        <button type="button" className={BUTTON} onClick={() => downloadFile(`${fileBase}-records.csv`, '﻿' + reportToCSV(procedure, records), 'text/csv')}>
          Download CSV
        </button>
        <button type="button" className={BUTTON} onClick={() => downloadFile(`${fileBase}-report.json`, reportToJSON(report), 'application/json')}>
          Download JSON
        </button>
        <button type="button" className={BUTTON} onClick={copyText}>
          Copy as text
        </button>
        <p role="status" className="w-full text-sm text-slate-600">
          {message}
        </p>
      </div>

      <article className="report-print-root mx-auto mt-4 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 text-black shadow-sm sm:p-8">
        <header>
          <p className="text-sm uppercase tracking-wide text-slate-600">Experiment report</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight sm:text-3xl">{report.title}</h1>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-base sm:grid-cols-2">
            <Field label="Protocol" value={report.protocol.title} />
            <Field label="Category" value={report.protocol.category ?? '—'} />
            <Field label="Status" value={report.status.replace('_', ' ')} />
            <Field label="Total duration" value={formatElapsed(report.dates.durationSec) || '—'} />
            <Field label="Started" value={formatTimestamp(report.dates.startedAt) || '—'} />
            <Field label="Ended" value={formatTimestamp(report.dates.endedAt) || '—'} />
          </dl>
        </header>

        <section className={SECTION} aria-labelledby="report-safety">
          <h2 id="report-safety" className="text-xl font-semibold">Safety</h2>
          <p className="mt-1 text-base">
            Checklist confirmed: {formatTimestamp(report.safety.confirmedAt) || 'not confirmed'}
          </p>
          {report.safety.items.length > 0 && (
            <ul className="mt-2 space-y-1 text-base">
              {report.safety.items.map((item) => (
                <li key={item.label} className="report-row">
                  [{item.checked ? 'x' : ' '}] {item.label}
                </li>
              ))}
            </ul>
          )}
          {report.safety.hazards.length > 0 && (
            <ul className="mt-3 space-y-2 text-base">
              {report.safety.hazards.map((h) => (
                <li key={h.name} className="report-row">
                  <strong>{h.name}</strong> ({h.kind}): {h.reason}
                  {h.ppe.length > 0 && <span> PPE: {h.ppe.join(', ')}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={SECTION_BREAK} aria-labelledby="report-steps">
          <h2 id="report-steps" className="text-xl font-semibold">Steps</h2>
          {report.steps.length === 0 && <p className="mt-2 text-base">This experiment has no steps.</p>}
          {report.steps.map((step) => (
            <div key={step.stepId} className="report-step mt-5">
              <h3 className="text-lg font-semibold">
                {step.number}. {step.title}{' '}
                <span className="text-base font-normal text-slate-700">
                  ({step.completed ? 'completed' : 'not completed'})
                </span>
              </h3>
              {step.instructions && <p className="mt-1 whitespace-pre-line text-base">{step.instructions}</p>}
              {step.cautions.length > 0 && (
                <ul className="mt-2 list-disc pl-6 text-base">
                  {step.cautions.map((c) => (
                    <li key={c}>Caution: {c}</li>
                  ))}
                </ul>
              )}
              {step.numbers.length > 0 && (
                <table className="mt-2 w-full border-collapse text-left text-base">
                  <thead>
                    <tr className="border-b border-slate-400">
                      <th className="py-1 pr-2 font-semibold">Recorded</th>
                      <th className="py-1 pr-2 font-semibold">Value</th>
                      <th className="py-1 font-semibold">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {step.numbers.map((n, i) => (
                      <tr key={`${n.label}-${i}`} className="report-row border-b border-slate-200">
                        <td className="py-1 pr-2">{n.label}</td>
                        <td className="py-1 pr-2">
                          {n.value ?? '—'}
                          {n.unit ? ` ${n.unit}` : ''}
                        </td>
                        <td className="py-1">{n.note ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {step.timers.length > 0 && (
                <ul className="mt-2 space-y-1 text-base">
                  {step.timers.map((t, i) => (
                    <li key={`${t.label}-${i}`} className="report-row">
                      Timer {t.label}: planned {formatElapsed(t.plannedSec) || '—'}, actual{' '}
                      {formatElapsed(t.actualSec) || 'not run'}
                    </li>
                  ))}
                </ul>
              )}
              {step.calculations.length > 0 && (
                <ul className="mt-2 space-y-1 text-base">
                  {step.calculations.map((c, i) => (
                    <li key={`${c.label}-${i}`} className="report-row">
                      Calculated {c.label}: {c.value}
                      {c.unit ? ` ${c.unit}` : ''}
                      {c.note ? ` (${c.note})` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>

        <section className={SECTION_BREAK} aria-labelledby="report-deviations">
          <h2 id="report-deviations" className="text-xl font-semibold">Deviations</h2>
          {report.deviations.length === 0 ? (
            <p className="mt-2 text-base">No deviations.</p>
          ) : (
            <ul className="mt-2 list-disc space-y-1 pl-6 text-base">
              {report.deviations.map((d, i) => (
                <li key={`${d.kind}-${i}`} className="report-row">
                  {d.message}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={SECTION} aria-labelledby="report-reagents">
          <h2 id="report-reagents" className="text-xl font-semibold">Reagents</h2>
          {report.reagents.length === 0 ? (
            <p className="mt-2 text-base">No reagents listed.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-base">
              {report.reagents.map((r) => (
                <li key={r.name} className="report-row">
                  <strong>{r.name}</strong>
                  {r.amount || r.unit ? `: ${[r.amount, r.unit].filter(Boolean).join(' ')}` : ''} (steps{' '}
                  {r.stepNumbers.join(', ')})
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={SECTION} aria-labelledby="report-notes">
          <h2 id="report-notes" className="text-xl font-semibold">Notes</h2>
          <p className="mt-2 whitespace-pre-line text-base">{report.notes || 'No notes.'}</p>
        </section>

        {report.generatedAt !== undefined && (
          <footer className="mt-8 border-t border-slate-300 pt-2 text-sm text-slate-600">
            Generated {formatTimestamp(report.generatedAt)} · {report.recordCount} recorded{' '}
            {report.recordCount === 1 ? 'entry' : 'entries'}
          </footer>
        )}
      </article>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function slugify(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'experiment';
}

function downloadFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
