import { db as defaultDb, type LabCompanionDB } from './index';
import type { ExecutionEvent } from '../types';

/** What a caller supplies. The log assigns the id and timestamp unless `at` is given. */
export type ExecutionEventInput = Omit<ExecutionEvent, 'id' | 'at'> & { at?: number };

/**
 * Appends one event to the execution log. The log is append-only: this module has no update or
 * delete, and callers must not rewrite past events.
 */
export async function logEvent(
  input: ExecutionEventInput,
  database: LabCompanionDB = defaultDb,
): Promise<ExecutionEvent> {
  const event: ExecutionEvent = { ...input, id: crypto.randomUUID(), at: input.at ?? Date.now() };
  await database.executionEvents.add(event);
  return event;
}

/** Events for one run, oldest first. */
export async function listExecutionEvents(
  experimentId: string,
  database: LabCompanionDB = defaultDb,
): Promise<ExecutionEvent[]> {
  return database.executionEvents.where('[experimentId+at]').between([experimentId, -Infinity], [experimentId, Infinity]).toArray();
}
