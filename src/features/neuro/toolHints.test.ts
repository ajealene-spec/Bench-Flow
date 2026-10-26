import { describe, expect, it } from 'vitest';
import { detectToolHints } from './toolHints';

describe('detectToolHints', () => {
  it('finds stereotaxic and virus steps', () => {
    const ids = detectToolHints('Align to bregma and inject 1 µL of AAV at the target.').map((h) => h.id);
    expect(ids).toEqual(['stereotax', 'virus']);
  });

  it('finds perfusion and ACSF steps', () => {
    expect(detectToolHints('Transcardially perfuse with 4% PFA.').map((h) => h.id)).toEqual(['perfusion']);
    expect(detectToolHints('Cut slices in ice-cold ACSF.').map((h) => h.id)).toEqual(['acsf']);
  });

  it('returns nothing for plain steps', () => {
    expect(detectToolHints('Wash the membrane three times.')).toEqual([]);
    expect(detectToolHints(undefined)).toEqual([]);
  });
});
