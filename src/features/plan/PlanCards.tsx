import { useState, type ChangeEvent } from 'react';
import type { MaterialItem, MaterialKind, ProtocolOverview, ProtocolPhase, Step } from '../../types';

/*
 * Plan cards shown above the steps on the template page and the experiment page. The same cards are
 * used for editing (template) and for bench checks (experiment). Cards are bordered, not filled.
 */

const CARD = 'flex flex-col gap-4 rounded-xl border border-slate-300 bg-white p-4 sm:p-5';
const INPUT = 'min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900';
const TEXTAREA = 'min-h-24 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900';
const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-medium';
const BUTTON_SECONDARY = `${BUTTON} border border-slate-300 bg-white text-slate-900 active:bg-slate-100`;
const HEADING = 'text-lg font-semibold text-slate-900';
const LABEL = 'text-sm font-medium text-slate-700';

export const EMPTY_OVERVIEW: ProtocolOverview = { objective: '', totalTime: '', outputs: '' };

const KIND_LABEL: Record<MaterialKind, string> = {
  consumable: 'Consumable',
  solution: 'Solution',
  equipment: 'Equipment',
};

// ---------- Overview ----------

export function OverviewCard({
  value,
  onChange,
  onBlur,
}: {
  value: ProtocolOverview;
  onChange: (next: ProtocolOverview) => void;
  onBlur?: () => void;
}) {
  const fieldProps = (key: keyof ProtocolOverview) => ({
    value: value[key],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [key]: e.target.value }),
    onBlur,
  });

  return (
    <section aria-label="Protocol overview" className={CARD}>
      <h2 className={HEADING}>Protocol overview</h2>
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Objective</span>
        <textarea rows={2} className={TEXTAREA} placeholder="What this protocol establishes" {...fieldProps('objective')} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Total time</span>
          <input type="text" className={INPUT} placeholder="e.g. 2 days" {...fieldProps('totalTime')} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Expected outputs</span>
          <input type="text" className={INPUT} placeholder="e.g. Blot image, densitometry" {...fieldProps('outputs')} />
        </label>
      </div>
    </section>
  );
}

// ---------- Materials ----------

/**
 * Edit mode (template): pass onChange. Check mode (experiment): pass checked and onToggle, and the
 * card shows a bench-readiness checklist with progress.
 */
