import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db } from '../../db';
import { deleteTemplate, getTemplate, listCategories, updateTemplate } from '../../db/templates';
import type { Hazard, ProtocolTemplate, Step } from '../../types';
import { prepareSteps, ReviewSection } from '../import/ImportPage';
import { LiteraturePrompt } from '../assist/LiteraturePrompt';

const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-medium';
const BUTTON_SECONDARY = `${BUTTON} border border-slate-300 bg-white text-slate-900 active:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100`;
const INPUT =
  'min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

/** Edit one protocol template. Runs already started from it are not affected. */
export default function TemplatePage() {
  const { templateId = '' } = useParams();
  const template = useLiveQuery(() => getTemplate(templateId, db), [templateId]);
  const categories = useLiveQuery(() => listCategories(db), []);

  if (template === undefined) return <main className="p-6 text-slate-500">Loading protocol…</main>;
  if (template === null) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
        <Link to="/library" className="inline-flex min-h-12 w-fit items-center text-teal-700 underline dark:text-teal-300">
          Back to library
        </Link>
        <h1 className="text-2xl font-semibold">Protocol not found</h1>
      </main>
    );
  }
  return <TemplateEditor key={template.id} template={template} categories={categories ?? []} />;
}

function TemplateEditor({ template, categories }: { template: ProtocolTemplate; categories: string[] }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(template.title);
  const [category, setCategory] = useState(template.category);
  const [steps, setSteps] = useState<Step[]>(template.steps);
  const [hazards, setHazards] = useState<Hazard[]>(template.hazards ?? []);
  const [notes, setNotes] = useState(template.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updateTemplate(template.id, { title, category, steps: prepareSteps(steps), hazards, notes }, db);
      setSaved(true);
    } catch {
      setError('Could not save the protocol. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = window.confirm(
      `Delete the protocol “${template.title}”? Experiments started from it keep their own steps and records.`,
    );
    if (!ok) return;
    await deleteTemplate(template.id, db);
    navigate('/library');
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/library" className="inline-flex min-h-12 items-center text-teal-700 underline dark:text-teal-300">
          Back to library
        </Link>
        <button type="button" className={BUTTON_SECONDARY} onClick={() => void remove()}>
          Delete protocol
        </button>
      </header>

      <h1 className="text-2xl font-semibold">Edit protocol</h1>

      {error && (
        <p role="alert" className="rounded-xl bg-rose-100 p-3 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100">
          {error}
        </p>
      )}

      <label className="flex flex-col gap-1">
        <span className="font-medium">Category</span>
        <input
          type="text"
          list="template-categories"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setSaved(false);
          }}
          placeholder="Uncategorized"
          className={INPUT}
        />
        <datalist id="template-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>

      <ReviewSection
        title={title}
        steps={steps}
        hazards={hazards}
        onHazardsChange={setHazards}
        busy={busy}
        saveLabel="Save changes"
        titleLabel="Protocol title"
        statusNote={saved ? 'Saved. Experiments already started from this protocol are unchanged.' : undefined}
        onTitle={(next) => {
          setTitle(next);
          setSaved(false);
        }}
        onStepsChange={(next) => {
          setSteps(next);
          setSaved(false);
        }}
        onSave={() => void save()}
      />

      <LiteraturePrompt
        templateId={template.id}
        onAddNote={(text) => {
          // Suggestions are saved as notes only; steps never change without the user editing them.
          const next = notes ? `${notes}\n\n${text}` : text;
          setNotes(next);
          void updateTemplate(template.id, { notes: next }, db);
        }}
      />

      <label className="flex flex-col gap-2">
        <span className="font-medium">Protocol notes</span>
        <textarea
          value={notes}
          rows={5}
          onChange={(e) => {
            setNotes(e.target.value);
            setSaved(false);
          }}
          onBlur={() => void updateTemplate(template.id, { notes }, db)}
          className="min-h-32 rounded-lg border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-900"
        />
      </label>
    </main>
  );
}
