import { describe, expect, it } from 'vitest';
import type { EphysRecord, Experiment, ExecutionEvent, Procedure, StepRecord } from '../../types';
import {
  buildInsightsRun,
  dayEnd,
  dayStart,
  ephysStrip,
  filterRuns,
  meanSd,
  NO_PROTOCOL,
  numericSeries,
  protocolOptions,
  scoresOverTime,
  timerDeviationBars,
  type InsightsRun,
  type RawRun,
} from './insightsData';

function exp(id: string, startedAt: number, name = id): Experiment {
  return { id, name, status: 'done', folderId: null, createdAt: startedAt, updatedAt: startedAt, startedAt };
}

function procedure(title: string, steps: Array<[string, string]>): Procedure {
  return {
    id: `p-${title}`,
    experimentId: 'x',
    title,
    steps: steps.map(([id, t]) => ({ id, title: t, instructions: '', timers: [], reagents: [], dataFields: [], cautions: [] })),
    createdAt: 0,
    updatedAt: 0,
  };
}

const rec = (over: Partial<StepRecord>): StepRecord => ({
  id: Math.random().toString(36).slice(2),
  experimentId: 'x',
  stepId: 's1',
  kind: 'number',
  label: 'Concentration',
  createdAt: 0,
  ...over,
});

function raw(id: string, startedAt: number, extra: Partial<RawRun> = {}): RawRun {
  return {
    experiment: exp(id, startedAt),
    procedure: procedure('Western blot', [['s1', 'Load gel'], ['s2', 'Transfer']]),
    records: [],
    events: [],
    ephys: [],
    score: null,
    ...extra,
  };
}

