import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { newId } from '../../db/helpers';
import { createTemplate } from '../../db/templates';
import type { Hazard, HazardKind, Step } from '../../types';
import { extractPdfText } from './pdfText';
import { pruneHazardSteps } from './hazards';
import { getParserStatus, parseProcedure, type ParseOutcome } from './parseProcedure';

type Unit = 's' | 'min' | 'h';
const UNIT_SECONDS: Record<Unit, number> = { s: 1, min: 60, h: 3600 };

const FIELD =
  'min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';
const BUTTON = 'inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl px-4 font-medium';
const BUTTON_PRIMARY = `${BUTTON} bg-teal-700 text-white active:bg-teal-800 disabled:opacity-50`;
const BUTTON_SECONDARY = `${BUTTON} border border-slate-300 bg-white text-slate-900 active:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100`;

/** Largest unit that represents the seconds exactly, so 3600 shows as "1 h". */
function bestUnit(sec: number): Unit {
  if (sec >= 3600 && sec % 3600 === 0) return 'h';
  if (sec >= 60 && sec % 60 === 0) return 'min';
  return 's';
}

function formatSec(sec: number): string {
  const unit = bestUnit(sec);
  return `${sec / UNIT_SECONDS[unit]} ${unit}`;
}

/** Sets the step's duration and keeps its first timer in sync with it. Other timers are kept. */
function withDuration(step: Step, sec: number | undefined): Step {
  const [first, ...rest] = step.timers;
  if (sec === undefined) return { ...step, durationSec: undefined, timers: rest };
  const timer = {
    ...(first ?? { id: newId(), stepId: step.id, label: step.title || 'Timer', status: 'idle' as const }),
    durationSec: sec,
  };
  return { ...step, durationSec: sec, timers: [timer, ...rest] };
}

export function blankStep(): Step {
  return { id: newId(), title: '', instructions: '', timers: [], reagents: [], dataFields: [], cautions: [] };
}

/** Trims titles and points each timer at its step, ready to store. */
export function prepareSteps(steps: Step[]): Step[] {
  return steps.map((s) => ({ ...s, title: s.title.trim(), timers: s.timers.map((t) => ({ ...t, stepId: s.id })) }));
}

interface ReviewState {
  title: string;
  steps: Step[];
  hazards: Hazard[];
  outcome: ParseOutcome;
}

