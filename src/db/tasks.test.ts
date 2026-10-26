import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from './index';
import {
  createTask,
  deleteTask,
  getTask,
  listTasksForDate,
  listTasksForExperiment,
  setTaskDone,
  sortTasks,
  updateTask,
} from './tasks';
import type { Task } from '../types';

let db: LabCompanionDB;

beforeEach(async () => {
  db = new LabCompanionDB(`tasks-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(() => {
  db.close();
});

describe('tasks', () => {
  it('creates a task with an id, done=false and createdAt, and drops empty optional fields', async () => {
    const task = await createTask({ title: 'Feed mice', date: '2026-11-02', notes: '  ', time: '', recurrence: 'none' }, db);
    expect(task.id).toBeTruthy();
    expect(task.done).toBe(false);
    expect(task.createdAt).toBeGreaterThan(0);
    const stored = await getTask(task.id, db);
    expect(stored).toEqual({ id: task.id, title: 'Feed mice', date: '2026-11-02', done: false, createdAt: task.createdAt });
  });

  it('lists tasks for one date with timed tasks first, in time order', async () => {
    await createTask({ title: 'Zeta untimed', date: '2026-11-02', done: false }, db);
    await createTask({ title: 'Late', date: '2026-11-02', time: '15:00', done: false }, db);
    await createTask({ title: 'Early', date: '2026-11-02', time: '08:30', done: false }, db);
    await createTask({ title: 'Other day', date: '2026-11-03', time: '09:00', done: false }, db);

    const titles = (await listTasksForDate('2026-11-02', db)).map((t) => t.title);
    expect(titles).toEqual(['Early', 'Late', 'Zeta untimed']);
  });

  it('lists tasks linked to a run, oldest first', async () => {
    await createTask({ title: 'B', date: '2026-11-05', experimentId: 'exp-1', done: false }, db);
    await createTask({ title: 'A', date: '2026-11-01', experimentId: 'exp-1', done: false }, db);
    await createTask({ title: 'C', date: '2026-11-01', experimentId: 'exp-2', done: false }, db);
    const titles = (await listTasksForExperiment('exp-1', db)).map((t) => t.title);
    expect(titles).toEqual(['A', 'B']);
  });

  it('updates fields without changing id or createdAt, and can clear optional fields', async () => {
    const task = await createTask({ title: 'Imaging', date: '2026-11-02', time: '10:00', color: 'blue', done: false }, db);
    await updateTask(task.id, { title: 'Imaging (2)', time: '', color: undefined }, db);
    const updated = (await getTask(task.id, db)) as Task;
    expect(updated.id).toBe(task.id);
    expect(updated.createdAt).toBe(task.createdAt);
    expect(updated.title).toBe('Imaging (2)');
    expect(updated.time).toBeUndefined();
    expect(updated.color).toBeUndefined();
  });

  it('throws when updating a task that does not exist', async () => {
    await expect(updateTask('missing', { title: 'x' }, db)).rejects.toThrow('not found');
  });

  it('toggles done and deletes', async () => {
    const task = await createTask({ title: 'Read paper', date: '2026-11-02', done: false }, db);
    await setTaskDone(task.id, true, db);
    expect((await getTask(task.id, db))?.done).toBe(true);
    await deleteTask(task.id, db);
    expect(await getTask(task.id, db)).toBeUndefined();
  });

  it('keeps recurrence when it is daily or weekly', async () => {
    const task = await createTask({ title: 'Check cages', date: '2026-11-02', recurrence: 'daily', durationMin: 30, done: false }, db);
    expect(await getTask(task.id, db)).toMatchObject({ recurrence: 'daily', durationMin: 30 });
  });
});

describe('sortTasks', () => {
  it('puts timed tasks before untimed and sorts untimed by title', () => {
    const base = { date: '2026-11-02', done: false, createdAt: 1 };
    const sorted = sortTasks([
      { ...base, id: '1', title: 'b' },
      { ...base, id: '2', title: 'a', time: '12:00' },
      { ...base, id: '3', title: 'a' },
    ]);
    expect(sorted.map((t) => t.id)).toEqual(['2', '3', '1']);
  });
});
