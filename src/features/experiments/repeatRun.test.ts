import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from '../../db';
import type { Experiment, Procedure, ReagentUsage, RunValue, Step } from '../../types';
import { buildRepeatRun, defaultRepeatTitle, repeatExperiment, type RepeatSource } from './repeatRun';

function counterIds() {
  let n = 0;
  return () => `id-${++n}`;
}

const step = (id: string, patch: Partial<Step> = {}): Step => ({
  id,
  title: `Step ${id}`,
  instructions: 'Add {{volume}} µL',
  timers: [],
  reagents: [],
  dataFields: [],
  cautions: [],
  ...patch,
});

function source(): RepeatSource {
  const experiment: Experiment = {
    id: 'exp-1',
    name: 'Blot 1',
    status: 'done',
    folderId: 'folder-1',
    tags: ['mouse', 'imaging'],
    templateId: 'tpl-1',
    notes: 'old notes',
    startedAt: 100,
    endedAt: 200,
    lastOpenedAt: 300,
    plannedStart: 50,
    animalIds: ['animal-1'],
    pausedAt: 150,
    safetyChecklist: [{ itemId: 'gloves', label: 'Gloves on', checked: true }],
    materialsChecked: ['m1'],
    createdAt: 10,
    updatedAt: 400,
  };
  const procedure: Procedure = {
    id: 'proc-1',
    experimentId: 'exp-1',
    title: 'Western blot',
    steps: [
      step('s1', {
        phaseId: 'ph1',
        timers: [{ id: 't1', stepId: 's1', label: 'Block', durationSec: 60, status: 'done', startedAt: 5, firstStartedAt: 5 }],
        variables: [{ id: 'v1', token: 'volume', value: 5, unit: 'µL', role: 'input' }],
      }),
      step('s2', { phaseId: 'ph2', variables: [{ id: 'v1', token: 'volume', value: 9, unit: 'µL', role: 'input' }] }),
    ],
    overview: { objective: 'Detect protein', totalTime: '2 days', outputs: 'Image' },
    materials: [{ id: 'm1', name: 'Buffer', kind: 'solution', checked: true }],
    phases: [
      { id: 'ph1', name: 'Day 1' },
      { id: 'ph2', name: 'Day 2' },
    ],
    createdAt: 10,
    updatedAt: 400,
  };
  const runValues: RunValue[] = [
    { experimentId: 'exp-1', stepId: 's1', varId: 'v1', value: 7, unit: 'µL', editedAt: 1 },
    { experimentId: 'exp-1', stepId: 's2', varId: 'v1', value: 11, unit: 'µL', editedAt: 1 },
  ];
  const usages: ReagentUsage[] = [
    { experimentId: 'exp-1', inventoryItemId: 'inv-1', stepId: 's1', usedAt: 2 },
    { experimentId: 'exp-1', inventoryItemId: 'inv-2', stepId: '', usedAt: 2 },
  ];
  return { experiment, procedure, runValues, usages };
}

