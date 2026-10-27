import { db as defaultDb, UNCATEGORIZED, type LabCompanionDB } from '../../db';
import type {
  ForkSource,
  Hazard,
  MaterialItem,
  MaterialKind,
  ProtocolOverview,
  ProtocolPhase,
  ProtocolTemplate,
  Step,
  Timer,
} from '../../types';
import { detectVariables } from '../assist/detectVariables';
import { computeValues } from '../assist/stepMath';

/*
 * protocols.io interchange. Export writes a protocols.io-shaped JSON document plus a `bench_flow`
 * block that keeps what protocols.io has no field for (phases, hazards, variables, timers), so
 * importing our own export gives back the same template. Import also accepts plain protocols.io
 * JSON, and a public protocols.io view link fetched from the browser.
 */

export const PROTOCOLS_IO_FORMAT = 'protocols.io-compatible';
export const PROTOCOLS_IO_VERSION = 1;
const MAX_IMPORT_CHARS = 5_000_000;
const FETCH_TIMEOUT_MS = 15_000;

export class ProtocolsIoError extends Error {}

/** Everything protocols.io has no field for. Kept so a round trip through our export is lossless. */
export interface BenchFlowExtension {
  category: string;
  overview?: ProtocolOverview;
  notes?: string;
  phases: ProtocolPhase[];
  materials: MaterialItem[];
  hazards: Hazard[];
  steps: Step[];
  forkedFrom?: ForkSource;
}

export interface ProtocolsIoDocument {
  format: typeof PROTOCOLS_IO_FORMAT;
  version: number;
  protocol: {
    title: string;
    description: string;
    authors: Array<{ name: string }>;
    license?: string;
    materials: Array<{ name: string; type: MaterialKind }>;
    /** duration is in seconds, as protocols.io step durations are. */
    steps: Array<{ id: string; title: string; description: string; duration?: number }>;
  };
  bench_flow?: BenchFlowExtension;
}

/** The fields an export needs. A saved ProtocolTemplate fits; so does an unsaved import review. */
export interface ExportSource {
  title: string;
  category?: string;
  steps: Step[];
  hazards?: Hazard[];
  overview?: ProtocolOverview;
  materials?: MaterialItem[];
  phases?: ProtocolPhase[];
  notes?: string;
  license?: string;
  authors?: string[];
  forkedFrom?: ForkSource;
}

// ---------- Export ----------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function paragraphs(text: string): string {
  return escapeHtml(text)
    .split(/\n+/)
    .filter((line) => line.trim())
    .map((line) => `<p>${line}</p>`)
    .join('');
}

function stepDescription(step: Step): string {
  const cautions = step.cautions.map((c) => `<p><em>Caution: ${escapeHtml(c)}</em></p>`).join('');
  return paragraphs(step.instructions) + cautions;
}

/** Builds the protocols.io-shaped document for a template. */
export function exportProtocolsIo(source: ExportSource): ProtocolsIoDocument {
  const materials = source.materials ?? [];
  return {
    format: PROTOCOLS_IO_FORMAT,
    version: PROTOCOLS_IO_VERSION,
    protocol: {
      title: source.title,
      description: source.overview?.objective ?? '',
      authors: (source.authors ?? []).map((name) => ({ name })),
      license: source.license,
      materials: materials.map((m) => ({ name: m.name, type: m.kind })),
      steps: source.steps.map((s) => ({
        id: s.id,
        title: s.title,
        description: stepDescription(s),
        duration: s.durationSec,
      })),
    },
    bench_flow: {
      category: source.category ?? UNCATEGORIZED,
      overview: source.overview,
      notes: source.notes,
      phases: source.phases ?? [],
      materials,
      hazards: source.hazards ?? [],
      steps: source.steps,
      forkedFrom: source.forkedFrom,
    },
  };
}

export function exportProtocolsIoJson(source: ExportSource): string {
  return JSON.stringify(exportProtocolsIo(source), null, 2);
}

// ---------- Markdown ----------

const KIND_HEADINGS: Record<MaterialKind, string> = {
  consumable: 'Consumables',
  solution: 'Solutions',
  reagent: 'Reagents',
  equipment: 'Equipment',
};

function formatNumber(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toPrecision(6))) : '—';
}

