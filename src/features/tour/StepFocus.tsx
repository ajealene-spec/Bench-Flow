import { useEffect, useState } from 'react';
import { antibodyDilution } from '../assist/calcMath';
import { formatRemaining } from '../timers/timeMath';
import { useTourReducedMotion } from './useTourMotion';
import { SAMPLE_ANTIBODY_RATIO, SAMPLE_FINAL_VOLUME_ML } from './sampleData';
import { TOUR_CARD } from './tourShared';

const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-surface px-4 font-medium text-text';
/** The timer runs this many times faster than real time in the tour. */
const TOUR_SPEED = 60;
const TIMER_SEC = 60 * 60;

/** Focus mode for the primary antibody step: a live calculator and a timer that starts by itself. */
export function StepFocus() {
  const reduced = useTourReducedMotion();
  const [finalMl, setFinalMl] = useState(SAMPLE_FINAL_VOLUME_ML);
  const [remaining, setRemaining] = useState(TIMER_SEC);
  const [nudged, setNudged] = useState(false);

  // The timer starts when this step opens. At 60x, each real second removes a minute of plan.
  useEffect(() => {
    const id = window.setInterval(() => setRemaining((r) => Math.max(0, r - TOUR_SPEED)), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Show the calculator responding once: the volume goes from 4 to 5 mL, as it did in the sample run.
  useEffect(() => {
    if (reduced) return;
    const id = window.setTimeout(() => {
      setFinalMl(5);
      setNudged(true);
    }, 1800);
    return () => window.clearTimeout(id);
  }, [reduced]);

  const { antibodyVolume, diluentVolume } = antibodyDilution({
    ratio: SAMPLE_ANTIBODY_RATIO,
    finalVolume: finalMl,
    volumeUnit: 'mL',
    outUnit: 'µL',
  });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className={TOUR_CARD}>
        <span className="text-sm font-semibold text-text-muted">Focus mode · Step 3 of the sample run</span>
        <h3 className="text-xl font-semibold text-text">Primary antibody</h3>
        <p className="text-base text-text-muted">
          Rabbit anti-NeuN at 1:{SAMPLE_ANTIBODY_RATIO}. Drag the final volume and the antibody volume follows.
        </p>

        <label className="flex flex-col gap-2">
          <span className="font-medium text-text">Final volume: <span className="t-num font-semibold">{finalMl} mL</span></span>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={finalMl}
            onChange={(e) => {
              setNudged(true);
              setFinalMl(Number(e.target.value));
            }}
            className="tour-range h-12 w-full cursor-pointer accent-accent"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col rounded-xl border border-border bg-surface-2 p-4">
            <span className="text-sm text-text-muted">Antibody to add</span>
            <span className="tour-value t-num text-2xl font-bold text-accent-text sm:text-3xl" aria-live="polite" data-changed={nudged}>
              {antibodyVolume.toFixed(1)} µL
            </span>
          </div>
          <div className="flex flex-col rounded-xl border border-border bg-surface-2 p-4">
            <span className="text-sm text-text-muted">Diluent (blocking buffer)</span>
            <span className="t-num text-2xl font-bold text-text sm:text-3xl">{Math.round(diluentVolume).toLocaleString('en-US')} µL</span>
          </div>
        </div>
        <button type="button" className={BUTTON} onClick={() => setFinalMl(SAMPLE_FINAL_VOLUME_ML)}>
          Reset to 4 mL
        </button>
      </div>

      <div className={TOUR_CARD}>
        <span className="text-sm font-semibold text-text-muted">Block timer · running at {TOUR_SPEED}× speed</span>
        <span className="t-num text-6xl font-bold tracking-tight text-text" role="timer" aria-live="off">
          {formatRemaining(remaining)}
        </span>
        <p className="text-base text-text-muted">
          Started automatically when the step opened. The tour runs it {TOUR_SPEED} times faster so you can see it move.
        </p>
        <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <div className="tour-bar h-full rounded-full bg-accent" style={{ width: `${((TIMER_SEC - remaining) / TIMER_SEC) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
