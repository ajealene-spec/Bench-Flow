import { useState, type ClipboardEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { addStepRecord, deleteStepRecord, listStepRecordsForStep, updateStepRecord } from '../../db/helpers';
import type { Step, StepRecord } from '../../types';
import { BUTTON_LINK, BUTTON_PRIMARY, BUTTON_SECONDARY, FIELD_INPUT } from './fieldStyles';
import { fillLabels, parseNumber, parsePastedValues } from './parseNumbers';
import { TimerEntries } from './TimerEntries';
import { StepCapture } from './StepCapture';
import { formatElapsed, parseDuration } from './time';

/** Collapsible "Record data" area under a run step: numbers, timers and notes. Saves immediately. */
export function StepDataPanel({ experimentId, step }: { experimentId: string; step: Step }) {
  const [open, setOpen] = useState(false);
  const records = useLiveQuery(() => listStepRecordsForStep(experimentId, step.id, db), [experimentId, step.id], []);
  const count = records.length;

  return (
    <section aria-label="Step data" className="flex flex-col gap-3 rounded-2xl border border-border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`step-data-${step.id}`}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-16 items-center justify-between px-5 text-lg font-semibold"
      >
        <span>
          Record data{count > 0 ? ` (${count})` : ''}
        </span>
        <span aria-hidden="true">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div id={`step-data-${step.id}`} className="flex flex-col gap-6 px-5 pb-5">
          <NumberEntry experimentId={experimentId} step={step} />

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Records</h3>
            {records.length === 0 && <p className="text-base text-text-muted">Nothing recorded for this step yet.</p>}
            <ul className="flex flex-col gap-2">
              {records.map((record) => (
                <RecordRow key={record.id} record={record} />
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Timers</h3>
            <TimerEntries experimentId={experimentId} stepId={step.id} />
          </div>

          <StepCapture experimentId={experimentId} step={step} />
        </div>
      )}
    </section>
  );
}

function NumberEntry({ experimentId, step }: { experimentId: string; step: Step }) {
  const fieldLabels = step.dataFields.map((f) => f.label);
  const first = step.dataFields[0];
  const [label, setLabel] = useState(first?.label ?? '');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState(first?.unit ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState<string | undefined>(undefined);

  async function add() {
    const number = parseNumber(value);
    if (number === undefined) {
      setError('Enter a number for the value.');
      return;
    }
    setError(undefined);
    await addStepRecord(
      {
        experimentId,
        stepId: step.id,
        kind: 'number',
        label: label.trim(),
        value: number,
        unit: unit.trim() || undefined,
        note: note.trim() || undefined,
      },
      db,
    );
    setValue('');
    setNote('');
  }

  /**
   * Pasting a single value fills the fields so the user can check them. Pasting several
   * values (one per line, or tab or comma separated) saves one record for each value.
   */
  async function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    const { values, skippedLines } = parsePastedValues(text);
    if (values.length === 0) return; // not numeric: let the normal paste happen
    e.preventDefault();

    if (values.length === 1) {
      const [only] = values;
      setValue(String(only.value));
      if (only.label) setLabel(only.label);
      if (only.unit) setUnit(only.unit);
      setError(undefined);
      return;
    }

    const rows = fillLabels(values, fieldLabels, label.trim());
    await db.transaction('rw', db.stepRecords, async () => {
      for (const row of rows) {
        await addStepRecord(
          {
            experimentId,
            stepId: step.id,
            kind: 'number',
            label: row.label,
            value: row.value,
            unit: row.unit || unit.trim() || undefined,
          },
          db,
        );
      }
    });
    setMessage(
      `Saved ${rows.length} values${skippedLines > 0 ? `. Skipped ${skippedLines} line${skippedLines === 1 ? '' : 's'} with no number` : ''}.`,
    );
    setValue('');
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Numbers</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">Label</span>
          <input
            className={FIELD_INPUT}
            list={`labels-${step.id}`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onPaste={(e) => void handlePaste(e)}
          />
          <datalist id={`labels-${step.id}`}>
            {fieldLabels.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">Value</span>
          <input
            className={FIELD_INPUT}
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onPaste={(e) => void handlePaste(e)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">Unit</span>
          <input className={FIELD_INPUT} value={unit} onChange={(e) => setUnit(e.target.value)} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">Note (optional)</span>
        <input className={FIELD_INPUT} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={BUTTON_PRIMARY} disabled={value.trim() === ''} onClick={() => void add()}>
          Add
        </button>
        <span className="text-sm text-text-muted">
          Paste one value, or several from Excel or an instrument (one per line).
        </span>
      </div>
      {error && (
        <p role="alert" className="text-base text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-base text-text">
          {message}
        </p>
      )}
    </div>
  );
}

function describe(record: StepRecord): string {
  if (record.kind === 'timer') return formatElapsed(record.elapsedSec);
  return [record.value, record.unit].filter((x) => x !== undefined && x !== '').join(' ');
}

function RecordRow({ record }: { record: StepRecord }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(record.label);
  const [value, setValue] = useState(record.value !== undefined ? String(record.value) : '');
  const [unit, setUnit] = useState(record.unit ?? '');
  const [elapsed, setElapsed] = useState(record.elapsedSec !== undefined ? formatElapsed(record.elapsedSec) : '');
  const [note, setNote] = useState(record.note ?? '');
  const [error, setError] = useState<string | undefined>(undefined);
  const isManualTime = record.kind === 'timer' && record.startedAt === undefined;

  async function save() {
    if (record.kind === 'number') {
      const number = parseNumber(value);
      if (number === undefined) return setError('Enter a number for the value.');
      await updateStepRecord(record.id, { label: label.trim(), value: number, unit: unit.trim() || undefined, note: note.trim() || undefined }, db);
    } else if (isManualTime) {
      const seconds = parseDuration(elapsed);
      if (seconds === undefined) return setError('Enter the time as mm:ss or h:mm:ss.');
      await updateStepRecord(record.id, { label: label.trim(), elapsedSec: seconds, note: note.trim() || undefined }, db);
    } else {
      await updateStepRecord(record.id, { label: label.trim(), note: note.trim() || undefined }, db);
    }
    setError(undefined);
    setEditing(false);
  }

  async function remove() {
    if (!window.confirm('Delete this record?')) return;
    await deleteStepRecord(record.id, db);
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-2 rounded-xl border-2 border-accent p-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <input aria-label="Edit label" className={FIELD_INPUT} value={label} onChange={(e) => setLabel(e.target.value)} />
          {record.kind === 'number' && (
            <>
              <input aria-label="Edit value" inputMode="decimal" className={FIELD_INPUT} value={value} onChange={(e) => setValue(e.target.value)} />
              <input aria-label="Edit unit" className={FIELD_INPUT} value={unit} onChange={(e) => setUnit(e.target.value)} />
            </>
          )}
          {isManualTime && (
            <input aria-label="Edit time" className={FIELD_INPUT} value={elapsed} onChange={(e) => setElapsed(e.target.value)} />
          )}
        </div>
        <input aria-label="Edit note" placeholder="Note" className={FIELD_INPUT} value={note} onChange={(e) => setNote(e.target.value)} />
        {error && (
          <p role="alert" className="text-base text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BUTTON_PRIMARY} onClick={() => void save()}>
            Save changes
          </button>
          <button type="button" className={BUTTON_SECONDARY} onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1 rounded-xl bg-surface-2 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-base">
          <span className="font-medium">{record.label || (record.kind === 'timer' ? 'Timer' : 'Value')}</span>{' '}
          <span className="font-mono text-lg tabular-nums">{describe(record)}</span>
        </span>
        <span className="text-sm text-text-muted">{record.kind ==='timer' ?'Time' :'Number'}</span>
      </div>
      {record.note && <p className="text-base text-text-muted">{record.note}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BUTTON_LINK} onClick={() => setEditing(true)}>
          Edit
        </button>
        <button type="button" className={BUTTON_LINK} onClick={() => void remove()}>
          Delete
        </button>
      </div>
    </li>
  );
}
