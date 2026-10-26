import { db as defaultDb, type LabCompanionDB } from '../../db';
import { listProtocolVersions, putProtocolVersion } from '../../db/protocolVersions';
import type { ProtocolTemplate, ProtocolVersion } from '../../types';

/** Quiet time after the last save before a snapshot is written. Keeps typing bursts to one version. */
export const SNAPSHOT_DEBOUNCE_MS = 1500;

/** Fields that make up the protocol content. Timestamps and internal flags are not part of a version. */
const CONTENT_KEYS = ['title', 'category', 'steps', 'hazards', 'overview', 'materials', 'phases', 'notes', 'license', 'authors'] as const;

export type ContentTemplate = Pick<ProtocolTemplate, (typeof CONTENT_KEYS)[number]>;

/** Stable JSON of the content fields. Two templates with the same fingerprint are the same protocol. */
export function contentFingerprint(template: Partial<ProtocolTemplate>): string {
  const picked: Record<string, unknown> = {};
  for (const key of CONTENT_KEYS) picked[key] = template[key] ?? null;
  return JSON.stringify(picked);
}

function pickContent(template: ProtocolTemplate): ContentTemplate {
  return structuredClone({
    title: template.title,
    category: template.category,
    steps: template.steps,
    hazards: template.hazards ?? [],
    overview: template.overview,
    materials: template.materials ?? [],
    phases: template.phases ?? [],
    notes: template.notes,
    license: template.license,
    authors: template.authors,
  });
}

function latestOf(versions: ProtocolVersion[]): ProtocolVersion | undefined {
  return versions.reduce<ProtocolVersion | undefined>((best, v) => (!best || v.version > best.version ? v : best), undefined);
}

/**
 * Writes a new version when the template differs from its latest version. Returns the new version,
 * or null when nothing changed (or the template does not exist). Never writes a duplicate.
 */
export async function snapshotIfChanged(
  templateId: string,
  options: { note?: string; database?: LabCompanionDB } = {},
): Promise<ProtocolVersion | null> {
  const database = options.database ?? defaultDb;
  const template = await database.templates.get(templateId);
  if (!template) return null;
  const versions = await listProtocolVersions(templateId, database);
  const latest = latestOf(versions);
  if (latest && contentFingerprint(latest.snapshot) === contentFingerprint(template)) return null;

  const version: ProtocolVersion = {
    id: crypto.randomUUID(),
    templateId,
    version: (latest?.version ?? 0) + 1,
    snapshot: { ...pickContent(template), id: templateId, createdAt: template.createdAt, updatedAt: template.updatedAt },
    createdAt: Date.now(),
    note: options.note?.trim() || undefined,
  };
  await putProtocolVersion(version, database);
  return version;
}

const pending = new Map<string, ReturnType<typeof setTimeout>>();

/** Debounced snapshot after a save. Each new save on the same template restarts the quiet period. */
export function scheduleSnapshot(templateId: string, database: LabCompanionDB = defaultDb): void {
  const existing = pending.get(templateId);
  if (existing) clearTimeout(existing);
  pending.set(
    templateId,
    setTimeout(() => {
      pending.delete(templateId);
      void snapshotIfChanged(templateId, { database }).catch(() => {
        // A failed history write must never break editing; the next save tries again.
      });
    }, SNAPSHOT_DEBOUNCE_MS),
  );
}

let installed = false;

/**
 * Hooks template writes so every save (creating or updating a template row) schedules a snapshot.
 * The hook runs after the write has succeeded, so the snapshot never reads a half-written row.
 */
export function installVersionHistory(database: LabCompanionDB = defaultDb): void {
  if (installed) return;
  installed = true;
  database.templates.hook('creating', function (primKey) {
    this.onsuccess = () => scheduleSnapshot(String(primKey), database);
  });
  database.templates.hook('updating', function (_mods, primKey) {
    this.onsuccess = () => scheduleSnapshot(String(primKey), database);
  });
}

/**
 * Restores a version by writing its content back to the template. The restore is itself a new
 * version, so nothing in the history is ever removed. Returns false when the template already matches.
 */
export async function restoreVersion(
  templateId: string,
  versionId: string,
  database: LabCompanionDB = defaultDb,
): Promise<boolean> {
  const versions = await listProtocolVersions(templateId, database);
  const target = versions.find((v) => v.id === versionId);
  if (!target) throw new Error('That version no longer exists.');
  const current = await database.templates.get(templateId);
  if (!current) throw new Error('This protocol no longer exists.');
  if (contentFingerprint(target.snapshot) === contentFingerprint(current)) return false;

  const content = pickContent(target.snapshot as ProtocolTemplate);
  await database.templates.update(templateId, { ...content, updatedAt: Date.now() });
  await snapshotIfChanged(templateId, { database, note: `Restored from version ${target.version}` });
  return true;
}

/** Adds a note to the newest version, or saves a new version with the note when there are unsaved changes. */
export async function saveVersionWithNote(
  templateId: string,
  note: string,
  database: LabCompanionDB = defaultDb,
): Promise<'created' | 'noted' | 'nothing'> {
  const created = await snapshotIfChanged(templateId, { database, note });
  if (created) return 'created';
  const latest = latestOf(await listProtocolVersions(templateId, database));
  if (!latest || !note.trim()) return 'nothing';
  await putProtocolVersion({ ...latest, note: note.trim() }, database);
  return 'noted';
}
