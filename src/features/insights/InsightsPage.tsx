import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../../db';
import { formatDate } from '../../app/format';
import { CARD, INPUT, LABEL } from '../experiments/styles';
import { BarPlot } from './charts/BarPlot';
import { LinePlot } from './charts/LinePlot';
import { StripPlot } from './charts/StripPlot';
import {
  dayEnd,
  dayStart,
  ephysStrip,
  filterRuns,
  numericSeries,
  protocolOptions,
  RM_REFERENCE_MOHM,
  scoresOverTime,
  timerDeviationBars,
  type InsightsRun,
} from './insightsData';
import { loadInsightsRuns } from './loadInsights';
import { PageHeader } from '../../app/ui';
import { isDemoExperiment } from '../tour/sampleNotice';
import { SampleBanner } from '../tour/SampleBanner';

/** Charts drawn from recorded data across runs of the same protocol. Descriptions are written for screen readers too. */
export default function InsightsPage() {
  const runs = useLiveQuery(() => loadInsightsRuns(db), []);
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');

  if (runs === undefined) return <main className="p-6 text-text-muted">Loading insights…</main>;

  const options = protocolOptions(runs);
  const protocol = options.some((o) => o.protocol === chosen) ? chosen : options[0]?.protocol;
  const selected = filterRuns(runs, {
    protocol,
    from: dayStart(fromText),
    to: dayEnd(toText),
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-6 p-4 pb-12 sm:p-6">
      <Link to="/" className="inline-flex min-h-12 w-fit items-center rounded-lg px-3 font-medium text-accent-text underline">
        Back to Command Center
      </Link>
      <PageHeader
        title="Insights"
        subtitle="Charts from the data you recorded, across runs of the same protocol. Use the data table under any chart to read the exact values."
      />

      {runs.length === 0 ? (
        <section className={`${CARD} p-4`}>
          <p className="text-lg">No runs yet. Insights appear once you have recorded numbers, timers or ephys data.</p>
        </section>
      ) : (
        <>
          <section aria-label="Filters" className={`${CARD} grid gap-4 p-4 sm:grid-cols-3`}>
            <label className={LABEL}>
              Protocol
              <select className={INPUT} value={protocol ?? ''} onChange={(e) => setChosen(e.target.value)}>
                {options.map((o) => (
                  <option key={o.protocol} value={o.protocol}>
                    {o.protocol} ({o.runCount})
                  </option>
                ))}
              </select>
            </label>
            <label className={LABEL}>
              From
              <input type="date" className={INPUT} value={fromText} max={toText || undefined} onChange={(e) => setFromText(e.target.value)} />
            </label>
            <label className={LABEL}>
              To
              <input type="date" className={INPUT} value={toText} min={fromText || undefined} onChange={(e) => setToText(e.target.value)} />
            </label>
            <div className="sm:col-span-3 flex flex-wrap items-center gap-3 text-base text-text-muted">
              <span>
                {selected.length} {selected.length === 1 ? 'run' : 'runs'} selected
                {selected.length > 0 && ` · ${formatDate(selected[0].date)} to ${formatDate(selected[selected.length - 1].date)}`}
              </span>
              <button
                type="button"
                className="inline-flex min-h-12 items-center rounded-xl border border-border bg-surface px-4 font-medium text-text shadow-card active:bg-surface-2"
                onClick={() => {
                  setFromText('');
                  setToText('');
                }}
              >
                Clear dates
              </button>
            </div>
          </section>

          {selected.length === 0 ? (
            <section className={`${CARD} p-4`}>
              <p className="text-lg">No runs match these filters.</p>
            </section>
          ) : (
            <>
              {selected.some((r) => isDemoExperiment({ name: r.name })) && (
                <SampleBanner note="The selected runs include the demo experiment. Its numbers are sample data, so the charts below are not real results." />
              )}
              <Sections runs={selected} />
            </>
          )}
        </>
      )}
    </main>
  );
}

function Sections({ runs }: { runs: InsightsRun[] }) {
  const series = numericSeries(runs);
  const timers = timerDeviationBars(runs);
  const strip = ephysStrip(runs);
  const scores = scoresOverTime(runs);
  const ticks = runTicks(runs);

  return (
    <div className="flex flex-col gap-6">
      <Panel heading="Recorded numbers over runs">
        {series.length === 0 && <Empty>No numbers recorded for these runs yet.</Empty>}
        {series.map((s) => (
          <LinePlot
            key={s.key}
            title={`${s.stepTitle}: ${s.label}${s.unit ? ` (${s.unit})` : ''}`}
            desc={
              s.stats
                ? `${s.points.length} ${s.points.length === 1 ? 'run' : 'runs'}. Mean ${round(s.stats.mean)}, SD ${round(s.stats.sd)}. Shaded band is mean ± 1 SD.`
                : 'One value per run.'
            }
            xLabel="Run, oldest first"
            yLabel={s.unit ?? s.label}
            points={s.points.map((p) => ({ x: p.runIndex, y: p.value, label: `${p.runName}: ${round(p.value)}${s.unit ? ` ${s.unit}` : ''}` }))}
            xTicks={ticks}
            band={s.stats ? { mean: s.stats.mean, sd: s.stats.sd } : undefined}
            table={{
              headers: ['Run', 'Date', `${s.label}${s.unit ? ` (${s.unit})` : ''}`],
              rows: s.points.map((p) => [p.runName, formatDate(p.date), round(p.value)]),
            }}
          />
        ))}
      </Panel>

      <Panel heading="Timer deviation per step">
        {timers.length === 0 ? (
          <Empty>No timers were run in these runs.</Empty>
        ) : (
          <BarPlot
            title="Mean timer deviation by step"
            desc="Mean absolute difference between the planned and actual timer, as a percentage of the plan, across all runs. Longer bars drift further."
            valueLabel="Mean absolute deviation (%)"
            bars={timers.map((t) => ({ label: t.stepTitle, value: round(t.meanAbsPct), note: `${t.outside} of ${t.n} outside 10%` }))}
            table={{
              headers: ['Step', 'Timers', 'Mean |deviation| %', 'Outside 10%'],
              rows: timers.map((t) => [t.stepTitle, t.n, round(t.meanAbsPct), t.outside]),
            }}
          />
        )}
      </Panel>

      <Panel heading="Ephys input resistance and access resistance">
        {strip.Rm.length === 0 ? (
          <Empty>No whole-cell records for these runs.</Empty>
        ) : (
          <StripPlot
            title="Ra and Rm per cell"
            desc={`Each dot is one recorded cell. Dashed line marks ${RM_REFERENCE_MOHM} MΩ. Ra is access resistance, Rm is membrane resistance.`}
            yLabel="Resistance (MΩ)"
            groups={[
              { label: 'Ra', values: strip.Ra.map((p) => ({ value: round(p.value), label: `${p.runName}, ${p.cellId}` })) },
              { label: 'Rm', values: strip.Rm.map((p) => ({ value: round(p.value), label: `${p.runName}, ${p.cellId}` })) },
            ]}
            reference={{ value: RM_REFERENCE_MOHM, label: `${RM_REFERENCE_MOHM} MΩ` }}
            table={{
              headers: ['Measure', 'Run', 'Cell', 'MΩ'],
              rows: [
                ...strip.Ra.map((p) => ['Ra', p.runName, p.cellId, round(p.value)]),
                ...strip.Rm.map((p) => ['Rm', p.runName, p.cellId, round(p.value)]),
              ],
            }}
          />
        )}
      </Panel>

      <Panel heading="Documentation completeness over time">
        {scores.length === 0 ? (
          <Empty>No scored runs yet.</Empty>
        ) : (
          <LinePlot
            title="Documentation completeness score by run"
            desc="Score 0 to 100 for how completely each run was documented. This is documentation completeness, not experimental quality."
            xLabel="Run, oldest first"
            yLabel="Score (0–100)"
            points={scores.map((p, i) => ({ x: i, y: p.score, label: `${p.runName}: ${p.score}` }))}
            xTicks={ticksFromList(scores.map((p, i) => ({ i, label: formatDate(p.date) })))}
            table={{
              headers: ['Run', 'Date', 'Score'],
              rows: scores.map((p) => [p.runName, formatDate(p.date), p.score]),
            }}
          />
        )}
      </Panel>
    </div>
  );
}

function Panel({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section aria-label={heading} className={`${CARD} flex flex-col gap-6 p-4 sm:p-6`}>
      <h2 className="text-xl font-semibold text-text">{heading}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-base text-text-muted">{children}</p>;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Up to five x ticks spread across the runs, labelled with run dates. */
function runTicks(runs: InsightsRun[]): Array<{ value: number; label: string }> {
  return ticksFromList(runs.map((r, i) => ({ i, label: formatDate(r.date) })));
}

function ticksFromList(items: Array<{ i: number; label: string }>): Array<{ value: number; label: string }> {
  if (items.length <= 5) return items.map((it) => ({ value: it.i, label: it.label }));
  const step = (items.length - 1) / 4;
  return [0, 1, 2, 3, 4].map((k) => {
    const it = items[Math.round(k * step)];
    return { value: it.i, label: it.label };
  });
}
