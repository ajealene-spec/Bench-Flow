import { db as defaultDb, type LabCompanionDB } from '../../../db';
import { listPhotos } from '../../../db/photos';
import { serializeAnnotations } from './annotations';

/**
 * Photos for a run's report. buildReport does not take photos yet, so the report page can call this and place
 * each photo under its step (stepId) or in an appendix. The annotations come back as JSON, as they are stored.
 */
export interface ReportPhoto {
  id: string;
  stepId?: string;
  caption: string;
  at: number;
  annotations: string;
  blob: Blob;
}

export async function photosForReport(experimentId: string, database: LabCompanionDB = defaultDb): Promise<ReportPhoto[]> {
  const photos = await listPhotos(experimentId, database);
  return photos.map((p) => ({
    id: p.id,
    stepId: p.stepId,
    caption: p.caption,
    at: p.at,
    annotations: serializeAnnotations(p.annotations),
    blob: p.blob,
  }));
}
