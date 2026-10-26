import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { dayKey, parseTime, formatMinutes, timestampAt } from './dates';
import { isSchedulable, setPlannedStart } from './experimentSchedule';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL } from './ui';

export interface ScheduleExperimentDialogProps {
  /** Pre-selects a run. Omit on the calendar to choose one. */
  experimentId?: string;
  defaultDay?: string;
  onClose: () => void;
}

/**
 * Sets a run's planned start (day and time). The run's phases then appear on the calendar for as
 * many days as the protocol takes. Only unstarted runs can be scheduled.
 */
export function ScheduleExperimentDialog({ experimentId, defaultDay, onClose }: ScheduleExperimentDialogProps) {
  const experiments = useLiveQuery(async () => (await db.experiments.toArray()).filter(isSchedulable), []);
  const [chosen, setChosen] = useState(experimentId ?? '');
  const [day, setDay] = useState(() => defaultDay ?? dayKey(Date.now()));
  const [time, setTime] = useState('09:00');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const current = (experiments ?? []).find((e) => e.id === chosen);

  async function save(e: FormEvent) {
    e.preventDefault();
    const minutes = parseTime(time);
    if (!chosen || minutes === undefined) {
      setError('Choose a run, a day and a time.');
      return;
    }
    setBusy(true);
    try {
      await setPlannedStart(chosen, timestampAt(day, minutes));
      onClose();
    } catch {
      setError('Could not schedule the run. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (!chosen) return;
    await setPlannedStart(chosen, undefined);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-dialog-title"
        className="flex max-h-dvh w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-2xl border border-border bg-page p-5 shadow-card sm:rounded-2xl"
      >
        <h2 id="schedule-dialog-title" className="text-xl font-semibold text-text">
          Schedule experiment
        </h2>
        <form onSubmit={save} className="flex flex-col gap-4">
          {!experimentId && (
            <label className={LABEL}>
              Run
              <select className={INPUT} value={chosen} onChange={(e) => setChosen(e.target.value)}>
                <option value="">Choose a run</option>
                {(experiments ?? []).map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className={LABEL}>
              Start day
              <input type="date" className={INPUT} value={day} onChange={(e) => setDay(e.target.value)} />
            </label>
            <label className={LABEL}>
              Start time
              <input type="time" className={INPUT} value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>
          <p className="text-sm text-text-muted">
            {current ? `${current.name} starts ${day} at ${formatMinutes(parseTime(time) ?? 0)}.` : 'Each phase lands on the day it falls on.'}
          </p>
          {error && (
            <p role="alert" className="text-sm font-medium text-text">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className={BTN_PRIMARY}>
              Schedule
            </button>
            {current?.plannedStart !== undefined && (
              <button type="button" onClick={clear} className={BTN_SECONDARY}>
                Remove from calendar
              </button>
            )}
            <button type="button" onClick={onClose} className={BTN_SECONDARY}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * One-button entry point for an experiment page. Hidden once the run has started, because the
 * calendar then follows the run's actual progress.
 */
export function ScheduleExperimentButton({ experimentId }: { experimentId: string }) {
  const [open, setOpen] = useState(false);
  const experiment = useLiveQuery(() => db.experiments.get(experimentId), [experimentId]);
  if (!experiment || !isSchedulable(experiment)) return null;
  const planned = experiment.plannedStart;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={BTN_SECONDARY}>
        {planned === undefined ? 'Schedule on calendar' : 'Reschedule on calendar'}
      </button>
      {open && (
        <ScheduleExperimentDialog
          experimentId={experimentId}
          defaultDay={planned === undefined ? undefined : dayKey(planned)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
