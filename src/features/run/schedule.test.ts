import { describe, expect, it } from 'vitest';
import type { ExecutionEvent, Step } from '../../types';
import { plannedStepMs, projectSchedule } from './schedule';
import { dayNumber, formatGap, phaseEndedAt } from './phasePause';

const step = (id: string, durationSec?: number, timerSec?: number, phaseId?: string): Step => ({
  id,
  title: `Step ${id}`,
  instructions: '',
  durationSec,
  timers: timerSec ? [{ id: `${id}-t`, stepId: id, label: 'T', durationSec: timerSec, status: 'idle' }] : [],
  reagents: [],
  dataFields: [],
  cautions: [],
  phaseId,
});

const event = (type: ExecutionEvent['type'], at: number, stepId?: string): ExecutionEvent => ({
  id: `${type}-${at}`,
  experimentId: 'exp-1',
  at,
  type,
  stepId,
});

const steps = [step('a', 60), step('b', undefined, 120), step('c', 300)];

describe('projectSchedule', () => {
  it('lays remaining steps end to end from now when the run has never resumed', () => {
    const items = projectSchedule(steps, [], 1_000_000);
    expect(items.map((i) => i.stepId)).toEqual(['a', 'b', 'c']);
    expect(items[0]).toMatchObject({ startAt: 1_000_000, endAt: 1_060_000 });
    expect(items[1]).toMatchObject({ startAt: 1_060_000, endAt: 1_180_000 });
    expect(items[2]).toMatchObject({ startAt: 1_180_000, endAt: 1_480_000 });
  });

  it('leaves out completed and skipped steps', () => {
    const events = [event('step_complete', 10, 'a'), event('step_skip', 20, 'b')];
    expect(projectSchedule(steps, events, 1_000).map((i) => i.stepId)).toEqual(['c']);
  });

  it('shifts the remaining schedule to the resume time', () => {
    // Paused on day 1, resumed 18 hours later. Day 2 steps are planned from the resume time.
    const resumeAt = 1_000 + 18 * 3_600_000;
    const events = [event('step_complete', 10, 'a'), event('phase_resume', resumeAt)];
    const items = projectSchedule(steps, events, resumeAt);
    expect(items[0].startAt).toBe(resumeAt);
    expect(items[0].stepId).toBe('b');
    expect(items[1].startAt).toBe(resumeAt + 120_000);
  });

  it('never plans a step before now, even if the last resume is older', () => {
    const events = [event('phase_resume', 1_000)];
    const items = projectSchedule(steps, events, 500_000);
    expect(items[0].startAt).toBe(500_000);
  });

  it('uses the step duration, or else the longest timer, for planned length', () => {
    expect(plannedStepMs(step('x', 45, 999))).toBe(45_000);
    expect(plannedStepMs(step('y', undefined, 90))).toBe(90_000);
    expect(plannedStepMs(step('z'))).toBe(0);
  });
});

describe('phase pauses', () => {
  const phases = [
    { id: 'p1', name: 'Day one' },
    { id: 'p2', name: 'Day two' },
  ];
  const phased: Step[] = [step('a', 60, undefined, 'p1'), step('b', 60, undefined, 'p1'), step('c', 60, undefined, 'p2')];

  it('finds the end of a phase, but not the end of the whole protocol', () => {
    expect(phaseEndedAt(phased, phases, 0)).toBeUndefined();
    expect(phaseEndedAt(phased, phases, 1)).toEqual({ phase: phases[0], day: 1 });
    expect(phaseEndedAt(phased, phases, 2)).toBeUndefined();
  });

  it('numbers days from the phase order and formats gaps', () => {
    expect(dayNumber(phases, 'p2')).toBe(2);
    expect(dayNumber(phases, 'missing')).toBeUndefined();
    expect(formatGap(18 * 3_600_000 + 20 * 60_000)).toBe('18h 20m');
    expect(formatGap(45 * 60_000)).toBe('45m');
  });
});
