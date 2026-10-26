import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { listActiveTimers } from '../../db/helpers';
import type { Step, Timer } from '../../types';
import { formatRemaining, remainingSec } from '../timers/timeMath';

export interface DenseRunViewProps {
  experimentId: string;
  steps: Step[];
  completedStepIds: string[];
  currentIndex: number;
  onToggle: (index: number, checked: boolean) => void;
  onJump: (index: number) => void;
  onStartTimer: (step: Step, timer: Timer) => void;
}

/**
 * Advanced run view: every step on one screen with an inline checkbox, its timers and the live
 * countdown of any run already going. Tap a title to make that step the current one.
 */
export function DenseRunView({ experimentId, steps, completedStepIds, currentIndex, onToggle, onJump, onStartTimer }: DenseRunViewProps) {
  const active = useLiveQuery(
    async () => (await listActiveTimers(db)).filter((t) => t.experimentId === experimentId),
    [experimentId],
    [],
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section aria-label="Dense run view" className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        {steps.map((step, i) => {
          const done = completedStepIds.includes(step.id);
          const current = i === currentIndex;
          const runs = active.filter((t) => t.stepId === step.id);
          return (
            <li
              key={step.id}
              className={`flex flex-col gap-2 rounded-xl border-2 p-3 ${current ? 'border-accent' : 'border-border'}`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={(e) => onToggle(i, e.target.checked)}
                  aria-label={`Complete step ${i + 1}: ${step.title}`}
                  className="h-12 w-12 shrink-0 accent-accent"
                />
                <button
                  type="button"
                  aria-current={current ? 'step' : undefined}
                  onClick={() => onJump(i)}
                  className={`min-h-12 flex-1 text-left text-lg ${current ? 'font-semibold' : ''} ${done ? 'text-text-muted line-through' : ''}`}
                >
                  {i + 1}. {step.title}
                </button>
              </div>
              {(step.timers.length > 0 || runs.length > 0) && (
                <div className="flex flex-wrap items-center gap-2 pl-12">
                  {step.timers.map((timer) => (
                    <button
                      key={timer.id}
                      type="button"
                      onClick={() => onStartTimer(step, timer)}
                      className="min-h-12 rounded-lg border-2 border-accent px-3 font-medium text-accent-text"
                    >
                      Start {timer.label} ({formatRemaining(timer.durationSec)})
                    </button>
                  ))}
                  {runs.map((run) => (
                    <span key={run.id} className="font-mono text-lg tabular-nums">
                      {run.label}:{' '}
                      {run.status === 'done' ? 'Done' : `${run.status === 'paused' ? 'paused ' : ''}${formatRemaining(remainingSec(run, now))}`}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
