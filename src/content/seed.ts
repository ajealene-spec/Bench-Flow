import { db as defaultDb, type LabCompanionDB } from '../db';
import { addStepRecord, deleteExperiment, getProcedureForExperiment, newId, startExperimentFromTemplate } from '../db/helpers';
import { logEvent, type ExecutionEventInput } from '../db/executionLog';
import { createInventoryItem, linkInventoryUsage } from '../db/inventory';
import type { Procedure, RunValue, StepRecord } from '../types';
import { STARTER_TEMPLATES } from './protocols';
import {
  CELL_METRIC_UNIT,
  FLUO4_ACTUAL_UM,
  FLUO4_PLANNED_UM,
  GENOTYPES,
  ROIS_PER_COVERSLIP,
  SAMPLE_CONDITIONS,
  SAMPLE_DEMO_NOTE,
  SAMPLE_CELLS,
  SAMPLE_LOADING_VOLUME_ML,
  type CellMetric,
  sampleCellLabel,
} from '../features/tour/sampleData';

export const DEMO_EXPERIMENT_NAME = 'Example: Fluo-4 calcium imaging in APOE3 vs APOE4 astrocytes';
const DEMO_TEMPLATE_TITLE = 'Fluo-4 AM calcium imaging in iPSC-derived astrocytes';
/** The demo this app seeded before. Removed on the next seed, but only when it is still untouched. */
const LEGACY_DEMO_NAME = 'Example: IF staining of mouse hippocampus';
const LEGACY_DEMO_NOTES =
  'Sections from the dorsal hippocampus. The block ran about 7 minutes over. The primary antibody volume was raised from 4 to 5 µL because the stock had settled.';
const LEGACY_DEMO_ITEM_NAMES = [
  'Rabbit anti-NeuN (example)',
  'Donkey anti-rabbit Alexa Fluor 488 (example)',
  'DAPI stock (example)',
  'Antifade mounting medium (example)',
];
const MINUTE = 60_000;

export interface SeedResult {
  templatesAdded: number;
  demoAdded: boolean;
}

export interface SeedOptions {
  /**
   * Titles of the starters to add, in the order they should be added. Omit to add every starter.
   * Unknown titles are ignored.
   */
  titles?: readonly string[];
}

/** Calls run one after another, so two taps cannot both add the same starter. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Loads the starter protocols and a finished demo experiment. Safe to call again: starters are
 * skipped when a template with the same title exists, and the demo is skipped when it exists.
 */
export function seedStarterContent(database: LabCompanionDB = defaultDb, options: SeedOptions = {}): Promise<SeedResult> {
  const run = queue.then(() => seedOnce(database, options));
  queue = run.catch(() => undefined);
  return run;
}

async function seedOnce(database: LabCompanionDB, options: SeedOptions): Promise<SeedResult> {
  const titles = new Set((await database.templates.toArray()).map((t) => t.title));
  let templatesAdded = 0;
  for (const template of selectStarters(options.titles)) {
    if (titles.has(template.title)) continue;
    await database.templates.add(structuredClone(template));
    titles.add(template.title);
    templatesAdded += 1;
  }
  await removeUntouchedLegacyDemo(database);
  const demoAdded = await seedDemoExperiment(database);
  await addMissingSampleCells(database);
  return { templatesAdded, demoAdded };
}

/** The starter templates to add, in the requested order. */
function selectStarters(wanted: readonly string[] | undefined) {
  if (!wanted) return STARTER_TEMPLATES;
  const byTitle = new Map(STARTER_TEMPLATES.map((t) => [t.title, t]));
  return wanted.map((title) => byTitle.get(title)).filter((t): t is (typeof STARTER_TEMPLATES)[number] => t !== undefined);
}

/** The sample cells are stored with the run, so the report and the data package carry them. */
function sampleCellRecords(experimentId: string, stepId: string, existing: Set<string>): StepRecord[] {
  const records: StepRecord[] = [];
  const createdAt = Date.now();
  for (const metric of ['peak', 'auc'] as CellMetric[]) {
    for (const genotype of GENOTYPES) {
      for (const condition of SAMPLE_CONDITIONS) {
        const values = SAMPLE_CELLS[genotype][condition.id][metric];
        values.forEach((value, i) => {
          const coverslip = Math.floor(i / ROIS_PER_COVERSLIP) + 1;
          const roi = (i % ROIS_PER_COVERSLIP) + 1;
          const label = sampleCellLabel(metric, genotype, condition.id, coverslip, roi);
          if (existing.has(label)) return;
          records.push({
            id: newId(),
            experimentId,
            stepId,
            kind: 'number',
            label,
            value,
            unit: CELL_METRIC_UNIT[metric],
            note: SAMPLE_DEMO_NOTE,
            createdAt,
          });
        });
      }
    }
  }
  return records;
}

