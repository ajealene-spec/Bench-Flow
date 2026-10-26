import { useState, type FormEvent } from 'react';
import { db } from '../../db';
import { createInventoryItem, updateInventoryItem, type InventoryInput } from '../../db/inventory';
import type { InventoryItem, InventoryKind } from '../../types';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, FIELD_INPUT } from '../data/fieldStyles';
import { RridField } from '../neuro/RridField';

const KINDS: Array<{ value: InventoryKind; label: string }> = [
  { value: 'antibody', label: 'Antibody' },
  { value: 'reagent', label: 'Reagent' },
  { value: 'buffer', label: 'Buffer' },
  { value: 'kit', label: 'Kit' },
];

const TEXT_FIELDS: Array<{ key: Exclude<keyof InventoryInput, 'kind' | 'reactivity'>; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'catalogNumber', label: 'Catalog number' },
  { key: 'lotNumber', label: 'Lot number' },
  { key: 'concentration', label: 'Concentration' },
  { key: 'stockDilution', label: 'Dilution (e.g. 1:1000)' },
  { key: 'hostSpecies', label: 'Host species' },
  { key: 'target', label: 'Target' },
  { key: 'conjugate', label: 'Conjugate' },
  { key: 'isotype', label: 'Isotype' },
  { key: 'expiresOn', label: 'Expiry date' },
  { key: 'location', label: 'Location' },
  { key: 'quantity', label: 'Quantity' },
];

type FormState = Record<string, string> & { kind: InventoryKind; reactivity: string };

function toFormState(item?: InventoryItem): FormState {
  const state: FormState = { kind: item?.kind ?? 'antibody', reactivity: item?.reactivity?.join(', ') ?? '' } as FormState;
  for (const { key } of TEXT_FIELDS) state[key] = (item?.[key] as string | undefined) ?? '';
  state.notes = item?.notes ?? '';
  state.rrid = item?.rrid ?? '';
  return state;
}

/** Add or edit one inventory item. Every input is at least 48px tall. */
export function InventoryForm({
  item,
  onDone,
}: {
  item?: InventoryItem;
  onDone: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => toFormState(item));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Enter a name.');
      return;
    }
    if (form.expiresOn && !/^\d{4}-\d{2}-\d{2}$/.test(form.expiresOn)) {
      setError('Expiry date must be a date.');
      return;
    }
    const input: InventoryInput = {
      name: form.name,
      kind: form.kind,
      vendor: form.vendor,
      catalogNumber: form.catalogNumber,
      lotNumber: form.lotNumber,
      concentration: form.concentration,
      stockDilution: form.stockDilution,
      hostSpecies: form.hostSpecies,
      target: form.target,
      conjugate: form.conjugate,
      isotype: form.isotype,
      reactivity: form.reactivity.split(',').map((r) => r.trim()).filter(Boolean),
      expiresOn: form.expiresOn,
      location: form.location,
      quantity: form.quantity,
      notes: form.notes,
      rrid: form.rrid,
    };
    setSaving(true);
    try {
      if (item) await updateInventoryItem(item.id, input, db);
      else await createInventoryItem(input, db);
      onDone();
    } catch {
      setError('Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label={item ?'Edit inventory item' :'Add inventory item'} className="flex flex-col gap-4 rounded-2xl border border-border p-4">
      <h2 className="text-xl font-semibold">{item ? 'Edit item' : 'Add item'}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-base font-medium">
          Kind
          <select className={FIELD_INPUT} value={form.kind} onChange={(e) => set('kind', e.target.value)}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        {TEXT_FIELDS.map(({ key, label }) => (
          <label key={key} className="flex flex-col gap-1 text-base font-medium">
            {label}
            <input
              className={FIELD_INPUT}
              type={key === 'expiresOn' ? 'date' : 'text'}
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              required={key === 'name'}
            />
          </label>
        ))}
        <label className="flex flex-col gap-1 text-base font-medium md:col-span-2">
          Reactive with (comma separated)
          <input className={FIELD_INPUT} value={form.reactivity} onChange={(e) => set('reactivity', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-base font-medium md:col-span-2">
          Notes
          <textarea
            className={`${FIELD_INPUT} min-h-24 py-2`}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </label>
      </div>
      <RridField id="inventory-rrid" searchName={form.name} value={form.rrid} onChange={(r) => set('rrid', r)} />
      {error && (
        <p role="alert" className="text-base text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={saving} className={BUTTON_PRIMARY}>
          Save
        </button>
        <button type="button" onClick={onDone} className={BUTTON_SECONDARY}>
          Cancel
        </button>
      </div>
    </form>
  );
}
