import { askConfirm } from '../../app/feedback';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../../db';
import { deleteTemplate, listTemplates } from '../../db/templates';
import type { ProtocolTemplate } from '../../types';
import { formatDate } from '../../app/format';
import { StartExperimentForm } from './StartExperimentForm';
import { EmptyState } from '../../app/EmptyState';
import { useStarterLoader } from './StarterLoader';
import { ImportBenchflowButton } from '../share/ImportBenchflowButton';
import { PageHeader } from '../../app/ui';

const BUTTON_PRIMARY = 'btn btn-primary';
const BUTTON_SECONDARY = 'btn btn-secondary';
const INPUT =
'min-h-12 w-full rounded-xl border border-border bg-surface shadow-card px-3 text-base text-text';

export default function LibraryPage() {
  const templates = useLiveQuery(() => listTemplates(db), []);
  const [category, setCategory] = useState('');
  const starter = useStarterLoader();

  if (templates === undefined) return <main className="p-6 text-text-muted">Loading library…</main>;

  const categories = [...new Set(templates.map((t) => t.category))];
  // A filter for a category that no longer exists (its last template was deleted) shows everything.
  const active = categories.includes(category) ? category : '';
  const visible = templates.filter((t) => !active || t.category === active);
  const groups = categories
    .filter((c) => !active || c === active)
    .map((c) => ({ category: c, items: visible.filter((t) => t.category === c) }));

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-6 lg:max-w-5xl">
      <PageHeader
        title="Protocol Library"
        subtitle="Reusable protocols, grouped by category. Start a run from any of them."
        actions={
          <>
            <ImportBenchflowButton />
            <Link to="/library/new" className="btn btn-primary">
              New protocol
            </Link>
          </>
        }
      />

      {templates.length === 0 ? (
        <>
          <EmptyState
            title="No protocols yet"
            primary={{ label: starter.busy ? 'Loading…' : 'Load starter protocols', onClick: () => void starter.load() }}
            secondary={{ label: 'New protocol', to: '/library/new' }}
          >
            A protocol is a reusable, step-by-step procedure. Load the starter set for 15 common lab protocols and an example run, or paste
            the text of a manual or your notes, or upload a PDF, and it becomes steps with timers, reagents and cautions.
          </EmptyState>
          {starter.message && (
            <p role="status" className="text-slate-700 dark:text-slate-300">
              {starter.message}
            </p>
          )}
        </>
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
    const ok = await askConfirm({ title: `Delete the protocol “${template.title}”?`, message: 'Experiments started from it keep their own steps and records.', confirmLabel: 'Delete protocol', danger: true });
    if (ok) await deleteTemplate(template.id, db);
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-medium">{template.title}</h3>
        <span className="text-sm text-text-muted">
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
          <button type="button" className="btn btn-danger" onClick={() => void remove()}>
            Delete
          </button>
        </div>
      )}
    </li>
  );
}
