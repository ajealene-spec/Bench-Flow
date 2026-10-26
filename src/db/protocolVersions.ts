import { db as defaultDb, type LabCompanionDB } from './index';
import type { ProtocolVersion } from '../types';

/** Versions of one template, oldest first. Pass nothing to list every version. */
export async function listProtocolVersions(templateId?: string, database: LabCompanionDB = defaultDb): Promise<ProtocolVersion[]> {
  if (templateId === undefined) return database.protocolVersions.toArray();
  return database.protocolVersions
    .where('[templateId+version]')
    .between([templateId, -Infinity], [templateId, Infinity])
    .toArray();
}

export function getProtocolVersion(id: string, database: LabCompanionDB = defaultDb): Promise<ProtocolVersion | undefined> {
  return database.protocolVersions.get(id);
}

export async function putProtocolVersion(version: ProtocolVersion, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.protocolVersions.put(version);
}

export async function deleteProtocolVersion(id: string, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.protocolVersions.delete(id);
}
