import { describe, expect, it } from 'vitest';
import { STARTER_SPECS } from '../content/protocols';
import { TOOL_TILES } from '../features/neuro/ToolsPage';
import { BUILTIN_TERMS } from '../features/learn/glossaryData';
import {
  DEFAULT_ANSWERS,
  answersFromSettings,
  glossaryScore,
  greetingFor,
  orderToolTiles,
  relevanceScore,
  settingsChanges,
  starterTitlesFor,
  type SurveyAnswers,
} from './personalization';

const answers = (over: Partial<SurveyAnswers>): SurveyAnswers => ({ ...DEFAULT_ANSWERS, ...over });

describe('settingsChanges and answersFromSettings', () => {
  it('sets the app mode from the experience level', () => {
    expect(settingsChanges(answers({ experience: 'advanced' })).mode).toBe('advanced');
    expect(settingsChanges(answers({ experience: 'beginner' })).mode).toBe('beginner');
  });

  it('trims the name and clears it when blank', () => {
    expect(settingsChanges(answers({ userName: '  Ana Lee ' })).userName).toBe('Ana Lee');
    expect(settingsChanges(answers({ userName: '   ' })).userName).toBeUndefined();
  });

  it('round-trips saved settings into the survey', () => {
    const pre = answersFromSettings({ mode: 'advanced', field: 'molecular', techniques: ['PCR and qPCR'], userName: 'Sam' });
    expect(pre).toMatchObject({ experience: 'advanced', field: 'molecular', techniques: ['PCR and qPCR'], userName: 'Sam', starters: 'recommended' });
  });

  it('copies the technique list so later edits do not change the source', () => {
    const source = { mode: 'beginner' as const, field: null, techniques: ['ELISA'], userName: undefined };
    const pre = answersFromSettings(source);
    pre.techniques.push('Mouse behavior');
    expect(source.techniques).toEqual(['ELISA']);
  });
});

describe('starterTitlesFor', () => {
  const titleOf = (slug: string) => STARTER_SPECS.find((s) => s.slug === slug)!.title;

  it('loads nothing when the user chose none', () => {
    expect(starterTitlesFor(answers({ starters: 'none', field: 'neuroscience' }), STARTER_SPECS)).toEqual([]);
  });

  it('keeps only relevant starters for the recommended set, most relevant first', () => {
    const titles = starterTitlesFor(answers({ field: 'molecular', techniques: ['Western blot'], starters: 'recommended' }), STARTER_SPECS);
    expect(titles[0]).toBe(titleOf('western-blot'));
    expect(titles).toContain(titleOf('pcr-amplification'));
    expect(titles).not.toContain(titleOf('slice-electrophysiology'));
    expect(titles).not.toContain(titleOf('stereotaxic-viral-injection'));
  });

  it('puts neuroscience starters first for a neuroscience patch clamp user', () => {
    const titles = starterTitlesFor(
      answers({ field: 'neuroscience', techniques: ['Patch clamp electrophysiology'], starters: 'all' }),
      STARTER_SPECS,
    );
    expect(titles[0]).toBe(titleOf('slice-electrophysiology'));
    expect(titles).toHaveLength(STARTER_SPECS.length);
    expect(new Set(titles).size).toBe(STARTER_SPECS.length);
  });

  it('falls back to a core set when nothing matches the answers', () => {
    const titles = starterTitlesFor(answers({ field: 'other', techniques: ['Flow cytometry'], starters: 'recommended' }), STARTER_SPECS);
    expect(titles.length).toBeGreaterThan(0);
    expect(titles[0]).toBe(titleOf('western-blot'));
  });

  it('keeps the original order when there are no answers to rank by', () => {
    expect(starterTitlesFor(answers({ starters: 'all' }), STARTER_SPECS)).toEqual(STARTER_SPECS.map((s) => s.title));
  });
});

describe('orderToolTiles', () => {
  it('puts stereotaxic and neuro tools first for a neuroscience user with stereotaxic surgery', () => {
    const ordered = orderToolTiles(TOOL_TILES, answers({ field: 'neuroscience', techniques: ['Stereotaxic surgery'] }));
    expect(ordered[0].id).toBe('stereotax');
    expect(ordered.map((t) => t.id).indexOf('virus')).toBeLessThan(ordered.map((t) => t.id).indexOf('osmolarity'));
  });

  it('puts the molarity tool first for a molecular user', () => {
    const ordered = orderToolTiles(TOOL_TILES, answers({ field: 'molecular', techniques: ['Western blot'] }));
    expect(ordered[0].id).toBe('molarity');
  });

  it('keeps every tile and the original order without answers', () => {
    const ordered = orderToolTiles(TOOL_TILES, answers({}));
    expect(ordered.map((t) => t.id)).toEqual(TOOL_TILES.map((t) => t.id));
  });
});

describe('glossaryScore', () => {
  it('ranks terms from the user field and techniques above the rest', () => {
    const neuroTerm = BUILTIN_TERMS.find((t) => t.field === 'neuro')!;
    const western = BUILTIN_TERMS.find((t) => t.term === 'SDS')!;
    const unrelated = BUILTIN_TERMS.find((t) => t.field === 'general' && !t.aliases?.length) ?? { term: 'zzz', field: 'general' as const };

    expect(glossaryScore(neuroTerm, answers({ field: 'neuroscience' }))).toBeGreaterThan(0);
    expect(glossaryScore(western, answers({ techniques: ['Western blot'] }))).toBeGreaterThan(0);
    expect(glossaryScore(unrelated, answers({ field: 'neuroscience' }))).toBe(0);
  });

  it('scores nothing with no answers', () => {
    expect(relevanceScore(['neuro'], answers({}))).toBe(0);
    expect(glossaryScore({ term: 'SDS', field: 'molecular' }, answers({}))).toBe(0);
  });
});

describe('greetingFor', () => {
  it('uses the time of day and the name when given', () => {
    expect(greetingFor(8, 'Ana')).toBe('Good morning, Ana');
    expect(greetingFor(14)).toBe('Good afternoon');
    expect(greetingFor(20, '  ')).toBe('Good evening');
  });

  it('switches at noon and 6pm', () => {
    expect(greetingFor(11)).toBe('Good morning');
    expect(greetingFor(12)).toBe('Good afternoon');
    expect(greetingFor(17)).toBe('Good afternoon');
    expect(greetingFor(18)).toBe('Good evening');
  });
});
