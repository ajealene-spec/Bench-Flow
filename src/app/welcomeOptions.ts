import type { ResearchField } from '../types';

export const FIELD_OPTIONS: Array<{ value: ResearchField; label: string }> = [
  { value: 'neuroscience', label: 'Neuroscience' },
  { value: 'molecular', label: 'Molecular biology' },
  { value: 'cell_bio', label: 'Cell biology' },
  { value: 'other', label: 'Other' },
];

export const TECHNIQUE_OPTIONS: string[] = [
  'Western blot',
  'PCR and qPCR',
  'Immunohistochemistry',
  'Cell culture',
  'Patch clamp electrophysiology',
  'Stereotaxic surgery',
  'Microscopy and imaging',
  'ELISA',
  'Mouse behavior',
  'Flow cytometry',
];

/** Whether the first-run welcome must be shown before this route. Welcome and About are always open. */
export function needsWelcome(pathname: string, onboardedAt: number | undefined): boolean {
  if (onboardedAt !== undefined) return false;
  return pathname !== '/welcome' && pathname !== '/about';
}
