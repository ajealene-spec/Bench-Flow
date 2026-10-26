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

/** Pages that never need onboarding: the welcome itself, plus the About and shared-protocol pages. */
export const PUBLIC_PATHS: readonly string[] = ['/welcome', '/about', '/shared'];

/** Whether the first-run welcome must be shown before this route. Public pages are always open. */
export function needsWelcome(pathname: string, onboardedAt: number | undefined): boolean {
  if (onboardedAt !== undefined) return false;
  return !PUBLIC_PATHS.includes(pathname.replace(/\/+$/, '') || '/');
}
