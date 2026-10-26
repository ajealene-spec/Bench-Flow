import { useState } from 'react';
import type { Step } from '../../types';
import { detectToolHints, type ToolId } from '../neuro/toolHints';
import { ToolPanel } from '../neuro/ToolsPage';
import { WhyThisStep } from './WhyThisStep';

/** Everything extra under a step: the "Why this step?" panel and any bench tools the step needs. */
export function StepAids({ step }: { step: Step }) {
  const hints = detectToolHints(`${step.title}\n${step.instructions}`);
  const [active, setActive] = useState<ToolId | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <WhyThisStep step={step} />
      {hints.length > 0 && (
        <div aria-label="Tools for this step" className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {hints.map((h) => (
              <button
                key={h.id}
                type="button"
                aria-pressed={active === h.id}
                onClick={() => setActive(active === h.id ? null : h.id)}
                className="min-h-12 rounded-xl border border-border bg-surface shadow-card px-4 text-base font-medium text-text"
              >
                {active === h.id ? 'Close ' : 'Open '}
                {h.label}
              </button>
            ))}
          </div>
          {active && (
            <div className="rounded-2xl border border-border p-4">
              <ToolPanel id={active} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
