export type ExperimentStatus = 'draft' | 'in_progress' | 'done';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'done';

/** A user-defined group for experiments. Deleting a folder moves its experiments to "Unfiled". */
export interface Folder {
  id: string;
  name: string;
  createdAt: number;
  /** Parent folder for nested folders. Missing or null means top level. */
  parentId?: string;
}

export type HazardKind = 'chemical' | 'biological' | 'physical' | 'radiological' | 'animal';

/** A hazard identified for a protocol. The parser fills these in later; for now they are stored empty. */
export interface Hazard {
  id: string;
  name: string;
  kind: HazardKind;
  reason: string;
  ppe: string[];
  stepIds: string[];
  /** The sentence from the protocol text that triggered this hazard. Shown to the user for review. */
  evidence?: string;
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
  /** Amount as written in the text, such as "5 µM" or "10 mL". */
  quantity?: string;
  checked?: boolean;
}

export type MaterialKind = 'consumable' | 'solution' | 'reagent' | 'equipment';

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
  /** Set when this template was copied from someone else's protocol. */
  forkedFrom?: ForkSource;
  /** License the template is shared under, for example "MIT" or "CC-BY-4.0". */
  license?: string;
  authors?: string[];
  /** True for templates shipped with the app (starter protocols). */
  isStarter?: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Where a forked protocol came from. */
export interface ForkSource {
  title: string;
  author?: string;
  url?: string;
  doi?: string;
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
  /** Ids of the animals this run used (from the Animals page). */
  animalIds?: string[];
  /** Ids of materials (from the run snapshot) the user has checked off on the bench. */
  materialsChecked?: string[];
  /** Run-mode resume point, set when the user pauses a run. */
  pausedAtPhaseId?: string;
  pausedAt?: number;
  /** null means unfiled. */
  folderId: string | null;
  /** Free-form tags for filtering and grouping. */
  tags?: string[];
  /** Id of the run this one was duplicated from ("Run again"). */
  duplicatedFrom?: string;
  /** Planned start date as a timestamp, set by the user. */
  plannedStart?: number;
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
  /** Research Resource Identifier, for example "RRID:AB_2298772". Checked with validateRrid before saving. */
  rrid?: string;
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

// ---------- Lab notebook (schema v7) ----------

export type ResearchField = 'neuroscience' | 'molecular' | 'cell_bio' | 'other';
export type ExperienceMode = 'beginner' | 'advanced';
export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * App-wide preferences. There is exactly one row, keyed by SETTINGS_ID. The Anthropic key lives here
 * too: it stays in this browser's IndexedDB and is sent only to the app's own /api routes as a header.
 */
export interface AppSettings {
  id: string;
  mode: ExperienceMode;
  field: ResearchField | null;
  techniques: string[];
  /** Set when the first-run welcome is finished (or skipped). Unset means the welcome is still shown. */
  onboardedAt?: number;
  theme: ThemePreference;
  dyslexiaFont: boolean;
  voiceEnabled: boolean;
  /** Bring-your-own Anthropic key. Local only; never synced and never logged. */
  apiKey?: string;
  /** The user's name, shown on comments and as the creator in research packages. */
  userName?: string;
}

/** A cached explanation for one template step (why it matters, common mistakes, reading links). */
export interface StepExplanation {
  templateStepId: string;
  why: string;
  mistakes: string[];
  links: ExplanationLink[];
}

export interface ExplanationLink {
  title: string;
  url: string;
}

/** A term the user keeps for their own reference. */
export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  createdAt: number;
  updatedAt: number;
}

export type AnimalSex = 'male' | 'female' | 'unknown';

export type AnimalEventKind = 'weight' | 'surgery' | 'injection' | 'post_op_check';

/** A dated entry in an animal's record. `value` and `unit` are used for weights and doses. */
export interface AnimalEvent {
  id: string;
  kind: AnimalEventKind;
  /** Wall-clock ms. */
  at: number;
  value?: number;
  unit?: string;
  note?: string;
}

