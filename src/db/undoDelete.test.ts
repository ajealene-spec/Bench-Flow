import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from './index';
import { deleteTaskWithUndo } from './tasks';
import { deleteTemplateWithUndo } from './templates';
import { seedStarterContent } from '../content/seed';
import { STARTER_TEMPLATES } from '../content/protocols';

let database: LabCompanionDB;

beforeEach(async () => {
  database = new LabCompanionDB(`undo-${crypto.randomUUID()}`);
  await database.open();
});

describe('deleteTaskWithUndo', () => {
  it('deletes the task and restores it on undo', async () => {
    const task = { id: 't1', title: 'Check incubator', date: '2026-11-02', done: false, createdAt: 1, updatedAt: 1 } as never;
    await database.tasks.put(task);
    const undo = await deleteTaskWithUndo('t1', database);
    expect(await database.tasks.get('t1')).toBeUndefined();
    await undo();
    expect(await database.tasks.get('t1')).toEqual(task);
  });
});

describe('deleteTemplateWithUndo', () => {
  it('deletes a protocol and restores it with its experiment links on undo', async () => {
    const title = STARTER_TEMPLATES[0].title;
    await seedStarterContent(database, { titles: [title] });
    const template = (await database.templates.toArray())[0];
    const experiment = await database.experiments.toArray();
    expect(experiment).toHaveLength(0);
    const { startExperimentFromTemplate } = await import('../db/helpers');
    const run = await startExperimentFromTemplate(template.id, 'Run A', database);

    const undo = await deleteTemplateWithUndo(template.id, database);
    expect(await database.templates.get(template.id)).toBeUndefined();
    expect((await database.experiments.get(run.id))?.templateId).toBeNull();

    await undo();
    expect((await database.templates.get(template.id))?.title).toBe(title);
    expect((await database.experiments.get(run.id))?.templateId).toBe(template.id);
  });
});
