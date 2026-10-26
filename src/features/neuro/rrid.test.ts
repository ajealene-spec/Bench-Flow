import { describe, expect, it } from 'vitest';
import { rridSearchLinks, validateRrid } from './rrid';

describe('validateRrid', () => {
  it('accepts antibody, mouse, Addgene and tool RRIDs', () => {
    expect(validateRrid('RRID:AB_2298772')).toEqual({ ok: true, value: 'RRID:AB_2298772', kind: 'antibody' });
    expect(validateRrid('RRID:IMSR_JAX:000664')).toMatchObject({ ok: true, kind: 'mouse' });
    expect(validateRrid('RRID:Addgene_50469')).toMatchObject({ ok: true, kind: 'plasmid' });
    expect(validateRrid('RRID:SCR_002285')).toMatchObject({ ok: true, kind: 'tool' });
  });

  it('adds the prefix when it is missing and ignores case of the prefix', () => {
    expect(validateRrid('ab_2298772')).toMatchObject({ ok: false });
    expect(validateRrid('AB_2298772')).toEqual({ ok: true, value: 'RRID:AB_2298772', kind: 'antibody' });
    expect(validateRrid('rrid:AB_2298772')).toMatchObject({ ok: true, value: 'RRID:AB_2298772' });
  });

  it('rejects malformed or empty input with a message', () => {
    expect(validateRrid('')).toMatchObject({ ok: false });
    expect(validateRrid('RRID:AB_abc')).toMatchObject({ ok: false });
    expect(validateRrid('RRID:SCR_12')).toMatchObject({ ok: false });
    const bad = validateRrid('hello');
    expect(bad.ok).toBe(false);
  });
});

describe('rridSearchLinks', () => {
  it('builds encoded search links for a name', () => {
    const links = rridSearchLinks('anti GFAP & mouse');
    expect(links[0].url).toBe('https://scicrunch.org/resources/search?q=anti%20GFAP%20%26%20mouse');
    expect(links[1].url).toContain('antibodyregistry.org');
  });

  it('returns nothing for a blank name', () => {
    expect(rridSearchLinks('   ')).toEqual([]);
  });
});
