import { db as defaultDb, type LabCompanionDB } from './index';
import type {
  Experiment,
  ExperimentStatus,
  Folder,
  Procedure,
  RunState,
  Step,
  StepRecord,
  Timer,
} from '../types';
import { getTemplate } from './templates';

export const DEFAULT_EXPERIMENT_NAME = 'Untitled experiment';
export const DEFAULT_FOLDER_NAME = 'New folder';

export interface ExperimentSummary {
  experiment: Experiment;
  lastStepTitle?: string;
}

export function newId(): string {
  return crypto.randomUUID();
}

// ---------- Experiments ----------

export async function createExperiment(name: string, database: LabCompanionDB = defaultDb): Promise<Experiment> {
  const now = Date.now();
  const experiment: Experiment = {
    id: newId(),
    name: name.trim() || DEFAULT_EXPERIMENT_NAME,
    status: 'draft',
    folderId: null,
    createdAt: now,
    updatedAt: now,
  };
  await database.experiments.add(experiment);
  return experiment;
}

export function getExperiment(id: string, database: LabCompanionDB = defaultDb): Promise<Experiment | undefined> {
  return database.experiments.get(id);
}

export async function updateExperiment(
  id: string,
  changes: Partial<
    Pick<
      Experiment,
      | 'name'
      | 'status'
      | 'procedureId'
      | 'templateId'
      | 'lastOpenedAt'
      | 'notes'
      | 'folderId'
      | 'startedAt'
      | 'endedAt'
      | 'safetyChecklist'
      | 'safetyConfirmedAt'
    >
  >,
  database: LabCompanionDB = defaultDb,
): Promise<void> {
  await database.experiments.update(id, { ...changes, updatedAt: Date.now() });
}

/** Renames an experiment. A blank name falls back to the default name. */
export function renameExperiment(id: string, name: string, database: LabCompanionDB = defaultDb): Promise<void> {
  return updateExperiment(id, { name: name.trim() || DEFAULT_EXPERIMENT_NAME }, database);
}

/**
 * Sets the status. Finishing stamps endedAt; any other status clears it, so a reopened
 * experiment does not keep a stale end date.
 */
export async function setExperimentStatus(
  id: string,
  status: ExperimentStatus,
  database: LabCompanionDB = defaultDb,
): Promise<void> {
  await updateExperiment(id, { status, endedAt: status === 'done' ? Date.now() : undefined }, database);
}

/** Called when the run page opens. Sets startedAt the first time and moves a draft to in progress. */
export async function markRunStarted(id: string, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.transaction('rw', database.experiments, async () => {
    const experiment = await database.experiments.get(id);
    if (!experiment) return;
    const changes: Partial<Experiment> = {};
    if (experiment.startedAt === undefined) changes.startedAt = Date.now();
    if (experiment.status === 'draft') changes.status = 'in_progress';
    if (Object.keys(changes).length > 0) await updateExperiment(id, changes, database);
  });
}

