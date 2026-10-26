import { describe, expect, it } from 'vitest';
import { genericExplanation, genericOrFallback, learnMoreLinks, validateExplanationResponse } from './explanations';

describe('genericExplanation', () => {
  it('matches blocking and washing steps', () => {
    expect(genericExplanation('Block', 'Block membrane in 5% milk for 1 h.')?.keyword).toBe('blocking');
    expect(genericExplanation('Wash', 'Wash 3 × 5 min in TBST.')?.keyword).toBe('washing');
  });

  it('matches perfusion and stereotaxic steps and adds the Allen Brain Atlas link', () => {
    const perf = genericExplanation('Perfuse', 'Transcardially perfuse with saline.');
    expect(perf?.keyword).toBe('perfusion');
    expect(perf?.links.map((l) => l.title)).toContain('Allen Brain Atlas');
    expect(genericExplanation('Surgery', 'Align to bregma.')?.keyword).toBe('stereotaxic surgery');
  });

  it('returns null for steps with no keyword', () => {
    expect(genericExplanation('Label tubes', 'Label each tube with the sample name.')).toBeNull();
  });

  it('always gives a fallback', () => {
    const r = genericOrFallback('Label tubes', 'Label each tube.');
    expect(r.why.length).toBeGreaterThan(20);
    expect(r.mistakes.length).toBeGreaterThan(0);
    expect(r.links.length).toBeGreaterThan(0);
  });
});

describe('learnMoreLinks', () => {
  it('encodes the query into protocol search links', () => {
    const links = learnMoreLinks('western blot & transfer');
    expect(links[0].url).toBe('https://www.protocols.io/search?q=western%20blot%20%26%20transfer');
    expect(links.some((l) => l.url.includes('jove.com'))).toBe(true);
    expect(links.some((l) => l.url.includes('addgene.org'))).toBe(true);
  });
});

describe('validateExplanationResponse', () => {
  it('accepts a well-formed response and trims it', () => {
    expect(validateExplanationResponse({ why: '  Keeps background low. ', mistakes: [' Too short '] })).toEqual({
      why: 'Keeps background low.',
      mistakes: ['Too short'],
    });
  });

  it('rejects wrong shapes', () => {
    expect(validateExplanationResponse(null)).toBeNull();
    expect(validateExplanationResponse({ why: '', mistakes: [] })).toBeNull();
    expect(validateExplanationResponse({ why: 'x', mistakes: [1] })).toBeNull();
    expect(validateExplanationResponse({ why: 'x' })).toBeNull();
  });

  it('caps the number of mistakes', () => {
    const r = validateExplanationResponse({ why: 'x', mistakes: Array.from({ length: 10 }, (_, i) => `m${i}`) });
    expect(r?.mistakes).toHaveLength(6);
  });
});
