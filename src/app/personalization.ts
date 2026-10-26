import type { AppSettings, ExperienceMode, ResearchField } from '../types';

/*
 * Pure mapping from the first-run survey answers to app settings and to the order of starters,
 * bench tools and glossary terms. No database or DOM access here, so every rule is testable.
 */

export type DeviceId = 'phone' | 'ipad' | 'laptop';
export type StarterChoice = 'recommended' | 'all' | 'none';

export const DEVICE_OPTIONS: Array<{ value: DeviceId; label: string }> = [
  { value: 'phone', label: 'Phone' },
  { value: 'ipad', label: 'iPad' },
  { value: 'laptop', label: 'Laptop or desktop' },
];

export interface SurveyAnswers {
  userName: string;
  field: ResearchField | null;
  experience: ExperienceMode;
  techniques: string[];
  devices: DeviceId[];
  starters: StarterChoice;
}

/** What "Skip survey" keeps: beginner mode, no field, no techniques, and the recommended starters. */
export const DEFAULT_ANSWERS: SurveyAnswers = {
  userName: '',
  field: null,
  experience: 'beginner',
  techniques: [],
  devices: [],
  starters: 'recommended',
};

/** Pre-fills the survey from saved settings. Devices and the starter choice are not saved, so they keep their defaults. */
export function answersFromSettings(
  settings: Pick<AppSettings, 'mode' | 'field' | 'techniques' | 'userName'>,
  devices: DeviceId[] = [],
): SurveyAnswers {
  return {
    userName: settings.userName ?? '',
    field: settings.field,
    experience: settings.mode,
    techniques: [...settings.techniques],
    devices,
    starters: DEFAULT_ANSWERS.starters,
  };
}

/** The settings the survey writes. The experience level sets the app mode. */
export function settingsChanges(answers: SurveyAnswers): Partial<Omit<AppSettings, 'id'>> {
  return {
    mode: answers.experience,
    field: answers.field,
    techniques: [...answers.techniques],
    userName: answers.userName.trim() || undefined,
  };
}

// Tags describe what a starter, tool or glossary group is about. Answers map to tags, and the
// best-matching items come first.

type Tag = 'neuro' | 'molecular' | 'cell' | 'protein' | 'pcr' | 'genotyping' | 'ihc' | 'imaging' | 'culture' | 'ephys' | 'stereotaxic' | 'surgery';

const FIELD_TAGS: Record<ResearchField, Tag[]> = {
  neuroscience: ['neuro', 'ihc', 'ephys', 'stereotaxic'],
  molecular: ['molecular', 'protein', 'pcr', 'genotyping'],
  cell_bio: ['cell', 'culture', 'imaging', 'ihc'],
  other: [],
};

const TECHNIQUE_TAGS: Record<string, Tag[]> = {
  'Western blot': ['protein'],
  'PCR and qPCR': ['pcr'],
  Immunohistochemistry: ['ihc'],
  'Cell culture': ['culture'],
  'Patch clamp electrophysiology': ['ephys'],
  'Stereotaxic surgery': ['stereotaxic', 'surgery'],
  'Microscopy and imaging': ['imaging'],
  ELISA: ['protein'],
  'Mouse behavior': [],
  'Flow cytometry': [],
};

/** Starter slug to tags. Keep in step with src/content/protocols. */
const STARTER_TAGS: Record<string, Tag[]> = {
  'western-blot': ['protein', 'molecular'],
  'if-free-floating': ['ihc', 'imaging', 'neuro'],
  'perfusion-pfa': ['neuro', 'ihc', 'surgery'],
  cryosectioning: ['ihc', 'neuro', 'imaging'],
  'nissl-cresyl-violet': ['neuro', 'imaging'],
  'dapi-counterstain': ['imaging', 'ihc'],
  'pcr-amplification': ['pcr', 'molecular'],
  'rt-qpcr-sybr': ['pcr', 'molecular'],
  'mouse-tail-genotyping': ['genotyping', 'molecular', 'pcr'],
  'cell-passaging': ['culture', 'cell'],
  'primary-neuron-culture': ['culture', 'neuro', 'cell'],
  'stereotaxic-viral-injection': ['stereotaxic', 'neuro', 'surgery'],
  'slice-electrophysiology': ['ephys', 'neuro'],
  'golgi-cox': ['neuro', 'imaging'],
  'bca-protein-assay': ['protein', 'molecular'],
};

/** Starters offered as "recommended" when the answers match nothing. */
const CORE_SLUGS = ['western-blot', 'if-free-floating', 'pcr-amplification', 'perfusion-pfa', 'dapi-counterstain', 'cell-passaging'];

/**
 * Relevance of an item to the answers: a technique match counts twice, a field match once.
 * Zero means the item is not related to anything the user picked.
 */
