import type { CommentTargetType, ForkSource, ProtocolTemplate, Step, TargetComment } from '../../types';

/** Marker and version written into every .benchflow.json file and share link. */
export const BENCHFLOW_FORMAT = 'benchflow';
export const BENCHFLOW_FORMAT_VERSION = 1;
export const BENCHFLOW_EXTENSION = '.benchflow.json';

/** Share links longer than this (in bytes of the encoded hash) get a warning and a file suggestion. */
export const SHARE_LINK_WARN_BYTES = 8 * 1024;

export interface BenchflowMetadata {
  title: string;
  authors: string[];
  license: string;
  forkedFrom?: ForkSource;
  /** Latest saved version number of the template when it was exported. */
  version: number;
  /** Optional citation fields, carried through from a file that has them. */
  doi?: string;
  url?: string;
  exportedAt: number;
}

export interface SharedTemplate {
  title: string;
  category: string;
  overview?: ProtocolTemplate['overview'];
  materials?: ProtocolTemplate['materials'];
  phases?: ProtocolTemplate['phases'];
  steps: Step[];
  hazards: ProtocolTemplate['hazards'];
  notes?: string;
}

export interface SharedComment {
  targetType: CommentTargetType;
  /** Template id, or step id for step comments. Remapped on import. */
  targetId: string;
  author: string;
  text: string;
  createdAt: number;
  resolved: boolean;
}

export interface BenchflowPayload {
  format: typeof BENCHFLOW_FORMAT;
  formatVersion: typeof BENCHFLOW_FORMAT_VERSION;
  metadata: BenchflowMetadata;
  template: SharedTemplate;
  /** Only present in .benchflow.json files. Share links leave comments out to stay short. */
  comments?: SharedComment[];
}

export function newBenchflowId(): string {
  return crypto.randomUUID();
}

/** Builds the shareable payload from a stored template. Runtime-only timer state is dropped. */
export function buildBenchflowPayload(input: {
  template: ProtocolTemplate;
  version: number;
  comments?: TargetComment[];
  exportedAt?: number;
}): BenchflowPayload {
  const { template } = input;
  const payload: BenchflowPayload = {
    format: BENCHFLOW_FORMAT,
    formatVersion: BENCHFLOW_FORMAT_VERSION,
    metadata: {
      title: template.title,
      authors: [...(template.authors ?? [])],
      license: template.license ?? DEFAULT_LICENSE,
      forkedFrom: template.forkedFrom ? { ...template.forkedFrom } : undefined,
      version: input.version,
      exportedAt: input.exportedAt ?? Date.now(),
    },
    template: {
      title: template.title,
      category: template.category,
      overview: template.overview,
      materials: template.materials ?? [],
      phases: template.phases ?? [],
      steps: structuredClone(template.steps),
      hazards: template.hazards ?? [],
      notes: template.notes,
    },
  };
  if (input.comments) {
    payload.comments = input.comments.map((c) => ({
      targetType: c.targetType,
      targetId: c.targetId,
      author: c.author,
      text: c.text,
      createdAt: c.createdAt,
      resolved: c.resolved,
    }));
  }
  return payload;
}

/** Default license for templates that have none set. */
export const DEFAULT_LICENSE = 'CC-BY-4.0';

export function serializeBenchflow(payload: BenchflowPayload): string {
  return JSON.stringify(payload, null, 2);
}

export function benchflowFileName(title: string): string {
  const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'protocol';
  return `${slug}${BENCHFLOW_EXTENSION}`;
}

