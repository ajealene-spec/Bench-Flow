import Dexie, { type Table } from 'dexie';
import type { Lab, Procedure, RunState, Timer } from '../types';

export class LabCompanionDB extends Dexie {
  labs!: Table<Lab, string>;
  procedures!: Table<Procedure, string>;
  runStates!: Table<RunState, string>;
  timers!: Table<Timer, string>;

  constructor(name = 'lab-companion') {
    super(name);
    this.version(1).stores({
      labs: 'id, status, updatedAt',
      procedures: 'id, labId',
      runStates: 'labId, updatedAt',
      timers: 'id, stepId, status',
    });
  }
}

export const db = new LabCompanionDB();
