import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { Hazard, Step, Timer } from '../../types';
import { formatRemaining, isExpired, remainingSec } from '../timers/timeMath';
import { requestNotificationPermission, startRepeatingAlarm, unlockAlarmAudio } from '../timers/alarm';
import {
  dismissStepTimer,
  finishIfExpired,
  pauseStepTimer,
  resetStepTimer,
  resumeStepTimer,
  startStepTimer,
} from '../timers/timerActions';
import { listActiveTimers } from '../../db/helpers';
import { StepNote } from './StepNote';
import { StepText } from '../assist/StepText';
import { StepAids } from '../learn/StepAids';

/** Full-width navigation buttons: at least 72px tall for gloved hands. */
const NAV_BUTTON = 'min-h-[72px] w-full rounded-2xl px-5 text-xl font-semibold active:opacity-80 disabled:opacity-40';
const TIMER_BUTTON = 'min-h-16 rounded-2xl px-5 text-lg font-semibold active:opacity-80';
const COUNTDOWN_SEC = 3;

export interface FocusModeProps {
  experimentId: string;
  step: Step;
  /** Title of the protocol this run follows. Sent with the step for explanations. */
  protocolTitle?: string;
  index: number;
  total: number;
  isCompleted: boolean;
  hazards: Hazard[];
  isLast: boolean;
  done?: boolean;
  onBack: () => void;
  onNext: () => void;
  onComplete: () => void;
  onSkip: () => void;
}

/** Check mark that pops in when a step is completed. Decorative: the text label says the same thing. */
function CheckBadge() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="32" height="32" className="check-pop shrink-0 text-accent-text">
      <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.15" />
      <path d="M6.5 12.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Focus mode: one step per screen, large text, huge timers. Timers for this run stay on screen
 * here, and a finished timer rings until it is dismissed.
 */
