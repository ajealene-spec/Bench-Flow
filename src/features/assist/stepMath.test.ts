import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from '../../db';
import { listExecutionEvents } from '../../db/executionLog';
import type { StepVariable } from '../../types';
import { computeValues, setRunValue } from './stepMath';

const dilution: StepVariable = { id: 'q1', token: '1:1000', value: 1000, unit: '1:N', role: 'input' };
const finalVol: StepVariable = { id: 'q2', token: '10 mL', value: 10, unit: 'mL', role: 'input' };
const antibody: StepVariable = { id: 'd1', token: 'antibody volume', value: 0, unit: 'µL', role: 'derived', formula: 'q2 * 1000 / q1' };
const vars = [dilution, finalVol, antibody];

let database: LabCompanionDB;

beforeEach(async () => {
  database = new LabCompanionDB(`stepmath-${crypto.randomUUID()}`);
  await database.open();
});

describe('computeValues', () => {
  it('evaluates derived values from template inputs', () => {
    const values = computeValues(vars);
    expect(values.d1).toBeCloseTo(10, 10);
  });

  it('lets an override replace an input and recompute the derived value', () => {
    const values = computeValues(vars, { q1: 500 });
    expect(values.q1).toBe(500);
    expect(values.d1).toBeCloseTo(20, 10);
  });

  it('lets an override replace a derived value directly', () => {
    expect(computeValues(vars, { d1: 7 }).d1).toBe(7);
  });

  it('gives NaN for a formula that cannot be evaluated', () => {
    const broken: StepVariable = { id: 'd2', token: 'x', value: 0, unit: 'µL', role: 'derived', formula: 'q9 * 2' };
    expect(computeValues([...vars, broken]).d2).toBeNaN();
  });
});

describe('setRunValue', () => {
  const input = { experimentId: 'exp-1', stepId: 's1' };

  it('writes the run value keyed by experiment, step and variable', async () => {
    await setRunValue({ ...input, variable: antibody, planned: 10, value: 12 }, database);
    const row = await database.runValues.get(['exp-1', 's1', 'd1']);
    expect(row).toMatchObject({ experimentId: 'exp-1', stepId: 's1', varId: 'd1', value: 12, unit: 'µL' });
  });

  it('logs a value_change with planned, actual and unit, and a value deviation when it differs', async () => {
    await setRunValue({ ...input, variable: antibody, planned: 10, value: 12 }, database);
    const [event] = await listExecutionEvents('exp-1', database);
    expect(event).toMatchObject({
      experimentId: 'exp-1',
      type: 'value_change',
      stepId: 's1',
      planned: 10,
      actual: 12,
      unit: 'µL',
      deviation: { kind: 'value', delta: 2 },
    });
  });

  it('logs without a deviation when the value matches the plan', async () => {
    await setRunValue({ ...input, variable: antibody, planned: 10, value: 10 }, database);
    const [event] = await listExecutionEvents('exp-1', database);
    expect(event.type).toBe('value_change');
    expect(event.deviation).toBeUndefined();
  });

  it('appends one event per change and never rewrites earlier ones', async () => {
    await setRunValue({ ...input, variable: antibody, planned: 10, value: 12 }, database);
    await setRunValue({ ...input, variable: antibody, planned: 10, value: 9 }, database);
    const events = await listExecutionEvents('exp-1', database);
    expect(events.map((e) => e.actual)).toEqual([12, 9]);
    expect(events[1].deviation?.delta).toBe(-1);
  });
});
