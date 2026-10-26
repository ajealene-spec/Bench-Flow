import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../../db';
import type { Experiment } from '../../types';
import { defaultRepeatTitle, repeatExperiment } from './repeatRun';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT, LABEL } from './styles';

/** "Run again": starts a new run from this run's procedure snapshot, with a title and a copy-values choice. */
export function RunAgainPanel({ experiment }: { experiment: Pick<Experiment, 'id' | 'name'> }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [copyValues, setCopyValues] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setOpen((o) => !o);
    setTitle(defaultRepeatTitle(experiment.name));
    setCopyValues(true);
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const created = await repeatExperiment(experiment.id, { title, copyValues }, db);
      navigate(`/experiment/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the repeat. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button type="button" className={BUTTON_SECONDARY} aria-expanded={open} onClick={toggle}>
        Run again
      </button>
      {open && (
        <form
          aria-label="Run again"
          className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="text-sm text-text-muted">
            Makes a new run from the same protocol, folder, tags, materials and lot links. Progress, timers,
            records and events start fresh.
          </p>
          <label className={LABEL}>
            Title
            <input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </label>
          <label className="flex min-h-12 items-center gap-3 text-base text-text">
            <input
              type="checkbox"
              className="size-6 accent-accent"
              checked={copyValues}
              onChange={(e) => setCopyValues(e.target.checked)}
            />
            Copy the values I entered as defaults
          </label>
          {error && (
            <p role="alert" className="text-rose-700 dark:text-rose-300">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={BUTTON_PRIMARY} disabled={busy}>
              {busy ? 'Creating…' : 'Create repeat'}
            </button>
            <button type="button" className={BUTTON_SECONDARY} onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** "Repeat of …" with a link to the source run. Shows a plain note when the source has been deleted. */
export function RepeatOfNote({ duplicatedFrom }: { duplicatedFrom: string }) {
  const source = useLiveQuery(async () => ({ experiment: await db.experiments.get(duplicatedFrom) }), [duplicatedFrom]);
  if (source === undefined) return null;
  if (!source.experiment) {
    return <p className="text-sm text-text-muted">Repeat of a run that has been deleted.</p>;
  }
  return (
    <p className="text-sm text-text-muted">
      Repeat of{' '}
      <Link to={`/experiment/${source.experiment.id}`} className="font-medium text-accent-text underline">
        {source.experiment.name}
      </Link>
    </p>
  );
}
