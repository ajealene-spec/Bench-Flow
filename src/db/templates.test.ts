import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from './index';
import {
  addStepRecord,
  createFolder,
  deleteExperiment,
  deleteFolder,
  getExperiment,
  getProcedureForExperiment,
  getRunState,
  listExperiments,
  listStepRecords,
  saveRunState,
  setExperimentFolder,
  startExperimentFromTemplate,
} from './helpers';
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listCategories,
  listTemplates,
  updateTemplate,
} from './templates';
import type { Step, Timer } from '../types';

let database: LabCompanionDB;

const step = (id: string, title: string, timers: Timer[] = []): Step => ({
  id,
  title,
  instructions: '',
  timers,
  reagents: [],
  dataFields: [],
  cautions: [],
});

const timer = (id: string, stepId: string): Timer => ({
  id,
  stepId,
  label: 'Incubate',
  durationSec: 600,
  status: 'idle',
});

beforeEach(async () => {
  database = new LabCompanionDB(`test-${crypto.randomUUID()}`);
  await database.open();
});

describe('template helpers', () => {
  it('creates a template with defaults for blank title and category', async () => {
    const template = await createTemplate({ title: '  ', category: '  ' }, database);
    expect(template.title).toBe('Untitled protocol');
    expect(template.category).toBe('Uncategorized');
    expect(template.steps).toEqual([]);
    expect(template.hazards).toEqual([]);
    expect(await getTemplate(template.id, database)).toEqual(template);
  });

  it('updates title, category and steps, and bumps updatedAt', async () => {
    const template = await createTemplate({ title: 'Blot', category: 'Western' }, database);
    await new Promise((r) => setTimeout(r, 5));
    await updateTemplate(template.id, { title: ' Western blot ', category: ' ', steps: [step('s1', 'Lyse')] }, database);
    const saved = await getTemplate(template.id, database);
    expect(saved?.title).toBe('Western blot');
    expect(saved?.category).toBe('Uncategorized');
    expect(saved?.steps.map((s) => s.title)).toEqual(['Lyse']);
    expect(saved!.updatedAt).toBeGreaterThan(template.updatedAt);
  });

  it('lists templates grouped by category and lists distinct categories', async () => {
    await createTemplate({ title: 'PCR', category: 'Molecular' }, database);
    await createTemplate({ title: 'Blot', category: 'Western' }, database);
    await createTemplate({ title: 'Ab', category: 'Molecular' }, database);

    expect((await listTemplates(database)).map((t) => t.title)).toEqual(['Ab', 'PCR', 'Blot']);
    expect(await listCategories(database)).toEqual(['Molecular', 'Western']);
  });

  it('deleting a template keeps the runs started from it, with their snapshots', async () => {
    const template = await createTemplate({ title: 'Blot', steps: [step('s1', 'Lyse')] }, database);
    const run = await startExperimentFromTemplate(template.id, 'Run 1', database);

    await deleteTemplate(template.id, database);

    expect(await getTemplate(template.id, database)).toBeUndefined();
    const kept = await getExperiment(run.id, database);
    expect(kept?.name).toBe('Run 1');
    expect(kept?.templateId).toBeNull();
    expect((await getProcedureForExperiment(run.id, database))?.steps.map((s) => s.title)).toEqual(['Lyse']);
  });
});

