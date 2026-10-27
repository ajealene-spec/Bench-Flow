import { askConfirm } from '../app/feedback';
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db } from '../db';
import {
  deleteExperiment,
  getExperiment,
  getProcedureForExperiment,
  listFolders,
  renameExperiment,
  setExperimentFolder,
  setMaterialChecked,
  updateExperiment,
  updateProcedureFields,
} from '../db/helpers';
import type { Experiment, ExperimentStatus, Procedure } from '../types';
import { EMPTY_OVERVIEW, MaterialsCard, OverviewCard, TimelineCard } from '../features/plan/PlanCards';
import { formatDate } from './format';
import { RecordedDataSummary } from '../features/data/RecordedDataSummary';
import { ExperimentCapture } from '../features/data/ExperimentCapture';
import { ExperimentReagentsPanel } from '../features/inventory/ExperimentReagentsPanel';
import { TroubleshootPanel } from '../features/assist/TroubleshootPanel';
import { ExperimentAnimalsPanel } from '../features/animals/ExperimentAnimalsPanel';
import { ScheduleExperimentButton } from '../features/calendar/ScheduleExperimentDialog';
import { RepeatOfNote, RunAgainPanel } from '../features/experiments/RunAgainPanel';
import { TagEditor } from '../features/experiments/TagEditor';
import { ReproducibilityBadge } from '../features/insights/ReproducibilityBadge';
import { isDemoExperiment } from '../features/tour/sampleNotice';
import { SampleBanner } from '../features/tour/SampleBanner';

const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-base font-medium';
const BUTTON_PRIMARY = `${BUTTON} bg-accent text-white active:bg-accent-hover`;
const BUTTON_SECONDARY =`${BUTTON} border border-border bg-surface shadow-card text-text active:bg-surface-2`;
const BUTTON_DANGER =`${BUTTON} border border-rose-300 bg-surface shadow-card text-rose-800 active:bg-rose-50 dark:border-rose-700  dark:text-rose-200`;
const INPUT =
'min-h-12 w-full rounded-xl border border-border bg-surface shadow-card px-3 text-base text-text';

const STATUS_LABEL: Record<ExperimentStatus, string> = {
  draft: 'Draft',
  in_progress: 'In progress',
  done: 'Done',
};

