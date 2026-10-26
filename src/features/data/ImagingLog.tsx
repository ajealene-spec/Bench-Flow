import { askConfirm } from '../../app/feedback';
import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { deleteImagingRecord, listImagingRecords, putImagingRecord } from '../../db/imagingRecords';
import { newId } from '../../db/helpers';
import type { ImagingRecord } from '../../types';
import { BUTTON_LINK, BUTTON_PRIMARY, BUTTON_SECONDARY, FIELD_INPUT } from './fieldStyles';
import { parseNumber } from './parseNumbers';
import { downloadText, slug } from './download';
import { toCsv } from './csv';

type Settings = Pick<ImagingRecord, 'microscope' | 'objective' | 'laser' | 'exposure' | 'gain' | 'channels'>;

interface Draft {
  microscope: string;
  objective: string;
  laser: string;
  exposure: string;
  gain: string;
  channels: string;
  file: string;
}

const EMPTY: Draft = { microscope: '', objective: '', laser: '', exposure: '', gain: '', channels: '', file: '' };

/** Settings from the most recent acquisition, or undefined when there is none. */
export function latestSettings(records: ImagingRecord[]): Settings | undefined {
  const last = [...records].sort((a, b) => b.at - a.at)[0];
  if (!last) return undefined;
  return {
    microscope: last.microscope,
    objective: last.objective,
    laser: last.laser,
    exposure: last.exposure,
    gain: last.gain,
    channels: last.channels,
  };
}

/** Splits a comma or semicolon list of channel names, dropping blanks. */
export function parseChannels(text: string): string[] {
  return text
    .split(/[,;]/)
    .map((c) => c.trim())
    .filter((c) => c !== '');
}

/**
 * Imaging log for a run, or for one step when stepId is given. The form can copy the settings from the
 * previous acquisition so repeat imaging takes one tap.
 */
export function ImagingLog({ experimentId, experimentName = 'run', stepId }: { experimentId: string; experimentName?: string; stepId?: string }) {
  const all = useLiveQuery(() => listImagingRecords(experimentId, db), [experimentId], []);
  const records = stepId === undefined ? all : all.filter((r) => r.stepId === stepId);
  const [draft, setDraft] = useState<Draft>({ ...EMPTY });
  const [error, setError] = useState<string | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  const previous = latestSettings(records.length > 0 ? records : all);

  function copyPrevious() {
    if (!previous) return;
    setDraft((d) => ({
      ...d,
      microscope: previous.microscope,
      objective: previous.objective,
      laser: previous.laser,
      exposure: previous.exposure,
      gain: String(previous.gain),
      channels: previous.channels.join(', '),
    }));
    setCopied(true);
  }

  async function save() {
    const gain = parseNumber(draft.gain);
    if (gain === undefined) return setError('Enter a number for gain.');
    if (!draft.microscope.trim()) return setError('Enter the microscope.');
    setError(undefined);
    const record: ImagingRecord = {
      id: newId(),
      experimentId,
      stepId,
      microscope: draft.microscope.trim(),
      objective: draft.objective.trim(),
      laser: draft.laser.trim(),
      exposure: draft.exposure.trim(),
      gain,
      channels: parseChannels(draft.channels),
      file: draft.file.trim() || undefined,
      at: Date.now(),
    };
    await putImagingRecord(record, db);
    setDraft({ ...EMPTY, microscope: draft.microscope, objective: draft.objective, channels: draft.channels, gain: draft.gain });
    setCopied(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Imaging</h3>
      <form
        aria-label="Imaging settings"
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Microscope">
            <input className={FIELD_INPUT} value={draft.microscope} onChange={(e) => setDraft({ ...draft, microscope: e.target.value })} />
          </Field>
          <Field label="Objective">
            <input className={FIELD_INPUT} value={draft.objective} placeholder="e.g. 20x / 0.8 NA" onChange={(e) => setDraft({ ...draft, objective: e.target.value })} />
          </Field>
          <Field label="Channels">
            <input className={FIELD_INPUT} value={draft.channels} placeholder="DAPI, GFP, RFP" onChange={(e) => setDraft({ ...draft, channels: e.target.value })} />
          </Field>
          <Field label="Laser power">
            <input className={FIELD_INPUT} value={draft.laser} placeholder="488 nm, 5%" onChange={(e) => setDraft({ ...draft, laser: e.target.value })} />
          </Field>
          <Field label="Exposure or dwell">
            <input className={FIELD_INPUT} value={draft.exposure} placeholder="200 ms" onChange={(e) => setDraft({ ...draft, exposure: e.target.value })} />
          </Field>
          <Field label="Gain">
            <input className={FIELD_INPUT} inputMode="decimal" value={draft.gain} onChange={(e) => setDraft({ ...draft, gain: e.target.value })} />
          </Field>
          <Field label="File name">
            <input className={FIELD_INPUT} value={draft.file} placeholder="image_0001.nd2" onChange={(e) => setDraft({ ...draft, file: e.target.value })} />
          </Field>
        </div>
        {error && <p role="alert" className="text-base text-rose-700 dark:text-rose-300">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={BUTTON_PRIMARY}>
            Save imaging settings
          </button>
          <button type="button" className={BUTTON_SECONDARY} disabled={!previous} onClick={copyPrevious}>
            {copied ? 'Copied previous settings' : 'Copy previous settings'}
          </button>
        </div>
      </form>

      {records.length === 0 ? (
        <p className="text-base text-text-muted">No imaging settings recorded yet.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-base text-text-muted">{records.length} entries</span>
            <button
              type="button"
              className={BUTTON_SECONDARY}
              onClick={() => downloadText(`${slug(experimentName)}-imaging.csv`, imagingCsv(records))}
            >
              Export CSV
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {[...records].sort((a, b) => a.at - b.at).map((r) => (
              <li key={r.id} className="flex flex-col gap-1 rounded-xl border border-border p-3 text-base">
                <span className="font-medium">
                  {r.microscope}
                  {r.objective ? ` · ${r.objective}` : ''}
                  {r.file ? ` · ${r.file}` : ''}
                </span>
                <span className="text-text-muted">
                  {[r.channels.join(', '), r.laser, r.exposure, `gain ${r.gain}`].filter(Boolean).join(' · ')}
                </span>
                <button
                  type="button"
                  className={`${BUTTON_LINK} self-start`}
                  onClick={async () => {
                    if (await askConfirm({ title: 'Delete this imaging entry?', confirmLabel: 'Delete', danger: true })) void deleteImagingRecord(r.id, db);
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** CSV of imaging entries in time order. */
export function imagingCsv(records: ImagingRecord[]): string {
  const rows = [...records]
    .sort((a, b) => a.at - b.at)
    .map((r) => [
      new Date(r.at).toISOString(),
      r.stepId ?? '',
      r.microscope,
      r.objective,
      r.channels.join(';'),
      r.laser,
      r.exposure,
      r.gain,
      r.file ?? '',
    ]);
  return toCsv([['recorded_at', 'step_id', 'microscope', 'objective', 'channels', 'laser', 'exposure', 'gain', 'file'], ...rows]);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-text-muted">{label}</span>
      {children}
    </label>
  );
}
