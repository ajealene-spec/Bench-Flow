import type { Hazard, MaterialItem, ProtocolOverview, ProtocolPhase, Step } from '../../types';

/**
 * The complete protocol that the import produces, whichever reader made it (AI or offline).
 * Both readers fill this shape, so the review screen and the saved template never care which one ran.
 */

export const CATEGORIES = [
  'Western Blot',
  'PCR/qPCR',
  'Cell Culture',
  'Imaging',
  'Immunostaining',
  'Histology',
  'Electrophysiology',
  'Animal Procedures',
  'Molecular Cloning',
  'Protein Assay',
  'Other',
] as const;

export type ProtocolCategory = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is ProtocolCategory {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}

export interface ProtocolDraft {
  title: string;
  category: ProtocolCategory;
  overview: ProtocolOverview;
  phases: ProtocolPhase[];
  materials: MaterialItem[];
  hazards: Hazard[];
  steps: Step[];
  /** Which reader produced the draft. */
  parser: 'ai' | 'local';
  /** Why a fallback happened, or empty. */
  note: string;
}

export const DEFAULT_TITLE = 'Untitled protocol';

/** A step this long is treated as an overnight (or longer) incubation. */
const OVERNIGHT_THRESHOLD_SEC = 10 * 3600;

/** "45 s", "12 min", "5 h", "1 h 30 min". */
export function formatDuration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  const hours = Math.floor(sec / 3600);
  const minutes = Math.round((sec % 3600) / 60);
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

export interface TotalTime {
  /** Sum of every step duration, in seconds. */
  totalSec: number;
  /** Sum of the durations that are not overnight steps. */
  handsOnSec: number;
  /** Number of overnight steps. */
  overnightSteps: number;
  /** Display text, e.g. "2 days (~5 h hands-on)". Null when no step has a duration. */
  display: string | null;
}

/**
 * Total time = the sum of step durations. Each overnight step adds a day, so a protocol with one
 * overnight step is shown as 2 days. `minDays` is the number of Day N phases when the text names
 * them. Returns a null display when no step has a duration.
 */
export function summarizeTotalTime(steps: Step[], minDays = 1): TotalTime {
  let totalSec = 0;
  let handsOnSec = 0;
  let overnightSteps = 0;
  for (const step of steps) {
    const sec = step.durationSec ?? 0;
    if (sec <= 0) continue;
    totalSec += sec;
    if (sec >= OVERNIGHT_THRESHOLD_SEC) overnightSteps += 1;
    else handsOnSec += sec;
  }
  if (totalSec === 0) return { totalSec, handsOnSec, overnightSteps, display: null };

  const days = Math.max(overnightSteps + 1, minDays);
  const display =
    days > 1 ? `${days} days (~${formatDuration(handsOnSec)} hands-on)` : formatDuration(totalSec);
  return { totalSec, handsOnSec, overnightSteps, display };
}

/** Lowercases, unifies quotes and dashes and collapses whitespace, so a quote can be found in the source. */
export function normalizeForMatch(text: string): string {
  return text
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/­/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Whether an evidence quote appears verbatim (ignoring case, spacing and typographic variants) in the source. */
export function isVerbatimEvidence(evidence: string, source: string): boolean {
  const needle = normalizeForMatch(evidence);
  return needle.length > 0 && normalizeForMatch(source).includes(needle);
}
