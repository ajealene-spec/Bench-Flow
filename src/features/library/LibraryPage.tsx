import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../../db';
import { deleteTemplate, listTemplates } from '../../db/templates';
import type { ProtocolTemplate } from '../../types';
import { formatDate } from '../../app/format';
import { StartExperimentForm } from './StartExperimentForm';
import { EmptyState } from '../../app/EmptyState';

const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-medium';
const BUTTON_PRIMARY = `${BUTTON} bg-accent text-white active:bg-accent-hover`;
const BUTTON_SECONDARY = `${BUTTON} border border-slate-300 bg-white text-slate-900 active:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100`;
const INPUT =
  'min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

export default function LibraryPage() {
  const templates = useLiveQuery(() => listTemplates(db), []);
  const [category, setCategory] = useState('');

  if (templates === undefined) return <main className="p-6 text-slate-500">Loading library…</main>;

  const categories = [...new Set(templates.map((t) => t.category))];
  // A filter for a category that no longer exists (its last template was deleted) shows everything.
  const active = categories.includes(category) ? category : '';
  const visible = templates.filter((t) => !active || t.category === active);
  const groups = categories
    .filter((c) => !active || c === active)
    .map((c) => ({ category: c, items: visible.filter((t) => t.category === c) }));

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-6 lg:max-w-5xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm text-slate-500 dark:text-slate-400">Lab Companion</span>
          <h1 className="text-2xl font-semibold">Protocol Library</h1>
        </div>
        <Link to="/library/new" className={BUTTON_PRIMARY}>
          New protocol
        </Link>
      </header>

      {templates.length === 0 ? (
        <EmptyState title="No protocols yet" primary={{ label: 'New protocol', to: '/library/new' }} secondary={{ label: 'Go to Home', to: '/' }}>
          A protocol is a reusable, step-by-step procedure. Paste the text of a manual or your notes, or upload a PDF, and it becomes steps
          with timers, reagents and cautions.
        </EmptyState>
      ) : (
        <>
          <label className="flex flex-col gap-1 sm:max-w-xs">
            <span className="font-medium">Category</span>
            <select className={INPUT} value={active} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          {groups.map((group) => (
            <section key={group.category} aria-label={group.category} className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">{group.category}</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {group.items.map((template) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </main>
  );
}

function TemplateCard({ template }: { template: ProtocolTemplate }) {
  const [starting, setStarting] = useState(false);

  async function remove() {
    const ok = window.confirm(
      `Delete the protocol “${template.title}”? Experiments started from it keep their own steps and records.`,
    );
    if (ok) await deleteTemplate(template.id, db);
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-slate-300 p-4 dark:border-slate-700">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-medium">{template.title}</h3>
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {template.steps.length} step{template.steps.length === 1 ? '' : 's'} · Updated {formatDate(template.updatedAt)}
        </span>
      </div>

      {starting ? (
        <StartExperimentForm template={template} onDone={() => setStarting(false)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BUTTON_PRIMARY} onClick={() => setStarting(true)}>
            Start experiment
          </button>
          <Link to={`/library/${template.id}`} className={BUTTON_SECONDARY}>
            Edit
          </Link>
          <button type="button" className={BUTTON_SECONDARY} onClick={() => void remove()}>
            Delete
          </button>
        </div>
      )}
    </li>
  );
}
