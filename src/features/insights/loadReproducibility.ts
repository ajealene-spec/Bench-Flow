import { db as defaultDb, type LabCompanionDB } from '../../db';
import { listExecutionEvents } from '../../db/executionLog';
import { getAnimal } from '../../db/animals';
import { getInventoryItem, listInventoryUsageForExperiment } from '../../db/inventory';
import { getProcedureForExperiment } from '../../db/helpers';
import type { ReproducibilityInput } from './reproducibility';

/** Gathers the stored data the reproducibility score reads for one run. Resolves to undefined when the run is missing. */
export async function loadReproducibilityInput(
  experimentId: string,
  database: LabCompanionDB = defaultDb,
): Promise<ReproducibilityInput | undefined> {
  const experiment = await database.experiments.get(experimentId);
  if (!experiment) return undefined;
  const [procedure, events, usages] = await Promise.all([
    getProcedureForExperiment(experimentId, database),
    listExecutionEvents(experimentId, database),
    listInventoryUsageForExperiment(experimentId, database),
  ]);

  const itemIds = [...new Set(usages.map((u) => u.inventoryItemId))];
  const reagents: ReproducibilityInput['reagents'] = [];
  for (const id of itemIds) {
    const item = await getInventoryItem(id, database);
    if (item) reagents.push({ id: item.id, kind: item.kind, name: item.name, lotNumber: item.lotNumber, rrid: item.rrid });
  }

  const animals: ReproducibilityInput['animals'] = [];
  for (const id of experiment.animalIds ?? []) {
    const animal = await getAnimal(id, database);
    if (animal) animals.push({ id: animal.id, rrid: animal.rrid });
  }

  return {
    steps: (procedure?.steps ?? []).map((s) => ({ id: s.id, title: s.title, instructions: s.instructions })),
    events,
    reagents,
    animals,
    safetyChecklist: experiment.safetyChecklist,
  };
}
