import { useEffect, useState } from 'react';
import { solveDilution } from '../assist/calcMath';
import { formatRemaining } from '../timers/timeMath';
import { useTourReducedMotion } from './useTourMotion';
import { FLUO4_PLANNED_UM, FLUO4_STOCK_MM, INCUBATION_37_SEC, SAMPLE_LOADING_VOLUME_ML } from './sampleData';
import { TOUR_CARD } from './tourShared';

const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-surface px-4 font-medium text-text';
/** The timer runs this many times faster than real time in the tour. */
const TOUR_SPEED = 60;

/** Stock to add (µL) for the planned Fluo-4 AM concentration in a loading volume (mL). C1V1 = C2V2. */
export function fluo4StockMicroliters(volumeMl: number): number {
  const result = solveDilution({
    c1: FLUO4_STOCK_MM,
    c1Unit: 'mM',
    v1: null,
    v1Unit: 'µL',
    c2: FLUO4_PLANNED_UM,
    c2Unit: 'µM',
    v2: volumeMl,
    v2Unit: 'mL',
  });
  return result.value;
}

/** Focus mode for the loading step: a live Fluo-4 AM dilution and the 1 hour loading timer, which starts by itself. */
export function StepFocus() {
  const reduced = useTourReducedMotion();
  const [volumeMl, setVolumeMl] = useState(SAMPLE_LOADING_VOLUME_ML);
  const [remaining, setRemaining] = useState(INCUBATION_37_SEC);
  const [nudged, setNudged] = useState(false);

  // The timer starts when this step opens. At 60x, each real second removes a minute of plan.
  useEffect(() => {
    const id = window.setInterval(() => setRemaining((r) => Math.max(0, r - TOUR_SPEED)), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Show the calculator responding once: the loading volume goes from 2 to 3 mL and the stock follows.
  useEffect(() => {
    if (reduced) return;
    const id = window.setTimeout(() => {
      setVolumeMl(3);
      setNudged(true);
    }, 1800);
    return () => window.clearTimeout(id);
  }, [reduced]);

  const stockUl = fluo4StockMicroliters(volumeMl);
  const bufferUl = volumeMl * 1000 - stockUl;
  const elapsedPct = ((INCUBATION_37_SEC - remaining) / INCUBATION_37_SEC) * 100;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className={TOUR_CARD}>
        <span className="text-sm font-semibold text-text-muted">Focus mode · Loading Fluo-4 AM</span>
        <h3 className="text-xl font-semibold text-text">Fluo-4 AM dilution</h3>
        <p className="text-base text-text-muted">
          From a {FLUO4_STOCK_MM} mM DMSO stock to {FLUO4_PLANNED_UM} µM. Change the loading volume and the stock volume follows.
        </p>

        <label className="flex flex-col gap-2">
          <span className="font-medium text-text">
            Loading volume: <span className="t-num font-semibold">{volumeMl} mL</span>
          </span>
          <input
            type="range"
            min={1}
            max={5}
            step={0.5}
            value={volumeMl}
            onChange={(e) => {
              setNudged(true);
              setVolumeMl(Number(e.target.value));
            }}
            className="tour-range h-12 w-full cursor-pointer accent-accent"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col rounded-xl border border-border bg-surface-2 p-4">
            <span className="text-sm text-text-muted">Fluo-4 AM stock to add</span>
            <span className="tour-value t-num text-2xl font-bold text-accent-text sm:text-3xl" aria-live="polite" data-changed={nudged}>
              {stockUl.toFixed(1)} µL
            </span>
          </div>
          <div className="flex flex-col rounded-xl border border-border bg-surface-2 p-4">
            <span className="text-sm text-text-muted">Loading buffer to add</span>
            <span className="t-num text-2xl font-bold text-text sm:text-3xl">{Math.round(bufferUl).toLocaleString('en-US')} µL</span>
          </div>
        </div>
        <p className="text-sm text-text-muted">
          C1V1 = C2V2: {FLUO4_STOCK_MM} mM stock, {FLUO4_PLANNED_UM} µM final, {volumeMl} mL total.
        </p>
        <button type="button" className={BUTTON} onClick={() => setVolumeMl(SAMPLE_LOADING_VOLUME_ML)}>
          Reset to {SAMPLE_LOADING_VOLUME_ML} mL
        </button>
      </div>

      <div className={TOUR_CARD}>
        <span className="text-sm font-semibold text-text-muted">Load timer · 37 °C · running at {TOUR_SPEED}× speed</span>
        <span className="t-num text-6xl font-bold tracking-tight text-text" role="timer" aria-live="off">
          {formatRemaining(remaining)}
        </span>
        <p className="text-base text-text-muted">
          Started automatically when the step opened: 1 hour at 37 °C, then 30 minutes at room temperature. The tour runs the timer {TOUR_SPEED} times faster so you can see it move.
        </p>
        <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <div className="tour-bar h-full rounded-full bg-accent" style={{ width: `${elapsedPct}%` }} />
        </div>
      </div>
    </div>
  );
}
