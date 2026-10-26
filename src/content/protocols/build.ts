import type {
  HazardKind,
  MaterialKind,
  ProtocolOverview,
  ProtocolPhase,
  ProtocolTemplate,
  Step,
  StepVariable,
  Timer,
} from '../../types';

/** Licence and attribution shared by every starter protocol. */
export const STARTER_LICENSE = 'CC BY 4.0';
export const STARTER_AUTHORS = ['Bench Flow starter'];
/** Shown on the first step of every starter, and in its notes. */
export const VERIFY_NOTE = "Verify against your lab's SOP and SDS.";
/** Fixed timestamp so starter content is identical on every device and on every re-seed. */
export const STARTER_TIMESTAMP = Date.UTC(2026, 9, 26);

/** A quantity the user can type in (input) or a value computed from other variables in the same step (derived). */
export function input(id: string, token: string, value: number, unit: string): StepVariable {
  return { id, token, value, unit, role: 'input' };
}

export function derived(id: string, token: string, unit: string, formula: string): StepVariable {
  return { id, token, value: 0, unit, role: 'derived', formula };
}

export interface ReagentSpec {
  name: string;
  amount?: string;
  unit?: string;
}

export interface StepSpec {
  title: string;
  instructions: string;
  /** Planned duration in minutes. Sets the step duration and adds one timer. */
  minutes?: number;
  /** Index into the spec's phases (0-based). */
  phase?: number;
  cautions?: string[];
  reagents?: ReagentSpec[];
  variables?: StepVariable[];
}

export interface HazardSpec {
  name: string;
  kind: HazardKind;
  reason: string;
  ppe: string[];
  /** 1-based step numbers the hazard applies to. */
  steps: number[];
}

export interface StarterSpec {
  /** Short id used to build stable ids for the template, steps, phases and hazards. */
  slug: string;
  title: string;
  category: string;
  overview: ProtocolOverview;
  materials: Array<readonly [string, MaterialKind]>;
  phases?: string[];
  hazards: HazardSpec[];
  steps: StepSpec[];
}

/** Turns a compact spec into a full ProtocolTemplate with stable ids. */
export function buildStarter(spec: StarterSpec): ProtocolTemplate {
  const stepIds = spec.steps.map((_, i) => `${spec.slug}-s${i + 1}`);
  const phases: ProtocolPhase[] = (spec.phases ?? []).map((name, i) => ({ id: `${spec.slug}-p${i + 1}`, name }));

  const steps: Step[] = spec.steps.map((s, i) => {
    const id = stepIds[i];
    const minutes = s.minutes;
    const timers: Timer[] = minutes
      ? [{ id: `${id}-t1`, stepId: id, label: s.title, durationSec: minutes * 60, status: 'idle' }]
      : [];
    const cautions = i === 0 ? [...(s.cautions ?? []), VERIFY_NOTE] : (s.cautions ?? []);
    return {
      id,
      title: s.title,
      instructions: s.instructions,
      durationSec: minutes ? minutes * 60 : undefined,
      timers,
      reagents: s.reagents ?? [],
      dataFields: [],
      cautions,
      phaseId: s.phase !== undefined ? phases[s.phase]?.id : undefined,
      variables: s.variables ?? [],
    };
  });

  return {
    id: `starter-${spec.slug}`,
    title: spec.title,
    category: spec.category,
    steps,
    hazards: spec.hazards.map((h, i) => ({
      id: `${spec.slug}-h${i + 1}`,
      name: h.name,
      kind: h.kind,
      reason: h.reason,
      ppe: h.ppe,
      stepIds: h.steps.map((n) => stepIds[n - 1]).filter((x): x is string => Boolean(x)),
    })),
    overview: spec.overview,
    materials: spec.materials.map(([name, kind], i) => ({ id: `${spec.slug}-m${i + 1}`, name, kind })),
    phases,
    notes: VERIFY_NOTE,
    license: STARTER_LICENSE,
    authors: [...STARTER_AUTHORS],
    isStarter: true,
    createdAt: STARTER_TIMESTAMP,
    updatedAt: STARTER_TIMESTAMP,
  };
}
