import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from './index';
import { getProcedureForExperiment, setMaterialChecked, startExperimentFromTemplate } from './helpers';
import { createTemplate, updateTemplate } from './templates';
import type { Step } from '../types';

let database: LabCompanionDB;

beforeEach(async () => {
  database = new LabCompanionDB(`snap-${crypto.randomUUID()}`);
  await database.open();
});

function step(id: string, title: string, phaseId?: string): Step {
  return { id, title, instructions: title, timers: [], reagents: [], dataFields: [], cautions: [], phaseId };
}

async function templateWithPlan() {
  return createTemplate(
    {
      title: 'Western blot',
      steps: [step('s1', 'Lyse', 'p1'), step('s2', 'Transfer', 'p2')],
      phases: [
        { id: 'p1', name: 'Day 1' },
        { id: 'p2', name: 'Day 2' },
      ],
      materials: [{ id: 'm1', name: 'PVDF membrane', kind: 'consumable', checked: true }],
    },
    database,
  ).then(async (t) => {
    await updateTemplate(
      t.id,
      { overview: { objective: 'Detect a protein', totalTime: '2 days', outputs: 'Blot image' } },
      database,
    );
    return t.id;
  });
}

describe('run snapshot', () => {
  it('copies overview, materials and phases into the run with fresh ids', async () => {
    const templateId = await templateWithPlan();
    const experiment = await startExperimentFromTemplate(templateId, 'Run 1', database);
    const procedure = await getProcedureForExperiment(experiment.id, database);

    expect(procedure?.overview).toEqual({ objective: 'Detect a protein', totalTime: '2 days', outputs: 'Blot image' });
    expect(procedure?.materials).toHaveLength(1);
    expect(procedure?.materials?.[0]).toEqual({ id: expect.any(String), name: 'PVDF membrane', kind: 'consumable' });
    expect(procedure?.materials?.[0].id).not.toBe('m1');
    expect(procedure?.materials?.[0].checked).toBeUndefined();

    const runPhases = procedure?.phases ?? [];
    expect(runPhases.map((p) => p.name)).toEqual(['Day 1', 'Day 2']);
    expect(runPhases.map((p) => p.id)).not.toEqual(['p1', 'p2']);
  });

  it('remaps step phaseIds to the run phase ids', async () => {
    const templateId = await templateWithPlan();
    const experiment = await startExperimentFromTemplate(templateId, 'Run 1', database);
    const procedure = await getProcedureForExperiment(experiment.id, database);
    const runPhaseIds = (procedure?.phases ?? []).map((p) => p.id);

    expect(procedure?.steps.map((s) => s.phaseId)).toEqual([runPhaseIds[0], runPhaseIds[1]]);
  });

  it('keeps the run unchanged when the template plan is edited later', async () => {
    const templateId = await templateWithPlan();
    const experiment = await startExperimentFromTemplate(templateId, 'Run 1', database);
    await updateTemplate(templateId, { phases: [], materials: [], overview: undefined }, database);

    const procedure = await getProcedureForExperiment(experiment.id, database);
    expect(procedure?.phases).toHaveLength(2);
    expect(procedure?.materials).toHaveLength(1);
    expect(procedure?.overview?.objective).toBe('Detect a protein');
  });

  it('starts every run with an empty materials checklist, tracked per experiment', async () => {
    const templateId = await templateWithPlan();
    const first = await startExperimentFromTemplate(templateId, 'Run 1', database);
    const second = await startExperimentFromTemplate(templateId, 'Run 2', database);
    expect(first.materialsChecked).toEqual([]);

    const materialId = (await getProcedureForExperiment(first.id, database))?.materials?.[0].id ?? '';
    await setMaterialChecked(first.id, materialId, true, database);
    await setMaterialChecked(first.id, materialId, true, database);

    expect((await database.experiments.get(first.id))?.materialsChecked).toEqual([materialId]);
    expect((await database.experiments.get(second.id))?.materialsChecked).toEqual([]);

    await setMaterialChecked(first.id, materialId, false, database);
    expect((await database.experiments.get(first.id))?.materialsChecked).toEqual([]);
  });
});
