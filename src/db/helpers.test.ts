import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from './index';
import {
  addStepRecord,
  createExperiment,
  createFolder,
  deleteFolder,
  deleteStepRecord,
  deleteTimer,
  getExperiment,
  getTimer,
  listActiveTimers,
  getProcedureForExperiment,
  getRunState,
  listExperimentSummaries,
  listExperiments,
  listFolders,
  listStepRecords,
  listStepRecordsForStep,
  markRunStarted,
  renameExperiment,
  renameFolder,
  saveProcedure,
  saveRunState,
  setExperimentFolder,
  setExperimentStatus,
  updateExperiment,
  updateStepRecord,
} from './helpers';
import type { Procedure, StepRecord, Timer } from '../types';

let database: LabCompanionDB;

beforeEach(async () => {
  database = new LabCompanionDB(`test-${crypto.randomUUID()}`);
  await database.open();
});

describe('experiment helpers', () => {
  it('creates a draft experiment with a default name when none is given', async () => {
    const experiment = await createExperiment('   ', database);
    expect(experiment.status).toBe('draft');
    expect(experiment.name).toBe('Untitled experiment');
    expect(experiment.folderId).toBeNull();
    expect(experiment.startedAt).toBeUndefined();
    expect(await getExperiment(experiment.id, database)).toEqual(experiment);
  });

  it('updates status and lists experiments newest first', async () => {
    const first = await createExperiment('First', database);
    await new Promise((r) => setTimeout(r, 5));
    const second = await createExperiment('Second', database);
    await setExperimentStatus(first.id, 'in_progress', database);

    const experiments = await listExperiments(database);
    expect(experiments.map((e) => e.id)).toEqual([first.id, second.id]);
    expect((await getExperiment(first.id, database))?.status).toBe('in_progress');
  });

  it('renames an experiment and falls back to the default for a blank name', async () => {
    const experiment = await createExperiment('Old', database);
    await renameExperiment(experiment.id, '  Western blot 3  ', database);
    expect((await getExperiment(experiment.id, database))?.name).toBe('Western blot 3');
    await renameExperiment(experiment.id, '  ', database);
    expect((await getExperiment(experiment.id, database))?.name).toBe('Untitled experiment');
  });

  it('stamps startedAt once, on the first run start, and moves a draft to in progress', async () => {
    const experiment = await createExperiment('Blot', database);
    await markRunStarted(experiment.id, database);
    const started = await getExperiment(experiment.id, database);
    expect(started?.status).toBe('in_progress');
    expect(started?.startedAt).toBeTypeOf('number');

    await new Promise((r) => setTimeout(r, 5));
    await markRunStarted(experiment.id, database);
    expect((await getExperiment(experiment.id, database))?.startedAt).toBe(started?.startedAt);
  });

  it('stamps endedAt when finished and clears it when reopened', async () => {
    const experiment = await createExperiment('Blot', database);
    await setExperimentStatus(experiment.id, 'done', database);
    expect((await getExperiment(experiment.id, database))?.endedAt).toBeTypeOf('number');

    await setExperimentStatus(experiment.id, 'in_progress', database);
    const reopened = await getExperiment(experiment.id, database);
    expect(reopened?.status).toBe('in_progress');
    expect(reopened?.endedAt).toBeUndefined();
  });

  it('saves notes and moves experiments between folders', async () => {
    const experiment = await createExperiment('Blot', database);
    const folder = await createFolder('Neuro', database);
    await updateExperiment(experiment.id, { notes: 'Antibody lot changed' }, database);
    await setExperimentFolder(experiment.id, folder.id, database);
    const saved = await getExperiment(experiment.id, database);
    expect(saved?.notes).toBe('Antibody lot changed');
    expect(saved?.folderId).toBe(folder.id);
  });
});

describe('folder helpers', () => {
  it('creates, renames and lists folders by name', async () => {
    const b = await createFolder('B', database);
    await createFolder('A', database);
    await renameFolder(b.id, 'Zeta', database);
    expect((await listFolders(database)).map((f) => f.name)).toEqual(['A', 'Zeta']);
  });

  it('deleting a folder moves its experiments to Unfiled and keeps them', async () => {
    const folder = await createFolder('Temp', database);
    const experiment = await createExperiment('Keep me', database);
    await setExperimentFolder(experiment.id, folder.id, database);
    const other = await createExperiment('Other folder', database);
    await deleteFolder(folder.id, database);

    expect(await listFolders(database)).toEqual([]);
    expect((await getExperiment(experiment.id, database))?.folderId).toBeNull();
    expect((await getExperiment(experiment.id, database))?.name).toBe('Keep me');
    expect((await getExperiment(other.id, database))?.folderId).toBeNull();
  });
});

