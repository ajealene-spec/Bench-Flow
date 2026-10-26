import { useEffect, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { createTask, deleteTask, setTaskDone, updateTask } from '../../db/tasks';
import type { Experiment, Task, TaskRecurrence } from '../../types';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER, INPUT, LABEL } from './ui';

export interface TaskDialogProps {
  /** Day the new task lands on, or the edited task's day when editing. */
  date: string;
  /** Pass a task to edit it. Omit to add a new one. */
  task?: Task;
  onClose: () => void;
}

const REPEATS: Array<{ value: TaskRecurrence; label: string }> = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
];

/** Add or edit a general task. Saving closes the dialog; the calendar updates from the database. */
export function TaskDialog({ date, task, onClose }: TaskDialogProps) {
  const experiments = useLiveQuery(() => db.experiments.toArray(), []);
  const [title, setTitle] = useState(task?.title ?? '');
  const [day, setDay] = useState(task?.date ?? date);
  const [time, setTime] = useState(task?.time ?? '');
  const [duration, setDuration] = useState(task?.durationMin ? String(task.durationMin) : '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [experimentId, setExperimentId] = useState(task?.experimentId ?? '');
  const [repeat, setRepeat] = useState<TaskRecurrence>(task?.recurrence ?? 'none');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Give the task a title.');
      return;
    }
    const minutes = duration.trim() === '' ? undefined : Number(duration);
    if (minutes !== undefined && (!Number.isFinite(minutes) || minutes < 0)) {
      setError('Duration must be a number of minutes.');
      return;
    }
    const fields = {
      title: title.trim(),
      date: day,
      time: time || undefined,
      durationMin: minutes,
      notes: notes.trim() || undefined,
      experimentId: experimentId || undefined,
      recurrence: repeat,
    };
    setBusy(true);
    try {
      if (task) {
        await updateTask(task.id, fields);
      } else {
        await createTask({ ...fields, done: false });
      }
      onClose();
    } catch {
      setError('Could not save the task. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleDone() {
    if (!task) return;
    await setTaskDone(task.id, !task.done);
    onClose();
  }

  async function remove() {
    if (!task) return;
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    await deleteTask(task.id);
    onClose();
  }

  const isRecurring = (task?.recurrence ?? 'none') !== 'none';

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-dialog-title"
        className="flex max-h-dvh w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-2xl border border-border bg-page p-5 shadow-card sm:rounded-2xl"
      >
        <h2 id="task-dialog-title" className="text-xl font-semibold text-text">
          {task ? 'Edit task' : 'New task'}
        </h2>
        <form onSubmit={save} className="flex flex-col gap-4">
          <label className={LABEL}>
            Title
            <input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={LABEL}>
              Day
              <input type="date" className={INPUT} value={day} onChange={(e) => setDay(e.target.value)} />
            </label>
            <label className={LABEL}>
              Time (optional)
              <input type="time" className={INPUT} value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className={LABEL}>
              Duration (minutes)
              <input
                inputMode="numeric"
                className={INPUT}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className={LABEL}>
              Repeats
              <select className={INPUT} value={repeat} onChange={(e) => setRepeat(e.target.value as TaskRecurrence)}>
                {REPEATS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className={LABEL}>
            Link to an experiment (optional)
            <select className={INPUT} value={experimentId} onChange={(e) => setExperimentId(e.target.value)}>
              <option value="">None</option>
              {(experiments ?? []).map((ex: Experiment) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL}>
            Notes
            <textarea
              className="min-h-24 w-full rounded-xl border border-border bg-surface px-3 py-2 text-base text-text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm font-medium text-text">
              {error}
            </p>
          )}
          {task && isRecurring && (
            <p className="text-sm text-text-muted">
              This task repeats, so it cannot be checked off one day at a time. Change Repeats to stop it.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className={BTN_PRIMARY}>
              Save
            </button>
            <button type="button" onClick={onClose} className={BTN_SECONDARY}>
              Cancel
            </button>
            {task && !isRecurring && (
              <button type="button" onClick={toggleDone} className={BTN_SECONDARY}>
                {task.done ? 'Mark not done' : 'Mark done'}
              </button>
            )}
            {task && (
              <button type="button" onClick={remove} className={BTN_DANGER}>
                Delete
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
