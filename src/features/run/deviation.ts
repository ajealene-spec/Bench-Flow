import type { EventDeviation } from '../../types';

/** A timer that ends more than this fraction away from its planned duration is a deviation. */
export const TIMER_TOLERANCE = 0.1;

/**
 * Compares a timer's actual run time with its plan. Returns a deviation only when the difference
 * is larger than the tolerance. A zero or negative plan has nothing to compare against.
 */
export function timerDeviation(
  plannedSec: number,
  actualSec: number,
  tolerance: number = TIMER_TOLERANCE,
): EventDeviation | undefined {
  if (!(plannedSec > 0)) return undefined;
  const delta = actualSec - plannedSec;
  if (Math.abs(delta) / plannedSec <= tolerance) return undefined;
  return { kind: 'timer', delta, tolerance };
}
