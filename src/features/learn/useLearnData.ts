import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { listGlossary } from '../../db/glossary';
import { getSettings } from '../../db/settings';
import { BUILTIN_TERMS } from './glossaryData';
import type { GlossaryEntry } from './glossaryMatch';

/** True in beginner mode (the default). Advanced users see plain step text. */
export function useIsBeginner(): boolean {
  const settings = useLiveQuery(() => getSettings(db), []);
  return (settings?.mode ?? 'beginner') === 'beginner';
}

/** Built-in terms plus the user's own. A user term with the same name replaces the built-in one. */
export function mergeGlossary(
  userTerms: Array<{ term: string; definition: string }>,
  builtin: GlossaryEntry[] = BUILTIN_TERMS,
): GlossaryEntry[] {
  const byName = new Map<string, GlossaryEntry>();
  for (const b of builtin) byName.set(b.term.toLowerCase(), b);
  for (const u of userTerms) byName.set(u.term.toLowerCase(), { term: u.term, definition: u.definition });
  return [...byName.values()];
}

/** All glossary entries the app knows about, kept live as the user adds terms. */
export function useGlossaryEntries(): GlossaryEntry[] {
  const userTerms = useLiveQuery(() => listGlossary(db), []);
  return mergeGlossary(userTerms ?? []);
}