/** Markdown for a template: overview, materials, hazards, then steps with timers and planned values. */
export function exportMarkdown(source: ExportSource): string {
  const lines: string[] = [];
  const authors = (source.authors ?? []).join(', ');
  lines.push(`# ${source.title}`, '');
  const meta = [source.category ?? UNCATEGORIZED, source.license && `License: ${source.license}`, authors && `Authors: ${authors}`];
  lines.push(meta.filter(Boolean).join(' · '), '');
  if (source.forkedFrom) {
    const from = [source.forkedFrom.title, source.forkedFrom.author, source.forkedFrom.doi, source.forkedFrom.url].filter(Boolean);
    lines.push(`Adapted from: ${from.join(', ')}`, '');
  }

  if (source.overview) {
    lines.push('## Overview', '');
    if (source.overview.objective) lines.push(`- **Objective:** ${source.overview.objective}`);
    if (source.overview.totalTime) lines.push(`- **Total time:** ${source.overview.totalTime}`);
    if (source.overview.outputs) lines.push(`- **Outputs:** ${source.overview.outputs}`);
    lines.push('');
  }

  const materials = source.materials ?? [];
  if (materials.length > 0) {
    lines.push('## Materials', '');
    for (const kind of Object.keys(KIND_HEADINGS) as MaterialKind[]) {
      const items = materials.filter((m) => m.kind === kind);
      if (items.length === 0) continue;
      lines.push(`**${KIND_HEADINGS[kind]}**`, '');
      for (const item of items) lines.push(`- ${item.name}`);
      lines.push('');
    }
  }

  const hazards = source.hazards ?? [];
  if (hazards.length > 0) {
    lines.push('## Hazards', '');
    for (const h of hazards) {
      lines.push(`- **${h.name}** (${h.kind}): ${h.reason}${h.ppe.length ? ` PPE: ${h.ppe.join(', ')}.` : ''}`);
    }
    lines.push('');
  }

  lines.push('## Steps', '');
  const phases = source.phases ?? [];
  const phaseName = new Map(phases.map((p) => [p.id, p.name]));
  let currentPhase: string | undefined = undefined;
  source.steps.forEach((step, index) => {
    const phase = step.phaseId ? phaseName.get(step.phaseId) : undefined;
    if (phase && phase !== currentPhase) {
      lines.push(`### ${phase}`, '');
      currentPhase = phase;
    }
    const timer = step.durationSec ? ` (${formatNumber(step.durationSec / 60)} min)` : '';
    lines.push(`${index + 1}. **${step.title}**${timer}`, '');
    if (step.instructions) lines.push(`   ${step.instructions}`, '');
    const values = step.variables?.length ? computeValues(step.variables) : {};
    for (const v of step.variables ?? []) {
      const value = values[v.id];
      lines.push(`   - ${v.token}: ${formatNumber(value)} ${v.unit}${v.role === 'derived' ? ' (calculated)' : ''}`);
    }
    for (const c of step.cautions) lines.push(`   > Caution: ${c}`);
    if (step.variables?.length || step.cautions.length) lines.push('');
  });

  if (source.notes) lines.push('## Notes', '', source.notes, '');
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

// ---------- Import ----------

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|div|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function authorNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((a) => (typeof a === 'string' ? a : asText((a as { name?: unknown })?.name)))
    .filter((n): n is string => Boolean(n));
}

function materialKind(raw: unknown): MaterialKind {
  const text = typeof raw === 'string' ? raw.toLowerCase() : '';
  if (text.includes('equip') || text.includes('instrument')) return 'equipment';
  if (text.includes('reagent') || text.includes('solution') || text.includes('buffer')) return 'solution';
  return 'consumable';
}

function timersFor(stepId: string, title: string, durationSec: number | undefined): Timer[] {
  if (!durationSec || durationSec <= 0) return [];
  return [{ id: crypto.randomUUID(), stepId, label: title, durationSec, status: 'idle' }];
}

function parseJson(text: string): unknown {
  if (text.length > MAX_IMPORT_CHARS) throw new ProtocolsIoError('This file is too large to import (over 5 MB).');
  try {
    return JSON.parse(text);
  } catch {
    throw new ProtocolsIoError('This file is not valid JSON. Export the protocol as JSON from protocols.io and try again.');
  }
}

/**
 * Turns protocols.io JSON into a new template. Our own export restores every field. Plain
 * protocols.io JSON is mapped field by field, with steps, materials, authors and the source link.
 */