export function relevanceScore(itemTags: readonly Tag[], answers: Pick<SurveyAnswers, 'field' | 'techniques'>): number {
  const fieldTags = answers.field ? FIELD_TAGS[answers.field] : [];
  const techniqueTags = answers.techniques.flatMap((t) => TECHNIQUE_TAGS[t] ?? []);
  let score = 0;
  for (const tag of itemTags) {
    if (techniqueTags.includes(tag)) score += 2;
    if (fieldTags.includes(tag)) score += 1;
  }
  return score;
}

/** Stable sort by score, highest first. Equal scores keep their original order. */
function sortByScore<T>(items: readonly T[], score: (item: T) => number): T[] {
  return items
    .map((item, index) => ({ item, index, score: score(item) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.item);
}

/**
 * Starter titles to load, in the order to add them. "all" puts the most relevant first.
 * "recommended" keeps only the relevant ones, or the core set when nothing matches.
 */
export function starterTitlesFor(answers: SurveyAnswers, starters: ReadonlyArray<{ slug: string; title: string }>): string[] {
  if (answers.starters === 'none') return [];
  const scoreOf = (s: { slug: string }) => relevanceScore(STARTER_TAGS[s.slug] ?? [], answers);
  const ordered = sortByScore(starters, scoreOf);
  if (answers.starters === 'all') return ordered.map((s) => s.title);

  const relevant = ordered.filter((s) => scoreOf(s) > 0);
  if (relevant.length > 0) return relevant.map((s) => s.title);
  return CORE_SLUGS.map((slug) => starters.find((s) => s.slug === slug)).filter((s): s is { slug: string; title: string } => s !== undefined).map((s) => s.title);
}

const TOOL_TAGS: Record<string, Tag[]> = {
  stereotax: ['stereotaxic', 'neuro'],
  perfusion: ['neuro', 'ihc'],
  acsf: ['ephys', 'neuro'],
  osmolarity: ['ephys', 'neuro'],
  virus: ['stereotaxic', 'culture'],
  molarity: ['protein', 'pcr', 'molecular', 'culture', 'ihc', 'cell'],
};

/** Bench tool tiles, most relevant first. Ties keep the original order. */
export function orderToolTiles<T extends { id: string }>(tiles: readonly T[], answers: Pick<SurveyAnswers, 'field' | 'techniques'>): T[] {
  return sortByScore(tiles, (t) => relevanceScore(TOOL_TAGS[t.id] ?? [], answers));
}

const TECHNIQUE_TERMS: Record<string, string[]> = {
  'Western blot': ['Western blot', 'SDS-PAGE', 'SDS', 'PVDF', 'Nitrocellulose', 'TBST', 'Tween-20', 'BSA'],
  'PCR and qPCR': ['PCR', 'qPCR', 'RT-qPCR', 'SYBR Green', 'cDNA', 'Primer'],
  Immunohistochemistry: ['PFA', 'PBS', 'PBST', 'NDS', 'NGS', 'DAB', 'DAPI', 'Triton X-100'],
  'Cell culture': ['DMSO', 'HEPES', 'PBS'],
  'Patch clamp electrophysiology': ['ACSF', 'aCSF', 'HEPES', 'EGTA', 'Ringer’s solution'],
  'Stereotaxic surgery': ['Bregma', 'Lambda', 'AAV'],
  'Microscopy and imaging': ['DAPI', 'PFA', 'DAB'],
  ELISA: ['BSA', 'TBS', 'Tween-20'],
};

const FIELD_GLOSSARY: Record<ResearchField, Array<'neuro' | 'molecular'>> = {
  neuroscience: ['neuro'],
  molecular: ['molecular'],
  cell_bio: ['molecular'],
  other: [],
};

/** Glossary entries relevant to the answers, most relevant first. Ties keep the alphabetical order the caller starts from. */
export function glossaryScore(
  entry: { term: string; aliases?: string[]; field?: 'neuro' | 'molecular' | 'general' },
  answers: Pick<SurveyAnswers, 'field' | 'techniques'>,
): number {
  let score = 0;
  if (entry.field && answers.field && FIELD_GLOSSARY[answers.field].includes(entry.field as 'neuro' | 'molecular')) score += 1;
  const names = [entry.term, ...(entry.aliases ?? [])].map((n) => n.toLowerCase());
  const technique = answers.techniques.flatMap((t) => TECHNIQUE_TERMS[t] ?? []).map((n) => n.toLowerCase());
  if (names.some((n) => technique.includes(n))) score += 2;
  return score;
}

/** "Good morning, Ana" before noon, "Good afternoon" before 6pm, otherwise "Good evening". */
export function greetingFor(hour: number, name?: string): string {
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const trimmed = name?.trim();
  return trimmed ? `${part}, ${trimmed}` : part;
}
