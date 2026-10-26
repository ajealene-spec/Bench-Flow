import { db as defaultDb, type LabCompanionDB } from '../../db';
import type { Experiment } from '../../types';
import { shiftPlannedStart } from './experimentBlocks';

/** Runs the user can still put on the calendar: not started and not finished. */
export function isSchedulable(experiment: Experiment): boolean {
  return experiment.startedAt === undefined && experiment.endedAt === undefined;
}

/** Sets (or clears, when undefined) the planned start of an unstarted run. The schema is unchanged. */
export async function setPlannedStart(
  experimentId: string,
  plannedStart: number | undefined,
  database: LabCompanionDB = defaultDb,
): Promise<void> {
  await database.transaction('rw', database.experiments, async () => {
    const current = await database.experiments.get(experimentId);
    if (!current) throw new Error(`Experiment ${experimentId} not found`);
    const next: Experiment = { ...current, updatedAt: Date.now() };
    if (plannedStart === undefined) {
      delete next.plannedStart;
    } else {
      next.plannedStart = plannedStart;
    }
    await database.experiments.put(next);
  });
}

/** Moves a whole unstarted run so its first day lands on toDay. The time of day is kept. */
export async function moveExperimentToDay(
  experimentId: string,
  fromDay: string,
  toDay: string,
  database: LabCompanionDB = defaultDb,
): Promise<void> {
  const experiment = await database.experiments.get(experimentId);
  if (!experiment || experiment.plannedStart === undefined || !isSchedulable(experiment)) return;
  await setPlannedStart(experimentId, shiftPlannedStart(experiment.plannedStart, fromDay, toDay), database);
}
