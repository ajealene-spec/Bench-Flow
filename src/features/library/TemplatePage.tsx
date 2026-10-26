import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db } from '../../db';
import { deleteTemplateWithUndo, getTemplate, listCategories, updateTemplate } from '../../db/templates';
import { askConfirm, notify } from '../../app/feedback';
import type { Hazard, MaterialItem, ProtocolOverview, ProtocolPhase, ProtocolTemplate, Step } from '../../types';
import { EMPTY_OVERVIEW, MaterialsCard, OverviewCard, TimelineCard } from '../plan/PlanCards';
import { prepareSteps, ReviewSection } from '../import/ImportPage';
import { ProtocolsIoExportButtons } from '../import/ProtocolsIoPanels';
import { LiteraturePrompt } from '../assist/LiteraturePrompt';
import { TemplateExtras } from '../share/TemplateExtras';
import { TemplateSourceEditor } from './TemplateSourceEditor';

const BUTTON_SECONDARY = 'btn btn-secondary';
const INPUT =
'min-h-12 w-full rounded-xl border border-border bg-surface shadow-card px-3 text-base text-text';

/** Edit one protocol template. Runs already started from it are not affected. */
export default function TemplatePage() {
  const { templateId = '' } = useParams();
  const template = useLiveQuery(() => getTemplate(templateId, db), [templateId]);
  const categories = useLiveQuery(() => listCategories(db), []);

  if (template === undefined) return <main className="p-6 text-text-muted">Loading protocol…</main>;
  if (template === null) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
        <Link to="/library" className="inline-flex min-h-12 w-fit items-center text-accent-text underline">
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
  const [overview, setOverview] = useState<ProtocolOverview>(template.overview ?? EMPTY_OVERVIEW);
  const [materials, setMaterials] = useState<MaterialItem[]>(template.materials ?? []);
  const [phases, setPhases] = useState<ProtocolPhase[]>(template.phases ?? []);
  const [notes, setNotes] = useState(template.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updateTemplate(
        template.id,
        { title, category, steps: prepareSteps(steps), hazards, notes, overview, materials, phases },
        db,
      );
      setSaved(true);
    } catch {
      setError('Could not save the protocol. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await askConfirm({ title: `Delete the protocol “${template.title}”?`, message: 'Experiments started from it keep their own steps and records.', confirmLabel: 'Delete protocol', danger: true });
    if (!ok) return;
    const undo = await deleteTemplateWithUndo(template.id, db);
    navigate('/library');
    notify(`Deleted “${template.title}”.`, { actionLabel: 'Undo', onAction: () => void undo() });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/library" className="inline-flex min-h-12 items-center text-accent-text underline">
          Back to library
        </Link>
        <button type="button" className={BUTTON_SECONDARY} onClick={() => void remove()}>
          Delete protocol
        </button>
      </header>

      <h1 className="t-h1">Edit protocol</h1>

      <div className="flex flex-wrap items-center gap-2">
        <ProtocolsIoExportButtons source={template} />
        <Link to="/library/new" className={BUTTON_SECONDARY}>
          Import from protocols.io
        </Link>
      </div>

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

      <OverviewCard
        value={overview}
        onChange={(next) => {
          setOverview(next);
          setSaved(false);
        }}
      />

      <MaterialsCard
        materials={materials}
        onChange={(next) => {
          setMaterials(next);
          setSaved(false);
        }}
      />

      <TimelineCard
        steps={steps}
        phases={phases}
        onChange={(next) => {
          setSteps(next.steps);
          setPhases(next.phases);
          setSaved(false);
        }}
      />

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

      <TemplateExtras template={template} />

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
          className="min-h-32 rounded-lg border border-border bg-surface shadow-card p-3"
        />
      </label>
      <TemplateSourceEditor template={template} />
    </main>
  );
}
