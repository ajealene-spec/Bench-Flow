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

/** A named block of the protocol, such as "Day 1" or "Phase 2". Steps point at one with phaseId. */
export interface ProtocolPhase {
  id: string;
  name: string;
}

/** A reagent, consumable, solution or instrument needed before the run starts. */
export interface MaterialItem {
  id: string;
  name: string;
  kind: MaterialKind;
  checked?: boolean;
}

export type MaterialKind = 'consumable' | 'solution' | 'equipment';

/** Short overview shown above the steps. */
export interface ProtocolOverview {
  objective: string;
  totalTime: string;
  outputs: string;
}

/** A reusable, editable procedure in the Protocol Library. Experiments copy its steps when they start. */
export interface ProtocolTemplate {
  id: string;
  title: string;
  category: string;
  steps: Step[];
  hazards: Hazard[];
  overview?: ProtocolOverview;
  materials?: MaterialItem[];
  phases?: ProtocolPhase[];
  sourceText?: string;
  /** Free-text notes, including accepted literature suggestions. */
  notes?: string;
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
  /** Ids of materials (from the run snapshot) the user has checked off on the bench. */
  materialsChecked?: string[];
  /** Run-mode resume point, set when the user pauses a run. */
  pausedAtPhaseId?: string;
  pausedAt?: number;
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
  /** Id of the phase this step belongs to. Missing when the step is not in a phase. */
  phaseId?: string;
  /** Named values the step uses or calculates. Types only for now; the assistants agent fills them in. */
  variables?: StepVariable[];
}

/** A named quantity used by a step, such as a concentration or volume. */
export interface StepVariable {
  id: string;
  token: string;
  value: number;
  unit: string;
  role: 'input' | 'derived';
  formula?: string;
}

/** The value a user entered (or a calculator produced) for a step variable in one run. */
export interface RunValue {
  experimentId: string;
  stepId: string;
  varId: string;
  value: number;
  unit: string;
  editedAt: number;
}

export type ExecutionEventType =
  | 'step_start'
  | 'step_complete'
  | 'step_skip'
  | 'step_reorder'
  | 'timer_start'
  | 'timer_stop'
  | 'value_change'
  | 'note'
  | 'phase_pause'
  | 'phase_resume';

/** Marks an event that departed from the protocol. `delta` is actual minus planned when there is one. */
export interface EventDeviation {
  kind: 'timer' | 'value' | 'skip' | 'order' | 'note';
  delta?: number;
  tolerance?: number;
}

/** One entry in the append-only log of what happened during a run. */
export interface ExecutionEvent {
  id: string;
  experimentId: string;
  /** Wall-clock ms. */
  at: number;
  type: ExecutionEventType;
  stepId?: string;
  phaseId?: string;
  planned?: number | string;
  actual?: number | string;
  unit?: string;
  note?: string;
  deviation?: EventDeviation;
}

export interface Procedure {
  id: string;
  experimentId: string;
  title: string;
  steps: Step[];
  overview?: ProtocolOverview;
  materials?: MaterialItem[];
  phases?: ProtocolPhase[];
  createdAt: number;
  updatedAt: number;
}

export interface RunState {
  experimentId: string;
  currentStepIndex: number;
  completedStepIds: string[];
  updatedAt: number;
}

export type InventoryKind = 'antibody' | 'reagent' | 'buffer' | 'kit';

/** A reagent, antibody, buffer or kit the lab keeps stock of. Lots and expiry are added by the user. */
export interface InventoryItem {
  id: string;
  name: string;
  kind: InventoryKind;
  vendor?: string;
  catalogNumber?: string;
  lotNumber?: string;
  concentration?: string;
  stockDilution?: string;
  hostSpecies?: string;
  target?: string;
  conjugate?: string;
  isotype?: string;
  reactivity?: string[];
  /** ISO date (YYYY-MM-DD). */
  expiresOn?: string;
  location?: string;
  quantity?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

/** Links an inventory item (or lot) to the run it was used in. stepId is '' for run-level use. */
export interface ReagentUsage {
  experimentId: string;
  inventoryItemId: string;
  stepId: string;
  usedAt: number;
}
