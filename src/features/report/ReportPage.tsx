import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import { db } from '../../db';
import { getExperiment, getProcedureForExperiment, getRunState, listStepRecords } from '../../db/helpers';
import { listExecutionEvents } from '../../db/executionLog';
import { getInventoryItem, listInventoryUsageForExperiment } from '../../db/inventory';
import { getAnimal } from '../../db/animals';
import { listProtocolVersions } from '../../db/protocolVersions';
import { listComments } from '../../db/comments';
import { getTemplate } from '../../db/templates';
import type { RunValue } from '../../types';
import { formatElapsed, formatTimestamp } from '../data/time';
import { photosForReport, type ReportPhoto } from '../data/photos/photosForReport';
import { AnnotationOverlay } from '../data/photos/AnnotationOverlay';
import { parseAnnotations } from '../data/photos/annotations';
import { useObjectUrl } from '../data/photos/objectUrl';
import { buildExecutionLog, type ReagentLot } from './buildExecutionLog';
import { buildReport, type ReportAnimal } from './buildReport';
import { reportToCSV, reportToEventsCSV, reportToJSON, reportToMarkdown } from './reportText';
import type { ReportData } from './reportData';
import { ResearchPackageButton } from './ResearchPackageButton';
import { useToast } from '../../app/feedback';
import { ZenodoHelp } from './ZenodoHelp';
import { CommentThread } from '../share/CommentThread';
import { ReproducibilityBadge } from '../insights/ReproducibilityBadge';
import './report.css';

const BUTTON = 'btn btn-secondary';
const SECTION = 'report-section mt-8 border-t border-border pt-4';
const SECTION_BREAK = `${SECTION} report-section--break`;

/** Loads everything the report needs for one experiment. Resolves to null when the experiment does not exist. */
async function loadReportData(experimentId: string): Promise<ReportData | null> {
  const experiment = await getExperiment(experimentId, db);
  if (!experiment) return null;
  const [procedure, runState, records, template, events, runValues, usages] = await Promise.all([
    getProcedureForExperiment(experimentId, db),
    getRunState(experimentId, db),
    listStepRecords(experimentId, db),
    experiment.templateId ? getTemplate(experiment.templateId, db) : Promise.resolve(undefined),
    listExecutionEvents(experimentId, db),
    db.runValues.filter((rv: RunValue) => rv.experimentId === experimentId).toArray(),
    listInventoryUsageForExperiment(experimentId, db),
  ]);
  const inventory = await db.inventory.toArray();
  const reagentRrids: Record<string, string> = {};
  for (const item of inventory) {
    if (item.rrid) reagentRrids[item.name.trim().toLowerCase()] = item.rrid;
  }
  const animals: ReportAnimal[] = [];
  for (const id of experiment.animalIds ?? []) {
    const animal = await getAnimal(id, db);
    if (animal) {
      animals.push({ label: animal.label, species: animal.species, strain: animal.strain, genotype: animal.genotype, sex: animal.sex, rrid: animal.rrid });
    }
  }
  const comments = (await listComments({ targetType: 'experiment', targetId: experimentId }, db)).map((c) => ({
    author: c.author,
    text: c.text,
    createdAt: c.createdAt,
    resolved: c.resolved,
  }));
  const photos = await photosForReport(experimentId, db);

  const lots: ReagentLot[] = [];
  for (const usage of usages) {
    const item = await getInventoryItem(usage.inventoryItemId, db);
    if (!item) continue;
    lots.push({
      stepId: usage.stepId,
      name: item.name,
      lotNumber: item.lotNumber,
      vendor: item.vendor,
      catalogNumber: item.catalogNumber,
    });
  }
  const executionLog = buildExecutionLog(experiment, procedure?.steps ?? [], events, runValues, lots);
  const report = buildReport({
    experiment,
    procedure,
    template: template ?? null,
    runState,
    records,
    reagentRrids,
    animals,
    comments,
    generatedAt: Date.now(),
  });
  return { report, procedure, records, events, executionLog, photos };
}

/** Printable report for one experiment. Print, CSV, JSON and plain-text export. */
export default function ReportPage() {
  const { id = '' } = useParams();
  const data = useLiveQuery(() => loadReportData(id), [id]);

  if (data === undefined) return <main className="p-6 text-text-muted">Loading report…</main>;
  if (data === null) {
    return (
      <main className="mx-auto flex max-w-7xl flex-col gap-4 p-4 sm:p-6">
        <Link to="/" className="inline-flex min-h-12 w-fit items-center text-accent-text underline">
          Back to experiments
        </Link>
        <h1 className="text-2xl font-semibold">Experiment not found</h1>
      </main>
    );
  }
  return <ReportView data={data} />;
}

