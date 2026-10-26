import { db as defaultDb, UNCATEGORIZED, type LabCompanionDB } from './index';
import type { Hazard, MaterialItem, ProtocolOverview, ProtocolPhase, ProtocolTemplate, Step } from '../types';

export const DEFAULT_TEMPLATE_TITLE = 'Untitled protocol';

export interface TemplateInput {
  title: string;
  category?: string;
  steps?: Step[];
  hazards?: Hazard[];
  overview?: ProtocolOverview;
  materials?: MaterialItem[];
  phases?: ProtocolPhase[];
  sourceText?: string;
}

function newId(): string {
  return crypto.randomUUID();
}

/** Trims a category; blank categories become "Uncategorized". */
export function normalizeCategory(category: string | undefined): string {
  return category?.trim() || UNCATEGORIZED;
}

export async function createTemplate(input: TemplateInput, database: LabCompanionDB = defaultDb): Promise<ProtocolTemplate> {
  const now = Date.now();
  const template: ProtocolTemplate = {
    id: newId(),
    title: input.title.trim() || DEFAULT_TEMPLATE_TITLE,
    category: normalizeCategory(input.category),
    steps: input.steps ?? [],
    hazards: input.hazards ?? [],
    overview: input.overview,
    materials: input.materials ?? [],
    phases: input.phases ?? [],
    sourceText: input.sourceText,
    createdAt: now,
    updatedAt: now,
  };
  await database.templates.add(template);
  return template;
}

export function getTemplate(id: string, database: LabCompanionDB = defaultDb): Promise<ProtocolTemplate | undefined> {
  return database.templates.get(id);
}

/** Updates a template. A blank title falls back to the default; a blank category to "Uncategorized". */
export async function updateTemplate(
  id: string,
  changes: Partial<Pick<ProtocolTemplate, 'title' | 'category' | 'steps' | 'hazards' | 'notes' | 'overview' | 'materials' | 'phases'>>,
  database: LabCompanionDB = defaultDb,
): Promise<void> {
  const next: Partial<ProtocolTemplate> = { ...changes, updatedAt: Date.now() };
  if (changes.title !== undefined) next.title = changes.title.trim() || DEFAULT_TEMPLATE_TITLE;
  if (changes.category !== undefined) next.category = normalizeCategory(changes.category);
  await database.templates.update(id, next);
}

/** All templates, grouped by category name then title. */
export async function listTemplates(database: LabCompanionDB = defaultDb): Promise<ProtocolTemplate[]> {
  const templates = await database.templates.toArray();
  return templates.sort(
    (a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title),
  );
}

/** Distinct category names in use, sorted. */
export async function listCategories(database: LabCompanionDB = defaultDb): Promise<string[]> {
  const templates = await database.templates.toArray();
  return [...new Set(templates.map((t) => t.category))].sort((a, b) => a.localeCompare(b));
}

/**
 * Deletes a template. Experiments started from it keep their procedure snapshots; their
 * templateId is set to null so the link is not left dangling.
 */
export async function deleteTemplate(id: string, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.transaction('rw', database.templates, database.experiments, async () => {
    await database.experiments.where('templateId').equals(id).modify({ templateId: null });
    await database.templates.delete(id);
  });
}

/**
 * Deletes a protocol and returns an Undo function. Undo restores the protocol and re-links the experiments
 * that pointed at it. Experiments keep their own step snapshots either way.
 */
export async function deleteTemplateWithUndo(id: string, database: LabCompanionDB = defaultDb): Promise<() => Promise<void>> {
  const template = await database.templates.get(id);
  const linked = await database.experiments.where('templateId').equals(id).primaryKeys();
  await deleteTemplate(id, database);
  return async () => {
    if (!template) return;
    await database.transaction('rw', database.templates, database.experiments, async () => {
      await database.templates.put(template);
      if (linked.length > 0) await database.experiments.where('id').anyOf(linked).modify({ templateId: id });
    });
  };
}
