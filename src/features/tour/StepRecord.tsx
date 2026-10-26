import { useMemo } from 'react';
import { formatMeanSd, summarize } from './tourStats';
import { useSequence, useTourReducedMotion } from './useTourMotion';
import {
  CELLS_PER_GROUP,
  FLUO4_ACTUAL_UM,
  FLUO4_PLANNED_UM,
  FLUO4_STOCK_MM,
  GENOTYPES,
  ROIS_PER_COVERSLIP,
  SAMPLE_CAPTION,
  SAMPLE_CELLS,
  SAMPLE_CONDITIONS,
  SAMPLE_LOADING_VOLUME_ML,
  type Genotype,
  type SampleCondition,
} from './sampleData';
import { TOUR_CARD } from './tourShared';

interface Group {
  genotype: Genotype;
  condition: SampleCondition;
}

/** Eight groups: two genotypes, four conditions. Each group has 30 ROIs (3 coverslips × 10). */
const GROUPS: Group[] = GENOTYPES.flatMap((genotype) => SAMPLE_CONDITIONS.map((condition) => ({ genotype, condition })));
const TOTAL_CELLS = GROUPS.length * CELLS_PER_GROUP;
const MINUS = '−';

/** ROIs recorded so far in one group, given how many cells have been recorded in total. */
function recordedIn(groupIndex: number, recorded: number): number {
  return Math.min(CELLS_PER_GROUP, Math.max(0, recorded - groupIndex * CELLS_PER_GROUP));
}