/** Creates a protocol template from pasted text or a PDF. Route: /library/new. */
export default function ImportPage() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'pdf' | 'parse' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [aiReady, setAiReady] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    void getParserStatus().then((ready) => {
      if (alive) setAiReady(ready);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function handlePdf(file: File) {
    setBusy('pdf');
    setError(null);
    try {
      const extracted = await extractPdfText(file);
      if (!extracted) {
        setError('No text found in this PDF. Scanned PDFs need OCR, which is not supported yet.');
        return;
      }
      setText((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${extracted}` : extracted));
    } catch {
      setError('Could not read that PDF.');
    } finally {
      setBusy(null);
    }
  }

  async function handleParse() {
    setBusy('parse');
    setError(null);
    try {
      const outcome = await parseProcedure(text);
      if (outcome.steps.length === 0) {
        setError('No steps found. Try numbered lines or add more detail.');
        return;
      }
      setReview({ title: outcome.title ?? '', steps: outcome.steps, hazards: outcome.hazards, outcome });
    } catch {
      setError('Parsing failed. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    if (!review) return;
    setBusy('save');
    setError(null);
    try {
      const template = await createTemplate({
        title: review.title,
        steps: prepareSteps(review.steps),
        hazards: pruneHazardSteps(review.hazards, review.steps.map((s) => s.id)),
        sourceText: text,
      });
      navigate(`/library/${template.id}`);
    } catch {
      setError('Could not save the protocol. Please try again.');
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <Link to="/library" className="inline-flex min-h-12 w-fit items-center text-teal-700 underline dark:text-teal-300">
          Back to library
        </Link>
        <h1 className="text-2xl font-semibold">New protocol</h1>
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-rose-100 p-3 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100">
          {error}
        </p>
      )}

      {!review ? (
        <section className="flex flex-col gap-4">
          {aiReady === false && (
            <div role="note" className="rounded-xl border border-amber-400 bg-amber-50 p-3 text-amber-950 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-100">
              <p className="font-semibold">For PDFs, add an Anthropic API key to .env for accurate steps.</p>
              <p className="text-sm">
                Add a line <code className="font-mono">ANTHROPIC_API_KEY=your-key</code> to a file named <code className="font-mono">.env</code> in the project folder, then restart <code className="font-mono">npm run dev</code>.
              </p>
            </div>
          )}

          <label htmlFor="procedure-text" className="font-medium">
            Paste numbered steps or notes
          </label>
          <textarea
            id="procedure-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder={'1. Thaw reagents on ice.\n2. Incubate with primary antibody overnight at 4 °C.\n\nOr paste messy notes, one action per line.'}
            className={`${FIELD} min-h-60 py-3`}
          />

          <div className="flex flex-wrap gap-3">
            <label
              className={`${BUTTON_SECONDARY} cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}
            >
              {busy === 'pdf' ? 'Reading PDF…' : 'Upload PDF'}
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                disabled={busy !== null}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void handlePdf(file);
                }}
              />
            </label>
            <button
              type="button"
              className={BUTTON_PRIMARY}
              disabled={!text.trim() || busy !== null}
              onClick={() => void handleParse()}
            >
              {busy === 'parse' ? 'Parsing…' : 'Parse steps'}
            </button>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            The PDF text is read on this device. AI parsing (recommended for PDFs) uses Claude when you are online and an
            API key is set; otherwise the local parser is used.
          </p>
        </section>
      ) : (
        <ReviewSection
          title={review.title}
          steps={review.steps}
          hazards={review.hazards}
          onHazardsChange={(hazards) => setReview({ ...review, hazards })}
          busy={busy === 'save'}
          saveLabel="Save protocol"
          titleLabel="Protocol title"
          titlePlaceholder="Name this protocol"
          statusNote={
            <>
              <span className="font-semibold">
                {review.outcome.parser === 'ai' ? 'Parsed with Claude AI.' : 'Parsed with the local parser.'}
              </span>{' '}
              {review.outcome.note && <span>{review.outcome.note} </span>}
              Check every step before you start.
            </>
          }
          onTitle={(title) => setReview({ ...review, title })}
          onStepsChange={(steps) => setReview({ ...review, steps })}
          onBack={() => setReview(null)}
          onSave={() => void handleSave()}
        />
      )}
    </main>
  );
}

export interface ReviewSectionProps {
  title: string;
  steps: Step[];
  /** Safety box contents. The Safety box is shown only when both hazards props are given. */
  hazards?: Hazard[];
  onHazardsChange?: (hazards: Hazard[]) => void;
  busy: boolean;
  saveLabel: string;
  titleLabel: string;
  titlePlaceholder?: string;
  statusNote?: ReactNode;
  onTitle: (title: string) => void;
  onStepsChange: (steps: Step[]) => void;
  /** Shown as a Back button when given (the import review). */
  onBack?: () => void;
  onSave: () => void;
}

