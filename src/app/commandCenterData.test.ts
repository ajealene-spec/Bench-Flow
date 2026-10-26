import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from '../db';
import { createExperiment, markRunStarted, saveRunState, setExperimentStatus, updateExperiment } from '../db/helpers';
import { listRecentActivity, listWorkspaceEntries, progressFor } from './commandCenterData';

let database: LabCompanionDB;

beforeEach(async () => {
  database = new LabCompanionDB(`home-${crypto.randomUUID()}`);
  await database.open();
});

describe('command center data', () => {
  it('computes progress and leaves out experiments that are not in progress', async () => {
    expect(progressFor(1, 4)).toBe(25);
    expect(progressFor(0, 0)).toBe(0);

    const active = await createExperiment('Blot A', database);
    await markRunStarted(active.id, database);
    const procedureId = crypto.randomUUID();
    await database.procedures.add({
      id: procedureId,
      experimentId: active.id,
      title: 'Blot',
      steps: [
        { id: 's1', title: 'Lyse', instructions: '', timers: [], reagents: [], dataFields: [], cautions: [] },
        { id: 's2', title: 'Transfer', instructions: '', timers: [], reagents: [], dataFields: [], cautions: [] },
      ],
      createdAt: 1,
      updatedAt: 1,
    });
    await saveRunState({ experimentId: active.id, currentStepIndex: 1, completedStepIds: ['s1'] }, database);
    await createExperiment('Idle', database);

    const entries = await listWorkspaceEntries(database);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ completed: 1, total: 2, percent: 50, currentStep: { title: 'Transfer' } });
  });

  it('lists recently finished or opened experiments, newest first, without never-opened ones', async () => {
    const a = await createExperiment('A', database);
    const b = await createExperiment('B', database);
    await createExperiment('C', database);
    await updateExperiment(a.id, { lastOpenedAt: 100 }, database);
    await setExperimentStatus(b.id, 'done', database);
    await database.experiments.update(b.id, { endedAt: 200 });

    const recent = await listRecentActivity(5, database);
    expect(recent.map((r) => r.experiment.name)).toEqual(['B', 'A']);
    expect(recent[0].at).toBe(200);
  });
});