describe('dayStart and dayEnd', () => {
  it('bracket a local calendar day inclusively', () => {
    const start = dayStart('2026-10-26')!;
    expect(new Date(start).getHours()).toBe(0);
    expect(dayEnd('2026-10-26')! - start).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it('returns undefined for text that is not a date', () => {
    expect(dayStart('26/10/2026')).toBeUndefined();
    expect(dayEnd('')).toBeUndefined();
  });
});

describe('meanSd', () => {
  it('uses the sample standard deviation', () => {
    const s = meanSd([2, 4, 4, 4, 5, 5, 7, 9])!;
    expect(s.mean).toBe(5);
    expect(s.sd).toBeCloseTo(Math.sqrt(32 / 7), 10);
    expect(s.n).toBe(8);
  });

  it('returns sd 0 for one value and undefined for none', () => {
    expect(meanSd([3])).toEqual({ n: 1, mean: 3, sd: 0 });
    expect(meanSd([])).toBeUndefined();
  });
});

describe('buildInsightsRun', () => {
  it('matches records and timers to step titles and skips non-numeric records', () => {
    const run = buildInsightsRun(
      raw('a', 100, {
        records: [
          rec({ stepId: 's1', value: 2.5, unit: 'mg/mL' }),
          rec({ stepId: 's1', kind: 'timer', value: undefined }),
          rec({ stepId: 'gone', value: 1 }),
        ],
        events: [
          { id: 'e', experimentId: 'a', at: 1, type: 'timer_stop', stepId: 's2', planned: 600, actual: 660 } as ExecutionEvent,
          { id: 'f', experimentId: 'a', at: 2, type: 'timer_stop', stepId: 's2', planned: 0, actual: 5 } as ExecutionEvent,
        ],
      }),
    );
    expect(run.numbers.map((n) => n.stepTitle)).toEqual(['Load gel', 'Unassigned']);
    expect(run.timers).toEqual([{ stepTitle: 'Transfer', plannedSec: 600, actualSec: 660 }]);
    expect(run.protocol).toBe('Western blot');
  });

  it('groups runs without a procedure under No protocol and drops incomplete ephys rows', () => {
    const ephys: EphysRecord[] = [
      { id: 'c', experimentId: 'a', cellId: 'c1', Rm: 300, Ra: 12, Cm: 40, holding: -70, at: 1 },
      { id: 'd', experimentId: 'a', cellId: 'c2', Rm: Number.NaN, Ra: 10, Cm: 40, holding: -70, at: 2 },
    ];
    const run = buildInsightsRun(raw('a', 1, { procedure: undefined, ephys }));
    expect(run.protocol).toBe(NO_PROTOCOL);
    expect(run.ephys).toEqual([{ cellId: 'c1', Ra: 12, Rm: 300 }]);
  });
});

describe('filterRuns and protocolOptions', () => {
  const runs: InsightsRun[] = [
    buildInsightsRun(raw('r1', 100)),
    buildInsightsRun(raw('r3', 300)),
    buildInsightsRun(raw('r2', 200, { procedure: procedure('Patch', [['p1', 'Seal']]) })),
  ];

  it('sorts by date and filters by protocol and inclusive date range', () => {
    expect(filterRuns(runs, {}).map((r) => r.experimentId)).toEqual(['r1', 'r2', 'r3']);
    expect(filterRuns(runs, { protocol: 'Western blot' }).map((r) => r.experimentId)).toEqual(['r1', 'r3']);
    expect(filterRuns(runs, { from: 200, to: 300 }).map((r) => r.experimentId)).toEqual(['r2', 'r3']);
  });

  it('lists protocols by run count', () => {
    expect(protocolOptions(runs)).toEqual([
      { protocol: 'Western blot', runCount: 2 },
      { protocol: 'Patch', runCount: 1 },
    ]);
  });
});

describe('numericSeries', () => {
  it('builds one series per step and field with run means and statistics', () => {
    const runs = [
      buildInsightsRun(raw('a', 1, { records: [rec({ value: 2 }), rec({ value: 4 })] })),
      buildInsightsRun(raw('b', 2, { records: [rec({ value: 6 })] })),
      buildInsightsRun(raw('c', 3, { records: [rec({ value: 8, label: 'Other' })] })),
    ];
    const series = numericSeries(runs);
    expect(series).toHaveLength(2);
    const main = series.find((s) => s.label === 'Concentration')!;
    expect(main.points.map((p) => p.value)).toEqual([3, 6]);
    expect(main.points.map((p) => p.runIndex)).toEqual([0, 1]);
    expect(main.stats!.mean).toBeCloseTo(4.5, 10);
    expect(main.stats!.n).toBe(2);
  });

  it('keeps series for different steps separate even when labels match', () => {
    const runs = [
      buildInsightsRun(raw('a', 1, { records: [rec({ stepId: 's1', value: 1 }), rec({ stepId: 's2', value: 9 })] })),
    ];
    expect(numericSeries(runs).map((s) => s.stepTitle)).toEqual(['Load gel', 'Transfer']);
  });
});

describe('timerDeviationBars, ephysStrip and scoresOverTime', () => {
  it('averages absolute timer deviation per step and counts timers outside tolerance', () => {
    const runs = [
      buildInsightsRun(
        raw('a', 1, {
          events: [
            { id: '1', experimentId: 'a', at: 1, type: 'timer_stop', stepId: 's1', planned: 100, actual: 90 } as ExecutionEvent,
            { id: '2', experimentId: 'a', at: 2, type: 'timer_stop', stepId: 's1', planned: 100, actual: 130 } as ExecutionEvent,
          ],
        }),
      ),
    ];
    const [bar] = timerDeviationBars(runs);
    expect(bar.stepTitle).toBe('Load gel');
    expect(bar.n).toBe(2);
    expect(bar.meanAbsPct).toBeCloseTo(20, 10);
    expect(bar.outside).toBe(1);
  });

  it('collects Ra and Rm for the strip plot and scores for runs that have one', () => {
    const runs = [
      buildInsightsRun(raw('a', 1, { ephys: [{ id: 'x', experimentId: 'a', cellId: 'c', Rm: 30, Ra: 9, Cm: 1, holding: -60, at: 1 }], score: 80 })),
      buildInsightsRun(raw('b', 2, { score: null })),
    ];
    const strip = ephysStrip(runs);
    expect(strip.Rm.map((p) => p.value)).toEqual([30]);
    expect(strip.Ra.map((p) => p.value)).toEqual([9]);
    expect(scoresOverTime(runs).map((p) => p.score)).toEqual([80]);
  });
});
