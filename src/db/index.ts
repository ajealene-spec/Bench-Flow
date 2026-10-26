import Dexie, { type Table } from 'dexie';
import type { Experiment, Folder, Procedure, RunState, StepRecord, Timer } from '../types';

export class LabCompanionDB extends Dexie {
  experiments!: Table<Experiment, string>;
  folders!: Table<Folder, string>;
  procedures!: Table<Procedure, string>;
  experimentRunStates!: Table<RunState, string>;
  timers!: Table<Timer, string>;
  stepRecords!: Table<StepRecord, string>;

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
  }
}

export const db = new LabCompanionDB();
