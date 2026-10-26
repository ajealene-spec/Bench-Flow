import { describe, expect, it } from 'vitest';
import { findGlossaryEntry, isCaseSensitive, splitGlossary, type GlossaryEntry } from './glossaryMatch';
import { BUILTIN_TERMS } from './glossaryData';

const entries: GlossaryEntry[] = [
  { term: 'TBST', definition: 'TBS with Tween' },
  { term: 'Blocking', definition: 'Covering sites' },
  { term: 'Western blot', aliases: ['western'], definition: 'Protein blot' },
  { term: 'Ra', definition: 'Access resistance' },
];

describe('splitGlossary', () => {
  it('splits out known terms and keeps the rest as text', () => {
    const segs = splitGlossary('Wash in TBST, then block.', entries);
    expect(segs.map((s) => (s.kind === 'term' ? `[${s.text}]` : s.text))).toEqual(['Wash in ', '[TBST]', ', then block.']);
  });

  it('prefers the longer term when two overlap', () => {
    const segs = splitGlossary('Run a western blot today.', entries);
    const term = segs.find((s) => s.kind === 'term');
    expect(term?.kind === 'term' && term.text).toBe('western blot');
  });

  it('matches only whole words and short acronyms in their exact case', () => {
    expect(splitGlossary('Blockage and ra are not terms here', entries).every((s) => s.kind === 'text')).toBe(true);
    expect(splitGlossary('Measure Ra in the cell', entries).some((s) => s.kind === 'term')).toBe(true);
  });

  it('returns plain text when there are no entries', () => {
    expect(splitGlossary('Hello', [])).toEqual([{ kind: 'text', text: 'Hello' }]);
  });

  it('keeps the original text when joined back together', () => {
    const text = 'Incubate with primary antibody in TBST overnight at 4 °C.';
    const joined = splitGlossary(text, BUILTIN_TERMS).map((s) => s.text).join('');
    expect(joined).toBe(text);
  });
});

describe('isCaseSensitive', () => {
  it('treats short capitalized words as case-sensitive', () => {
    expect(isCaseSensitive('PBS')).toBe(true);
    expect(isCaseSensitive('Ra')).toBe(true);
    expect(isCaseSensitive('Blocking')).toBe(false);
  });
});

describe('findGlossaryEntry', () => {
  it('finds a term by name or alias regardless of case', () => {
    expect(findGlossaryEntry('WESTERN', entries)?.term).toBe('Western blot');
    expect(findGlossaryEntry('nothing', entries)).toBeUndefined();
  });
});
