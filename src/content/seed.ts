import { db as defaultDb, type LabCompanionDB } from '../db';
import { addStepRecord, getProcedureForExperiment, startExperimentFromTemplate } from '../db/helpers';
import { logEvent, type ExecutionEventInput } from '../db/executionLog';
import { createInventoryItem, linkInventoryUsage } from '../db/inventory';
import type { Procedure, RunValue } from '../types';
import { STARTER_TEMPLATES } from './protocols';
import { SAMPLE_ANIMALS, SAMPLE_COUNTS, SAMPLE_COUNT_UNIT, SAMPLE_REGIONS, sampleCountLabel } from '../features/tour/sampleData';

export const DEMO_EXPERIMENT_NAME = 'Example: IF staining of mouse hippocampus';
const DEMO_TEMPLATE_TITLE = 'Immunofluorescence on free-floating brain sections';
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
  const demoAdded = await seedDemoExperiment(database);
  await addMissingSampleCounts(database);
  return { templatesAdded, demoAdded };
}

/**
 * Adds the SAMPLE NeuN+ counts (per region, per animal) to the demo run. Runs for demos created before
 * the counts existed too. Skips any count already present, so repeated calls add nothing.
 */
async function addMissingSampleCounts(database: LabCompanionDB): Promise<void> {
  const demo = await database.experiments.filter((e) => e.name === DEMO_EXPERIMENT_NAME).first();
  if (!demo) return;
  const existing = await database.stepRecords.where('experimentId').equals(demo.id).toArray();
  const have = new Set(existing.map((r) => r.label));
  const missing = SAMPLE_REGIONS.flatMap((region) =>
    SAMPLE_ANIMALS.map((animal, i) => ({ region, animal, value: SAMPLE_COUNTS[region][i] })),
  ).filter((c) => !have.has(sampleCountLabel(c.region, c.animal)));
  if (missing.length === 0) return;
  const procedure = await getProcedureForExperiment(demo.id, database);
  if (!procedure) return;
  // The counts belong to the imaging step, which is the one that produces the sections.
  const stepId = stepIdByTitle(procedure, 'Mount');
  for (const c of missing) {
    await addStepRecord(
      {
        experimentId: demo.id,
        stepId,
        kind: 'number',
        label: sampleCountLabel(c.region, c.animal),
        value: c.value,
        unit: SAMPLE_COUNT_UNIT,
        note: 'Sample data for the tour. Made-up numbers, not a measurement.',
      },
      database,
    );
  }
}

/** The starter templates to add, in the requested order. */
function selectStarters(wanted: readonly string[] | undefined) {
  if (!wanted) return STARTER_TEMPLATES;
  const byTitle = new Map(STARTER_TEMPLATES.map((t) => [t.title, t]));
  return wanted.map((title) => byTitle.get(title)).filter((t): t is (typeof STARTER_TEMPLATES)[number] => t !== undefined);
}

