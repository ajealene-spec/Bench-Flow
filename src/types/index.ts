export type ExperimentStatus = 'draft' | 'in_progress' | 'done';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'done';

/** A user-defined group for experiments. Deleting a folder moves its experiments to "Unfiled". */
export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export interface Experiment {
  id: string;
  name: string;
  status: ExperimentStatus;
  procedureId?: string;
  /** null means unfiled. */
  folderId: string | null;
  notes?: string;
  /** Set the first time the run is started. */
  startedAt?: number;
  /** Set when the last step completes; cleared when the experiment is reopened. */
  endedAt?: number;
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
  /** Experiment this run belongs to. Set on runs started from the run page, so finished runs can be logged. */
  experimentId?: string;
  /** Wall-clock time of the first start of this run, before any pauses. Used for elapsed time. */
  firstStartedAt?: number;
}

/** One recorded measurement or timer run, attached to a step of an experiment. */
export interface StepRecord {
  id: string;
  experimentId: string;
  stepId: string;
  kind: 'number' | 'timer';
  label: string;
  value?: number;
  unit?: string;
  startedAt?: number;
  stoppedAt?: number;
  elapsedSec?: number;
  note?: string;
  createdAt: number;
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
  experimentId: string;
  title: string;
  steps: Step[];
  createdAt: number;
  updatedAt: number;
}

export interface RunState {
  experimentId: string;
  currentStepIndex: number;
  completedStepIds: string[];
  updatedAt: number;
}
