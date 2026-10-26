import Dexie, { type Table } from 'dexie';
import type {
  Experiment,
  ExecutionEvent,
  Folder,
  InventoryItem,
  Procedure,
  ProtocolTemplate,
  ReagentUsage,
  RunState,
  RunValue,
  StepRecord,
  Timer,
} from '../types';

/** Category given to templates that were created from existing experiments by the version 3 upgrade. */
export const UNCATEGORIZED = 'Uncategorized';

export class LabCompanionDB extends Dexie {
  experiments!: Table<Experiment, string>;
  folders!: Table<Folder, string>;
  procedures!: Table<Procedure, string>;
  experimentRunStates!: Table<RunState, string>;
  timers!: Table<Timer, string>;
  stepRecords!: Table<StepRecord, string>;
  templates!: Table<ProtocolTemplate, string>;
  inventory!: Table<InventoryItem, string>;
  inventoryUsage!: Table<ReagentUsage, [string, string, string]>;
  executionEvents!: Table<ExecutionEvent, string>;
  runValues!: Table<RunValue, [string, string, string]>;

  constructor(name = 'lab-companion') {
    super(name);
    this.version(1).stores({
      labs: 'id, status, updatedAt',
      procedures: 'id, labId',
      runStates: 'labId, updatedAt',
      timers: 'id, stepId, status',
    });

    // Version 2: "Lab" becomes "Experiment". Primary keys cannot change in IndexedDB, so the run
    // state table is replaced by one keyed on experimentId. Old tables are read in the upgrade
    // below and then deleted (null). The database name is unchanged so existing data is kept.
    this.version(2)
      .stores({
        labs: null,
        runStates: null,
        experiments: 'id, status, updatedAt, folderId',
        folders: 'id, createdAt',
        procedures: 'id, experimentId',
        experimentRunStates: 'experimentId, updatedAt',
        stepRecords: 'id, experimentId, stepId, [experimentId+stepId]',
        timers: 'id, stepId, status',
      })
      .upgrade(async (tx) => {
        const labs = (await tx.table('labs').toArray()) as Array<{
          id: string;
          name: string;
          status: Experiment['status'];
          procedureId?: string;
          createdAt: number;
          updatedAt: number;
          lastOpenedAt?: number;
        }>;
        if (labs.length > 0) {
          await tx.table('experiments').bulkAdd(
            labs.map((lab) => ({
              id: lab.id,
              name: lab.name,
              status: lab.status,
              procedureId: lab.procedureId,
              folderId: null,
              createdAt: lab.createdAt,
              updatedAt: lab.updatedAt,
              lastOpenedAt: lab.lastOpenedAt,
            })),
          );
        }

        await tx.table('procedures').toCollection().modify((p: Record<string, unknown>) => {
          p.experimentId = p.labId;
          delete p.labId;
        });

        const states = (await tx.table('runStates').toArray()) as Array<{
          labId: string;
          currentStepIndex: number;
          completedStepIds: string[];
          updatedAt: number;
        }>;
        if (states.length > 0) {
          await tx.table('experimentRunStates').bulkAdd(
            states.map((s) => ({
              experimentId: s.labId,
              currentStepIndex: s.currentStepIndex,
              completedStepIds: s.completedStepIds,
              updatedAt: s.updatedAt,
            })),
          );
        }
      });

    // Version 3: reusable protocol templates. Every experiment that already has a procedure gets its
    // own template built from that procedure (category "Uncategorized"), so nothing is lost. The
    // procedure stays as the experiment's snapshot. Experiments gain a nullable templateId.
    this.version(3)
      .stores({
        templates: 'id, category, updatedAt',
        experiments: 'id, status, updatedAt, folderId, templateId',
      })
      .upgrade(async (tx) => {
        const experiments = (await tx.table('experiments').toArray()) as Experiment[];
        const procedures = (await tx.table('procedures').toArray()) as Procedure[];
        const now = Date.now();

        for (const experiment of experiments) {
          const procedure = procedures.find((p) => p.experimentId === experiment.id);
          if (!procedure) {
            await tx.table('experiments').update(experiment.id, { templateId: null });
            continue;
          }
          const templateId = crypto.randomUUID();
          await tx.table('templates').add({
            id: templateId,
            title: procedure.title,
            category: UNCATEGORIZED,
            steps: procedure.steps,
            hazards: [],
            createdAt: procedure.createdAt ?? now,
            updatedAt: procedure.updatedAt ?? now,
          } satisfies ProtocolTemplate);
          await tx.table('experiments').update(experiment.id, { templateId });
        }
      });

    // Version 4: reagent and antibody inventory. Usage rows are keyed by run, item and step so the
    // same item is linked to a run only once per step.
    this.version(4).stores({
      inventory: 'id, kind, name, expiresOn',
      inventoryUsage: '[experimentId+inventoryItemId+stepId], experimentId, inventoryItemId',
    });

    // Version 5: protocol overview, materials and phases. All three are optional fields inside the
    // existing documents, so no index changes are needed. The upgrade fills empty arrays in older
    // templates and procedure snapshots so readers never have to special-case missing lists.
    this.version(5).upgrade(async (tx) => {
      await tx.table('templates').toCollection().modify((t: Record<string, unknown>) => {
        t.phases ??= [];
        t.materials ??= [];
      });
      await tx.table('procedures').toCollection().modify((p: Record<string, unknown>) => {
        p.phases ??= [];
        p.materials ??= [];
      });
    });

    // Version 6: append-only execution log (what happened, when, and where it deviated) and per-run
    // values for step variables. Both start empty; no existing rows change.
    this.version(6).stores({
      executionEvents: 'id, experimentId, [experimentId+at]',
      runValues: '[experimentId+stepId+varId]',
    });
  }
}

export const db = new LabCompanionDB();
