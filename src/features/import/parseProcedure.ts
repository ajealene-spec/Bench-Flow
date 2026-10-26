import type { Step } from '../../types';
import { parseLocal } from './localParse';

export interface ParseOutcome {
  title?: string;
  steps: Step[];
  parser: 'ai' | 'local';
  /** Why the local parser was used, or empty when AI parsed the text. */
  note: string;
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
          const data = (await res.json()) as { title?: string; steps: Step[] };
          if (Array.isArray(data.steps) && data.steps.length > 0) {
            return { title: data.title, steps: data.steps, parser: 'ai', note: '' };
          }
        }
        note = 'The AI parser could not read this text, so the local parser was used.';
      }
    } catch {
      note = 'The AI parser is unreachable, so the local parser was used.';
    }
  }

  const local = parseLocal(text);
  return { title: local.title, steps: local.steps, parser: 'local', note };
}
