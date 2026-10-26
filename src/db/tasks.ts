import { db as defaultDb, type LabCompanionDB } from './index';
import type { Task } from '../types';

export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'done'> & { done?: boolean };

/** Tasks on one day (yyyy-mm-dd), earliest time first, untimed tasks last. */
export async function listTasksForDate(date: string, database: LabCompanionDB = defaultDb): Promise<Task[]> {
  const tasks = await database.tasks.where('date').equals(date).toArray();
  return sortTasks(tasks);
}

/** Tasks linked to one run, oldest date first. */
export async function listTasksForExperiment(experimentId: string, database: LabCompanionDB = defaultDb): Promise<Task[]> {
  const tasks = await database.tasks.where('experimentId').equals(experimentId).toArray();
  return tasks.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
}

export function getTask(id: string, database: LabCompanionDB = defaultDb): Promise<Task | undefined> {
  return database.tasks.get(id);
}

export async function createTask(input: TaskInput, database: LabCompanionDB = defaultDb): Promise<Task> {
  const task: Task = {
    ...cleanTask(input),
    id: crypto.randomUUID(),
    done: input.done ?? false,
    createdAt: Date.now(),
  };
  await database.tasks.add(task);
  return task;
}

/** Replaces the editable fields of a task. The id and createdAt never change. */
export async function updateTask(
  id: string,
  changes: Partial<TaskInput>,
  database: LabCompanionDB = defaultDb,
): Promise<void> {
  const current = await database.tasks.get(id);
  if (!current) throw new Error(`Task ${id} not found`);
  await database.tasks.put(cleanTask({ ...current, ...changes }) as Task);
}

export async function setTaskDone(id: string, done: boolean, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.tasks.update(id, { done });
}

export async function deleteTask(id: string, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.tasks.delete(id);
}

/** Orders by time (untimed last), then title. Returns the same array. */
export function sortTasks(tasks: Task[]): Task[] {
  return tasks.sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time) || a.title.localeCompare(b.title);
    if (a.time) return -1;
    if (b.time) return 1;
    return a.title.localeCompare(b.title);
  });
}

/** Drops empty optional fields so stored rows never hold empty strings or zero-length notes. */
function cleanTask<T extends Partial<Task>>(task: T): T {
  const out: Partial<Task> = { ...task };
  if (out.notes !== undefined && out.notes.trim() === '') delete out.notes;
  if (!out.time) delete out.time;
  if (!out.experimentId) delete out.experimentId;
  if (!out.color) delete out.color;
  if (out.durationMin === undefined || out.durationMin === null || out.durationMin <= 0) delete out.durationMin;
  if (!out.recurrence || out.recurrence === 'none') delete out.recurrence;
  return out as T;
}

/** Deletes a task and returns a function that puts it back exactly as it was (for an Undo action). */
export async function deleteTaskWithUndo(id: string, database: LabCompanionDB = defaultDb): Promise<() => Promise<void>> {
  const task = await database.tasks.get(id);
  await deleteTask(id, database);
  return async () => {
    if (task) await database.tasks.put(task);
  };
}