/** Step editor shared by the import review and the template editor. */
export function ReviewSection({
  title,
  steps,
  hazards,
  onHazardsChange,
  busy,
  saveLabel,
  titleLabel,
  titlePlaceholder,
  statusNote,
  onTitle,
  onStepsChange,
  onBack,
  onSave,
}: ReviewSectionProps) {
  const hasBlankTitle = steps.some((s) => !s.title.trim());
  const canSave = !busy && !hasBlankTitle;

  function updateStep(index: number, next: Step) {
    onStepsChange(steps.map((s, i) => (i === index ? next : s)));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    const copy = [...steps];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    onStepsChange(copy);
  }

  return (
    <section className="flex flex-col gap-4">
      {statusNote && <p role="status" className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">{statusNote}</p>}

      {hazards && onHazardsChange && <SafetyBox hazards={hazards} steps={steps} onChange={onHazardsChange} />}

      <label className="flex flex-col gap-1">
        <span className="font-medium">{titleLabel}</span>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder={titlePlaceholder}
          className={FIELD}
        />
      </label>

      {steps.length === 0 && <p className="text-slate-600 dark:text-slate-400">No steps yet. Add one below.</p>}

      <ol className="flex flex-col gap-4">
        {steps.map((step, index) => (
          <StepCard
            key={step.id}
            step={step}
            index={index}
            count={steps.length}
            onChange={(next) => updateStep(index, next)}
            onMove={(dir) => move(index, dir)}
            onDelete={() => onStepsChange(steps.filter((_, i) => i !== index))}
          />
        ))}
      </ol>

      <button type="button" className={BUTTON_SECONDARY} onClick={() => onStepsChange([...steps, blankStep()])}>
        Add step
      </button>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap gap-3 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:-mx-6 sm:px-6 dark:border-slate-700 dark:bg-slate-950/95">
        {onBack && (
          <button type="button" className={BUTTON_SECONDARY} onClick={onBack} disabled={busy}>
            Back to text
          </button>
        )}
        <button type="button" className={`${BUTTON_PRIMARY} flex-1 sm:flex-none`} disabled={!canSave} onClick={onSave}>
          {busy ? 'Saving…' : saveLabel}
        </button>
        {hasBlankTitle && <p className="w-full text-sm text-rose-700 dark:text-rose-300">Every step needs a title.</p>}
      </div>
    </section>
  );
}

interface StepCardProps {
  step: Step;
  index: number;
  count: number;
  onChange: (next: Step) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}

function StepCard({ step, index, count, onChange, onMove, onDelete }: StepCardProps) {
  const initialUnit: Unit = step.durationSec ? bestUnit(step.durationSec) : 'min';
  const [unit, setUnit] = useState<Unit>(initialUnit);
  const [valueText, setValueText] = useState(
    step.durationSec ? String(step.durationSec / UNIT_SECONDS[initialUnit]) : '',
  );

  function applyDuration(nextValue: string, nextUnit: Unit) {
    const n = parseFloat(nextValue.replace(',', '.'));
    onChange(withDuration(step, Number.isFinite(n) && n > 0 ? Math.round(n * UNIT_SECONDS[nextUnit]) : undefined));
  }

  const timedPhases = step.timers.map((t) => `${t.label} (${formatSec(t.durationSec)})`);

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Step {index + 1}
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={BUTTON_SECONDARY}
            aria-label={`Move step ${index + 1} up`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            Move up
          </button>
          <button
            type="button"
            className={BUTTON_SECONDARY}
            aria-label={`Move step ${index + 1} down`}
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          >
            Move down
          </button>
          <button
            type="button"
            className={`${BUTTON} border border-rose-300 bg-white text-rose-800 active:bg-rose-50 dark:border-rose-700 dark:bg-slate-800 dark:text-rose-200`}
            aria-label={`Delete step ${index + 1}`}
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Title</span>
        <input
          type="text"
          value={step.title}
          onChange={(e) => onChange({ ...step, title: e.target.value })}
          className={FIELD}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Instructions</span>
        <textarea
          value={step.instructions}
          onChange={(e) => onChange({ ...step, instructions: e.target.value })}
          rows={3}
          className={`${FIELD} min-h-24 py-3`}
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">Duration (leave empty for none)</span>
        <div className="flex flex-wrap gap-2">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            aria-label="Duration amount"
            value={valueText}
            onChange={(e) => {
              setValueText(e.target.value);
              applyDuration(e.target.value, unit);
            }}
            className={`${FIELD} w-32`}
          />
          <select
            aria-label="Duration unit"
            value={unit}
            onChange={(e) => {
              const next = e.target.value as Unit;
              setUnit(next);
              applyDuration(valueText, next);
            }}
            className={`${FIELD} w-28`}
          >
            <option value="s">seconds</option>
            <option value="min">minutes</option>
            <option value="h">hours</option>
          </select>
        </div>
        {timedPhases.length > 1 && (
          <p className="text-sm text-slate-600 dark:text-slate-400">Also timed: {timedPhases.slice(1).join(', ')}</p>
        )}
      </div>

      {step.cautions.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-amber-800 dark:text-amber-200">
          {step.cautions.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

const KIND_LABEL: Record<HazardKind, string> = {
  chemical: 'Chemical',
  biological: 'Biological',
  physical: 'Physical',
  radiological: 'Radiological',
};

interface SafetyBoxProps {
  hazards: Hazard[];
  steps: Step[];
  onChange: (hazards: Hazard[]) => void;
}

/** Editable list of hazards and PPE for a protocol. Removing an item drops a false positive. */
export function SafetyBox({ hazards, steps, onChange }: SafetyBoxProps) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<HazardKind>('chemical');
  const [ppeText, setPpeText] = useState('');

  const stepNumber = new Map(steps.map((s, i) => [s.id, i + 1]));

  function remove(id: string) {
    onChange(hazards.filter((h) => h.id !== id));
  }

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const ppe = ppeText.split(',').map((p) => p.trim()).filter(Boolean);
    onChange([...hazards, { id: newId(), name: trimmed, kind, reason: 'Added by you.', ppe, stepIds: [] }]);
    setName('');
    setPpeText('');
  }

  return (
    <section aria-labelledby="safety-heading" className="flex flex-col gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100">
      <h2 id="safety-heading" className="text-lg font-semibold">
        Safety
      </h2>
      <p className="text-sm">
        {hazards.length === 0
          ? 'No hazards were detected. Add any that are missing.'
          : 'Hazards found in this protocol, with the protective equipment to wear. Remove any false positives.'}
      </p>

      {hazards.length > 0 && (
        <ul className="flex flex-col gap-3">
          {hazards.map((h) => {
            const steps = h.stepIds.map((id) => stepNumber.get(id)).filter((n): n is number => n !== undefined);
            return (
              <li key={h.id} className="flex flex-col gap-2 rounded-xl bg-white p-3 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="font-semibold">{h.name}</span>
                    <span className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      {KIND_LABEL[h.kind]} · {steps.length > 0 ? `Steps ${steps.join(', ')}` : 'Whole protocol'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`${BUTTON_SECONDARY} border-rose-300 text-rose-800 dark:border-rose-700 dark:text-rose-200`}
                    aria-label={`Remove hazard ${h.name}`}
                    onClick={() => remove(h.id)}
                  >
                    Remove
                  </button>
                </div>
                {h.reason && <p className="text-sm">{h.reason}</p>}
                {h.ppe.length > 0 && (
                  <div className="text-sm">
                    <span className="font-medium">PPE: </span>
                    {h.ppe.join('; ')}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-amber-300 p-3 dark:border-amber-700">
        <span className="text-sm font-medium">Add a hazard</span>
        <input
          type="text"
          aria-label="Hazard name"
          placeholder="Hazard name, e.g. Ethanol"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={FIELD}
        />
        <select aria-label="Hazard kind" value={kind} onChange={(e) => setKind(e.target.value as HazardKind)} className={FIELD}>
          {(Object.keys(KIND_LABEL) as HazardKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <input
          type="text"
          aria-label="PPE for this hazard"
          placeholder="PPE, separated by commas"
          value={ppeText}
          onChange={(e) => setPpeText(e.target.value)}
          className={FIELD}
        />
        <button type="button" className={BUTTON_SECONDARY} disabled={!name.trim()} onClick={add}>
          Add hazard
        </button>
      </div>
    </section>
  );
}
