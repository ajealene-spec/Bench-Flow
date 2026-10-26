import { useMemo } from 'react';
import { summarize, formatMeanSd } from './tourStats';
import { useSequence, useTourReducedMotion } from './useTourMotion';
import { SAMPLE_ANIMALS, SAMPLE_COUNTS, SAMPLE_COUNT_UNIT, SAMPLE_REGIONS, SAMPLE_TIMELINE } from './sampleData';
import { TOUR_CARD } from './tourShared';

const W = 400;
const H = 250;
const PLOT = { left: 44, right: 392, top: 18, bottom: 206 };
const Y_MAX = 320;
const TIMELINE_TOTAL_MIN = 1340;

/** Mean bars with ± SD whiskers and one dot per animal, for each region. */
export function StepResults() {
  const reduced = useTourReducedMotion();
  const shownDots = useSequence(SAMPLE_REGIONS.length, { reduced, intervalMs: 500 });
  const stats = useMemo(() => SAMPLE_REGIONS.map((r) => ({ region: r, values: SAMPLE_COUNTS[r], ...summarize(SAMPLE_COUNTS[r]) })), []);
  const y = (v: number) => PLOT.bottom - (v / Y_MAX) * (PLOT.bottom - PLOT.top);
  const slot = (PLOT.right - PLOT.left) / SAMPLE_REGIONS.length;
  const ticks = [0, 100, 200, 300];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className={TOUR_CARD}>
        <div className="flex flex-col gap-1">
          <span className="text-lg font-semibold text-text">NeuN+ cells per region, mean ± SD</span>
          <span className="text-sm text-text-muted">Bars are means. Whiskers are ± SD. Each dot is one sample animal (n = 3). Made-up numbers.</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bar chart of NeuN+ cell counts per region with standard deviation whiskers" className="h-auto w-full">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PLOT.left} x2={PLOT.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
              <text x={PLOT.left - 8} y={y(t) + 4} textAnchor="end" className="fill-text-muted" fontSize={11}>{t}</text>
            </g>
          ))}
          <text x={12} y={(PLOT.top + PLOT.bottom) / 2} transform={`rotate(-90 12 ${(PLOT.top + PLOT.bottom) / 2})`} textAnchor="middle" className="fill-text-muted" fontSize={11}>
            {SAMPLE_COUNT_UNIT}
          </text>
          {stats.map((s, i) => {
            const cx = PLOT.left + slot * i + slot / 2;
            const barW = 64;
            const grown = reduced || i < shownDots;
            return (
              <g key={s.region}>
                <rect
                  x={cx - barW / 2}
                  y={y(s.mean)}
                  width={barW}
                  height={PLOT.bottom - y(s.mean)}
                  rx={6}
                  className={`tour-grow fill-accent/80 ${grown ? 'is-in' : ''}`}
                  style={{ transitionDelay: `${i * 120}ms` }}
                />
                <line x1={cx} x2={cx} y1={y(s.mean - s.sd)} y2={y(s.mean + s.sd)} className="stroke-text" strokeWidth={2} />
                <line x1={cx - 8} x2={cx + 8} y1={y(s.mean + s.sd)} y2={y(s.mean + s.sd)} className="stroke-text" strokeWidth={2} />
                <line x1={cx - 8} x2={cx + 8} y1={y(s.mean - s.sd)} y2={y(s.mean - s.sd)} className="stroke-text" strokeWidth={2} />
                {s.values.map((v, k) => (
                  <circle
                    key={k}
                    cx={cx + (k - 1) * 14}
                    cy={y(v)}
                    r={5}
                    className={`tour-dot ${grown ? 'is-in' : ''} fill-surface stroke-text`}
                    strokeWidth={2}
                    style={{ transitionDelay: `${i * 120 + 200 + k * 90}ms` }}
                  >
                    <title>{`${SAMPLE_ANIMALS[k]}, ${s.region}: ${v} ${SAMPLE_COUNT_UNIT} (sample)`}</title>
                  </circle>
                ))}
                <text x={cx} y={PLOT.bottom + 18} textAnchor="middle" className="fill-text" fontSize={13} fontWeight={600}>
                  {s.region}
                </text>
              </g>
            );
          })}
        </svg>
        <dl className="grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.region} className="rounded-xl bg-surface-2 p-3">
              <dt className="text-sm text-text-muted">{s.region}</dt>
              <dd className="t-num text-lg font-semibold text-text">{formatMeanSd(s)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className={TOUR_CARD}>
        <div className="flex flex-col gap-1">
          <span className="text-lg font-semibold text-text">Run timeline, planned against actual</span>
          <span className="text-sm text-text-muted">Solid bars are what happened. Dashed outlines are the plan for timed steps. Overnight incubation is the long bar.</span>
        </div>
        <ol className="flex flex-col gap-3" aria-label="Timeline of the sample run">
          {SAMPLE_TIMELINE.map((row) => {
            const left = (row.startMin / TIMELINE_TOTAL_MIN) * 100;
            const width = Math.max(0.8, ((row.endMin - row.startMin) / TIMELINE_TOTAL_MIN) * 100);
            const plannedWidth = row.plannedMin ? Math.max(0.8, (row.plannedMin / TIMELINE_TOTAL_MIN) * 100) : 0;
            return (
              <li key={row.label} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-text">{row.label}</span>
                  <span className="t-num text-sm text-text-muted">
                    {Math.round(row.endMin - row.startMin)} min actual
                    {row.plannedMin ? ` · ${row.plannedMin} min planned` : ''}
                  </span>
                </div>
                <div className="relative h-5 w-full rounded-md bg-surface-2">
                  {row.plannedMin && (
                    <div
                      className="absolute inset-y-0 rounded-md border-2 border-dashed border-text-muted"
                      style={{ left: `${left}%`, width: `${plannedWidth}%` }}
                      aria-hidden="true"
                    />
                  )}
                  <div className="tour-grow absolute inset-y-0 rounded-md bg-accent is-in" style={{ left: `${left}%`, width: `${width}%` }} aria-hidden="true" />
                </div>
              </li>
            );
          })}
        </ol>
        <p className="text-sm text-text-muted">Block ran 7 minutes past its plan. The other timed step finished on time.</p>
      </div>
    </div>
  );
}
