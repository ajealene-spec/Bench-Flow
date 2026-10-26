import { db as defaultDb, type LabCompanionDB } from './index';
import type { Lab, LabStatus, Procedure, RunState, Timer } from '../types';

export interface LabSummary {
  lab: Lab;
  lastStepTitle?: string;
}

export function newId(): string {
  return crypto.randomUUID();
}

export async function createLab(name: string, database: LabCompanionDB = defaultDb): Promise<Lab> {
  const now = Date.now();
  const lab: Lab = {
    id: newId(),
    name: name.trim() || 'Untitled lab',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
  await database.labs.add(lab);
  return lab;
}

export function getLab(id: string, database: LabCompanionDB = defaultDb): Promise<Lab | undefined> {
  return database.labs.get(id);
}

export async function updateLab(
  id: string,
  changes: Partial<Pick<Lab, 'name' | 'status' | 'procedureId' | 'lastOpenedAt'>>,
  database: LabCompanionDB = defaultDb,
): Promise<void> {
  await database.labs.update(id, { ...changes, updatedAt: Date.now() });
}

export async function setLabStatus(
  id: string,
  status: LabStatus,
  database: LabCompanionDB = defaultDb,
): Promise<void> {
  await updateLab(id, { status }, database);
}

/** All labs, most recently updated first. */
export async function listLabs(database: LabCompanionDB = defaultDb): Promise<Lab[]> {
  const labs = await database.labs.toArray();
  return labs.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Labs with the title of the step the run is currently on, for the workspace list. */
export async function listLabSummaries(database: LabCompanionDB = defaultDb): Promise<LabSummary[]> {
  const labs = await listLabs(database);
  return Promise.all(
    labs.map(async (lab) => {
      const [procedure, runState] = await Promise.all([
        getProcedureForLab(lab.id, database),
        getRunState(lab.id, database),
      ]);
      const step = procedure?.steps[runState?.currentStepIndex ?? 0];
      return { lab, lastStepTitle: step?.title };
    }),
  );
}

export async function saveProcedure(procedure: Procedure, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.procedures.put({ ...procedure, updatedAt: Date.now() });
}

export function getProcedureForLab(labId: string, database: LabCompanionDB = defaultDb): Promise<Procedure | undefined> {
  return database.procedures.where('labId').equals(labId).first();
}

export function getRunState(labId: string, database: LabCompanionDB = defaultDb): Promise<RunState | undefined> {
  return database.runStates.get(labId);
}

export async function saveRunState(state: Omit<RunState, 'updatedAt'>, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.runStates.put({ ...state, updatedAt: Date.now() });
}

export async function saveTimer(timer: Timer, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.timers.put(timer);
}

export function listTimersForStep(stepId: string, database: LabCompanionDB = defaultDb): Promise<Timer[]> {
  return database.timers.where('stepId').equals(stepId).toArray();
}

export function getTimer(id: string, database: LabCompanionDB = defaultDb): Promise<Timer | undefined> {
  return database.timers.get(id);
}

/** Timers shown in the run-mode tray: running, paused or finished but not yet dismissed. */
export function listActiveTimers(database: LabCompanionDB = defaultDb): Promise<Timer[]> {
  return database.timers.where('status').anyOf(['running', 'paused', 'done']).sortBy('startedAt');
}

export async function deleteTimer(id: string, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.timers.delete(id);
}
