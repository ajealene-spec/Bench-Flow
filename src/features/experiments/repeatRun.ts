import { db as defaultDb, type LabCompanionDB } from '../../db';
import { newId } from '../../db/helpers';
import type {
  Experiment,
  MaterialItem,
  Procedure,
  ProtocolPhase,
  ReagentUsage,
  RunValue,
  SafetyChecklistItem,
  Step,
  Timer,
} from '../../types';

/** What a repeat starts from: the run, its procedure snapshot, its inline values and its reagent lot links. */
export interface RepeatSource {
  experiment: Experiment;
  procedure: Procedure;
  runValues: RunValue[];
  usages: ReagentUsage[];
}

export interface RepeatOptions {
  title: string;
  /** Copy the inline variable values (runValues) into the new run as its starting values. */
  copyValues: boolean;
  now: number;
  newId: () => string;
}

export interface RepeatResult {
  experiment: Experiment;
  procedure: Procedure;
  runValues: RunValue[];
  usages: ReagentUsage[];
}

/** The default title for a repeat: "<title> (repeat)". */
export function defaultRepeatTitle(name: string): string {
  return `${name} (repeat)`;
}

/**
 * Builds a new run from an old one. Every id that identifies a step, phase, variable, timer, material or
 * checklist item is new, and references to them are remapped. Progress, timers, step records, events,
 * notes, animals and planned start are not carried over. Folder, tags, overview, materials, phases,
 * template link and reagent lot links are kept. The source is never modified.
 */
export function buildRepeatRun(source: RepeatSource, options: RepeatOptions): RepeatResult {
  const { newId: makeId, now } = options;
  const experimentId = makeId();
  const procedureId = makeId();

  const phaseIds = new Map<string, string>();
  const phases: ProtocolPhase[] = (source.procedure.phases ?? []).map((p) => {
    const id = makeId();
    phaseIds.set(p.id, id);
    return { id, name: p.name };
  });

  const stepIds = new Map<string, string>();
  const varIds = new Map<string, string>();
  const varKey = (stepId: string, varId: string) => `${stepId}\u0000${varId}`;

  const steps: Step[] = source.procedure.steps.map((step) => {
    const stepId = makeId();
    stepIds.set(step.id, stepId);
    const timers: Timer[] = step.timers.map((timer) => ({
      ...structuredClone(timer),
      id: makeId(),
      stepId,
      status: 'idle',
      startedAt: undefined,
      pausedRemainingSec: undefined,
      firstStartedAt: undefined,
    }));
    const variables = step.variables?.map((variable) => {
      const id = makeId();
      varIds.set(varKey(step.id, variable.id), id);
      return { ...structuredClone(variable), id };
    });
    return {
      ...structuredClone(step),
      id: stepId,
      phaseId: step.phaseId ? phaseIds.get(step.phaseId) : undefined,
      timers,
      variables,
    };
  });

  const materials: MaterialItem[] = (source.procedure.materials ?? []).map((m) => ({
    id: makeId(),
    name: m.name,
    kind: m.kind,
  }));

  const procedure: Procedure = {
    id: procedureId,
    experimentId,
    title: source.procedure.title,
    steps,
    overview: source.procedure.overview ? { ...source.procedure.overview } : undefined,
    materials,
    phases,
    createdAt: now,
    updatedAt: now,
  };

  const checklist: SafetyChecklistItem[] | undefined = source.experiment.safetyChecklist?.map((item) => ({
    ...item,
    checked: false,
  }));

  const experiment: Experiment = {
    id: experimentId,
    name: options.title.trim() || defaultRepeatTitle(source.experiment.name),
    status: 'draft',
    procedureId,
    templateId: source.experiment.templateId,
    folderId: source.experiment.folderId,
    tags: [...(source.experiment.tags ?? [])],
    duplicatedFrom: source.experiment.id,
    safetyChecklist: checklist,
    materialsChecked: [],
    createdAt: now,
    updatedAt: now,
  };

  const runValues: RunValue[] = options.copyValues
    ? source.runValues.flatMap((rv) => {
        const stepId = stepIds.get(rv.stepId);
        const varId = varIds.get(varKey(rv.stepId, rv.varId));
        if (!stepId || !varId) return [];
        return [{ ...rv, experimentId, stepId, varId, editedAt: now }];
      })
    : [];

  const usages: ReagentUsage[] = source.usages.flatMap((usage) => {
    if (usage.stepId === '') return [{ ...usage, experimentId, usedAt: now }];
    const stepId = stepIds.get(usage.stepId);
    return stepId ? [{ ...usage, experimentId, stepId, usedAt: now }] : [];
  });

  return { experiment, procedure, runValues, usages };
}

/**
 * Creates the repeat in one transaction and returns the new run. Throws when the source is missing or
 * has no protocol snapshot.
 */
export async function repeatExperiment(
  sourceId: string,
  options: { title: string; copyValues: boolean },
  database: LabCompanionDB = defaultDb,
): Promise<Experiment> {
  return database.transaction(
    'rw',
    [database.experiments, database.procedures, database.runValues, database.inventoryUsage],
    async () => {
      const experiment = await database.experiments.get(sourceId);
      if (!experiment) throw new Error('This experiment no longer exists.');
      const procedure = await database.procedures.where('experimentId').equals(sourceId).first();
      if (!procedure) throw new Error('This experiment has no protocol to repeat.');
      const runValues = await database.runValues.filter((rv) => rv.experimentId === sourceId).toArray();
      const usages = await database.inventoryUsage.where('experimentId').equals(sourceId).toArray();

      const result = buildRepeatRun(
        { experiment, procedure, runValues, usages },
        { title: options.title, copyValues: options.copyValues, now: Date.now(), newId },
      );

      await database.procedures.add(result.procedure);
      await database.experiments.add(result.experiment);
      if (result.runValues.length > 0) await database.runValues.bulkAdd(result.runValues);
      if (result.usages.length > 0) await database.inventoryUsage.bulkAdd(result.usages);
      return result.experiment;
    },
  );
}
