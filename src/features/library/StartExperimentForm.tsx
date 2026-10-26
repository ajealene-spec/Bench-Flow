import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startExperimentFromTemplate } from '../../db/helpers';
import { setPlannedStart } from '../calendar/experimentSchedule';
import type { ProtocolTemplate } from '../../types';
import { parseScheduleStart, toScheduleInputValue } from './scheduleStart';

const INPUT = 'min-h-12 w-full rounded-xl border border-border bg-surface px-3 text-base text-text shadow-card';

/**
 * Asks for a run title and an optional planned start, then starts an experiment from the template and
 * opens its run page. A scheduled start puts the run on the calendar, so multi-day protocols show their days.
 */
export function StartExperimentForm({ template, onDone }: { template: ProtocolTemplate; onDone: () => void }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(() => `${template.title} – ${new Date().toLocaleDateString()}`);
  const [schedule, setSchedule] = useState(false);
  const [when, setWhen] = useState(() => toScheduleInputValue(defaultStart()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    const plannedStart = schedule ? parseScheduleStart(when) : undefined;
    if (schedule && plannedStart === undefined) {
      setError('Enter a valid date and time for the scheduled start, or turn scheduling off.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const experiment = await startExperimentFromTemplate(template.id, title);
      if (plannedStart !== undefined) await setPlannedStart(experiment.id, plannedStart);
      navigate(`/experiment/${experiment.id}/run`);
    } catch {
      setError('Could not start the experiment. Please try again.');
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void start();
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Run title</span>
        <input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Schedule start (optional)</legend>
        <label className="flex min-h-12 items-center gap-3 text-base">
          <input
            type="checkbox"
            className="size-6 accent-[var(--accent)]"
            checked={schedule}
            onChange={(e) => setSchedule(e.target.checked)}
          />
          <span>Put this run on the calendar</span>
        </label>
        {schedule && (
          <label className="flex flex-col gap-1">
            <span className="text-sm text-text-muted">Date and time the first step starts</span>
            <input
              type="datetime-local"
              className={INPUT}
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </label>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? 'Starting…' : 'Start run'}
        </button>
        <button type="button" onClick={onDone} disabled={busy} className="btn btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Default schedule: the next 09:00, so the picker opens on a sensible morning. */
function defaultStart(): number {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}