export default function ExperimentPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const loaded = useLiveQuery(async () => ({ experiment: await getExperiment(id, db) }), [id]);
  const folders = useLiveQuery(() => listFolders(db), []);
  const procedure = useLiveQuery(() => getProcedureForExperiment(id, db), [id]);

  if (loaded === undefined) {
    return <main className="p-6 text-text-muted">Loading…</main>;
  }
  const experiment = loaded.experiment;
  if (!experiment) {
    return (
      <main className="mx-auto flex max-w-7xl flex-col gap-4 p-4 sm:p-6">
        <BackLink />
        <h1 className="text-2xl font-semibold">Experiment not found</h1>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-6 p-4 pb-10 sm:p-6">
      <BackLink />
      {isDemoExperiment(experiment) && <SampleBanner />}

      <header className="flex flex-col gap-2">
        <NameField key={experiment.id} experimentId={experiment.id} initial={experiment.name} />
        <span className="text-base text-text-muted">
          {STATUS_LABEL[experiment.status]}
          {procedure ? ` · ${procedure.title}` : ''}
        </span>
        <ReproducibilityBadge experimentId={experiment.id} />
        {experiment.duplicatedFrom && <RepeatOfNote duplicatedFrom={experiment.duplicatedFrom} />}
      </header>

      <section aria-label="Dates" className="grid gap-3 sm:grid-cols-2">
        <DateRow label="Started" value={formatDate(experiment.startedAt)} />
        <DateRow label="Ended" value={formatDate(experiment.endedAt)} />
      </section>

      {procedure && <ExperimentPlan key={procedure.id} experiment={experiment} procedure={procedure} />}

      <section aria-label="Actions" className="flex flex-wrap gap-3">
        <Link to={`/experiment/${experiment.id}/run`} className={BUTTON_PRIMARY}>
          Continue run
        </Link>
        {experiment.templateId ? (
          <Link to={`/library/${experiment.templateId}`} className={BUTTON_SECONDARY}>
            Edit template
          </Link>
        ) : (
          <span className="self-center text-sm text-text-muted">
            No template. This run keeps its own steps.
          </span>
        )}
        <button
          type="button"
          className={BUTTON_DANGER}
          onClick={async () => {
            const ok = await askConfirm({ title: 'Delete this experiment?', message: 'Its steps, timers and recorded data will be deleted. The protocol stays in the library.', confirmLabel: 'Delete experiment', danger: true });
            if (!ok) return;
            await deleteExperiment(experiment.id, db);
            navigate('/');
          }}
        >
          Delete experiment
        </button>
        <Link
          to={`/experiment/${experiment.id}/report`}
          className="inline-flex min-h-12 items-center justify-center rounded-lg bg-accent px-4 font-semibold text-white"
        >
          View report
        </Link>
      </section>

      <label className="flex flex-col gap-1">
        <span className="font-medium">Folder</span>
        <select
          className={INPUT}
          value={experiment.folderId ?? ''}
          onChange={(e) => void setExperimentFolder(experiment.id, e.target.value || null, db)}
        >
          <option value="">Unfiled</option>
          {folders?.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
      </label>

      <TagEditor key={experiment.id} experimentId={experiment.id} tags={experiment.tags ?? []} />

      <RunAgainPanel experiment={experiment} />

      <NotesField key={experiment.id} experimentId={experiment.id} initial={experiment.notes ?? ''} />

      <RecordedDataSummary experimentId={experiment.id} experimentName={experiment.name} />
      <ExperimentCapture experimentId={experiment.id} experimentName={experiment.name} />
      <ExperimentReagentsPanel experimentId={experiment.id} />
      <ExperimentAnimalsPanel experiment={experiment} />
      <ScheduleExperimentButton experimentId={experiment.id} />
      <TroubleshootPanel experimentId={experiment.id} />
    </main>
  );
}

function NameField({ experimentId, initial }: { experimentId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-text-muted">Name</span>
      <input
        className={`${INPUT} text-2xl font-semibold`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void renameExperiment(experimentId, value, db)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}

/** Notes save automatically: after a short pause while typing, and when the field loses focus. */
function NotesField({ experimentId, initial }: { experimentId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const pending = useRef<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  function flush() {
    window.clearTimeout(timer.current);
    if (pending.current === null) return;
    const next = pending.current;
    pending.current = null;
    void updateExperiment(experimentId, { notes: next }, db);
  }

  useEffect(() => flush, []);

  return (
    <label className="flex flex-col gap-1">
      <span className="font-medium">Notes</span>
      <textarea
        className="min-h-32 w-full rounded-xl border border-border bg-surface shadow-card p-3 text-base text-text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          pending.current = e.target.value;
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(flush, 600);
        }}
        onBlur={flush}
      />
      <span className="text-sm text-text-muted">Saves automatically.</span>
    </label>
  );
}

function DateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
      <span className="text-text-muted">{label}</span>
      <span className="text-lg font-medium">{value}</span>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex min-h-12 w-fit items-center rounded-lg px-3 font-medium text-accent-text underline"
    >
      Back to experiments
    </Link>
  );
}

/** Overview, materials checklist and timeline for the run. Edits change this run only, never the template. */
function ExperimentPlan({ experiment, procedure }: { experiment: Experiment; procedure: Procedure }) {
  const [overview, setOverview] = useState(procedure.overview ?? EMPTY_OVERVIEW);
  return (
    <section aria-label="Protocol plan" className="flex flex-col gap-4">
      <OverviewCard
        value={overview}
        onChange={setOverview}
        onBlur={() => void updateProcedureFields(procedure.id, { overview }, db)}
      />
      <MaterialsCard
        materials={procedure.materials ?? []}
        checked={experiment.materialsChecked ?? []}
        onToggle={(id, on) => void setMaterialChecked(experiment.id, id, on, db)}
      />
      <TimelineCard
        steps={procedure.steps}
        phases={procedure.phases ?? []}
        onChange={(next) => void updateProcedureFields(procedure.id, next, db)}
      />
    </section>
  );
}
