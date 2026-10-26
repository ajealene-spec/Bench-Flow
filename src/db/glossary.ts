import { db as defaultDb, type LabCompanionDB } from './index';
import type { GlossaryTerm } from '../types';

/** Glossary terms, sorted alphabetically. */
export async function listGlossary(database: LabCompanionDB = defaultDb): Promise<GlossaryTerm[]> {
  const terms = await database.glossary.toArray();
  return terms.sort((a, b) => a.term.localeCompare(b.term));
}

export function getGlossaryTerm(id: string, database: LabCompanionDB = defaultDb): Promise<GlossaryTerm | undefined> {
  return database.glossary.get(id);
}

export async function putGlossaryTerm(term: GlossaryTerm, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.glossary.put(term);
}

export async function deleteGlossaryTerm(id: string, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.glossary.delete(id);
}