function fail(message: string): never {
  throw new Error(message);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function normalizeStep(raw: unknown, index: number): Step {
  if (typeof raw !== 'object' || raw === null) fail(`Step ${index + 1} is not an object.`);
  const s = raw as Record<string, unknown>;
  const id = asString(s.id) || newBenchflowId();
  const timers = Array.isArray(s.timers)
    ? s.timers.map((t) => {
        const timer = (t ?? {}) as Record<string, unknown>;
        return {
          id: asString(timer.id) || newBenchflowId(),
          stepId: id,
          label: asString(timer.label, 'Timer'),
          durationSec: typeof timer.durationSec === 'number' ? timer.durationSec : 0,
          status: 'idle' as const,
        };
      })
    : [];
  return {
    id,
    title: asString(s.title, `Step ${index + 1}`),
    instructions: asString(s.instructions),
    durationSec: typeof s.durationSec === 'number' ? s.durationSec : undefined,
    timers,
    reagents: Array.isArray(s.reagents)
      ? (s.reagents as Step['reagents']).filter((r) => r && typeof r.name === 'string')
      : [],
    dataFields: Array.isArray(s.dataFields) ? (s.dataFields as Step['dataFields']) : [],
    cautions: asStringArray(s.cautions),
    phaseId: typeof s.phaseId === 'string' ? s.phaseId : undefined,
    variables: Array.isArray(s.variables) ? (s.variables as Step['variables']) : undefined,
  };
}

/**
 * Checks a parsed .benchflow.json (or decoded share link) and fills in missing optional fields.
 * Throws an Error with a message a person can act on when the file is not a Bench Flow protocol.
 */
export function parseBenchflowPayload(input: unknown): BenchflowPayload {
  if (typeof input !== 'object' || input === null) fail('This is not a Bench Flow protocol file.');
  const raw = input as Record<string, unknown>;
  if (raw.format !== BENCHFLOW_FORMAT) fail('This is not a Bench Flow protocol file (missing "format": "benchflow").');
  if (typeof raw.formatVersion !== 'number' || raw.formatVersion > BENCHFLOW_FORMAT_VERSION) {
    fail('This protocol file was made by a newer version of Bench Flow. Update the app to open it.');
  }
  const meta = (raw.metadata ?? {}) as Record<string, unknown>;
  const tpl = raw.template as Record<string, unknown> | undefined;
  if (typeof tpl !== 'object' || tpl === null) fail('The protocol file has no template.');
  if (!Array.isArray(tpl.steps)) fail('The protocol file has no steps list.');

  const title = asString(tpl.title).trim() || asString(meta.title).trim();
  if (!title) fail('The protocol file has no title.');

  const steps = (tpl.steps as unknown[]).map((s, i) => normalizeStep(s, i));
  const phases = Array.isArray(tpl.phases)
    ? (tpl.phases as Array<{ id?: unknown; name?: unknown }>)
        .filter((p) => typeof p?.id === 'string')
        .map((p) => ({ id: p.id as string, name: asString(p.name, 'Phase') }))
    : [];
  const materials = Array.isArray(tpl.materials)
    ? (tpl.materials as Array<Record<string, unknown>>)
        .filter((m) => typeof m?.name === 'string')
        .map((m) => ({
          id: asString(m.id) || newBenchflowId(),
          name: m.name as string,
          kind: (['consumable', 'solution', 'equipment'].includes(m.kind as string) ? m.kind : 'consumable') as 'consumable' | 'solution' | 'equipment',
        }))
    : [];

  const comments: SharedComment[] | undefined = Array.isArray(raw.comments)
    ? (raw.comments as Array<Record<string, unknown>>)
        .filter((c) => typeof c?.text === 'string' && typeof c?.targetId === 'string')
        .map((c) => ({
          targetType: (['template', 'step', 'experiment'].includes(c.targetType as string) ? c.targetType : 'template') as CommentTargetType,
          targetId: c.targetId as string,
          author: asString(c.author, 'Unknown'),
          text: c.text as string,
          createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now(),
          resolved: c.resolved === true,
        }))
    : undefined;

  return {
    format: BENCHFLOW_FORMAT,
    formatVersion: BENCHFLOW_FORMAT_VERSION,
    metadata: {
      title,
      authors: asStringArray(meta.authors),
      license: asString(meta.license, DEFAULT_LICENSE),
      forkedFrom: parseForkSource(meta.forkedFrom),
      version: typeof meta.version === 'number' ? meta.version : 1,
      doi: typeof meta.doi === 'string' ? meta.doi : undefined,
      url: typeof meta.url === 'string' ? meta.url : undefined,
      exportedAt: typeof meta.exportedAt === 'number' ? meta.exportedAt : Date.now(),
    },
    template: {
      title,
      category: asString(tpl.category, 'Uncategorized'),
      overview: tpl.overview as SharedTemplate['overview'],
      materials,
      phases,
      steps,
      hazards: Array.isArray(tpl.hazards) ? (tpl.hazards as SharedTemplate['hazards']) : [],
      notes: typeof tpl.notes === 'string' ? tpl.notes : undefined,
    },
    comments,
  };
}

function parseForkSource(value: unknown): ForkSource | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const f = value as Record<string, unknown>;
  if (typeof f.title !== 'string') return undefined;
  return {
    title: f.title,
    author: typeof f.author === 'string' ? f.author : undefined,
    url: typeof f.url === 'string' ? f.url : undefined,
    doi: typeof f.doi === 'string' ? f.doi : undefined,
  };
}

/** Reads and validates the text of a .benchflow.json file. */
export function parseBenchflowText(text: string): BenchflowPayload {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    fail('This file is not valid JSON, so it cannot be opened.');
  }
  return parseBenchflowPayload(json);
}
