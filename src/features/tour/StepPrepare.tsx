import { useEffect, useMemo, useState } from 'react';
import { parseLocal } from '../import/localParse';
import { buildSafetyChecklist } from '../run/safety';
import { detectHazards } from '../import/hazards';
import { SafetyGate } from '../run/SafetyGate';
import type { SafetyChecklistItem, Step } from '../../types';
import { useSequence, useTourReducedMotion, useTyped } from './useTourMotion';
import { SAMPLE_PROTOCOL_TEXT } from './sampleData';
import { TOUR_CARD } from './tourShared';

/** The parsed sample protocol. Computed once; the parser is pure. */
function parseSample(): Step[] {
  return parseLocal(SAMPLE_PROTOCOL_TEXT).steps;
}

/** Types the sample protocol, then shows the steps the parser found, one card at a time. */
export function StepPaste() {
  const reduced = useTourReducedMotion();
  const typed = useTyped(SAMPLE_PROTOCOL_TEXT, { reduced, charsPerTick: 3, tickMs: 16 });
  const typingDone = typed.length === SAMPLE_PROTOCOL_TEXT.length;
  const steps = useMemo(parseSample, []);
  const shown = useSequence(steps.length, { reduced, enabled: typingDone, intervalMs: 320 });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className={TOUR_CARD}>
        <span className="text-sm font-semibold text-text-muted">Pasted text</span>
        <pre className="tour-paste whitespace-pre-wrap break-words rounded-xl border border-border bg-surface-2 p-4 font-mono text-sm leading-relaxed text-text" aria-label="Pasted protocol text">
          {typed}
          {!typingDone && !reduced && <span className="tour-caret" aria-hidden="true">|</span>}
        </pre>
      </div>
      <div className={TOUR_CARD} aria-live="polite">
        <span className="text-sm font-semibold text-text-muted">
          {typingDone ? `${steps.length} steps found` : 'Reading the protocol…'}
        </span>
        <ol className="flex flex-col gap-3">
          {steps.slice(0, shown).map((step, i) => (
            <li key={step.id} className="tour-card-in flex gap-3 rounded-xl border border-border bg-surface p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-on-accent">
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-semibold text-text">{step.title}</span>
                {step.instructions && <span className="text-sm leading-relaxed text-text-muted">{step.instructions}</span>}
                {step.durationSec !== undefined && (
                  <span className="text-sm text-accent-text">Timer: {Math.round(step.durationSec / 60)} min</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** The safety and PPE checklist for the sample protocol. Items tick themselves in the tour; you can tap them too. */
export function StepSafety() {
  const reduced = useTourReducedMotion();
  const [items, setItems] = useState<SafetyChecklistItem[]>(() => buildSafetyChecklist(detectHazards(parseSample())));
  const [autoIndex, setAutoIndex] = useState(0);
  const [confirmed, setConfirmed] = useState(false);

  // Tick the items once, in order, so the gate visibly fills before the steps unlock. Later taps are never undone.
  useEffect(() => {
    if (reduced) {
      setItems((list) => list.map((i) => ({ ...i, checked: true })));
      return;
    }
    if (autoIndex >= items.length) return;
    const id = window.setTimeout(() => {
      setItems((list) => list.map((item, i) => (i === autoIndex ? { ...item, checked: true } : item)));
      setAutoIndex((n) => n + 1);
    }, 550);
    return () => window.clearTimeout(id);
  }, [autoIndex, items.length, reduced]);

  return confirmed ? (
    <div role="status" className={TOUR_CARD}>
      <p className="text-lg font-semibold text-text">Confirmed. The steps unlock, and the confirmation is kept in the report.</p>
    </div>
  ) : (
    <SafetyGate
      items={items}
      onToggle={(id, checked) => setItems((list) => list.map((i) => (i.itemId === id ? { ...i, checked } : i)))}
      onConfirm={() => setConfirmed(true)}
    />
  );
}
