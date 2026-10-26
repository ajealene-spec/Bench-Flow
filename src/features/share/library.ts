import { db as defaultDb, UNCATEGORIZED, type LabCompanionDB } from '../../db';
import type { ForkSource, ProtocolPhase, ProtocolTemplate, Step, TargetComment } from '../../types';
import { DEFAULT_LICENSE, newBenchflowId, type BenchflowPayload } from './benchflowFile';

interface BuiltTemplate {
  template: ProtocolTemplate;
  /** Maps the file's step ids to the new ids, for re-attaching comments. */
  stepIdMap: Map<string, string>;
}

/** Builds a new template from a payload with fresh ids everywhere. Phase links on steps are remapped too. */
function buildTemplate(payload: BenchflowPayload, forkedFrom: ForkSource | undefined, authors: string[]): BuiltTemplate {
  const { metadata, template: source } = payload;
  const now = Date.now();
  const templateId = newBenchflowId();

  const phaseMap = new Map<string, string>();
  const phases: ProtocolPhase[] = (source.phases ?? []).map((p) => {
    const id = newBenchflowId();
    phaseMap.set(p.id, id);
    return { ...p, id };
  });

  const stepIdMap = new Map<string, string>();
  const steps: Step[] = source.steps.map((s) => {
    const id = newBenchflowId();
    stepIdMap.set(s.id, id);
    return {
      ...s,
      id,
      phaseId: s.phaseId ? phaseMap.get(s.phaseId) : undefined,
      timers: s.timers.map((t) => ({ ...t, id: newBenchflowId(), stepId: id })),
    };
  });

  return {
    stepIdMap,
    template: {
      id: templateId,
      title: source.title,
      category: source.category || UNCATEGORIZED,
      steps,
      hazards: source.hazards ?? [],
      overview: source.overview,
      materials: (source.materials ?? []).map((m) => ({ ...m, id: newBenchflowId() })),
      phases,
      notes: source.notes,
      forkedFrom,
      // The license travels with the work. CC BY and CC BY-SA need attribution, which forkedFrom records.
      license: metadata.license || DEFAULT_LICENSE,
      authors,
      createdAt: now,
      updatedAt: now,
    },
  };
}

/** Copies a shared protocol into the library, crediting the original. Comments are not copied. */
export async function copyWithCredit(
  payload: BenchflowPayload,
  options: { sourceUrl?: string; database?: LabCompanionDB } = {},
): Promise<ProtocolTemplate> {
  const database = options.database ?? defaultDb;
  const { metadata } = payload;
  const forkedFrom: ForkSource = {
    title: metadata.title,
    author: metadata.authors.length > 0 ? metadata.authors.join(', ') : undefined,
    url: options.sourceUrl ?? metadata.url,
    doi: metadata.doi,
  };
  // The authors of the copy are the person who made it; they can edit the list afterwards.
  const { template } = buildTemplate(payload, forkedFrom, []);
  await database.templates.add(template);
  return template;
}

/**
 * Imports a .benchflow.json as a new template that keeps its authors and license. Ids are replaced,
 * and the file's comments are re-attached to the new ids.
 */
export async function importBenchflowPayload(
  payload: BenchflowPayload,
  database: LabCompanionDB = defaultDb,
): Promise<{ templateId: string; commentCount: number }> {
  const { template, stepIdMap } = buildTemplate(payload, payload.metadata.forkedFrom, payload.metadata.authors);
  const comments: TargetComment[] = [];
  for (const c of payload.comments ?? []) {
    let targetId: string | undefined;
    if (c.targetType === 'template') targetId = template.id;
    else if (c.targetType === 'step') targetId = stepIdMap.get(c.targetId);
    // Experiment comments have no experiment in the file to attach to, so they are dropped.
    if (!targetId) continue;
    comments.push({
      id: newBenchflowId(),
      targetType: c.targetType,
      targetId,
      author: c.author,
      text: c.text,
      createdAt: c.createdAt,
      resolved: c.resolved,
    });
  }
  await database.transaction('rw', database.templates, database.comments, async () => {
    await database.templates.add(template);
    if (comments.length > 0) await database.comments.bulkAdd(comments);
  });
  return { templateId: template.id, commentCount: comments.length };
}