export function FocusMode(props: FocusModeProps) {
  const { experimentId, step, protocolTitle, index, total, isCompleted, hazards, isLast, done, onBack, onNext, onComplete, onSkip } =
    props;

  // Which way the last move went, so the step slides in from the side the user moved toward.
  const [motion, setMotion] = useState({ index, dir: 'next' as 'next' | 'prev' });
  if (motion.index !== index) setMotion({ index, dir: index > motion.index ? 'next' : 'prev' });

  return (
    <section aria-label="Focus mode" className="flex flex-col gap-6">
      <div key={step.id} className={`flex flex-col gap-6 ${motion.dir === 'next' ? 'step-enter-next' : 'step-enter-prev'}`}>
      <div className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-3 text-xl font-semibold text-text-muted">
          <span>
            Step {index + 1} of {total}
            {isCompleted ? ' · Completed' : ''}
          </span>
          {isCompleted && <CheckBadge />}
        </p>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">{step.title}</h1>
      </div>

      {hazards.length > 0 && (
        <ul aria-label="Hazards for this step" className="flex flex-wrap gap-2">
          {hazards.map((h) => (
            <li key={h.id} className="rounded-full bg-surface-2 px-3 py-1 text-lg font-semibold text-text">
              ⚠ {h.name}
            </li>
          ))}
        </ul>
      )}

      <StepText step={step} experimentId={experimentId} textClassName="text-2xl leading-relaxed" />
      <StepAids step={step} protocolTitle={protocolTitle} />

      {step.cautions.length > 0 && (
        <section
          aria-label="Cautions"
          className="flex flex-col gap-2 rounded-xl border-2 border-border bg-surface-2 p-4"
        >
          <h2 className="text-lg font-bold uppercase tracking-wide">Caution</h2>
          <ul className="list-disc pl-6 text-xl font-medium">
            {step.cautions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      )}

      {step.timers.length > 0 && <FocusTimerStarts timers={step.timers} experimentId={experimentId} />}

      <FocusTimerTray experimentId={experimentId} />

      <StepNote experimentId={experimentId} stepId={step.id} large />

      </div>
      <nav aria-label="Step navigation" className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className={`${NAV_BUTTON} bg-surface-2 text-text`}
            disabled={index === 0}
            onClick={onBack}
          >
            Back
          </button>
          <button type="button" className={`${NAV_BUTTON} bg-surface-2 text-text`} disabled={isLast} onClick={onNext}>
            Next
          </button>
        </div>
        <button type="button" className={`${NAV_BUTTON} bg-accent text-on-accent`} onClick={onComplete}>
          {isLast ? (done ? 'Run finished' : 'Mark complete and finish') : 'Mark complete'}
        </button>
        <button
          type="button"
          className="min-h-14 w-full rounded-2xl px-5 text-lg font-medium underline"
          disabled={isLast}
          onClick={onSkip}
        >
          Skip this step (logged as a deviation)
        </button>
      </nav>
    </section>
  );
}

/** Start buttons for a step's timers. Tapping one shows a 3 second countdown, then starts it. */
function FocusTimerStarts({ timers, experimentId }: { timers: Timer[]; experimentId: string }) {
  const [pending, setPending] = useState<Timer | null>(null);
  const [count, setCount] = useState(COUNTDOWN_SEC);

  useEffect(() => {
    if (!pending) return;
    if (count <= 0) {
      void startStepTimer({ ...pending, experimentId });
      setPending(null);
      return;
    }
    const id = window.setTimeout(() => setCount((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [pending, count, experimentId]);

  function begin(template: Timer) {
    // Taps are user gestures: unlock audio and ask for notifications here.
    unlockAlarmAudio();
    void requestNotificationPermission();
    setCount(COUNTDOWN_SEC);
    setPending(template);
  }

  if (pending) {
    return (
      <section aria-label="Timer starting" className="flex flex-col gap-3 rounded-2xl border-2 border-accent p-5">
        <p className="text-2xl font-semibold">Starting {pending.label} in</p>
        <p className="text-7xl font-bold tabular-nums text-accent-text" role="status" aria-live="polite">
          {Math.max(count, 0)}…
        </p>
        <button type="button" className={`${TIMER_BUTTON} bg-surface-2 text-text`} onClick={() => setPending(null)}>
          Cancel
        </button>
      </section>
    );
  }

  return (
    <section aria-label="Step timers" className="flex flex-col gap-3">
      {timers.map((timer) => (
        <button
          key={timer.id}
          type="button"
          onClick={() => begin(timer)}
          className="min-h-20 w-full rounded-2xl border-2 border-accent px-5 text-left text-2xl font-semibold text-accent-text active:bg-surface-2"
        >
          Start timer: {timer.label} ({formatRemaining(timer.durationSec)})
        </button>
      ))}
    </section>
  );
}

/** Every running, paused or ringing timer of this run. Ringing timers sound until dismissed. */
function FocusTimerTray({ experimentId }: { experimentId: string }) {
  const timers = useLiveQuery(
    async () => (await listActiveTimers(db)).filter((t) => t.experimentId === experimentId),
    [experimentId],
    [],
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  // Running timers that have reached zero become done, exactly once (logged in finishIfExpired).
  useEffect(() => {
    for (const timer of timers) {
      if (isExpired(timer, now)) void finishIfExpired(timer.id);
    }
  }, [timers, now]);

  const ringing = timers.filter((t) => t.status === 'done' || isExpired(t, now));
  const ringKey = ringing.map((t) => t.id).join(',');

  // One alarm for as long as anything is ringing; it stops when the list clears.
  useEffect(() => {
    if (!ringKey) return;
    return startRepeatingAlarm();
  }, [ringKey]);

  if (timers.length === 0) return null;

  return (
    <section aria-label="Running timers" className="flex flex-col gap-3">
      {ringing.map((timer) => (
        <div
          key={`ring-${timer.id}`}
          role="alertdialog"
          aria-label={`${timer.label} timer done`}
          className="flex flex-col gap-3 rounded-2xl border-4 border-border bg-surface-2 p-5"
        >
          <p className="text-3xl font-bold">Timer done: {timer.label}</p>
          <button
            type="button"
            className={`${TIMER_BUTTON} min-h-[72px] w-full bg-accent text-on-accent`}
            onClick={async () => {
              await finishIfExpired(timer.id);
              await dismissStepTimer(timer.id);
            }}
          >
            Dismiss alarm
          </button>
        </div>
      ))}

      {timers
        .filter((t) => !ringing.includes(t))
        .map((timer) => {
          const left = remainingSec(timer, now);
          return (
            <div key={timer.id} className="flex flex-col gap-3 rounded-2xl border border-border p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xl font-semibold">{timer.label}</span>
                <span className="font-mono text-6xl font-bold tabular-nums sm:text-7xl" aria-live="off">
                  {formatRemaining(left)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {timer.status === 'running' ? (
                  <button
                    type="button"
                    className={`${TIMER_BUTTON} bg-surface-2 text-text`}
                    onClick={() => void pauseStepTimer(timer.id)}
                  >
                    Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${TIMER_BUTTON} bg-accent text-on-accent`}
                    onClick={() => void resumeStepTimer(timer.id)}
                  >
                    Resume
                  </button>
                )}
                <button
                  type="button"
                  className={`${TIMER_BUTTON} bg-surface-2 text-text`}
                  onClick={() => void resetStepTimer(timer.id)}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className={`${TIMER_BUTTON} underline`}
                  onClick={() => void dismissStepTimer(timer.id)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}
    </section>
  );
}
