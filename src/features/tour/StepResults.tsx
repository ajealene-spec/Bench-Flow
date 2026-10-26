import { useEffect, useMemo, useState } from 'react';
import { formatMeanSd, formatP, summarize, welchTTest } from './tourStats';
import { useSequence, useTourReducedMotion } from './useTourMotion';
import {
  CELL_METRIC_LABEL,
  CELL_METRIC_UNIT,
  GENOTYPES,
  SAMPLE_CAPTION,
  SAMPLE_CELLS,
  SAMPLE_CONDITIONS,
  SAMPLE_TRACE,
  TRACE_BASELINE_SEC,
  TRACE_TOTAL_SEC,
  seededRandom,
  type CellMetric,
  type Genotype,
} from './sampleData';
import { TOUR_CARD } from './tourShared';

const W = 480;
const H = 280;
const PLOT = { left: 52, right: 468, top: 16, bottom: 236 };
const Y_MAX: Record<CellMetric, number> = { peak: 2.5, auc: 70 };
const Y_TICKS: Record<CellMetric, number[]> = { peak: [0, 0.5, 1, 1.5, 2, 2.5], auc: [0, 20, 40, 60] };
/** Horizontal offset of each genotype inside a condition column. */
const GENOTYPE_OFFSET: Record<Genotype, number> = { APOE3: -22, APOE4: 22 };
const GENOTYPE_FILL: Record<Genotype, string> = { APOE3: 'fill-accent', APOE4: 'fill-amber-700 dark:fill-amber-400' };
const GENOTYPE_STROKE: Record<Genotype, string> = { APOE3: 'stroke-accent', APOE4: 'stroke-amber-700 dark:stroke-amber-400' };
const TRACE_W = 480;
const TRACE_H = 220;
const TRACE_PLOT = { left: 52, right: 468, top: 14, bottom: 186 };
const TRACE_Y_MAX = 1.2;
/** Reveal time of each condition's dots, in ms. */
const REVEAL_MS = 450;

/** Deterministic horizontal jitter for each dot, so the plot looks the same on every visit. */
const JITTER: Record<string, number[]> = (() => {
  const rand = seededRandom(20261026);
  const out: Record<string, number[]> = {};
  for (const g of GENOTYPES) {
    for (const c of SAMPLE_CONDITIONS) {
      out[`${g}|${c.id}`] = Array.from({ length: 30 }, () => (rand() - 0.5) * 22);
    }
  }
  return out;
})();

