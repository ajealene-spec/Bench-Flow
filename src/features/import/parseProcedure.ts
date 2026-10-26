import type { Hazard, Step } from '../../types';
import { detectHazards, mergeHazards, sanitizeHazards } from './hazards';
import { parseLocal } from './localParse';

export interface ParseOutcome {
  title?: string;
  steps: Step[];
  /** Rule hits merged with the AI's hazards (AI names are matched to the rule list). */
  hazards: Hazard[];
  parser: 'ai' | 'local';
  /** Why the local parser was used, or empty when AI parsed the text. */
  note: string;
}

/** Whether the dev server has an Anthropic API key. Null when the server cannot be reached. */
export async function getParserStatus(): Promise<boolean | null> {
  if (!navigator.onLine) return null;
  try {
    const res = await fetch('/api/parse');
    if (!res.ok) return null;
    const info = (await res.json()) as { configured?: boolean };
    return Boolean(info.configured);
  } catch {
    return null;
  }
}

/** Tries the AI parser when online and configured; otherwise falls back to the local parser. */
export async function parseProcedure(text: string): Promise<ParseOutcome> {
  let note = '';

  if (!navigator.onLine) {
    note = 'You are offline, so the local parser was used.';
  } else {
    try {
      const status = await fetch('/api/parse');
      const info = status.ok ? ((await status.json()) as { configured?: boolean }) : {};
      if (!info.configured) {
        note = 'No Anthropic API key is set, so the local parser was used.';
      } else {
        const res = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (res.ok) {
          const data = (await res.json()) as { title?: string; steps: Step[]; hazards?: unknown };
          if (Array.isArray(data.steps) && data.steps.length > 0) {
            const hazards = mergeHazards(detectHazards(data.steps), sanitizeHazards(data.hazards, data.steps));
            return { title: data.title, steps: data.steps, hazards, parser: 'ai', note: '' };
          }
        }
        note = 'The AI parser could not read this text, so the local parser was used.';
      }
    } catch {
      note = 'The AI parser is unreachable, so the local parser was used.';
    }
  }

  const local = parseLocal(text);
  return { title: local.title, steps: local.steps, hazards: detectHazards(local.steps), parser: 'local', note };
}