/** Adds the sample cells (peak ΔF/F0 and AUC for every ROI) to the demo run. Skips any already present. */
async function addMissingSampleCells(database: LabCompanionDB): Promise<void> {
  const demo = await database.experiments.filter((e) => e.name === DEMO_EXPERIMENT_NAME).first();
  if (!demo) return;
  const procedure = await getProcedureForExperiment(demo.id, database);
  if (!procedure) return;
  const existing = new Set(
    (await database.stepRecords.where('experimentId').equals(demo.id).toArray()).map((r) => r.label),
  );
  const records = sampleCellRecords(demo.id, stepIdByTitle(procedure, 'Analyze in FIJI'), existing);
  if (records.length > 0) await database.stepRecords.bulkAdd(records);
}

/** Deletes the old IF demo only when it is still the untouched seeded copy: same notes, never edited after seeding. */
async function removeUntouchedLegacyDemo(database: LabCompanionDB): Promise<void> {
  const legacy = await database.experiments.filter((e) => e.name === LEGACY_DEMO_NAME).toArray();
  for (const run of legacy) {
    if (run.notes !== LEGACY_DEMO_NOTES || run.updatedAt !== run.endedAt) continue;
    const usages = await database.inventoryUsage.filter((u) => u.experimentId === run.id).toArray();
    await deleteExperiment(run.id, database);
    await database.executionEvents.filter((e) => e.experimentId === run.id).delete();
    await database.runValues.filter((v) => v.experimentId === run.id).delete();
    await database.inventoryUsage.filter((u) => u.experimentId === run.id).delete();
    // Remove the example reagents only when nothing else still uses them.
    for (const itemId of new Set(usages.map((u) => u.inventoryItemId))) {
      const item = await database.inventory.get(itemId);
      const stillUsed = await database.inventoryUsage.filter((u) => u.inventoryItemId === itemId).count();
      if (item && LEGACY_DEMO_ITEM_NAMES.includes(item.name) && stillUsed === 0) await database.inventory.delete(itemId);
    }
  }
}

