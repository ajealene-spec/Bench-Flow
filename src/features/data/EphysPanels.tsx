import { askConfirm } from '../../app/feedback';
import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { deleteEphysRecord, listEphysRecords, putEphysRecord } from '../../db/ephysRecords';
import { newId } from '../../db/helpers';
import type { EphysRecord } from '../../types';
import { BUTTON_LINK, BUTTON_PRIMARY, BUTTON_SECONDARY, FIELD_INPUT } from './fieldStyles';
import { parseNumber } from './parseNumbers';
import { downloadText, slug } from './download';
import { ephysCsv, flagEphysRecords, RA_LIMIT_MOHM, RA_CHANGE_LIMIT } from './ephysMath';

const TIME = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

interface Draft {
  cellId: string;
  Rm: string;
  Ra: string;
  Cm: string;
  holding: string;
  notes: string;
}

const EMPTY_DRAFT: Draft = { cellId: '', Rm: '', Ra: '', Cm: '', holding: '', notes: '' };

/** Quick per-cell entry for patch-clamp records. Shows the Ra quality flag before saving. */
export function EphysQuickForm({ experimentId, stepId }: { experimentId: string; stepId?: string }) {
  const records = useLiveQuery(() => listEphysRecords(experimentId, db), [experimentId], []);
  const [draft, setDraft] = useState<Draft>(() => ({ ...EMPTY_DRAFT }));
  const [error, setError] = useState<string | undefined>(undefined);

  const previousCell = records.length > 0 ? records[records.length - 1].cellId : '';
  const cellId = draft.cellId || '';

  const numbers = {
    Rm: parseNumber(draft.Rm),
    Ra: parseNumber(draft.Ra),
    Cm: parseNumber(draft.Cm),
    holding: parseNumber(draft.holding),
  };
  const preview: EphysRecord | undefined =
    numbers.Ra !== undefined && numbers.Rm !== undefined && numbers.Cm !== undefined && numbers.holding !== undefined && cellId
      ? { id: 'preview', experimentId, cellId, Rm: numbers.Rm, Ra: numbers.Ra, Cm: numbers.Cm, holding: numbers.holding, at: Date.now() }
      : undefined;
  const previewFlags = preview ? flagEphysRecords([...records, preview]).get('preview') ?? [] : [];

  async function save() {
    const cell = (cellId || previousCell).trim();
    if (!cell) return setError('Enter a cell ID.');
    if (numbers.Rm === undefined || numbers.Ra === undefined || numbers.Cm === undefined || numbers.holding === undefined) {
      return setError('Rm, Ra, Cm and holding current need numbers.');
    }
    setError(undefined);
    await putEphysRecord(
      {
        id: newId(),
        experimentId,
        stepId,
        cellId: cell,
        Rm: numbers.Rm,
        Ra: numbers.Ra,
        Cm: numbers.Cm,
        holding: numbers.holding,
        notes: draft.notes.trim() || undefined,
        at: Date.now(),
      },
      db,
    );
    // Keep the cell ID for the next cell in the same recording session.
    setDraft({ ...EMPTY_DRAFT, cellId: cell });
  }

  return (
    <form
      aria-label="Patch clamp record"
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Patch clamp</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Cell ID">
          <input className={FIELD_INPUT} value={draft.cellId} placeholder={previousCell || 'e.g. c01'} onChange={(e) => setDraft({ ...draft, cellId: e.target.value })} />
        </Field>
        <Field label="Holding current (mV)">
          <input className={FIELD_INPUT} inputMode="decimal" value={draft.holding} onChange={(e) => setDraft({ ...draft, holding: e.target.value })} />
        </Field>
        <Field label="Rm (MΩ)">
          <input className={FIELD_INPUT} inputMode="decimal" value={draft.Rm} onChange={(e) => setDraft({ ...draft, Rm: e.target.value })} />
        </Field>
        <Field label="Ra (MΩ)">
          <input className={FIELD_INPUT} inputMode="decimal" value={draft.Ra} onChange={(e) => setDraft({ ...draft, Ra: e.target.value })} />
        </Field>
        <Field label="Cm (pF)">
          <input className={FIELD_INPUT} inputMode="decimal" value={draft.Cm} onChange={(e) => setDraft({ ...draft, Cm: e.target.value })} />
        </Field>
        <Field label="Notes">
          <input className={FIELD_INPUT} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </Field>
      </div>
      {previewFlags.length > 0 && (
        <ul role="status" className="flex flex-col gap-1 rounded-xl border border-amber-400 bg-amber-50 p-3 text-base text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {previewFlags.map((f) => (
            <li key={f.message}>Quality warning: {f.message}</li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-base text-rose-700 dark:text-rose-300">{error}</p>}
      <button type="submit" className={`${BUTTON_PRIMARY} w-full sm:w-fit`}>
        Save cell record
      </button>
    </form>
  );
}

/** Table of every patch-clamp record for a run, with quality flags and CSV export. */
export function EphysTable({ experimentId, experimentName = 'run' }: { experimentId: string; experimentName?: string }) {
  const records = useLiveQuery(() => listEphysRecords(experimentId, db), [experimentId], []);
  const flags = flagEphysRecords(records);
  const flagged = records.filter((r) => flags.has(r.id)).length;

  if (records.length === 0) {
    return <p className="text-base text-text-muted">No patch-clamp records yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-base text-text-muted">
          {records.length} {records.length === 1 ? 'cell' : 'cells'}
          {flagged > 0 ? `, ${flagged} with warnings` : ''}
        </span>
        <button
          type="button"
          className={BUTTON_SECONDARY}
          onClick={() => downloadText(`${slug(experimentName)}-ephys.csv`, ephysCsv(records))}
        >
          Export CSV
        </button>
      </div>
      <p className="text-sm text-text-muted">
        Warnings: Ra above {RA_LIMIT_MOHM} MΩ, or a change of more than {Math.round(RA_CHANGE_LIMIT * 100)}% from the previous record of the same cell.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left text-base">
          <thead>
            <tr className="border-b border-border">
              <th className="px-2 py-2">Cell</th>
              <th className="px-2 py-2">Time</th>
              <th className="px-2 py-2 text-right">Rm</th>
              <th className="px-2 py-2 text-right">Ra</th>
              <th className="px-2 py-2 text-right">Cm</th>
              <th className="px-2 py-2 text-right">Hold</th>
              <th className="px-2 py-2">Notes / flags</th>
              <th className="px-2 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {[...records].sort((a, b) => a.at - b.at).map((r) => {
              const rowFlags = flags.get(r.id) ?? [];
              return (
                <tr key={r.id} className={`border-b border-border align-top  ${rowFlags.length ?'bg-amber-50 dark:bg-amber-950/40' :''}`}>
                  <td className="px-2 py-3 font-medium">{r.cellId}</td>
                  <td className="px-2 py-3">{TIME.format(r.at)}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{r.Rm}</td>
                  <td className={`px-2 py-3 text-right tabular-nums ${rowFlags.some((f) => f.kind === 'ra_high') ? 'font-semibold text-rose-700 dark:text-rose-300' : ''}`}>{r.Ra}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{r.Cm}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{r.holding}</td>
                  <td className="px-2 py-3">
                    {r.notes && <div>{r.notes}</div>}
                    {rowFlags.map((f) => (
                      <div key={f.message} className="text-sm text-amber-800 dark:text-amber-200">Warning: {f.message}</div>
                    ))}
                  </td>
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      className={BUTTON_LINK}
                      onClick={async () => {
                        if (await askConfirm({ title: `Delete the record for cell ${r.cellId}?`, confirmLabel: 'Delete', danger: true })) void deleteEphysRecord(r.id, db);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-text-muted">{label}</span>
      {children}
    </label>
  );
}