export interface Animal {
  id: string;
  label: string;
  cageId?: string;
  species: string;
  strain: string;
  genotype: string;
  sex: AnimalSex;
  /** ISO date (YYYY-MM-DD). */
  dob: string;
  notes?: string;
  /** Research Resource Identifier, for example "RRID:IMSR_JAX:000664". */
  rrid?: string;
  events: AnimalEvent[];
  createdAt: number;
  updatedAt: number;
}

export interface Cage {
  id: string;
  label: string;
  room: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

/** Whole-cell patch clamp measurements. Rm and Ra in MOhm, Cm in pF, holding in mV. */
export interface EphysRecord {
  id: string;
  experimentId: string;
  stepId?: string;
  cellId: string;
  Rm: number;
  Ra: number;
  Cm: number;
  holding: number;
  notes?: string;
  /** Wall-clock ms. */
  at: number;
}

export interface ImagingRecord {
  id: string;
  experimentId: string;
  stepId?: string;
  microscope: string;
  objective: string;
  /** Laser line and power, free text, for example "488 nm, 5%". */
  laser: string;
  /** Exposure or dwell settings, free text, for example "200 ms". */
  exposure: string;
  gain: number;
  channels: string[];
  /** Image file name or path the acquisition was saved to. */
  file?: string;
  /** Wall-clock ms. */
  at: number;
}

/** A text label placed on a photo. x and y are fractions (0 to 1) of the image size. */
export interface PhotoLabel {
  id: string;
  /** Missing on labels saved before arrows existed. Treated as a label. */
  type?: 'label';
  x: number;
  y: number;
  text: string;
}

/** An arrow drawn on a photo. Start and end points are fractions (0 to 1) of the image size. */
export interface PhotoArrow {
  id: string;
  type: 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Optional caption shown next to the arrow. */
  text?: string;
}

export type PhotoAnnotation = PhotoLabel | PhotoArrow;

export interface Photo {
  id: string;
  experimentId: string;
  stepId?: string;
  blob: Blob;
  /** Small JPEG copy for lists and reports. Missing on photos saved before thumbnails existed. */
  thumbnail?: Blob;
  annotations: PhotoAnnotation[];
  caption: string;
  /** Wall-clock ms. */
  at: number;
}

export type SampleFormat = '96' | '24' | 'list';

export interface SampleWell {
  sampleId: string;
  label: string;
  group: string;
}

/** A plate map or sample sheet. Wells are keyed by position, for example "A1", or by sample for lists. */
export interface SampleSheet {
  id: string;
  experimentId: string;
  format: SampleFormat;
  wells: Record<string, SampleWell>;
}

/** An immutable snapshot of a template, kept each time its protocol is saved as a new version. */
export interface ProtocolVersion {
  id: string;
  templateId: string;
  version: number;
  snapshot: ProtocolTemplate;
  createdAt: number;
  note?: string;
}

export type CommentTargetType = 'template' | 'step' | 'experiment';

/** A review comment on a template, a step or an experiment. */
export interface TargetComment {
  id: string;
  targetType: CommentTargetType;
  targetId: string;
  author: string;
  text: string;
  createdAt: number;
  resolved: boolean;
}

/** A stereotaxic coordinate set. ap, ml and dv are in mm from bregma (or the atlas origin). angle in degrees. */
export interface StereotaxTarget {
  id: string;
  name: string;
  atlas: string;
  ap: number;
  ml: number;
  dv: number;
  angle?: number;
  notes?: string;
}

export type TaskRecurrence = 'none' | 'daily' | 'weekly';

/** A calendar task. date is yyyy-mm-dd in local time; time is HH:mm. */
export interface Task {
  id: string;
  title: string;
  notes?: string;
  date: string;
  time?: string;
  durationMin?: number;
  done: boolean;
  experimentId?: string;
  color?: string;
  recurrence?: TaskRecurrence;
  createdAt: number;
}
