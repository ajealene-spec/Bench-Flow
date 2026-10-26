import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startExperimentFromTemplate } from '../../db/helpers';
import type { ProtocolTemplate } from '../../types';

const INPUT =
  'min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';
const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl px-5 font-medium';

/** Asks for a run title, then starts an experiment from the template and opens its run page. */
export function StartExperimentForm({ template, onDone }: { template: ProtocolTemplate; onDone: () => void }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(() => `${template.title} – ${new Date().toLocaleDateString()}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const experiment = await startExperimentFromTemplate(template.id, title);
      navigate(`/experiment/${experiment.id}/run`);
    } catch {
      setError('Could not start the experiment. Please try again.');
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-slate-300 p-4 dark:border-slate-700"
      onSubmit={(e) => {
        e.preventDefault();
        void start();
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Run title</span>
        <input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>
      {error && <p role="alert" className="text-rose-700 dark:text-rose-300">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={`${BUTTON} bg-accent text-white active:bg-accent-hover disabled:opacity-50`}>
          {busy ? 'Starting…' : 'Start run'}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={busy}
          className={`${BUTTON} border border-slate-300 bg-white text-slate-900 active:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100`}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
