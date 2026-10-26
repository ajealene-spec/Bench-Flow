import { describe, expect, it } from 'vitest';
import { PERFUSION_PRESETS, PerfusionError, perfusionPlan } from './perfusion';

describe('perfusionPlan', () => {
  it('scales volumes with body weight', () => {
    const plan = perfusionPlan(25, { salineMlPerG: 1, fixativeMlPerG: 1 });
    expect(plan).toEqual({ weightG: 25, salineMl: 25, fixativeMl: 25, totalMl: 50 });
  });

  it('adds pump minutes when a flow rate is given', () => {
    const plan = perfusionPlan(30, { salineMlPerG: 0.5, fixativeMlPerG: 1, flowMlPerMin: 3 });
    expect(plan.salineMl).toBe(15);
    expect(plan.salineMin).toBe(5);
    expect(plan.fixativeMin).toBe(10);
  });

  it('uses the mouse preset', () => {
    expect(perfusionPlan(20, PERFUSION_PRESETS.mouse).totalMl).toBe(40);
  });

  it('rejects bad weight, rates or flow', () => {
    expect(() => perfusionPlan(0, PERFUSION_PRESETS.mouse)).toThrow(PerfusionError);
    expect(() => perfusionPlan(20, { salineMlPerG: -1, fixativeMlPerG: 1 })).toThrow(PerfusionError);
    expect(() => perfusionPlan(20, { salineMlPerG: 1, fixativeMlPerG: 1, flowMlPerMin: 0 })).toThrow(PerfusionError);
  });
});
