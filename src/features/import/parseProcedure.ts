import type { Hazard, MaterialItem, ProtocolPhase, Step } from '../../types';
import { mapAiSteps, validateAiSteps, type AiStep } from './aiSchema';
import { detectHazards } from './hazards';
import { detectMaterials, parseLocal } from './localParse';

export interface ParseOutcome {
  title?: string;
  steps: Step[];
  /** Rule hits from the original pasted text, linked to the steps that use them. */
  hazards: Hazard[];
  /** Phases from "Day N" / "Phase N" headings, when found. */
  phases?: ProtocolPhase[];
  /** Materials mentioned in the text. */
  materials?: MaterialItem[];
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

/**
 * Builds the outcome from AI steps. Hazards, phases and materials come from the ORIGINAL pasted text
 * (materials are kept out of the steps but still feed the Materials card).
 */
function parseWithAi(text: string, aiSteps: AiStep[]): ParseOutcome {
  const steps = mapAiSteps(aiSteps);
  const local = parseLocal(text);
  // Rule hits are found on the whole pasted text; each hazard is then linked to the steps that mention it.
  const source: Step = {
    id: 'source',
    title: '',
    instructions: text,
    timers: [],
    reagents: [],
    dataFields: [],
    cautions: [],
  };
  const perStep = detectHazards(steps);
  const hazards = detectHazards([source]).map((h) => ({
    ...h,
    stepIds: perStep.find((p) => p.id === h.id)?.stepIds ?? [],
  }));
  return {
    title: local.title,
    steps,
    hazards,
    parser: 'ai',
    note: '',
    phases: local.phases,
    materials: detectMaterials(text),
  };
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
          const data = (await res.json()) as { aiSteps?: unknown };
          const checked = validateAiSteps(data.aiSteps);
          if (checked.ok) {
            return parseWithAi(text, checked.steps);
          }
        }
        note = 'The AI parser could not read this text, so the local parser was used.';
      }
    } catch {
      note = 'The AI parser is unreachable, so the local parser was used.';
    }
  }

  const local = parseLocal(text);
  return {
    title: local.title,
    steps: local.steps,
    hazards: detectHazards(local.steps),
    parser: 'local',
    note,
    phases: local.phases,
    materials: local.materials,
  };
}