function ReportView({ data }: { data: ReportData }) {
  const { toast } = useToast();
  const experimentId = data.report.experimentId;
  // The template version that was current when the run started, so the report names the protocol revision it followed.
  const protocolVersion = useLiveQuery(async () => {
    const experiment = await getExperiment(experimentId);
    if (!experiment?.templateId) return undefined;
    const versions = await listProtocolVersions(experiment.templateId);
    const atStart = versions.filter((v) => v.createdAt <= experiment.createdAt).at(-1);
    return atStart ? `v${atStart.version}` : 'Unversioned';
  }, [experimentId]);
  const { report, procedure, records, events, executionLog, photos } = data;
  const [message, setMessage] = useState('');

  const fileBase = slugify(report.title);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(reportToMarkdown(report));
      setMessage('Copied report text.');
      toast('Copied report text.');
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
          Download PDF
        </button>
        <button type="button" className={BUTTON} onClick={() => downloadFile(`${fileBase}-records.csv`, '﻿' + reportToCSV(procedure, records), 'text/csv')}>
          Download CSV
        </button>
        <button type="button" className={BUTTON} onClick={() => downloadFile(`${fileBase}-events.csv`, '\ufeff' + reportToEventsCSV(events), 'text/csv')}>
          Download events CSV
        </button>
        <button type="button" className={BUTTON} onClick={() => downloadFile(`${fileBase}-report.json`, reportToJSON(report, { executionLog, events }), 'application/json')}>
          Download JSON
        </button>
        <button type="button" className={BUTTON} onClick={copyText}>
          Copy as text
        </button>
        <ResearchPackageButton experimentId={report.experimentId} data={data} />
        <p role="status" className="w-full text-sm text-text-muted">
          {message}
        </p>
      </div>

      <article className="report-print-root mx-auto mt-4 w-full max-w-3xl rounded-2xl border border-border bg-surface shadow-card p-4 text-text shadow-sm sm:p-8">
        {/* Print-only running header and footer. They repeat on every page (see report.css). */}
        <div className="print-brand hidden print:flex" aria-hidden="true">
          <img src="/icon.svg" alt="" width={22} height={22} />
          <span className="font-semibold">Bench Flow</span>
          <span className="ml-auto truncate">{report.title}</span>
        </div>
        <div className="print-footer hidden print:block" aria-hidden="true">
          Generated with Bench Flow · {formatTimestamp(Date.now())}
        </div>
        <header>
          <p className="text-sm uppercase tracking-wide text-text-muted">Experiment report</p>
          <h1 className="t-h1 mt-1">{report.title}</h1>
          <div className="mt-2">
            <ReproducibilityBadge experimentId={report.experimentId} />
          </div>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-base sm:grid-cols-2">
            <Field label="Protocol" value={report.protocol.title} />
            <Field label="Protocol version" value={protocolVersion ?? '—'} />
            <Field label="Category" value={report.protocol.category ?? '—'} />
            <Field label="Status" value={report.status.replace('_', ' ')} />
            <Field label="Total duration" value={formatElapsed(report.dates.durationSec) || '—'} />
            <Field label="Started" value={formatTimestamp(report.dates.startedAt) || '—'} />
            <Field label="Ended" value={formatTimestamp(report.dates.endedAt) || '—'} />
          </dl>
        </header>

        <section className={SECTION} aria-labelledby="report-safety">
          <h2 id="report-safety" className="t-h2">Safety</h2>
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
          <h2 id="report-steps" className="t-h2">Steps</h2>
          {report.steps.length === 0 && <p className="mt-2 text-base">This experiment has no steps.</p>}
          {report.steps.map((step) => (
            <div key={step.stepId} className="report-step mt-5">
              <h3 className="text-lg font-semibold">
                {step.number}. {step.title}{' '}
                <span className="text-base font-normal text-text-muted">
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
                    <tr className="border-b border-border-strong">
                      <th className="py-1 pr-2 font-semibold">Recorded</th>
                      <th className="py-1 pr-2 font-semibold">Value</th>
                      <th className="py-1 font-semibold">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {step.numbers.map((n, i) => (
                      <tr key={`${n.label}-${i}`} className="report-row border-b border-border">
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

        <section className={SECTION_BREAK} aria-labelledby="report-log">
          <h2 id="report-log" className="text-xl font-semibold">Execution Log</h2>
          {executionLog.timeline.length === 0 ? (
            <p className="mt-2 text-base">No events were logged for this run.</p>
          ) : (
            <table className="mt-2 w-full border-collapse text-left text-base">
              <thead>
                <tr className="border-b border-border-strong">
                  <th className="py-1 pr-2 font-semibold">Time</th>
                  <th className="py-1 font-semibold">What happened</th>
                </tr>
              </thead>
              <tbody>
                {executionLog.timeline.map((entry, i) => (
                  <tr key={`${entry.at}-${entry.type}-${i}`} className="report-row border-b border-border">
                    <td className="py-1 pr-2 whitespace-nowrap">{formatTimestamp(entry.at)}</td>
                    <td className="py-1">{entry.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {executionLog.pauses.length > 0 && (
            <>
              <h3 className="mt-4 text-lg font-semibold">Pauses</h3>
              <ul className="mt-1 space-y-1 text-base">
                {executionLog.pauses.map((p, i) => (
                  <li key={`${p.resumedAt}-${i}`} className="report-row">
                    {p.phaseId ? `Phase ${p.phaseId}` : 'Run'}: paused {formatTimestamp(p.pausedAt) || 'unknown time'}, resumed{' '}
                    {formatTimestamp(p.resumedAt)} ({formatElapsed(p.gapMs / 1000)} gap)
                  </li>
                ))}
              </ul>
            </>
          )}

          <h3 className="mt-4 text-lg font-semibold">Deviations from protocol</h3>
          {executionLog.deviations.length === 0 ? (
            <p className="mt-1 text-base">No deviations logged.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-base">
              {executionLog.deviations.map((d, i) => (
                <li
                  key={`${d.kind}-${d.at ?? i}-${i}`}
                  className="report-row rounded-md border-l-4 border-amber-600 bg-amber-50 px-3 py-2 text-text"
                >
                  <span className="font-semibold capitalize">{d.kind}</span>: {d.message}
                </li>
              ))}
            </ul>
          )}

          <div className="report-row mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">Methods</h3>
              <button type="button" className={`${BUTTON} no-print`} onClick={() => copyMethods(executionLog.methodsText, setMessage)}>
                Copy Methods
              </button>
            </div>
            <p className="mt-2 text-base leading-relaxed">
              {executionLog.methodsText || 'No steps were performed, so there is no Methods text.'}
            </p>
          </div>
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
                  {r.stepNumbers.join(', ')}){r.rrid ? ` · ${r.rrid}` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={SECTION} aria-labelledby="report-animals">
          <h2 id="report-animals" className="text-xl font-semibold">Animals</h2>
          {report.animals.length === 0 ? (
            <p className="mt-2 text-base">No animals linked to this run.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-base">
              {report.animals.map((a) => (
                <li key={a.label} className="report-row">
                  <strong>{a.label}</strong> · {[a.species, a.strain, a.genotype, a.sex].filter(Boolean).join(' · ') || 'no details'}
                  {a.rrid ? ` · ${a.rrid}` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={SECTION_BREAK} aria-labelledby="report-photos">
          <h2 id="report-photos" className="text-xl font-semibold">Photos</h2>
          {photos.length === 0 ? (
            <p className="mt-2 text-base">No photos taken during this run.</p>
          ) : (
            <ol className="report-photos mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {photos.map((photo, i) => (
                <ReportPhotoFigure key={photo.id} photo={photo} number={i + 1} stepNumber={report.steps.find((s) => s.stepId === photo.stepId)?.number} />
              ))}
            </ol>
          )}
        </section>

        <section className={SECTION} aria-labelledby="report-comments">
          <h2 id="report-comments" className="text-xl font-semibold">Comments</h2>
          {report.comments.length === 0 ? (
            <p className="mt-2 text-base">No comments on this run.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-base">
              {report.comments.map((c, i) => (
                <li key={`${c.createdAt}-${i}`} className="report-row">
                  <strong>{c.author}</strong> · {formatTimestamp(c.createdAt)}{c.resolved ? ' · resolved' : ''}
                  <p className="whitespace-pre-line">{c.text}</p>
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
          <footer className="mt-8 border-t border-border pt-2 text-sm text-text-muted">
            Generated {formatTimestamp(report.generatedAt)} · {report.recordCount} recorded{' '}
            {report.recordCount === 1 ? 'entry' : 'entries'}
          </footer>
        )}
      </article>

      <section className="no-print mx-auto mt-6 w-full max-w-3xl rounded-2xl border border-border bg-surface shadow-card p-4 text-text" aria-label="Run comments">
        <CommentThread targetType="experiment" targetId={report.experimentId} label="this run" />
      </section>
      <ZenodoHelp />
    </div>
  );
}

/** One photo for the report: thumbnail (or full image) with its annotations and caption. Prints in colour or grey. */
function ReportPhotoFigure({ photo, number, stepNumber }: { photo: ReportPhoto; number: number; stepNumber?: number }) {
  const url = useObjectUrl(photo.thumbnail ?? photo.blob);
  const annotations = parseAnnotations(photo.annotations);
  return (
    <li className="report-photo flex flex-col gap-1 break-inside-avoid">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-surface-2">
        {url && <img src={url} alt={photo.caption || `Photo ${number}`} className="h-full w-full object-contain" />}
        <AnnotationOverlay annotations={annotations} />
      </div>
      <p className="text-sm">
        <strong>Figure {number}.</strong> {photo.caption || 'No caption.'}
        <span className="text-text-muted">
          {' '}
          {stepNumber !== undefined ? `(step ${stepNumber}, ` : '('}
          {formatTimestamp(photo.at)})
        </span>
      </p>
    </li>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

async function copyMethods(text: string, setMessage: (m: string) => void): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    setMessage('Copied Methods text.');
  } catch {
    setMessage('Could not copy the Methods text. Select it and copy by hand.');
  }
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
