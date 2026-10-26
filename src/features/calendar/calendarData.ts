import { db as defaultDb, type LabCompanionDB } from '../../db';
import { listExecutionEvents } from '../../db/executionLog';
import { expandExperimentBlocks, type ExperimentBlock, type ExperimentSource } from './experimentBlocks';
import { expandTaskOccurrences, type TaskOccurrence } from './recurrence';

export interface CalendarItems {
  tasks: TaskOccurrence[];
  blocks: ExperimentBlock[];
}

/**
 * Tasks and experiment phase blocks for the inclusive day range start..end ("yyyy-mm-dd").
 * Reads IndexedDB only. The pure expansion lives in recurrence.ts and experimentBlocks.ts.
 */
export async function listCalendarItems(
  start: string,
  end: string,
  database: LabCompanionDB = defaultDb,
  now: number = Date.now(),
): Promise<CalendarItems> {
  const [taskRows, experiments] = await Promise.all([
    database.tasks.where('date').belowOrEqual(end).toArray(),
    database.experiments.toArray(),
  ]);

  const sources: ExperimentSource[] = [];
  for (const experiment of experiments) {
    if (experiment.startedAt === undefined && experiment.plannedStart === undefined) continue;
    const procedure = await database.procedures.where('experimentId').equals(experiment.id).first();
    if (!procedure) continue;
    sources.push({
      experiment,
      title: procedure.title,
      steps: procedure.steps,
      phases: procedure.phases ?? [],
      events: await listExecutionEvents(experiment.id, database),
    });
  }

  return {
    tasks: expandTaskOccurrences(taskRows, start, end),
    blocks: expandExperimentBlocks(sources, start, end, now),
  };
}
