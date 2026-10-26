import { db as defaultDb, type LabCompanionDB } from '../../db';
import { getAnimal } from '../../db/animals';
import { listComments } from '../../db/comments';
import { getExperiment } from '../../db/helpers';
import { getInventoryItem, listInventoryUsageForExperiment } from '../../db/inventory';
import { getSettings } from '../../db/settings';
import { getTemplate } from '../../db/templates';
import type { Procedure } from '../../types';
import { describeAnnotations, parseAnnotations } from '../data/photos/annotations';
import { photosForReport } from '../data/photos/photosForReport';
import { buildResearchPackage, findRrid, type PackageCreator, type PackagePhoto, type PackageReagent } from './researchPackage';
import type { ReportData } from './reportData';
import { buildZip } from './zip';

/** Loads what the research package needs beyond the report, then builds the zip. */
export async function buildResearchPackageZip(
  experimentId: string,
  data: Pick<ReportData, 'report' | 'procedure' | 'records' | 'events' | 'executionLog'>,
  database: LabCompanionDB = defaultDb,
): Promise<Uint8Array> {
  const experiment = await getExperiment(experimentId, database);
  if (!experiment) throw new Error('This experiment no longer exists.');
  const template = experiment.templateId ? await getTemplate(experiment.templateId, database) : null;
  const settings = await getSettings(database);

  const stepNumber = (procedure: Procedure | undefined, stepId: string | undefined): number | undefined => {
    if (!stepId || !procedure) return undefined;
    const index = procedure.steps.findIndex((s) => s.id === stepId);
    return index >= 0 ? index + 1 : undefined;
  };

  const usages = await listInventoryUsageForExperiment(experimentId, database);
  const byItem = new Map<string, PackageReagent>();
  for (const usage of usages) {
    const item = await getInventoryItem(usage.inventoryItemId, database);
    if (!item) continue;
    const existing: PackageReagent = byItem.get(item.id) ?? {
      name: item.name,
      kind: item.kind,
      vendor: item.vendor,
      catalogNumber: item.catalogNumber,
      lotNumber: item.lotNumber,
      expiresOn: item.expiresOn,
      rrid: item.rrid ?? findRrid(item.name, item.notes, item.catalogNumber),
      stepNumbers: [],
    };
    const n = stepNumber(data.procedure, usage.stepId);
    if (n !== undefined && !existing.stepNumbers.includes(n)) existing.stepNumbers.push(n);
    byItem.set(item.id, existing);
  }

  const photos = await photosForReport(experimentId, database);
  const packagePhotos: PackagePhoto[] = [];
  for (const photo of photos) {
    packagePhotos.push({
      id: photo.id,
      at: photo.at,
      caption: photo.caption,
      stepNumber: stepNumber(data.procedure, photo.stepId),
      mimeType: photo.blob.type || 'application/octet-stream',
      bytes: new Uint8Array(await photo.blob.arrayBuffer()),
      thumbnailBytes: photo.thumbnail ? new Uint8Array(await photo.thumbnail.arrayBuffer()) : undefined,
      annotations: describeAnnotations(parseAnnotations(photo.annotations)),
    });
  }

  const animals = [];
  for (const id of experiment.animalIds ?? []) {
    const animal = await getAnimal(id, database);
    if (animal) {
      animals.push({ label: animal.label, species: animal.species, strain: animal.strain, genotype: animal.genotype, sex: animal.sex, rrid: animal.rrid });
    }
  }

  const comments = await listComments({ targetType: 'experiment', targetId: experimentId }, database);

  // The user's name leads the creators list; protocol authors follow without repeating it.
  const creators: PackageCreator[] = [];
  const userName = settings.userName?.trim();
  if (userName) creators.push({ name: userName });
  for (const author of template?.authors ?? []) {
    if (author.trim() && !creators.some((c) => c.name === author)) creators.push({ name: author });
  }

  const entries = buildResearchPackage({
    experiment,
    report: data.report,
    executionLog: data.executionLog,
    events: data.events,
    procedure: data.procedure,
    template,
    records: data.records,
    reagents: [...byItem.values()],
    photos: packagePhotos,
    creators: creators.length > 0 ? creators : undefined,
    comments: comments.map((c) => ({ author: c.author, text: c.text, createdAt: c.createdAt, resolved: c.resolved })),
    animals,
    generatedAt: Date.now(),
  });
  return buildZip(entries);
}