/** All experiments, most recently updated first. */
export async function listExperiments(database: LabCompanionDB = defaultDb): Promise<Experiment[]> {
  const experiments = await database.experiments.toArray();
  return experiments.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Experiments with the title of the step the run is currently on, for the workspace list. */
export async function listExperimentSummaries(database: LabCompanionDB = defaultDb): Promise<ExperimentSummary[]> {
  const experiments = await listExperiments(database);
  return Promise.all(
    experiments.map(async (experiment) => {
      const [procedure, runState] = await Promise.all([
        getProcedureForExperiment(experiment.id, database),
        getRunState(experiment.id, database),
      ]);
      const step = procedure?.steps[runState?.currentStepIndex ?? 0];
      return { experiment, lastStepTitle: step?.title };
    }),
  );
}

/**
 * Copies template steps with fresh ids. Timers are keyed by step id, so two runs of the same
 * template must not share step ids or one run's timers would show up in the other.
 */
function snapshotSteps(steps: Step[]): Step[] {
  return steps.map((step) => {
    const stepId = newId();
    return {
      ...structuredClone(step),
      id: stepId,
      timers: step.timers.map((timer) => ({ ...structuredClone(timer), id: newId(), stepId })),
    };
  });
}

/**
 * Starts a run from a template. The template's steps are copied into a new procedure snapshot,
 * so later edits to the template never change this run. A blank run title falls back to
 * "<template> – <date>".
 */
export async function startExperimentFromTemplate(
  templateId: string,
  runTitle: string,
  database: LabCompanionDB = defaultDb,
): Promise<Experiment> {
  return database.transaction('rw', database.templates, database.experiments, database.procedures, async () => {
    const template = await getTemplate(templateId, database);
    if (!template) throw new Error(`Template ${templateId} not found`);

    const now = Date.now();
    const experimentId = newId();
    const procedure: Procedure = {
      id: newId(),
      experimentId,
      title: template.title,
      steps: snapshotSteps(template.steps),
      createdAt: now,
      updatedAt: now,
    };
    const experiment: Experiment = {
      id: experimentId,
      name: runTitle.trim() || `${template.title} – ${new Date(now).toLocaleDateString()}`,
      status: 'draft',
      folderId: null,
      templateId: template.id,
      procedureId: procedure.id,
      safetyChecklist: [],
      createdAt: now,
      updatedAt: now,
    };
    await database.procedures.add(procedure);
    await database.experiments.add(experiment);
    return experiment;
  });
}

/**
 * Deletes an experiment with everything it owns: its procedure snapshot, run state, timers and
 * step records. The template it came from is not touched.
 */
export async function deleteExperiment(id: string, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.transaction(
    'rw',
    [database.experiments, database.procedures, database.experimentRunStates, database.timers, database.stepRecords],
    async () => {
      const procedures = await database.procedures.where('experimentId').equals(id).toArray();
      const stepIds = new Set(procedures.flatMap((p) => p.steps.map((s) => s.id)));
      await database.timers.filter((t) => t.experimentId === id || stepIds.has(t.stepId)).delete();
      await database.stepRecords.where('experimentId').equals(id).delete();
      await database.procedures.where('experimentId').equals(id).delete();
      await database.experimentRunStates.delete(id);
      await database.experiments.delete(id);
    },
  );
}

// ---------- Folders ----------

/** All folders, by name. */
export async function listFolders(database: LabCompanionDB = defaultDb): Promise<Folder[]> {
  const folders = await database.folders.toArray();
  return folders.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createFolder(name: string, database: LabCompanionDB = defaultDb): Promise<Folder> {
  const folder: Folder = { id: newId(), name: name.trim() || DEFAULT_FOLDER_NAME, createdAt: Date.now() };
  await database.folders.add(folder);
  return folder;
}

export async function renameFolder(id: string, name: string, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.folders.update(id, { name: name.trim() || DEFAULT_FOLDER_NAME });
}

/** Deletes a folder. Its experiments move to Unfiled; experiments are never deleted. */
export async function deleteFolder(id: string, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.transaction('rw', database.folders, database.experiments, async () => {
    await database.experiments.where('folderId').equals(id).modify({ folderId: null, updatedAt: Date.now() });
    await database.folders.delete(id);
  });
}

/** Moves an experiment into a folder, or back to Unfiled with null. */
export function setExperimentFolder(
  experimentId: string,
  folderId: string | null,
  database: LabCompanionDB = defaultDb,
): Promise<void> {
  return updateExperiment(experimentId, { folderId }, database);
}

// ---------- Procedures and run state ----------

export async function saveProcedure(procedure: Procedure, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.procedures.put({ ...procedure, updatedAt: Date.now() });
}

export function getProcedureForExperiment(
  experimentId: string,
  database: LabCompanionDB = defaultDb,
): Promise<Procedure | undefined> {
  return database.procedures.where('experimentId').equals(experimentId).first();
}

export function getRunState(experimentId: string, database: LabCompanionDB = defaultDb): Promise<RunState | undefined> {
  return database.experimentRunStates.get(experimentId);
}

export async function saveRunState(state: Omit<RunState, 'updatedAt'>, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.experimentRunStates.put({ ...state, updatedAt: Date.now() });
}

// ---------- Step records ----------

export async function addStepRecord(
  input: Omit<StepRecord, 'id' | 'createdAt'>,
  database: LabCompanionDB = defaultDb,
): Promise<StepRecord> {
  const record: StepRecord = { ...input, id: newId(), createdAt: Date.now() };
  await database.stepRecords.add(record);
  return record;
}

/** Every record for an experiment, oldest first. */
export async function listStepRecords(experimentId: string, database: LabCompanionDB = defaultDb): Promise<StepRecord[]> {
  return database.stepRecords.where('experimentId').equals(experimentId).sortBy('createdAt');
}

/** Records for one step of an experiment, oldest first. */
export async function listStepRecordsForStep(
  experimentId: string,
  stepId: string,
  database: LabCompanionDB = defaultDb,
): Promise<StepRecord[]> {
  return database.stepRecords.where('[experimentId+stepId]').equals([experimentId, stepId]).sortBy('createdAt');
}

export async function updateStepRecord(
  id: string,
  changes: Partial<Pick<StepRecord, 'kind' | 'label' | 'value' | 'unit' | 'startedAt' | 'stoppedAt' | 'elapsedSec' | 'note'>>,
  database: LabCompanionDB = defaultDb,
): Promise<void> {
  await database.stepRecords.update(id, changes);
}

export async function deleteStepRecord(id: string, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.stepRecords.delete(id);
}

// ---------- Timers ----------

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
