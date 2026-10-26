import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { listExecutionEvents } from '../../db/executionLog';
import { logStepNote } from './runEvents';

/**
 * Note for one step, saved to the execution log. The "deviation" toggle marks the note as something
 * that departed from the protocol, which the report can pick out.
 */
export function StepNote({ experimentId, stepId, large = false }: { experimentId: string; stepId: string; large?: boolean }) {
  const [text, setText] = useState('');
  const [deviation, setDeviation] = useState(false);
  const [message, setMessage] = useState('');
  const notes = useLiveQuery(
    async () =>
      (await listExecutionEvents(experimentId, db)).filter((e) => e.type === 'note' && e.stepId === stepId),
    [experimentId, stepId],
    [],
  );

  async function save() {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      await logStepNote(experimentId, stepId, trimmed, deviation, db);
      setText('');
      setDeviation(false);
      setMessage('Note saved.');
    } catch {
      setMessage('Could not save the note. Try again.');
    }
  }

  const control = large ? 'min-h-16 text-lg' : 'min-h-12 text-base';

  return (
    <section aria-label="Step note" className="flex flex-col gap-3 rounded-2xl border border-slate-300 p-4 dark:border-slate-700">
      <label htmlFor={`note-${stepId}`} className="text-lg font-semibold">
        Note for this step
      </label>
      <textarea
        id={`note-${stepId}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className={`w-full rounded-xl border border-slate-300 bg-white p-3 ${control} dark:border-slate-600 dark:bg-slate-900`}
      />
      <label className={`flex items-center gap-3 ${control}`}>
        <input
          type="checkbox"
          checked={deviation}
          onChange={(e) => setDeviation(e.target.checked)}
          className="h-6 w-6"
        />
        Mark as deviation from the protocol
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!text.trim()}
          className={`${large ? 'min-h-16' : 'min-h-12'} rounded-xl bg-accent px-5 font-semibold text-white disabled:opacity-40`}
        >
          Save note
        </button>
        {message && (
          <span role="status" className="text-base text-slate-600 dark:text-slate-400">
            {message}
          </span>
        )}
      </div>
      {notes.length > 0 && (
        <ul className="flex flex-col gap-2 text-base">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
              {n.deviation && <span className="mr-2 font-semibold">[Deviation]</span>}
              {n.note}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