/** Records peak ΔF/F0 and AUC for each ROI. The table and the grid fill in as the ROIs are measured. */
export function StepRecord() {
  const reduced = useTourReducedMotion();
  const recorded = useSequence(TOTAL_CELLS, { reduced, intervalMs: 45 });
  const activeIndex = Math.min(GROUPS.length - 1, Math.floor(recorded / CELLS_PER_GROUP));
  const active = GROUPS[activeIndex];
  const activeFilled = recordedIn(activeIndex, recorded);
  const activePeaks = SAMPLE_CELLS[active.genotype][active.condition.id].peak;

  const rows = useMemo(
    () =>
      GROUPS.map((g, i) => {
        const n = recordedIn(i, recorded);
        const peaks = SAMPLE_CELLS[g.genotype][g.condition.id].peak.slice(0, n);
        const aucs = SAMPLE_CELLS[g.genotype][g.condition.id].auc.slice(0, n);
        return { g, n, peak: summarize(peaks), auc: summarize(aucs) };
      }),
    [recorded],
  );

  return (
    <div className={TOUR_CARD}>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-text-muted">Step: Analyze in FIJI · one ROI per cell</span>
        <span className="text-base text-text-muted">
          Peak ΔF/F0 is the highest response after the treatment. AUC is the area under the trace. Each value is stored with its ROI.
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-text-muted" aria-live="polite">
          {recorded >= TOTAL_CELLS
            ? `All ${TOTAL_CELLS} ROIs recorded`
            : `${active.genotype} · ${active.condition.short}: ${activeFilled}/${CELLS_PER_GROUP} ROIs`}
        </span>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10" role="img" aria-label={`Peak ΔF/F0 for ${activeFilled} of ${CELLS_PER_GROUP} ROIs in ${active.genotype} ${active.condition.short}`}>
          {Array.from({ length: CELLS_PER_GROUP }, (_, i) => {
            const done = i < activeFilled;
            const coverslip = Math.floor(i / ROIS_PER_COVERSLIP) + 1;
            return (
              <span
                key={i}
                title={`Coverslip ${coverslip}, ROI ${(i % ROIS_PER_COVERSLIP) + 1}`}
                className={`tour-field flex min-h-12 items-center justify-center rounded-lg border t-num text-xs font-semibold ${
                  done ? 'border-accent bg-surface-2 text-text' : 'border-dashed border-border text-text-muted'
                }`}
              >
                {done ? activePeaks[i].toFixed(2) : '·'}
              </span>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-0 text-left">
          <caption className="sr-only">Peak ΔF/F0 and AUC per group, with the number of ROIs recorded so far</caption>
          <thead>
            <tr>
              <th scope="col" className="p-3 text-sm font-semibold text-text-muted">Group</th>
              <th scope="col" className="p-3 text-sm font-semibold text-text-muted">ROIs</th>
              <th scope="col" className="p-3 text-sm font-semibold text-text-muted">Peak ΔF/F0, mean ± SD</th>
              <th scope="col" className="p-3 text-sm font-semibold text-text-muted">AUC, mean ± SD</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ g, n, peak, auc }, i) => (
              <tr key={`${g.genotype}-${g.condition.id}`} className={i === activeIndex && recorded < TOTAL_CELLS ? 'bg-surface-2' : ''}>
                <th scope="row" className="border-t border-border p-3 font-medium text-text">
                  {g.genotype} · {g.condition.short}
                </th>
                <td className="t-num border-t border-border p-3 text-text">{n}</td>
                <td className="t-num border-t border-border p-3 text-text">{formatMeanSd(peak, 2)}</td>
                <td className="t-num border-t border-border p-3 text-text">{formatMeanSd(auc, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-text-muted">{SAMPLE_CAPTION}</p>
    </div>
  );
}

/** Fluo-4 AM was loaded at 4.17 µM, not the planned 5 µM. The app logs planned against actual by itself. */
export function StepDeviation() {
  const reduced = useTourReducedMotion();
  const logged = useSequence(1, { reduced, intervalMs: 900 });
  const delta = FLUO4_ACTUAL_UM - FLUO4_PLANNED_UM;
  const deltaPct = (delta / FLUO4_PLANNED_UM) * 100;
  const scaleUm = 6;
  const plannedPct = (FLUO4_PLANNED_UM / scaleUm) * 100;
  const actualPct = (FLUO4_ACTUAL_UM / scaleUm) * 100;
  const plannedStock = (FLUO4_PLANNED_UM * SAMPLE_LOADING_VOLUME_ML * 1000) / (FLUO4_STOCK_MM * 1000);
  const actualStock = (FLUO4_ACTUAL_UM * SAMPLE_LOADING_VOLUME_ML * 1000) / (FLUO4_STOCK_MM * 1000);
  const signed = (v: number, digits: number) => `${v < 0 ? MINUS : '+'}${Math.abs(v).toFixed(digits)}`;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className={TOUR_CARD}>
        <span className="text-sm font-semibold text-text-muted">Fluo-4 AM loading concentration</span>
        <div className="flex flex-col gap-2" role="img" aria-label={`Planned ${FLUO4_PLANNED_UM} µM, actual ${FLUO4_ACTUAL_UM} µM`}>
          <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold">
            <span className="text-text">Planned {FLUO4_PLANNED_UM} µM</span>
            <span className="text-rose-700 dark:text-rose-300">Actual {FLUO4_ACTUAL_UM} µM</span>
          </div>
          <div className="relative h-10 w-full rounded-lg bg-surface-2">
            <div className="tour-bar absolute inset-y-0 left-0 rounded-l-lg bg-accent" style={{ width: `${actualPct}%`, opacity: logged ? 1 : 0.4 }} />
            <div className="absolute inset-y-[-6px] w-0.5 bg-text" style={{ left: `${plannedPct}%` }} aria-hidden="true" />
          </div>
          <div className="flex justify-between text-xs text-text-muted" aria-hidden="true">
            <span>0 µM</span>
            <span>{scaleUm} µM</span>
          </div>
        </div>
        <p className="text-base text-text-muted">
          The stock was {actualStock.toFixed(2)} µL instead of {plannedStock.toFixed(0)} µL for a {SAMPLE_LOADING_VOLUME_ML} mL load, so the loading ran low.
        </p>
      </div>

      <div className={TOUR_CARD} aria-live="polite">
        <span className="text-sm font-semibold text-text-muted">Execution log</span>
        {logged ? (
          <div className="tour-card-in flex flex-col gap-2 rounded-xl border border-rose-300 bg-surface p-4 dark:border-rose-400/60">
            <span className="inline-flex w-fit rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-900 dark:bg-rose-400/20 dark:text-rose-100">
              Deviation logged automatically
            </span>
            <span className="text-lg font-semibold text-text">Loaded {Math.abs(delta).toFixed(2)} µM below plan</span>
            <span className="t-num text-base text-text-muted">
              Planned {FLUO4_PLANNED_UM.toFixed(2)} µM · actual {FLUO4_ACTUAL_UM.toFixed(2)} µM · delta {signed(delta, 2)} µM ({signed(deltaPct, 1)}%)
            </span>
            <span className="text-sm text-text-muted">Nobody typed this. The app wrote the planned and actual values when the step was confirmed, and they appear in the report.</span>
          </div>
        ) : (
          <p className="text-base text-text-muted">Waiting for the value to be confirmed…</p>
        )}
        <p className="text-sm text-text-muted">{SAMPLE_CAPTION}</p>
      </div>
    </div>
  );
}