describe('procedure and run state helpers', () => {
  const procedure: Procedure = {
    id: 'proc-1',
    experimentId: 'exp-x',
    title: 'Western blot',
    steps: [
      { id: 's1', title: 'Lyse cells', instructions: '', timers: [], reagents: [], dataFields: [], cautions: [] },
      { id: 's2', title: 'Run gel', instructions: '', timers: [], reagents: [], dataFields: [], cautions: [] },
    ],
    createdAt: 0,
    updatedAt: 0,
  };

  it('stores a procedure per experiment and returns it by experimentId', async () => {
    await saveProcedure(procedure, database);
    expect((await getProcedureForExperiment('exp-x', database))?.title).toBe('Western blot');
    expect(await getProcedureForExperiment('missing', database)).toBeUndefined();
  });

  it('saves run state keyed by experiment', async () => {
    await saveRunState({ experimentId: 'exp-x', currentStepIndex: 1, completedStepIds: ['s1'] }, database);
    const state = await getRunState('exp-x', database);
    expect(state?.currentStepIndex).toBe(1);
    expect(state?.completedStepIds).toEqual(['s1']);
  });

  it('summarizes experiments with the current step title', async () => {
    const experiment = await createExperiment('Blot', database);
    await saveProcedure({ ...procedure, experimentId: experiment.id }, database);
    await saveRunState({ experimentId: experiment.id, currentStepIndex: 1, completedStepIds: ['s1'] }, database);

    const [summary] = await listExperimentSummaries(database);
    expect(summary.experiment.id).toBe(experiment.id);
    expect(summary.lastStepTitle).toBe('Run gel');
  });
});

describe('step record helpers', () => {
  const base = (experimentId: string, stepId: string, label: string): Omit<StepRecord, 'id' | 'createdAt'> => ({
    experimentId,
    stepId,
    kind: 'number',
    label,
    value: 1,
    unit: 'AU',
  });

  it('adds a record with an id and timestamp, and reads it back', async () => {
    const record = await addStepRecord(base('e1', 's1', 'Band intensity'), database);
    expect(record.id).toBeTruthy();
    expect(record.createdAt).toBeTypeOf('number');
    expect(await listStepRecords('e1', database)).toEqual([record]);
  });

  it('lists records per experiment and per step, oldest first', async () => {
    const a = await addStepRecord(base('e1', 's1', 'a'), database);
    await new Promise((r) => setTimeout(r, 5));
    const b = await addStepRecord(base('e1', 's2', 'b'), database);
    await addStepRecord(base('e2', 's1', 'other experiment'), database);

    expect((await listStepRecords('e1', database)).map((r) => r.id)).toEqual([a.id, b.id]);
    expect((await listStepRecordsForStep('e1', 's1', database)).map((r) => r.id)).toEqual([a.id]);
    expect(await listStepRecordsForStep('e1', 'missing', database)).toEqual([]);
  });

  it('updates a record and deletes it', async () => {
    const timerRecord = await addStepRecord(
      { ...base('e1', 's1', 'Gel run'), kind: 'timer', value: undefined, startedAt: 100, stoppedAt: 400, elapsedSec: 300 },
      database,
    );
    await updateStepRecord(timerRecord.id, { note: 'Bubble in lane 3' }, database);
    const [updated] = await listStepRecords('e1', database);
    expect(updated.note).toBe('Bubble in lane 3');
    expect(updated.elapsedSec).toBe(300);

    await deleteStepRecord(timerRecord.id, database);
    expect(await listStepRecords('e1', database)).toEqual([]);
  });
});

describe('timer helpers', () => {
  const base = (id: string, status: Timer['status']): Timer => ({
    id,
    stepId: 's1',
    label: id,
    durationSec: 60,
    status,
  });

  it('stores, reads and deletes timer rows', async () => {
    await database.timers.put(base('t1', 'running'));
    expect((await getTimer('t1', database))?.status).toBe('running');
    await deleteTimer('t1', database);
    expect(await getTimer('t1', database)).toBeUndefined();
  });

  it('lists only running, paused and done timers', async () => {
    await database.timers.bulkPut([base('a', 'idle'), base('b', 'running'), base('c', 'paused'), base('d', 'done')]);
    const ids = (await listActiveTimers(database)).map((t) => t.id).sort();
    expect(ids).toEqual(['b', 'c', 'd']);
  });
});
