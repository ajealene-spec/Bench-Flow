export type LabStatus = 'draft' | 'in_progress' | 'done';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'done';

export interface Lab {
  id: string;
  name: string;
  status: LabStatus;
  procedureId?: string;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
}

export interface Timer {
  id: string;
  stepId: string;
  label: string;
  durationSec: number;
  startedAt?: number;
  pausedRemainingSec?: number;
  status: TimerStatus;
}

export interface Reagent {
  name: string;
  amount?: string;
  unit?: string;
}

export interface DataField {
  id: string;
  label: string;
  unit?: string;
  type: 'number' | 'text';
}

export interface Step {
  id: string;
  title: string;
  instructions: string;
  durationSec?: number;
  timers: Timer[];
  reagents: Reagent[];
  dataFields: DataField[];
  cautions: string[];
}

export interface Procedure {
  id: string;
  labId: string;
  title: string;
  steps: Step[];
  createdAt: number;
  updatedAt: number;
}

export interface RunState {
  labId: string;
  currentStepIndex: number;
  completedStepIds: string[];
  updatedAt: number;
}
