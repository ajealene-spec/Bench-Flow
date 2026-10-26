import { useMemo } from 'react';
import { timerDeviation } from '../run/deviation';
import { formatMinSec } from './tourStats';
import { useSequence, useTourReducedMotion } from './useTourMotion';
import {
  SAMPLE_ANIMALS,
  SAMPLE_BLOCK_ACTUAL_SEC,
  SAMPLE_BLOCK_PLANNED_SEC,
  SAMPLE_COUNTS,
  SAMPLE_COUNT_UNIT,
  SAMPLE_REGIONS,
} from './sampleData';
import { TOUR_CARD } from './tourShared';

const CELLS = SAMPLE_ANIMALS.length * SAMPLE_REGIONS.length;

/** Cell counts typed into the step's fields, one animal per row and one region per column. */
export function StepRecord() {
  const reduced = useTourReducedMotion();
  const filled = useSequence(CELLS, { reduced, intervalMs: 260 });

  return (
    <div className={TOUR_CARD}>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-text-muted">Step: Mount · count NeuN+ cells per region</span>
        <span className="text-base text-text-muted">Each field takes a number with its unit. Values are stored with the run, not in a spreadsheet.</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-separate border-spacing-0 text-left">
          <caption className="sr-only">NeuN+ cell counts per region for three sample animals</caption>
          <thead>
            <tr>
              <th scope="col" className="p-3 text-sm font-semibold text-text-muted">Animal</th>
              {SAMPLE_REGIONS.map((r) => (
                <th key={r} scope="col" className="p-3 text-sm font-semibold text-text-muted">
                  {r}
                  <span className="block text-xs font-normal">{SAMPLE_COUNT_UNIT}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SAMPLE_ANIMALS.map((animal, row) => (
              <tr key={animal}>
                <th scope="row" className="border-t border-border p-3 font-medium text-text">{animal}</th>
                {SAMPLE_REGIONS.map((region, col) => {
                  const index = row * SAMPLE_REGIONS.length + col;
                  const done = index < filled;
                  return (
                    <td key={region} className="border-t border-border p-2">
                      <span
                        className={`tour-field flex min-h-12 items-center justify-center rounded-lg border px-3 text-lg font-semibold t-num ${
                          done ? 'border-accent bg-surface-2 text-text' : 'border-dashed border-border text-text-muted'
                        }`}
                      >
                        {done ? SAMPLE_COUNTS[region][row] : '·'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-text-muted" aria-live="polite">
        {filled}/{CELLS} fields filled
      </p>
    </div>
  );
}

/** The block timer that ran over. The deviation is computed by the same rule the run uses. */
export function StepDeviation() {
  const reduced = useTourReducedMotion();
  const deviation = useMemo(() => timerDeviation(SAMPLE_BLOCK_PLANNED_SEC, SAMPLE_BLOCK_ACTUAL_SEC), []);
  const logged = useSequence(1, { reduced, intervalMs: 900 });
  const scaleMin = 70;
  const plannedPct = (SAMPLE_BLOCK_PLANNED_SEC / 60 / scaleMin) * 100;
  const actualPct = (SAMPLE_BLOCK_ACTUAL_SEC / 60 / scaleMin) * 100;
  const deltaSec = deviation?.delta ?? 0;
  const overMin = Math.round(deltaSec / 60);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className={TOUR_CARD}>
        <span className="text-sm font-semibold text-text-muted">Permeabilize and block · timer</span>
        <div className="flex flex-col gap-2" role="img" aria-label={`Planned ${formatMinSec(SAMPLE_BLOCK_PLANNED_SEC)}, actual ${formatMinSec(SAMPLE_BLOCK_ACTUAL_SEC)}`}>
          <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold">
            <span className="text-text">Planned {formatMinSec(SAMPLE_BLOCK_PLANNED_SEC)}</span>
            <span className="text-rose-700 dark:text-rose-300">Actual {formatMinSec(SAMPLE_BLOCK_ACTUAL_SEC)}</span>
          </div>
          <div className="relative h-10 w-full rounded-lg bg-surface-2">
            <div className="tour-bar absolute inset-y-0 left-0 rounded-l-lg bg-accent" style={{ width: `${plannedPct}%` }} />
            <div
              className="tour-bar absolute inset-y-0 rounded-r-lg bg-rose-600/80"
              style={{ left: `${plannedPct}%`, width: `${actualPct - plannedPct}%`, opacity: logged ? 1 : 0.3 }}
            />
            <div className="absolute inset-y-[-6px] w-0.5 bg-text" style={{ left: `${plannedPct}%` }} aria-hidden="true" />
          </div>
        </div>
        <p className="text-base text-text-muted">The timer stopped 7 minutes after its plan. The tolerance for this run is 10%.</p>
      </div>

      <div className={TOUR_CARD} aria-live="polite">
        <span className="text-sm font-semibold text-text-muted">Execution log</span>
        {logged ? (
          <div className="tour-card-in flex flex-col gap-2 rounded-xl border border-rose-300 bg-surface p-4 dark:border-rose-400/60">
            <span className="inline-flex w-fit rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-900 dark:bg-rose-400/20 dark:text-rose-100">
              Deviation logged automatically
            </span>
            <span className="text-lg font-semibold text-text">Timer over plan by {overMin} min</span>
            <span className="t-num text-base text-text-muted">
              Planned {formatMinSec(SAMPLE_BLOCK_PLANNED_SEC)} · actual {formatMinSec(SAMPLE_BLOCK_ACTUAL_SEC)} · delta +{formatMinSec(deltaSec)}
            </span>
            <span className="text-sm text-text-muted">Nobody typed this. The app wrote it when the timer stopped, and it appears in the report.</span>
          </div>
        ) : (
          <p className="text-base text-text-muted">Waiting for the timer to stop…</p>
        )}
      </div>
    </div>
  );
}