/** A finished IF run with timer and value deviations, recorded data, reagent lots and notes. */
async function seedDemoExperiment(database: LabCompanionDB): Promise<boolean> {
  const exists = await database.experiments.filter((e) => e.name === DEMO_EXPERIMENT_NAME).first();
  if (exists) return false;
  const template = await database.templates.filter((t) => t.title === DEMO_TEMPLATE_TITLE).first();
  if (!template) return false;

  const experiment = await startExperimentFromTemplate(template.id, DEMO_EXPERIMENT_NAME, database);
  const procedure = await getProcedureForExperiment(experiment.id, database);
  if (!procedure) return false;

  // Timeline, in minutes from the start of the run.
  const base = Date.now() - 3 * 24 * 60 * MINUTE;
  const at = (minutes: number) => base + minutes * MINUTE;
  const idOf = (title: string) => stepIdByTitle(procedure, title);
  const log = (partial: Omit<ExecutionEventInput, 'experimentId'>) =>
    logEvent({ experimentId: experiment.id, ...partial }, database);

  const blockId = idOf('Permeabilize and block');
  const primaryId = idOf('Primary antibody');
  const secondaryId = idOf('Secondary antibody');
  const mountId = idOf('Mount');

  // Step 1: wash sections.
  await log({ type: 'step_start', stepId: idOf('Wash sections'), at: at(0) });
  await log({ type: 'step_complete', stepId: idOf('Wash sections'), at: at(32) });

  // Step 2: block ran 7 minutes over its 60 minute timer.
  await log({ type: 'step_start', stepId: blockId, at: at(35) });
  await log({ type: 'timer_start', stepId: blockId, planned: 3600, unit: 's', at: at(36) });
  await log({
    type: 'timer_stop',
    stepId: blockId,
    planned: 3600,
    actual: 4020,
    unit: 's',
    at: at(103),
    deviation: { kind: 'timer', delta: 420, tolerance: 60 },
  });
  await log({ type: 'step_complete', stepId: blockId, at: at(104) });
  await addStepRecord(
    { experimentId: experiment.id, stepId: blockId, kind: 'timer', label: 'Block timer', startedAt: at(36), stoppedAt: at(103), elapsedSec: 4020 },
    database,
  );

  // Step 3: primary antibody. The volume was raised from 4 to 5 µL because the stock had settled.
  const primaryVar = template.steps
    .find((s) => s.title === 'Primary antibody')
    ?.variables?.find((v) => v.token === 'Primary antibody volume');
  await log({ type: 'step_start', stepId: primaryId, at: at(110) });
  await log({
    type: 'value_change',
    stepId: primaryId,
    planned: 4,
    actual: 5,
    unit: 'µL',
    note: 'Primary antibody volume',
    at: at(112),
    deviation: { kind: 'value', delta: 1 },
  });
  await log({
    type: 'note',
    stepId: primaryId,
    note: 'Stock had settled, so it was mixed by inversion before pipetting. Volume raised to 5 µL.',
    at: at(113),
  });
  if (primaryVar) {
    const value: RunValue = { experimentId: experiment.id, stepId: primaryId, varId: primaryVar.id, value: 5, unit: 'µL', editedAt: at(112) };
    await database.runValues.put(value);
  }
  await log({ type: 'step_complete', stepId: primaryId, at: at(1100) });

  // Day 2: wash, secondary, counterstain and mount.
  await log({ type: 'step_start', stepId: idOf('Wash after primary'), at: at(1110) });
  await log({ type: 'step_complete', stepId: idOf('Wash after primary'), at: at(1140) });

  await log({ type: 'step_start', stepId: secondaryId, at: at(1150) });
  await addStepRecord(
    { experimentId: experiment.id, stepId: secondaryId, kind: 'number', label: 'Secondary solution made', value: 9, unit: 'mL' },
    database,
  );
  await log({ type: 'step_complete', stepId: secondaryId, at: at(1280) });

  await log({ type: 'step_start', stepId: idOf('Wash and counterstain'), at: at(1290) });
  await log({ type: 'step_complete', stepId: idOf('Wash and counterstain'), at: at(1305) });

  await log({ type: 'step_start', stepId: mountId, at: at(1310) });
  await addStepRecord(
    { experimentId: experiment.id, stepId: mountId, kind: 'number', label: 'Sections imaged', value: 12, unit: 'sections' },
    database,
  );
  await log({ type: 'step_complete', stepId: mountId, at: at(1340) });

  // Reagents with lots. Names and lots are examples, not real stock.
  const primaryAb = await createInventoryItem(
    {
      name: 'Rabbit anti-NeuN (example)',
      kind: 'antibody',
      vendor: 'Example vendor',
      catalogNumber: 'EX-1001',
      lotNumber: 'LOT 2041-B',
      concentration: '1 mg/mL',
      hostSpecies: 'rabbit',
      target: 'NeuN',
      reactivity: ['mouse'],
      expiresOn: '2027-06-30',
      location: 'Freezer B, shelf 2',
      notes: 'Example entry for the demo run.',
    },
    database,
  );
  const secondaryAb = await createInventoryItem(
    {
      name: 'Donkey anti-rabbit Alexa Fluor 488 (example)',
      kind: 'antibody',
      vendor: 'Example vendor',
      catalogNumber: 'EX-2002',
      lotNumber: 'LOT 7720-A',
      hostSpecies: 'donkey',
      conjugate: 'Alexa Fluor 488',
      reactivity: ['rabbit'],
      expiresOn: '2027-03-31',
      location: 'Freezer B, shelf 3',
    },
    database,
  );
  const dapi = await createInventoryItem(
    { name: 'DAPI stock (example)', kind: 'reagent', lotNumber: 'LOT D-0912', concentration: '5 mg/mL', expiresOn: '2027-09-01' },
    database,
  );
  const mounting = await createInventoryItem(
    { name: 'Antifade mounting medium (example)', kind: 'reagent', lotNumber: 'LOT M-3305', expiresOn: '2027-12-31' },
    database,
  );
  await linkInventoryUsage(experiment.id, primaryAb.id, primaryId, database);
  await linkInventoryUsage(experiment.id, secondaryAb.id, secondaryId, database);
  await linkInventoryUsage(experiment.id, dapi.id, idOf('Wash and counterstain'), database);
  await linkInventoryUsage(experiment.id, mounting.id, mountId, database);

  await database.experiments.update(experiment.id, {
    status: 'done',
    createdAt: base,
    startedAt: at(0),
    endedAt: at(1340),
    updatedAt: at(1340),
    lastOpenedAt: at(1340),
    notes:
      'Sections from the dorsal hippocampus. The block ran about 7 minutes over. The primary antibody volume was raised from 4 to 5 µL because the stock had settled.',
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
