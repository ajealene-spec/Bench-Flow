import { db as defaultDb, type LabCompanionDB } from '../../db';
import { getExperiment } from '../../db/helpers';
import { getInventoryItem, listInventoryUsageForExperiment } from '../../db/inventory';
import { listPhotos } from '../../db/photos';
import { getTemplate } from '../../db/templates';
import type { Procedure } from '../../types';
import { buildResearchPackage, findRrid, type PackagePhoto, type PackageReagent } from './researchPackage';
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
      rrid: findRrid(item.name, item.notes, item.catalogNumber),
      stepNumbers: [],
    };
    const n = stepNumber(data.procedure, usage.stepId);
    if (n !== undefined && !existing.stepNumbers.includes(n)) existing.stepNumbers.push(n);
    byItem.set(item.id, existing);
  }

  const photos = await listPhotos(experimentId, database);
  const packagePhotos: PackagePhoto[] = [];
  for (const photo of photos) {
    packagePhotos.push({
      id: photo.id,
      at: photo.at,
      caption: photo.caption,
      stepNumber: stepNumber(data.procedure, photo.stepId),
      mimeType: photo.blob.type || 'application/octet-stream',
      bytes: new Uint8Array(await photo.blob.arrayBuffer()),
      annotations: photo.annotations.map((a) => a.text).filter(Boolean),
    });
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
    generatedAt: Date.now(),
  });
  return buildZip(entries);
}