/** Dot plot of every cell, grouped by condition with APOE3 and APOE4 side by side, plus the sample statistics. */
export function StepResults() {
  const reduced = useTourReducedMotion();
  const [metric, setMetric] = useState<CellMetric>('peak');
  const revealed = useSequence(SAMPLE_CONDITIONS.length, { reduced, intervalMs: REVEAL_MS });
  const unit = CELL_METRIC_UNIT[metric];

  const y = (v: number) => PLOT.bottom - (v / Y_MAX[metric]) * (PLOT.bottom - PLOT.top);
  const slot = (PLOT.right - PLOT.left) / SAMPLE_CONDITIONS.length;

  const stats = useMemo(
    () =>
      SAMPLE_CONDITIONS.map((c) => {
        const a = SAMPLE_CELLS.APOE3[c.id][metric];
        const b = SAMPLE_CELLS.APOE4[c.id][metric];
        return { condition: c, apoe3: summarize(a), apoe4: summarize(b), test: welchTTest(a, b) };
      }),
    [metric],
  );

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className={TOUR_CARD}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold text-text">Every cell, by condition and genotype</span>
            <span className="text-sm text-text-muted">
              Each dot is one ROI (n = 30 per group). Lines show mean ± SD. {SAMPLE_CAPTION}
            </span>
          </div>
          <div role="group" aria-label="Choose the measure" className="inline-flex w-full rounded-xl border border-border bg-surface-2 p-1 sm:w-auto">
            {(['peak', 'auc'] as CellMetric[]).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={metric === m}
                onClick={() => setMetric(m)}
                className={`inline-flex min-h-12 flex-1 items-center justify-center rounded-lg px-4 font-semibold sm:flex-none ${
                  metric === m ? 'bg-surface text-text shadow-card' : 'text-text-muted'
                }`}
              >
                {CELL_METRIC_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Dot plot of ${CELL_METRIC_LABEL[metric]} per cell, grouped by condition and genotype, with mean and standard deviation. Sample data.`} className="h-auto w-full">
          {Y_TICKS[metric].map((t) => (
            <g key={t}>
              <line x1={PLOT.left} x2={PLOT.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
              <text x={PLOT.left - 8} y={y(t) + 4} textAnchor="end" className="fill-text-muted" fontSize={11}>
                {t}
              </text>
            </g>
          ))}
          <text x={14} y={(PLOT.top + PLOT.bottom) / 2} transform={`rotate(-90 14 ${(PLOT.top + PLOT.bottom) / 2})`} textAnchor="middle" className="fill-text-muted" fontSize={11}>
            {unit}
          </text>
          {SAMPLE_CONDITIONS.map((c, ci) => {
            const cx = PLOT.left + slot * ci + slot / 2;
            const shown = reduced || ci < revealed;
            return (
              <g key={c.id}>
                {GENOTYPES.map((g) => {
                  const s = stats[ci][g === 'APOE3' ? 'apoe3' : 'apoe4'];
                  const x = cx + GENOTYPE_OFFSET[g];
                  const values = SAMPLE_CELLS[g][c.id][metric];
                  const jitter = JITTER[`${g}|${c.id}`];
                  return (
                    <g key={g}>
                      <line x1={x} x2={x} y1={y(Math.max(0, s.mean - s.sd))} y2={y(s.mean + s.sd)} className={GENOTYPE_STROKE[g]} strokeWidth={2} opacity={shown ? 1 : 0} style={{ transition: reduced ? 'none' : 'opacity 300ms ease' }} />
                      <line x1={x - 6} x2={x + 6} y1={y(s.mean + s.sd)} y2={y(s.mean + s.sd)} className={GENOTYPE_STROKE[g]} strokeWidth={2} opacity={shown ? 1 : 0} />
                      <line x1={x - 6} x2={x + 6} y1={y(Math.max(0, s.mean - s.sd))} y2={y(Math.max(0, s.mean - s.sd))} className={GENOTYPE_STROKE[g]} strokeWidth={2} opacity={shown ? 1 : 0} />
                      <line x1={x - 11} x2={x + 11} y1={y(s.mean)} y2={y(s.mean)} className={GENOTYPE_STROKE[g]} strokeWidth={3} opacity={shown ? 1 : 0} />
                      {values.map((v, k) => (
                        <circle
                          key={k}
                          cx={x + jitter[k]}
                          cy={y(v)}
                          r={3.5}
                          className={`tour-dot ${shown ? 'is-in' : ''} ${GENOTYPE_FILL[g]}`}
                          fillOpacity={0.75}
                          style={{ transitionDelay: reduced ? '0ms' : `${ci * REVEAL_MS + k * 8}ms` }}
                        >
                          <title>{`${g}, ${c.short}, ROI ${k + 1}: ${v} ${unit} (sample)`}</title>
                        </circle>
                      ))}
                    </g>
                  );
                })}
                <text x={cx} y={PLOT.bottom + 18} textAnchor="middle" className="fill-text" fontSize={12} fontWeight={600}>
                  {c.short}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted" aria-label="Legend">
          <span className="inline-flex items-center gap-2">
            <svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="6" className="fill-accent" /></svg>
            APOE3
          </span>
          <span className="inline-flex items-center gap-2">
            <svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="6" className="fill-amber-700 dark:fill-amber-400" /></svg>
            APOE4
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-0 text-left">
            <caption className="sr-only">Sample statistics for {CELL_METRIC_LABEL[metric]} by condition, with Welch two-sample t-tests</caption>
            <thead>
              <tr>
                <th scope="col" className="p-2 text-sm font-semibold text-text-muted">Condition</th>
                <th scope="col" className="p-2 text-sm font-semibold text-text-muted">APOE3, mean ± SD</th>
                <th scope="col" className="p-2 text-sm font-semibold text-text-muted">APOE4, mean ± SD</th>
                <th scope="col" className="p-2 text-sm font-semibold text-text-muted">Welch t</th>
                <th scope="col" className="p-2 text-sm font-semibold text-text-muted">df</th>
                <th scope="col" className="p-2 text-sm font-semibold text-text-muted">p</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.condition.id}>
                  <th scope="row" className="border-t border-border p-2 text-sm font-medium text-text">{s.condition.short}</th>
                  <td className="t-num border-t border-border p-2 text-sm text-text">{formatMeanSd(s.apoe3, metric === 'peak' ? 2 : 1)}</td>
                  <td className="t-num border-t border-border p-2 text-sm text-text">{formatMeanSd(s.apoe4, metric === 'peak' ? 2 : 1)}</td>
                  <td className="t-num border-t border-border p-2 text-sm text-text">{s.test ? s.test.t.toFixed(2) : '—'}</td>
                  <td className="t-num border-t border-border p-2 text-sm text-text">{s.test ? s.test.df.toFixed(1) : '—'}</td>
                  <td className="t-num border-t border-border p-2 text-sm text-text">{s.test ? formatP(s.test.p) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-text-muted">
          {SAMPLE_CAPTION} Welch two-sample t-tests describe the sample numbers only. They draw no conclusion about APOE3 and APOE4.
        </p>
      </div>

      <div className={TOUR_CARD}>
        <ExampleTrace reduced={reduced} />
      </div>
    </div>
  );
}

/** One example ΔF/F0 trace: a 5 s baseline, the treatment arrow, then the response drawn in. */
function ExampleTrace({ reduced }: { reduced: boolean }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setDrawn(true), 150);
    return () => window.clearTimeout(id);
  }, []);
  const isDrawn = reduced || drawn;

  const x = (t: number) => TRACE_PLOT.left + (t / TRACE_TOTAL_SEC) * (TRACE_PLOT.right - TRACE_PLOT.left);
  const y = (f: number) => TRACE_PLOT.bottom - (f / TRACE_Y_MAX) * (TRACE_PLOT.bottom - TRACE_PLOT.top);
  const d = SAMPLE_TRACE.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)} ${y(p.f).toFixed(1)}`).join(' ');
  const peak = SAMPLE_TRACE.reduce((best, p) => (p.f > best.f ? p : best), SAMPLE_TRACE[0]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-lg font-semibold text-text">Example trace: ΔF/F0 over time</span>
        <span className="text-sm text-text-muted">One cell, sampled every 0.5 s at 30 fps. {SAMPLE_CAPTION}</span>
      </div>
      <svg viewBox={`0 0 ${TRACE_W} ${TRACE_H}`} role="img" aria-label="Example ΔF/F0 trace with a 5 second baseline, the treatment added at 5 seconds, and a response. Sample data." className="h-auto w-full">
        <rect x={x(0)} y={TRACE_PLOT.top} width={x(TRACE_BASELINE_SEC) - x(0)} height={TRACE_PLOT.bottom - TRACE_PLOT.top} className="fill-surface-2" />
        <text x={(x(0) + x(TRACE_BASELINE_SEC)) / 2} y={TRACE_PLOT.top + 14} textAnchor="middle" className="fill-text-muted" fontSize={11}>
          Baseline
        </text>
        {[0, 0.4, 0.8, 1.2].map((t) => (
          <g key={t}>
            <line x1={TRACE_PLOT.left} x2={TRACE_PLOT.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
            <text x={TRACE_PLOT.left - 8} y={y(t) + 4} textAnchor="end" className="fill-text-muted" fontSize={11}>
              {t.toFixed(1)}
            </text>
          </g>
        ))}
        <text x={TRACE_PLOT.left} y={TRACE_H - 6} className="fill-text-muted" fontSize={11}>
          0 s
        </text>
        <text x={TRACE_PLOT.right} y={TRACE_H - 6} textAnchor="end" className="fill-text-muted" fontSize={11}>
          {TRACE_TOTAL_SEC} s
        </text>
        <path
          d={d}
          fill="none"
          className="stroke-accent"
          strokeWidth={2}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={isDrawn ? 0 : 1}
          style={{ transition: reduced ? 'none' : 'stroke-dashoffset 1.8s ease-out' }}
        />
        {/* Treatment arrow at 5 s */}
        <line x1={x(TRACE_BASELINE_SEC)} x2={x(TRACE_BASELINE_SEC)} y1={TRACE_PLOT.top + 22} y2={TRACE_PLOT.bottom} className="stroke-text" strokeWidth={1.5} strokeDasharray="4 4" />
        <polygon points={`${x(TRACE_BASELINE_SEC) - 5},${TRACE_PLOT.top + 22} ${x(TRACE_BASELINE_SEC) + 5},${TRACE_PLOT.top + 22} ${x(TRACE_BASELINE_SEC)},${TRACE_PLOT.top + 30}`} className="fill-text" />
        <text x={x(TRACE_BASELINE_SEC) + 8} y={TRACE_PLOT.top + 34} className="fill-text" fontSize={12} fontWeight={600}>
          Treatment added
        </text>
        {/* Response peak */}
        <circle cx={x(peak.t)} cy={y(peak.f)} r={4} className="fill-text" opacity={isDrawn ? 1 : 0} style={{ transition: reduced ? 'none' : 'opacity 400ms ease 1.6s' }} />
        <text x={x(peak.t) + 8} y={y(peak.f) - 6} className="fill-text" fontSize={12} fontWeight={600} opacity={isDrawn ? 1 : 0} style={{ transition: reduced ? 'none' : 'opacity 400ms ease 1.6s' }}>
          Peak ΔF/F0 ≈ {peak.f.toFixed(2)}
        </text>
      </svg>
      <p className="text-sm text-text-muted">
        Peak ΔF/F0 is the highest point after the treatment. AUC is the area under the response curve, over the 1 min after the addition.
      </p>
    </div>
  );
}