/** A finished calcium imaging run with a planned-against-actual loading concentration, sample cells, reagent lots and notes. */
async function seedDemoExperiment(database: LabCompanionDB): Promise<boolean> {
  const exists = await database.experiments.filter((e) => e.name === DEMO_EXPERIMENT_NAME).first();
  if (exists) return false;
  const template = await database.templates.filter((t) => t.title === DEMO_TEMPLATE_TITLE).first();
  if (!template) return false;

  const experiment = await startExperimentFromTemplate(template.id, DEMO_EXPERIMENT_NAME, database);
  const procedure = await getProcedureForExperiment(experiment.id, database);
  if (!procedure) return false;

  // Timeline, in minutes from the start of the run. Sample data.
  const base = Date.now() - 3 * 24 * 60 * MINUTE;
  const at = (minutes: number) => base + minutes * MINUTE;
  const idOf = (title: string) => stepIdByTitle(procedure, title);
  const log = (partial: Omit<ExecutionEventInput, 'experimentId'>) =>
    logEvent({ experimentId: experiment.id, ...partial }, database);

  const coatId = idOf('Coat coverslips');
  const loadId = idOf('Load Fluo-4 AM at 37 °C');
  const roomId = idOf('Room temperature incubation');
  const imagingId = idOf('Set up live imaging');
  const treatId = idOf('Add treatment and record');
  const analysisId = idOf('Analyze in FIJI');

  await log({ type: 'step_start', stepId: coatId, at: at(0) });
  await log({ type: 'step_complete', stepId: coatId, at: at(20) });
  await log({ type: 'step_start', stepId: idOf('Culture to 80% confluency'), at: at(20) });
  await log({ type: 'step_complete', stepId: idOf('Culture to 80% confluency'), at: at(1460) });

  // Loading: 1 h at 37 °C on time, with the Fluo-4 AM loaded at 4.17 µM instead of the planned 5 µM.
  await log({ type: 'step_start', stepId: loadId, at: at(1470) });
  await log({ type: 'timer_start', stepId: loadId, planned: 3600, unit: 's', at: at(1470) });
  await log({ type: 'timer_stop', stepId: loadId, planned: 3600, actual: 3600, unit: 's', at: at(1530) });
  await log({
    type: 'value_change',
    stepId: loadId,
    planned: FLUO4_PLANNED_UM,
    actual: FLUO4_ACTUAL_UM,
    unit: 'µM',
    note: 'Fluo-4 AM loading concentration',
    at: at(1531),
    deviation: { kind: 'value', delta: Number((FLUO4_ACTUAL_UM - FLUO4_PLANNED_UM).toFixed(2)) },
  });
  await log({ type: 'step_complete', stepId: loadId, at: at(1532) });
  await addStepRecord(
    { experimentId: experiment.id, stepId: loadId, kind: 'timer', label: 'Load timer', startedAt: at(1470), stoppedAt: at(1530), elapsedSec: 3600 },
    database,
  );

  // Room temperature: 30 minutes, on time.
  await log({ type: 'step_start', stepId: roomId, at: at(1533) });
  await log({ type: 'timer_start', stepId: roomId, planned: 1800, unit: 's', at: at(1533) });
  await log({ type: 'timer_stop', stepId: roomId, planned: 1800, actual: 1800, unit: 's', at: at(1563) });
  await log({ type: 'step_complete', stepId: roomId, at: at(1563) });

  await log({ type: 'step_start', stepId: imagingId, at: at(1570) });
  await log({ type: 'step_complete', stepId: imagingId, at: at(1575) });
  await log({ type: 'step_start', stepId: treatId, at: at(1580) });
  await log({ type: 'step_complete', stepId: treatId, at: at(1700) });

  await log({ type: 'step_start', stepId: analysisId, at: at(1800) });
  await addStepRecord(
    { experimentId: experiment.id, stepId: analysisId, kind: 'number', label: 'ROIs analyzed', value: 240, unit: 'cells' },
    database,
  );
  await log({ type: 'step_complete', stepId: analysisId, at: at(2400) });

  // The stock volume that matches the actual 4.17 µM loading: 4.17 µM × 2 mL / 1 mM = 8.34 µL.
  const stockVar = template.steps
    .find((s) => s.title === 'Load Fluo-4 AM at 37 °C')
    ?.variables?.find((v) => v.token === 'Stock to add');
  if (stockVar) {
    const value: RunValue = {
      experimentId: experiment.id,
      stepId: loadId,
      varId: stockVar.id,
      value: Number(((FLUO4_ACTUAL_UM * SAMPLE_LOADING_VOLUME_ML * 1000) / 1000).toFixed(2)),
      unit: 'µL',
      editedAt: at(1531),
    };
    await database.runValues.put(value);
  }

  // Reagents with lots. Names and lots are examples, not real stock.
  const fluo4 = await createInventoryItem(
    { name: 'Fluo-4 AM (example)', kind: 'reagent', vendor: 'Example vendor', catalogNumber: 'EX-4401', lotNumber: 'LOT FL-2208', concentration: '1 mM in DMSO', expiresOn: '2027-04-30', location: 'Freezer A, shelf 1' },
    database,
  );
  const dmso = await createInventoryItem(
    { name: 'DMSO, anhydrous (example)', kind: 'reagent', lotNumber: 'LOT DM-4417', expiresOn: '2028-01-31' },
    database,
  );
  const matrigel = await createInventoryItem(
    { name: 'Matrigel (example)', kind: 'reagent', vendor: 'Example vendor', lotNumber: 'LOT MG-1190', location: 'Freezer B, shelf 2', expiresOn: '2027-02-28' },
    database,
  );
  const laminin = await createInventoryItem(
    { name: 'Laminin (example)', kind: 'reagent', lotNumber: 'LOT LN-0631', expiresOn: '2027-08-31' },
    database,
  );
  const glutamate = await createInventoryItem(
    { name: 'Glutamate (example)', kind: 'reagent', lotNumber: 'LOT GL-7302', concentration: '5 µM working', expiresOn: '2028-05-31' },
    database,
  );
  const alphaSyn = await createInventoryItem(
    { name: 'Alpha-synuclein, monomeric (example)', kind: 'reagent', lotNumber: 'LOT AS-0915', concentration: '100 nM and 500 nM working', location: 'Freezer A, shelf 3' },
    database,
  );
  const tris = await createInventoryItem(
    { name: 'Tris-HCl buffer (example)', kind: 'buffer', lotNumber: 'LOT TR-2290', expiresOn: '2028-03-31' },
    database,
  );
  await linkInventoryUsage(experiment.id, matrigel.id, coatId, database);
  await linkInventoryUsage(experiment.id, laminin.id, coatId, database);
  await linkInventoryUsage(experiment.id, fluo4.id, loadId, database);
  await linkInventoryUsage(experiment.id, dmso.id, loadId, database);
  await linkInventoryUsage(experiment.id, tris.id, treatId, database);
  await linkInventoryUsage(experiment.id, glutamate.id, treatId, database);
  await linkInventoryUsage(experiment.id, alphaSyn.id, treatId, database);

  await addMissingSampleCells(database);

  await database.experiments.update(experiment.id, {
    status: 'done',
    createdAt: base,
    startedAt: at(0),
    endedAt: at(2400),
    updatedAt: at(2400),
    lastOpenedAt: at(2400),
    notes:
      'Sample data for demonstration. Fluo-4 AM was loaded at 4.17 µM instead of the planned 5 µM, so 8.34 µL of stock was used for a 2 mL load instead of 10 µL. The sample numbers are not results.',
  });

  return true;
}

function stepIdByTitle(procedure: Procedure, title: string): string {
  const step = procedure.steps.find((s) => s.title === title);
  if (!step) throw new Error(`Starter step "${title}" is missing`);
  return step.id;
}

/**
 * Path to the finished demo experiment's report. Loads the starter content first when the demo is missing.
 * Returns null only if the demo cannot be created (for example, the starter template failed to load).
 */
export async function demoReportPath(database: LabCompanionDB = defaultDb): Promise<string | null> {
  const find = () => database.experiments.filter((e) => e.name === DEMO_EXPERIMENT_NAME).first();
  let demo = await find();
  if (!demo) {
    await seedStarterContent(database);
    demo = await find();
  }
  return demo ? `/experiment/${demo.id}/report` : null;
}
