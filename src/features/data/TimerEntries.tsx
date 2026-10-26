import { useEffect, useState } from 'react';
import { db } from '../../db';
import { addStepRecord } from '../../db/helpers';
import { elapsedSecBetween, formatElapsed, parseDuration } from './time';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, FIELD_INPUT } from './fieldStyles';

/** Manual stopwatch and "time taken" entry. Both save a timer record for the step. */
export function TimerEntries({ experimentId, stepId }: { experimentId: string; stepId: string }) {
  const [label, setLabel] = useState('Stopwatch');
  const [startedAt, setStartedAt] = useState<number | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());
  const [manualLabel, setManualLabel] = useState('');
  const [manualTime, setManualTime] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (startedAt === undefined) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [startedAt]);

  async function stopStopwatch() {
    if (startedAt === undefined) return;
    const stoppedAt = Date.now();
    setStartedAt(undefined);
    await addStepRecord(
      {
        experimentId,
        stepId,
        kind: 'timer',
        label: label.trim() || 'Stopwatch',
        startedAt,
        stoppedAt,
        elapsedSec: elapsedSecBetween(startedAt, stoppedAt),
      },
      db,
    );
  }

  async function addManual() {
    const seconds = parseDuration(manualTime);
    if (seconds === undefined) {
      setError('Enter the time as mm:ss or h:mm:ss, for example 12:30 or 1:02:05.');
      return;
    }
    setError(undefined);
    await addStepRecord(
      {
        experimentId,
        stepId,
        kind: 'timer',
        label: manualLabel.trim() || 'Time taken',
        elapsedSec: seconds,
      },
      db,
    );
    setManualTime('');
    setManualLabel('');
  }

  const running = startedAt !== undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h4 className="font-medium">Stopwatch</h4>
        <div className="flex flex-wrap items-center gap-3">
          <span className="min-w-32 font-mono text-3xl tabular-nums" aria-live="off">
            {formatElapsed(running ? (now - startedAt) / 1000 : 0)}
          </span>
          {running ? (
            <button type="button" className={BUTTON_PRIMARY} onClick={() => void stopStopwatch()}>
              Stop and save
            </button>
          ) : (
            <button type="button" className={BUTTON_PRIMARY} onClick={() => { setNow(Date.now()); setStartedAt(Date.now()); }}>
              Start stopwatch
            </button>
          )}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600 dark:text-slate-400">Stopwatch label</span>
          <input className={FIELD_INPUT} value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="font-medium">Time taken</h4>
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            aria-label="Time label"
            placeholder="Label"
            className={FIELD_INPUT}
            value={manualLabel}
            onChange={(e) => setManualLabel(e.target.value)}
          />
          <input
            aria-label="Time taken"
            placeholder="mm:ss or h:mm:ss"
            className={FIELD_INPUT}
            value={manualTime}
            onChange={(e) => setManualTime(e.target.value)}
          />
          <button type="button" className={BUTTON_SECONDARY} disabled={manualTime.trim() === ''} onClick={() => void addManual()}>
            Add time
          </button>
        </div>
        {error && (
          <p role="alert" className="text-base text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