export function importProtocolsIoJson(text: string, now = Date.now()): ProtocolTemplate {
  const root = parseJson(text);
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    throw new ProtocolsIoError('This does not look like a protocols.io protocol.');
  }
  const obj = root as Record<string, unknown>;

  if (obj.format === PROTOCOLS_IO_FORMAT && obj.bench_flow) return fromBenchFlowExport(obj, now);

  const p = (obj.payload ?? obj.protocol ?? obj) as Record<string, unknown>;
  const title = asText(p.title) ?? 'Imported protocol';
  if (!Array.isArray(p.steps)) {
    throw new ProtocolsIoError('No steps were found in this file. Export the protocol as JSON from protocols.io and try again.');
  }

  const steps: Step[] = [];
  p.steps.forEach((raw, i) => {
    const s = (raw ?? {}) as Record<string, unknown>;
    const instructions = stripHtml(asText(s.description) ?? '');
    const stepTitle = asText(s.title) ?? (instructions.split('\n')[0]?.slice(0, 60) || '');
    if (!stepTitle && !instructions) return;
    const id = crypto.randomUUID();
    const durationSec = typeof s.duration === 'number' && s.duration > 0 ? s.duration : undefined;
    steps.push({
      id,
      title: stepTitle || `Step ${i + 1}`,
      instructions,
      durationSec,
      timers: timersFor(id, stepTitle || `Step ${i + 1}`, durationSec),
      reagents: [],
      dataFields: [],
      cautions: [],
      variables: detectVariables(instructions),
    });
  });
  if (steps.length === 0) {
    throw new ProtocolsIoError('No steps were found in this file. Export the protocol as JSON from protocols.io and try again.');
  }

  const materials: MaterialItem[] = Array.isArray(p.materials)
    ? p.materials
        .flatMap((m): MaterialItem[] => {
          const name = typeof m === 'string' ? m.trim() : asText((m as { name?: unknown })?.name);
          if (!name) return [];
          return [{ id: crypto.randomUUID(), name, kind: materialKind((m as { type?: unknown })?.type) }];
        })
    : [];

  const description = stripHtml(asText(p.description) ?? '');
  const authors = authorNames(p.authors);
  const doi = asText(p.doi) ?? asText(p.DOI);
  const url = asText(p.url) ?? (asText(p.uri) ? `https://www.protocols.io/view/${asText(p.uri)}` : undefined);

  return {
    id: crypto.randomUUID(),
    title,
    category: UNCATEGORIZED,
    steps,
    hazards: [],
    overview: description ? { objective: description, totalTime: '', outputs: '' } : undefined,
    materials,
    phases: [],
    license: asText(p.license),
    authors: authors.length ? authors : undefined,
    forkedFrom: { title, author: authors.length ? authors.join(', ') : undefined, url, doi },
    createdAt: now,
    updatedAt: now,
  };
}

function fromBenchFlowExport(obj: Record<string, unknown>, now: number): ProtocolTemplate {
  const protocol = (obj.protocol ?? {}) as Record<string, unknown>;
  const ext = obj.bench_flow as BenchFlowExtension;
  const authors = authorNames(protocol.authors);
  const title = asText(protocol.title) ?? 'Imported protocol';
  if (!Array.isArray(ext.steps) || ext.steps.length === 0) {
    throw new ProtocolsIoError('No steps were found in this file.');
  }
  return {
    id: crypto.randomUUID(),
    title,
    category: ext.category || UNCATEGORIZED,
    steps: ext.steps,
    hazards: ext.hazards ?? [],
    overview: ext.overview,
    materials: ext.materials ?? [],
    phases: ext.phases ?? [],
    notes: ext.notes,
    license: asText(protocol.license),
    authors: authors.length ? authors : undefined,
    forkedFrom: ext.forkedFrom ?? { title, author: authors.join(', ') || undefined },
    createdAt: now,
    updatedAt: now,
  };
}

/** Saves an imported template as-is. Imports are always new templates; nothing existing is overwritten. */
export async function saveImportedTemplate(template: ProtocolTemplate, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.templates.add(template);
}

// ---------- protocols.io links ----------

const VIEW_LINK = /^(?:https?:\/\/)?(?:www\.)?protocols\.io\/view\/([A-Za-z0-9._-]{1,200})\/?(?:[?#].*)?$/i;

/** The protocol slug from a public protocols.io view link, or null when the text is not one. */
export function protocolsIoSlug(link: string): string | null {
  const match = VIEW_LINK.exec(link.trim());
  return match ? match[1] : null;
}

/**
 * Fetches a public protocol's JSON from protocols.io. Only the slug is sent. Every failure is
 * turned into a message the user can act on, with the export file as the fallback.
 */
export async function fetchProtocolsIoJson(link: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const slug = protocolsIoSlug(link);
  if (!slug) {
    throw new ProtocolsIoError('Paste a public protocols.io link, such as https://www.protocols.io/view/your-protocol.');
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ProtocolsIoError('You are offline. Connect to the internet to fetch a link, or import an exported JSON file instead.');
  }

  let response: Response;
  try {
    response = await fetchImpl(`https://www.protocols.io/api/v3/protocols/${encodeURIComponent(slug)}`, {
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new ProtocolsIoError(
      'Could not reach protocols.io from this browser. Check your connection, or export the protocol as JSON on protocols.io and import the file.',
    );
  }

  if (response.status === 404) throw new ProtocolsIoError('protocols.io could not find that protocol. Check the link.');
  if (response.status === 401 || response.status === 403) {
    throw new ProtocolsIoError('That protocol is private. Export it as JSON on protocols.io and import the file instead.');
  }
  if (!response.ok) throw new ProtocolsIoError(`protocols.io returned an error (${response.status}). Try again later.`);

  const text = await response.text();
  if (text.length > MAX_IMPORT_CHARS) throw new ProtocolsIoError('This protocol is too large to import (over 5 MB).');
  return text;
}

// ---------- Files ----------

/** A safe download name, for example "western-blot.json". */
export function exportFileName(title: string, extension: 'json' | 'md'): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'protocol'}.${extension}`;
}

/** Starts a browser download of text content. */
export function downloadText(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
