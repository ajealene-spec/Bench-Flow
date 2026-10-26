import { db as defaultDb, type LabCompanionDB } from './index';
import type { StepExplanation } from '../types';

/** Cached explanations, one per template step. */
export function listExplanations(database: LabCompanionDB = defaultDb): Promise<StepExplanation[]> {
  return database.explanations.toArray();
}

export function getExplanation(templateStepId: string, database: LabCompanionDB = defaultDb): Promise<StepExplanation | undefined> {
  return database.explanations.get(templateStepId);
}

export async function putExplanation(explanation: StepExplanation, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.explanations.put(explanation);
}

export async function deleteExplanation(templateStepId: string, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.explanations.delete(templateStepId);
}
