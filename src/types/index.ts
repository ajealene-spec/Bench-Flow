export type ExperimentStatus = 'draft' | 'in_progress' | 'done';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'done';

/** A user-defined group for experiments. Deleting a folder moves its experiments to "Unfiled". */
export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export type HazardKind = 'chemical' | 'biological' | 'physical' | 'radiological';

/** A hazard identified for a protocol. The parser fills these in later; for now they are stored empty. */
export interface Hazard {
  id: string;
  name: string;
  kind: HazardKind;
  reason: string;
  ppe: string[];
  stepIds: string[];
}

/** A reusable, editable procedure in the Protocol Library. Experiments copy its steps when they start. */
export interface ProtocolTemplate {
  id: string;
  title: string;
  category: string;
  steps: Step[];
  hazards: Hazard[];
  sourceText?: string;
  createdAt: number;
  updatedAt: number;
}

/** One item of the pre-run safety checklist. */
export interface SafetyChecklistItem {
  itemId: string;
  label: string;
  checked: boolean;
}

export interface Experiment {
  id: string;
  name: string;
  status: ExperimentStatus;
  procedureId?: string;
  /** The template this run was started from. Null or missing when the template was deleted or never existed. */
  templateId?: string | null;
  /** Pre-run safety checklist. Run mode builds the gate UI on top of this. */
  safetyChecklist?: SafetyChecklistItem[];
  /** Set when every safety checklist item has been checked. */
  safetyConfirmedAt?: number;
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