describe('buildRepeatRun', () => {
  it('gives every step, phase, variable and timer a fresh id and remaps references', () => {
    const src = source();
    const result = buildRepeatRun(src, { title: 'Blot 2', copyValues: true, now: 999, newId: counterIds() });

    const oldIds = new Set([
      'exp-1',
      'proc-1',
      's1',
      's2',
      't1',
      'ph1',
      'ph2',
      'v1',
      'm1',
    ]);
    const newSteps = result.procedure.steps;
    for (const s of newSteps) expect(oldIds.has(s.id)).toBe(false);
    expect(newSteps[0].phaseId).toBe(result.procedure.phases?.[0].id);
    expect(newSteps[1].phaseId).toBe(result.procedure.phases?.[1].id);
    expect(newSteps[0].timers[0].stepId).toBe(newSteps[0].id);
    expect(newSteps[0].timers[0].id).not.toBe('t1');
    expect(newSteps[0].variables?.[0].id).not.toBe('v1');
    expect(newSteps[1].variables?.[0].id).not.toBe(newSteps[0].variables?.[0].id);
  });

  it('resets timers and progress but keeps the plan', () => {
    const result = buildRepeatRun(source(), { title: 'Blot 2', copyValues: false, now: 999, newId: counterIds() });
    const timer = result.procedure.steps[0].timers[0];
    expect(timer.status).toBe('idle');
    expect(timer.startedAt).toBeUndefined();
    expect(timer.firstStartedAt).toBeUndefined();

    const e = result.experiment;
    expect(e.status).toBe('draft');
    expect(e.startedAt).toBeUndefined();
    expect(e.endedAt).toBeUndefined();
    expect(e.pausedAt).toBeUndefined();
    expect(e.plannedStart).toBeUndefined();
    expect(e.animalIds).toBeUndefined();
    expect(e.notes).toBeUndefined();
    expect(e.materialsChecked).toEqual([]);
    expect(e.safetyChecklist).toEqual([{ itemId: 'gloves', label: 'Gloves on', checked: false }]);
    expect(result.procedure.materials?.[0].name).toBe('Buffer');
    expect(result.procedure.materials?.[0].id).not.toBe('m1');
    expect(result.procedure.overview).toEqual({ objective: 'Detect protein', totalTime: '2 days', outputs: 'Image' });
  });

  it('keeps folder, tags, template link and marks the source', () => {
    const e = buildRepeatRun(source(), { title: '', copyValues: false, now: 999, newId: counterIds() }).experiment;
    expect(e.folderId).toBe('folder-1');
    expect(e.tags).toEqual(['mouse', 'imaging']);
    expect(e.templateId).toBe('tpl-1');
    expect(e.duplicatedFrom).toBe('exp-1');
    expect(e.name).toBe(defaultRepeatTitle('Blot 1'));
    expect(e.name).toBe('Blot 1 (repeat)');
  });

  it('copies inline values as defaults only when asked, remapped to the new ids', () => {
    const copied = buildRepeatRun(source(), { title: 'X', copyValues: true, now: 999, newId: counterIds() });
    expect(copied.runValues).toHaveLength(2);
    const newS1 = copied.procedure.steps[0];
    const newVar = newS1.variables?.[0].id;
    expect(copied.runValues[0]).toMatchObject({
      experimentId: copied.experiment.id,
      stepId: newS1.id,
      varId: newVar,
      value: 7,
      editedAt: 999,
    });

    const plain = buildRepeatRun(source(), { title: 'X', copyValues: false, now: 999, newId: counterIds() });
    expect(plain.runValues).toEqual([]);
  });

  it('keeps reagent lot links on the new steps and run level', () => {
    const result = buildRepeatRun(source(), { title: 'X', copyValues: false, now: 999, newId: counterIds() });
    const linked = result.usages.find((u) => u.inventoryItemId === 'inv-1');
    expect(linked?.stepId).toBe(result.procedure.steps[0].id);
    expect(linked?.experimentId).toBe(result.experiment.id);
    const runLevel = result.usages.find((u) => u.inventoryItemId === 'inv-2');
    expect(runLevel?.stepId).toBe('');
  });

  it('does not change the source objects', () => {
    const src = source();
    const before = structuredClone(src);
    buildRepeatRun(src, { title: 'X', copyValues: true, now: 999, newId: counterIds() });
    expect(src).toEqual(before);
  });
});

describe('repeatExperiment', () => {
  let db: LabCompanionDB;

  beforeEach(async () => {
    db = new LabCompanionDB(`repeat-${crypto.randomUUID()}`);
    await db.open();
    const src = source();
    await db.experiments.add(src.experiment);
    await db.procedures.add(src.procedure);
    await db.runValues.bulkAdd(src.runValues);
    await db.inventoryUsage.bulkAdd(src.usages);
  });

  it('writes the new run, its snapshot, values and links in one go', async () => {
    const created = await repeatExperiment('exp-1', { title: 'Blot 2', copyValues: true }, db);
    expect(created.id).not.toBe('exp-1');
    expect(created.name).toBe('Blot 2');
    expect(created.duplicatedFrom).toBe('exp-1');

    const procedure = await db.procedures.where('experimentId').equals(created.id).first();
    expect(procedure?.id).toBe(created.procedureId);
    expect(procedure?.steps).toHaveLength(2);

    const values = await db.runValues.filter((rv) => rv.experimentId === created.id).toArray();
    expect(values).toHaveLength(2);
    const usages = await db.inventoryUsage.where('experimentId').equals(created.id).toArray();
    expect(usages).toHaveLength(2);

    // The source is untouched.
    const original = await db.experiments.get('exp-1');
    expect(original?.name).toBe('Blot 1');
    expect(await db.runValues.filter((rv) => rv.experimentId === 'exp-1').count()).toBe(2);
  });

  it('uses the default title when the given one is blank', async () => {
    const created = await repeatExperiment('exp-1', { title: '  ', copyValues: false }, db);
    expect(created.name).toBe('Blot 1 (repeat)');
    expect(await db.runValues.filter((rv) => rv.experimentId === created.id).count()).toBe(0);
  });

  it('throws for a missing source', async () => {
    await expect(repeatExperiment('nope', { title: 'x', copyValues: false }, db)).rejects.toThrow();
  });
});
