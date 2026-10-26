import { useState } from 'react';
import { db } from '../../db';
import { deleteAnimal, putAnimal } from '../../db/animals';
import type { Animal, AnimalEventKind } from '../../types';
import { BUTTON_LINK, BUTTON_PRIMARY, BUTTON_SECONDARY, FIELD_INPUT } from '../data/fieldStyles';
import { parseNumber } from '../data/parseNumbers';
import { postOpChecklist, POST_OP_STATUS_LABEL, type PostOpItem } from './postOp';
import { eventsOfKind, weightSeries, withEvent } from './animalEvents';
import { Sparkline } from './Sparkline';

const DATE_TIME = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const BADGE: Record<PostOpItem['status'], string> = {
  upcoming:'bg-surface-2 text-text-muted',
  due: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100',
  overdue: 'bg-rose-100 text-rose-900 dark:bg-rose-900/60 dark:text-rose-100',
  done: 'bg-accent text-white',
};

/** Event log, weight trend and post-op checklist for one animal. Each change saves to the animal record. */
export function AnimalDetail({ animal, cageLabel }: { animal: Animal; cageLabel: string }) {
  const weights = weightSeries(animal);
  const surgery = eventsOfKind(animal, 'surgery')[0];
  const checks = animal.events
    .filter((e) => e.kind === 'post_op_check' && e.value !== undefined && surgery !== undefined && e.at >= surgery.at)
    .map((e) => ({ day: e.value as number, at: e.at }));
  const checklist = surgery ? postOpChecklist(surgery.at, checks, Date.now()) : [];

  async function add(kind: AnimalEventKind, value: number | undefined, unit: string | undefined, note: string) {
    await putAnimal(withEvent(animal, { kind, at: Date.now(), value, unit, note: note.trim() || undefined }), db);
  }

  return (
    <div className="flex flex-col gap-5 border-t border-border pt-4">
      <dl className="grid grid-cols-2 gap-3 text-base sm:grid-cols-3">
        <Info label="Cage" value={cageLabel} />
        <Info label="Genotype" value={animal.genotype || '—'} />
        <Info label="Strain" value={animal.strain || '—'} />
        <Info label="Sex" value={animal.sex} />
        <Info label="RRID" value={animal.rrid || '—'} />
        <Info label="Notes" value={animal.notes || '—'} />
      </dl>

      <section aria-label="Weights" className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Weight</h3>
        <Sparkline series={weights} label={`Weight trend for ${animal.label}`} />
        <EventForm
          key="weight"
          submitLabel="Add weight"
          valueLabel="Weight (g)"
          needsValue
          onSubmit={(value, note) => add('weight', value, 'g', note)}
        />
      </section>

      <section aria-label="Surgery and injections" className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Surgery and injections</h3>
        <EventForm
          key="surgery"
          submitLabel="Log surgery"
          valueLabel="Notes"
          needsValue={false}
          textOnly
          onSubmit={(_, note) => add('surgery', undefined, undefined, note)}
        />
        <EventForm
          key="injection"
          submitLabel="Log injection"
          valueLabel="Dose (mg/kg)"
          needsValue
          notePlaceholder="Compound, route, volume"
          onSubmit={(value, note) => add('injection', value, 'mg/kg', note)}
        />
        <EventList animal={animal} kinds={['surgery', 'injection']} />
      </section>

      {surgery && (
        <section aria-label="Post-op checklist" className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Post-op checks (surgery {DATE_TIME.format(surgery.at)})
          </h3>
          <ul className="flex flex-col gap-2">
            {checklist.map((item) => (
              <li key={item.day} className="flex flex-col gap-2 rounded-xl border border-border p-3  sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-sm text-text-muted">
                    Due {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(item.dueAt)}
                    {item.completedAt ? ` · done ${DATE_TIME.format(item.completedAt)}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${BADGE[item.status]}`}>{POST_OP_STATUS_LABEL[item.status]}</span>
                  {item.status !== 'done' && (
                    <button type="button" className={BUTTON_SECONDARY} onClick={() => void add('post_op_check', item.day, undefined, `Day ${item.day} check`)}>
                      Mark done
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Event log" className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Event log</h3>
        <EventList animal={animal} kinds={['weight', 'surgery', 'injection', 'post_op_check']} />
      </section>

      <button
        type="button"
        className={`${BUTTON_LINK} self-start text-rose-800 dark:text-rose-300`}
        onClick={async () => {
          if (!window.confirm(`Delete animal ${animal.label} and its event log?`)) return;
          await deleteAnimal(animal.id, db);
        }}
      >
        Delete animal
      </button>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </div>
  );
}

function EventList({ animal, kinds }: { animal: Animal; kinds: AnimalEventKind[] }) {
  const events = animal.events.filter((e) => kinds.includes(e.kind)).sort((a, b) => b.at - a.at);
  if (events.length === 0) return <p className="text-base text-text-muted">Nothing logged yet.</p>;
  return (
    <ul className="flex flex-col gap-2 text-base">
      {events.map((e) => (
        <li key={e.id} className="rounded-xl border border-border px-3 py-2">
          <span className="font-medium">{EVENT_LABEL[e.kind]}</span>
          {e.value !== undefined && e.kind !== 'post_op_check' && <span> · {e.value} {e.unit ?? ''}</span>}
          <span className="text-text-muted"> · {DATE_TIME.format(e.at)}</span>
          {e.note && <div className="text-text-muted">{e.note}</div>}
        </li>
      ))}
    </ul>
  );
}

const EVENT_LABEL: Record<AnimalEventKind, string> = {
  weight: 'Weight',
  surgery: 'Surgery',
  injection: 'Injection',
  post_op_check: 'Post-op check',
};

function EventForm({
  submitLabel,
  valueLabel,
  needsValue,
  textOnly = false,
  notePlaceholder,
  onSubmit,
}: {
  submitLabel: string;
  valueLabel: string;
  needsValue: boolean;
  textOnly?: boolean;
  notePlaceholder?: string;
  onSubmit: (value: number | undefined, note: string) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  async function submit() {
    let number: number | undefined;
    if (needsValue) {
      number = parseNumber(value);
      if (number === undefined) return setError(`Enter a number for ${valueLabel.toLowerCase()}.`);
    }
    if (textOnly && note.trim() === '') return setError('Add a note for the surgery.');
    setError(undefined);
    await onSubmit(number, note);
    setValue('');
    setNote('');
  }

  return (
    <form
      className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {!textOnly && (
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">{valueLabel}</span>
          <input className={FIELD_INPUT} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} aria-label={valueLabel} />
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">Note</span>
        <input className={FIELD_INPUT} value={note} placeholder={notePlaceholder} onChange={(e) => setNote(e.target.value)} aria-label={`${submitLabel} note`} />
      </label>
      <button type="submit" className={BUTTON_PRIMARY}>
        {submitLabel}
      </button>
      {error && <p role="alert" className="text-base text-rose-700 dark:text-rose-300 sm:col-span-3">{error}</p>}
    </form>
  );
}