export function MaterialsCard({
  materials,
  onChange,
  checked,
  onToggle,
}: {
  materials: MaterialItem[];
  onChange?: (next: MaterialItem[]) => void;
  checked?: string[];
  onToggle?: (id: string, on: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<MaterialKind>('consumable');
  const checkMode = checked !== undefined;
  const readyCount = checked ? materials.filter((m) => checked.includes(m.id)).length : 0;
  const percent = materials.length ? Math.round((readyCount / materials.length) * 100) : 0;

  function add() {
    const trimmed = name.trim();
    if (!trimmed || !onChange) return;
    onChange([...materials, { id: crypto.randomUUID(), name: trimmed, kind }]);
    setName('');
  }

  return (
    <section aria-label="Materials and equipment" className={CARD}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={HEADING}>Materials &amp; equipment</h2>
        {checkMode && (
          <span className="text-sm text-slate-600">
            {readyCount} of {materials.length} ready
          </span>
        )}
      </div>

      {checkMode && (
        <div role="progressbar" aria-label="Bench readiness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-2 rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      )}

      {materials.length === 0 ? (
        <p className="text-sm text-slate-600">No materials listed yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-200 rounded-xl border border-slate-200">
          {materials.map((m) => (
            <li key={m.id} className="flex min-h-12 items-center gap-3 px-3">
              {checkMode ? (
                <label className="flex min-h-12 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-6 w-6 shrink-0 accent-accent"
                    checked={checked.includes(m.id)}
                    onChange={(e) => onToggle?.(m.id, e.target.checked)}
                  />
                  <span className={`flex-1 ${checked.includes(m.id) ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{m.name}</span>
                  <span className="text-sm text-slate-600">{KIND_LABEL[m.kind]}</span>
                </label>
              ) : (
                <>
                  <span className="flex-1 py-2 text-slate-900">{m.name}</span>
                  <span className="text-sm text-slate-600">{KIND_LABEL[m.kind]}</span>
                  <button
                    type="button"
                    className={BUTTON_SECONDARY}
                    onClick={() => onChange?.(materials.filter((x) => x.id !== m.id))}
                  >
                    Remove
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {!checkMode && onChange && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label className="flex flex-1 flex-col gap-1">
            <span className="sr-only">Material name</span>
            <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a material or equipment" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="sr-only">Kind</span>
            <select className={INPUT} value={kind} onChange={(e) => setKind(e.target.value as MaterialKind)}>
              <option value="consumable">Consumable</option>
              <option value="solution">Solution</option>
              <option value="equipment">Equipment</option>
            </select>
          </label>
          <button type="submit" className={BUTTON_SECONDARY}>
            Add
          </button>
        </form>
      )}
    </section>
  );
}

// ---------- Timeline ----------

export interface TimelineChange {
  phases: ProtocolPhase[];
  steps: Step[];
}

/** Phases with their steps grouped under them. Steps outside any phase are listed first. */
export function TimelineCard({
  steps,
  phases,
  onChange,
}: {
  steps: Step[];
  phases: ProtocolPhase[];
  onChange: (next: TimelineChange) => void;
}) {
  const [phaseName, setPhaseName] = useState('');
  const phaseIds = new Set(phases.map((p) => p.id));
  const unassigned = steps.map((s, i) => ({ step: s, index: i })).filter(({ step }) => !step.phaseId || !phaseIds.has(step.phaseId));

  function addPhase() {
    const trimmed = phaseName.trim();
    if (!trimmed) return;
    onChange({ phases: [...phases, { id: crypto.randomUUID(), name: trimmed }], steps });
    setPhaseName('');
  }

  function renamePhase(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    onChange({ phases: phases.map((p) => (p.id === id ? { ...p, name: trimmed } : p)), steps });
  }

  function removePhase(id: string) {
    onChange({
      phases: phases.filter((p) => p.id !== id),
      steps: steps.map((s) => (s.phaseId === id ? { ...s, phaseId: undefined } : s)),
    });
  }

  function assign(stepId: string, phaseId: string) {
    onChange({
      phases,
      steps: steps.map((s) => (s.id === stepId ? { ...s, phaseId: phaseId || undefined } : s)),
    });
  }

  return (
    <section aria-label="Timeline" className={CARD}>
      <h2 className={HEADING}>Timeline</h2>
      {phases.length === 0 && (
        <p className="text-sm text-slate-600">No phases yet. Add phases such as Day 1 or Transfer to group the steps.</p>
      )}

      {phases.map((phase) => {
        const inPhase = steps.map((s, i) => ({ step: s, index: i })).filter(({ step }) => step.phaseId === phase.id);
        return (
          <div key={phase.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <PhaseNameField name={phase.name} onCommit={(name) => renamePhase(phase.id, name)} />
              <button type="button" className={BUTTON_SECONDARY} onClick={() => removePhase(phase.id)}>
                Remove phase
              </button>
            </div>
            <StepList items={inPhase} phases={phases} onAssign={assign} />
          </div>
        );
      })}

      {unassigned.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-600">{phases.length > 0 ? 'Not in a phase' : 'Steps'}</span>
          <StepList items={unassigned} phases={phases} onAssign={assign} />
        </div>
      )}

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          addPhase();
        }}
      >
        <label className="flex flex-1 flex-col gap-1">
          <span className="sr-only">Phase name</span>
          <input className={INPUT} value={phaseName} onChange={(e) => setPhaseName(e.target.value)} placeholder="New phase, e.g. Day 2" />
        </label>
        <button type="submit" className={BUTTON_SECONDARY}>
          Add phase
        </button>
      </form>
    </section>
  );
}

function PhaseNameField({ name, onCommit }: { name: string; onCommit: (name: string) => void }) {
  const [draft, setDraft] = useState(name);
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="sr-only">Phase name</span>
      <input
        className={`${INPUT} font-medium`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim() && draft !== name) onCommit(draft);
          else setDraft(name);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}

function StepList({
  items,
  phases,
  onAssign,
}: {
  items: Array<{ step: Step; index: number }>;
  phases: ProtocolPhase[];
  onAssign: (stepId: string, phaseId: string) => void;
}) {
  if (items.length === 0) return <p className="text-sm text-slate-600">No steps in this phase yet.</p>;
  return (
    <ol className="flex flex-col gap-2">
      {items.map(({ step, index }) => (
        <li key={step.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <span className="min-w-0 flex-1 text-slate-900">
            {index + 1}. {step.title || 'Untitled step'}
          </span>
          <label className="flex items-center gap-2">
            <span className="sr-only">Phase for step {index + 1}</span>
            <select
              className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900"
              value={step.phaseId && phases.some((p) => p.id === step.phaseId) ? step.phaseId : ''}
              onChange={(e) => onAssign(step.id, e.target.value)}
            >
              <option value="">No phase</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </li>
      ))}
    </ol>
  );
}
