import { useState, type ReactNode } from 'react';
import { parseAmount } from './calcMath';
import { formatAmount } from './variableFormat';
import { differsFromPlan } from './stepMath';
import { useStepMath } from './useStepMath';
import type { Step, StepVariable } from '../../types';
import { GlossaryText } from '../learn/GlossaryText';
import { useIsBeginner } from '../learn/useLearnData';

/* Touch target for gloved hands: at least 48px tall. */
const CHIP_BASE = 'inline-flex min-h-12 items-center rounded-xl px-3 align-middle font-semibold';
const CHIP_INPUT =`${CHIP_BASE} border-2 border-dashed border-border-strong bg-surface-2 active:opacity-80`;
const CHIP_DERIVED =`${CHIP_BASE} border border-border`;
const CHIP_CHANGED ='text-accent-text font-bold';

export interface StepTextProps {
  step: Step;
  /** Run experiment to save values to. Leave out in template review; values then stay on screen only. */
  experimentId?: string;
  textClassName?: string;
}

type Segment = { kind: 'text'; text: string } | { kind: 'var'; variable: StepVariable };

/** Splits text at each variable token. Tokens match whole words only. Unmatched variables are returned separately. */
function splitText(text: string, variables: StepVariable[]): { segments: Segment[]; unplaced: StepVariable[] } {
  const byToken = new Map<string, StepVariable>();
  for (const v of variables) if (!byToken.has(v.token)) byToken.set(v.token, v);
  const tokens = [...byToken.keys()].sort((a, b) => b.length - a.length);
  const placed = new Set<string>();
  const segments: Segment[] = [];
  if (tokens.length > 0) {
    const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`(?<![\\w.,])(${escaped.join('|')})(?![\\w])`, 'g');
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) segments.push({ kind: 'text', text: text.slice(last, m.index) });
      const variable = byToken.get(m[0]);
      if (variable) {
        segments.push({ kind: 'var', variable });
        placed.add(variable.id);
      }
      last = m.index + m[0].length;
    }
    if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) });
  } else {
    segments.push({ kind: 'text', text });
  }
  return { segments, unplaced: variables.filter((v) => !placed.has(v.id)) };
}

/** Reads a typed value. Accepts "12,5" and dilutions typed as "1:1000". */
function readTyped(draft: string): number | undefined {
  const dilution = /^\s*1\s*:\s*(\d+(?:\.\d+)?)\s*$/.exec(draft);
  const n = dilution ? Number(dilution[1]) : parseAmount(draft);
  return n !== undefined && Number.isFinite(n) && n >= 0 ? n : undefined;
}

interface InlineVarProps {
  variable: StepVariable;
  value: number;
  planned: number;
  onCommit: (value: number) => void;
}

/** One value in the step text. Inputs are tappable chips; derived values update as inputs change. */
export function InlineVar({ variable, value, planned, onCommit }: InlineVarProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const changed = differsFromPlan(value, planned);
  const shown = formatAmount(value, variable.unit);
  const original = formatAmount(planned, variable.unit);
  const label = changed ? `${variable.token}: ${shown}. Planned ${original}.` : `${variable.token}: ${shown}.`;

  if (variable.role === 'input' && draft !== null) {
    const finish = () => {
      const next = readTyped(draft);
      setDraft(null);
      if (next !== undefined) onCommit(next);
    };
    return (
      <input
        type="text"
        inputMode="decimal"
        autoFocus
        aria-label={`New value for ${variable.token}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setDraft(null);
        }}
        className="inline-block min-h-12 w-32 rounded-xl border-2 border-accent bg-surface shadow-card px-3 align-middle text-lg text-text"
      />
    );
  }

  const tone = changed ? CHIP_CHANGED : '';
  if (variable.role === 'input') {
    return (
      <button
        type="button"
        className={`${CHIP_INPUT} ${tone}`}
        aria-label={label}
        title={changed ? `Planned: ${original}` : undefined}
        onClick={() => setDraft(String(Number(value.toPrecision(12))))}
      >
        {shown}
      </button>
    );
  }
  return (
    <span className={`${CHIP_DERIVED} ${tone}`} aria-label={label} title={changed ? `Planned: ${original}` : undefined}>
      {shown}
    </span>
  );
}

/** Step text with every quantity replaced by a live value. Values not found in the text are listed under it. */
export function StepText({ step, experimentId, textClassName = 'text-xl leading-relaxed' }: StepTextProps) {
  const { variables, values, templateValues, setValue } = useStepMath(step, experimentId);
  const beginner = useIsBeginner();
  if (!step.instructions && variables.length === 0) return null;

  const { segments, unplaced } = splitText(step.instructions, variables);
  const render = (v: StepVariable): ReactNode => (
    <InlineVar
      key={v.id}
      variable={v}
      value={values[v.id]}
      planned={templateValues[v.id]}
      onCommit={(next) => void setValue(v.id, next)}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {step.instructions && (
        <p className={`whitespace-pre-line ${textClassName}`}>
          {segments.map((s, i) =>
            s.kind === 'text' ? (
              beginner ? <GlossaryText key={i} text={s.text} /> : <span key={i}>{s.text}</span>
            ) : (
              render(s.variable)
            ),
          )}
        </p>
      )}
      {unplaced.length > 0 && (
        <ul aria-label="Calculated values" className="flex flex-col gap-2">
          {unplaced.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-2 text-lg">
              <span className="text-text-muted">{v.token}</span>
              {render(v)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
