import type { ExecutionEvent, Step } from '../../types';

export interface ScheduleItem {
  stepId: string;
  title: string;
  phaseId?: string;
  /** Planned clock time (ms). */
  startAt: number;
  endAt: number;
}

/** Planned length of one step: its own duration if given, otherwise its longest timer. */
export function plannedStepMs(step: Step): number {
  const longest = step.timers.reduce((max, t) => Math.max(max, t.durationSec), 0);
  return (step.durationSec ?? longest) * 1000;
}

/**
 * Planned clock times for the steps not yet completed or skipped. The schedule starts at the latest
 * resume (or now, if the run has never been resumed), and never earlier than now, so it reads as
 * "from here on". Each step follows the one before it. Pure: pass the time in.
 */
export function projectSchedule(steps: Step[], events: ExecutionEvent[], now: number): ScheduleItem[] {
  const finished = new Set(
    events
      .filter((e) => e.type === 'step_complete' || e.type === 'step_skip')
      .map((e) => e.stepId)
      .filter((id): id is string => id !== undefined),
  );
  const resumes = events.filter((e) => e.type === 'phase_resume').map((e) => e.at);
  const resumedAt = resumes.length > 0 ? Math.max(...resumes) : now;
  let cursor = Math.max(resumedAt, now);

  return steps
    .filter((s) => !finished.has(s.id))
    .map((s) => {
      const startAt = cursor;
      cursor += plannedStepMs(s);
      return { stepId: s.id, title: s.title, phaseId: s.phaseId, startAt, endAt: cursor };
    });
}