describe('starting an experiment from a template', () => {
  it('copies the steps into a snapshot, so editing the template does not change the run', async () => {
    const template = await createTemplate({ title: 'Blot', steps: [step('s1', 'Lyse'), step('s2', 'Run gel')] }, database);
    const run = await startExperimentFromTemplate(template.id, 'Blot 3', database);

    await updateTemplate(template.id, { steps: [step('x', 'Changed')] }, database);

    expect(run).toMatchObject({ name: 'Blot 3', status: 'draft', templateId: template.id, folderId: null });
    const procedure = await getProcedureForExperiment(run.id, database);
    expect(procedure?.id).toBe(run.procedureId);
    expect(procedure?.steps.map((s) => s.title)).toEqual(['Lyse', 'Run gel']);
  });

  it('gives each run its own step and timer ids', async () => {
    const template = await createTemplate(
      { title: 'Blot', steps: [step('s1', 'Lyse', [timer('t1', 's1')])] },
      database,
    );
    const a = await startExperimentFromTemplate(template.id, 'A', database);
    const b = await startExperimentFromTemplate(template.id, 'B', database);

    const stepA = (await getProcedureForExperiment(a.id, database))!.steps[0];
    const stepB = (await getProcedureForExperiment(b.id, database))!.steps[0];
    expect(stepA.id).not.toBe(stepB.id);
    expect(stepA.timers[0].stepId).toBe(stepA.id);
    expect(stepA.timers[0].id).not.toBe(stepB.timers[0].id);
  });

  it('uses "<template> – <date>" when the run title is blank', async () => {
    const template = await createTemplate({ title: 'PCR' }, database);
    const run = await startExperimentFromTemplate(template.id, '  ', database);
    expect(run.name.startsWith('PCR – ')).toBe(true);
  });

  it('throws for a missing template and creates nothing', async () => {
    await expect(startExperimentFromTemplate('missing', 'x', database)).rejects.toThrow('not found');
    expect(await listExperiments(database)).toEqual([]);
  });
});

describe('deleteExperiment', () => {
  it('removes the experiment with its snapshot, run state, timers and step records', async () => {
    const template = await createTemplate({ title: 'Blot', steps: [step('s1', 'Lyse', [timer('t1', 's1')])] }, database);
    const doomed = await startExperimentFromTemplate(template.id, 'Doomed', database);
    const keeper = await startExperimentFromTemplate(template.id, 'Keeper', database);
    const doomedStepId = (await getProcedureForExperiment(doomed.id, database))!.steps[0].id;
    const keeperStepId = (await getProcedureForExperiment(keeper.id, database))!.steps[0].id;

    await saveRunState({ experimentId: doomed.id, currentStepIndex: 0, completedStepIds: [] }, database);
    await database.timers.bulkAdd([
      { ...timer('t-run', doomedStepId), experimentId: doomed.id, status: 'running' },
      { ...timer('t-keep', keeperStepId), experimentId: keeper.id, status: 'running' },
    ]);
    await addStepRecord({ experimentId: doomed.id, stepId: doomedStepId, kind: 'number', label: 'x', value: 1 }, database);
    await addStepRecord({ experimentId: keeper.id, stepId: keeperStepId, kind: 'number', label: 'y', value: 2 }, database);

    await deleteExperiment(doomed.id, database);

    expect(await getExperiment(doomed.id, database)).toBeUndefined();
    expect(await getProcedureForExperiment(doomed.id, database)).toBeUndefined();
    expect(await getRunState(doomed.id, database)).toBeUndefined();
    expect(await listStepRecords(doomed.id, database)).toEqual([]);
    expect((await database.timers.toArray()).map((t) => t.id)).toEqual(['t-keep']);

    expect(await getExperiment(keeper.id, database)).toBeDefined();
    expect(await getProcedureForExperiment(keeper.id, database)).toBeDefined();
    expect(await listStepRecords(keeper.id, database)).toHaveLength(1);
    expect(await getTemplate(template.id, database)).toBeDefined();
  });
});

describe('folders and templates together', () => {
  it('deleting a folder still moves its runs to Unfiled', async () => {
    const template = await createTemplate({ title: 'Blot' }, database);
    const folder = await createFolder('Neuro', database);
    const run = await startExperimentFromTemplate(template.id, 'Run', database);
    await setExperimentFolder(run.id, folder.id, database);

    await deleteFolder(folder.id, database);
    expect((await getExperiment(run.id, database))?.folderId).toBeNull();
  });
});
