import { askConfirm } from '../../app/feedback';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { deleteStereotaxTarget, listStereotaxTargets, putStereotaxTarget } from '../../db/stereotaxTargets';
import type { StereotaxTarget } from '../../types';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, FIELD_INPUT } from '../data/fieldStyles';
import { NumField, readNum } from './NumField';
import { BrainAtlasPreview } from './BrainAtlasPreview';
import { ATLAS_BREGMA_LAMBDA_MM, angledApproach, formatCoordinate, scaleAp, skullScale, StereotaxError } from './stereotax';

interface Form {
  name: string;
  atlas: string;
  ap: string;
  ml: string;
  dv: string;
  angle: string;
  notes: string;
  measured: string;
}

const EMPTY: Form = { name: '', atlas: 'Paxinos mouse', ap: '', ml: '', dv: '', angle: '0', notes: '', measured: String(ATLAS_BREGMA_LAMBDA_MM) };

function fromTarget(t: StereotaxTarget): Form {
  return { name: t.name, atlas: t.atlas, ap: String(t.ap), ml: String(t.ml), dv: String(t.dv), angle: String(t.angle ?? 0), notes: t.notes ?? '', measured: String(ATLAS_BREGMA_LAMBDA_MM) };
}

/** Stereotaxic helper: skull scaling, angled approach, saved targets and a printable card. */
export function StereotaxTool() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [printId, setPrintId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const targets = useLiveQuery(() => listStereotaxTargets(db), []) ?? [];
  const set = (key: keyof Form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  let result: { scale: number; ap?: number; entryMl?: number; insertionDepth?: number; mlShift?: number } | null = null;
  let problem: string | null = null;
  try {
    const measured = readNum(form.measured);
    const scale = measured === undefined ? 1 : skullScale(measured);
    const ap = readNum(form.ap);
    const ml = readNum(form.ml);
    const dv = readNum(form.dv);
    const angle = readNum(form.angle) ?? 0;
    result = { scale };
    if (ap !== undefined) result.ap = scaleAp(ap, measured ?? ATLAS_BREGMA_LAMBDA_MM).ap;
    if (ml !== undefined && dv !== undefined) {
      const a = angledApproach(ml, dv, angle);
      result.entryMl = a.entryMl;
      result.insertionDepth = a.insertionDepth;
      result.mlShift = a.mlShift;
    }
  } catch (e) {
    problem = e instanceof StereotaxError ? e.message : 'Check the numbers.';
  }

  async function save() {
    const ap = readNum(form.ap);
    const ml = readNum(form.ml);
    const dv = readNum(form.dv);
    if (!form.name.trim() || ap === undefined || ml === undefined || dv === undefined) {
      setMessage('Name and the AP, ML and DV values are needed to save.');
      return;
    }
    const target: StereotaxTarget = {
      id: editingId ?? crypto.randomUUID(),
      name: form.name.trim(),
      atlas: form.atlas.trim() || 'Atlas',
      ap,
      ml,
      dv,
      angle: readNum(form.angle) ?? 0,
      notes: form.notes.trim() || undefined,
    };
    await putStereotaxTarget(target, db);
    setEditingId(target.id);
    setMessage(`Saved ${target.name}.`);
  }

  async function remove(t: StereotaxTarget) {
    if (!await askConfirm({ title: `Delete the saved target “${t.name}”?`, confirmLabel: 'Delete', danger: true })) return;
    await deleteStereotaxTarget(t.id, db);
    if (editingId === t.id) setEditingId(null);
    if (printId === t.id) setPrintId(null);
  }

  const printed = targets.find((t) => t.id === printId);

  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-xl font-semibold">Stereotaxic helper</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <NumField id="st-measured" label="Measured bregma–lambda" unit="mm" value={form.measured} onChange={(v) => set('measured', v)} />
        <NumField id="st-ap" label="Atlas AP (from bregma)" unit="mm" value={form.ap} onChange={(v) => set('ap', v)} />
        <NumField id="st-ml" label="ML" unit="mm" value={form.ml} onChange={(v) => set('ml', v)} />
        <NumField id="st-dv" label="DV depth" unit="mm" value={form.dv} onChange={(v) => set('dv', v)} />
        <NumField id="st-angle" label="Approach angle from vertical" unit="°" value={form.angle} onChange={(v) => set('angle', v)} />
      </div>
      {problem && <p role="alert" className="text-base text-red-700 dark:text-red-300">{problem}</p>}
      <BrainAtlasPreview
        ap={readNum(form.ap)}
        ml={readNum(form.ml)}
        dv={readNum(form.dv)}
        angleDeg={readNum(form.angle) ?? 0}
        scaledAp={result?.ap}
        bregmaLambdaMm={readNum(form.measured)}
      />
      {result && !problem && (
        <ul aria-label="Stereotaxic results" className="flex flex-col gap-2 rounded-xl border border-border p-4 text-lg">
          <li>Skull scale: {result.scale.toFixed(3)} × atlas</li>
          {result.ap !== undefined && <li>Scaled AP: {formatCoordinate('AP', result.ap)}</li>}
          {result.entryMl !== undefined && <li>Skull entry ML: {formatCoordinate('ML', result.entryMl)} (shift {result.mlShift?.toFixed(2)} mm)</li>}
          {result.insertionDepth !== undefined && <li>Insertion along the tilted axis: {result.insertionDepth.toFixed(2)} mm</li>}
        </ul>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-border p-4">
        <h4 className="text-lg font-semibold">{editingId ? 'Edit saved target' : 'New saved target'}</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-base font-medium">
            Name
            <input className={FIELD_INPUT} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-base font-medium">
            Atlas
            <input className={FIELD_INPUT} value={form.atlas} onChange={(e) => set('atlas', e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-base font-medium md:col-span-2">
            Notes
            <input className={FIELD_INPUT} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={BUTTON_PRIMARY} onClick={() => void save()}>
            Save target
          </button>
          <button
            type="button"
            className={BUTTON_SECONDARY}
            onClick={() => {
              setForm(EMPTY);
              setEditingId(null);
              setMessage(null);
            }}
          >
            New
          </button>
        </div>
        {message && <p role="status" className="text-base">{message}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-lg font-semibold">Saved targets</h4>
        {targets.length === 0 && <p className="text-base text-text-muted">No saved targets yet.</p>}
        <ul className="flex flex-col gap-2">
          {targets.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3">
              <span className="mr-auto text-base">
                <strong>{t.name}</strong> · AP {t.ap} · ML {t.ml} · DV {t.dv}
                {t.angle ? ` · ${t.angle}°` : ''}
              </span>
              <button type="button" className={BUTTON_SECONDARY} onClick={() => { setForm(fromTarget(t)); setEditingId(t.id); }}>
                Edit
              </button>
              <button type="button" className={BUTTON_SECONDARY} onClick={() => setPrintId(t.id)}>
                Target card
              </button>
              <button type="button" className={BUTTON_SECONDARY} onClick={() => void remove(t)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>

      {printed && (
        <div>
          <button type="button" className={BUTTON_PRIMARY} onClick={() => window.print()}>
            Print target card
          </button>
        </div>
      )}
      {printed && (
        <section aria-label="Printable target card" className="target-card hidden rounded-xl border-2 border-black p-6 text-text print:block">
          <h2 className="text-2xl font-bold">{printed.name}</h2>
          <p className="text-lg">Atlas: {printed.atlas}</p>
          <p className="text-lg">
            {formatCoordinate('AP', printed.ap)} · {formatCoordinate('ML', printed.ml)} · {formatCoordinate('DV', printed.dv)}
          </p>
          <p className="text-lg">Approach angle: {printed.angle ?? 0}°</p>
          {printed.notes && <p className="text-lg">Notes: {printed.notes}</p>}
          <p className="mt-6 text-sm">Measured bregma–lambda: ____ mm · Scaled AP: ____ mm · Initials: ____</p>
        </section>
      )}
    </div>
  );
}
