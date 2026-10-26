import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { listActiveTimers } from '../../db/helpers';
import { alertTimerDone } from './alarm';
import { formatRemaining, isExpired, remainingSec } from './timeMath';
import {
  dismissStepTimer,
  finishIfExpired,
  pauseStepTimer,
  resetStepTimer,
  resumeStepTimer,
} from './timerActions';

const BUTTON = 'min-h-12 rounded-lg px-4 font-medium active:opacity-80';

/**
 * Persistent tray of concurrent timers. Remaining time comes from wall-clock
 * time, so this view can be unmounted or the device can sleep without drift.
 */
export function TimerTray() {
  const timers = useLiveQuery(() => listActiveTimers(db), [], []);
  const [now, setNow] = useState(() => Date.now());
  const alerted = useRef(new Set<string>());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Detect finished timers each tick; alert once per timer.
  useEffect(() => {
    if (!timers) return;
    for (const timer of timers) {
      if (!isExpired(timer, now)) {
        alerted.current.delete(timer.id); // a reset timer may alert again later
        continue;
      }
      if (alerted.current.has(timer.id)) continue;
      alerted.current.add(timer.id);
      void finishIfExpired(timer.id).then((finished) => {
        if (finished) alertTimerDone(finished);
      });
    }
  }, [timers, now]);

  if (!timers || timers.length === 0) return null;

  return (
    <section
      aria-label="Running timers"
      className="flex flex-col gap-2 rounded-xl border border-teal-300 bg-teal-50 p-3 dark:border-teal-700 dark:bg-teal-950/50"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-200">
        Timers ({timers.length})
      </h2>
      <ul className="flex flex-col gap-2">
        {timers.map((timer) => {
          const left = remainingSec(timer, now);
          const done = timer.status === 'done' || left <= 0;
          return (
            <li
              key={timer.id}
              className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 dark:bg-slate-900"
            >
              <span className="min-w-32 flex-1 font-medium">{timer.label}</span>
              <span
                className={`min-w-20 text-right font-mono text-2xl tabular-nums ${
                  done ? 'text-red-700 dark:text-red-300' : ''
                }`}
                aria-live="off"
              >
                {done ? 'Done' : formatRemaining(left)}
              </span>
              <div className="flex flex-wrap gap-2">
                {timer.status === 'running' && (
                  <button type="button" className={`${BUTTON} bg-amber-200 text-amber-900 dark:bg-amber-700 dark:text-amber-50`} onClick={() => void pauseStepTimer(timer.id)}>
                    Pause
                  </button>
                )}
                {timer.status === 'paused' && (
                  <button type="button" className={`${BUTTON} bg-teal-700 text-white`} onClick={() => void resumeStepTimer(timer.id)}>
                    Resume
                  </button>
                )}
                <button type="button" className={`${BUTTON} bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100`} onClick={() => void resetStepTimer(timer.id)}>
                  Reset
                </button>
                <button type="button" className={`${BUTTON} text-slate-700 underline dark:text-slate-300`} onClick={() => void dismissStepTimer(timer.id)}>
                  Dismiss
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
