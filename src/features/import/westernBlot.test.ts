import { describe, expect, it } from 'vitest';
import { parseLocal } from './localParse';
import { cleanExtractedText } from './pdfText';
import raw from './fixtures/western-blot-extracted.txt?raw';

/** Reconstructed text of a three-page Western blot guide: header/footer repeats, intro, reagent table, procedure, troubleshooting. */
const cleaned = cleanExtractedText(raw);
const result = parseLocal(cleaned);
const steps = result.steps;

describe('PDF text cleanup on the Western blot fixture', () => {
  it('drops repeated headers and footers, page numbers, URLs, copyright and figure captions', () => {
    expect(cleaned).not.toMatch(/Rev 3/);
    expect(cleaned).not.toMatch(/Page \d of \d/);
    expect(cleaned).not.toMatch(/www\./);
    expect(cleaned).not.toMatch(/©|All rights reserved/);
    expect(cleaned).not.toMatch(/Figure \d\./);
    expect(cleaned).not.toContain('For updates visit');
  });

  it('merges a word hyphenated across a line break', () => {
    expect(cleaned).toContain('Assemble the transfer sandwich in the cassette');
    expect(cleaned).not.toContain('sand-\n');
  });

  it('keeps list markers and the document title', () => {
    expect(cleaned).toContain('1. Wash the cell monolayer');
    expect(result.title).toBe('Protein Detection by Western Blot');
  });
});

describe('local parser on the Western blot fixture', () => {
  it('yields the sixteen procedure steps in order, not intro or reference sentences', () => {
    expect(steps).toHaveLength(16);
    expect(steps[0].instructions.startsWith('Wash the cell monolayer')).toBe(true);
    expect(steps[5].instructions.startsWith('Mix 20 µg')).toBe(true);
    expect(steps[15].instructions.startsWith('Record the exposure time')).toBe(true);
    expect(steps.map((s) => s.instructions).join(' ')).not.toMatch(
      /separates proteins|Background|Reagent Stock|RIPA lysis buffer 10x|Weak signal|High background|No bands|Towbin|Blot orientation|Typical transfer/,
    );
  });

  it('uses section headings as title prefixes in the procedure order', () => {
    const prefixes = steps.map((s) => s.title.split(':')[0]);
    expect(prefixes).toEqual([
      'Sample preparation',
      'Sample preparation',
      'Sample preparation',
      'Sample preparation',
      'Sample preparation',
      'SDS-PAGE',
      'SDS-PAGE',
      'Protein transfer',
      'Protein transfer',
      'Blocking',
      'Antibody incubation',
      'Antibody incubation',
      'Antibody incubation',
      'Antibody incubation',
      'Detection',
      'Detection',
    ]);
  });

  it('keeps every title within 60 characters and at a readable start', () => {
    for (const step of steps) {
      expect(step.title.length).toBeLessThanOrEqual(60);
      expect(step.title).not.toMatch(/^(Caution|Note|Warning)\b/);
    }
    expect(steps[9].title.startsWith('Blocking: Block the membrane')).toBe(true);
    expect(steps[6].title.startsWith('SDS-PAGE: Load samples onto a 4')).toBe(true);
  });

  it('sets block, primary, washes and secondary durations from the text', () => {
    const block = steps[9];
    expect(block.durationSec).toBe(3600);
    expect(block.timers[0]).toMatchObject({ durationSec: 3600, status: 'idle' });

    const primary = steps[10];
    expect(primary.durationSec).toBe(16 * 3600);
    expect(primary.timers[0].label.toLowerCase()).toBe('overnight');

    const washes = steps[11];
    expect(washes.durationSec).toBe(300);
    expect(washes.timers.map((t) => t.durationSec)).toEqual([300]);

    expect(steps[12].durationSec).toBe(3600);
    expect(steps[13].durationSec).toBe(300);
  });

  it('reads the other timed phases', () => {
    expect(steps[2].durationSec).toBe(1200); // 20 min on ice
    expect(steps[3].durationSec).toBe(900); // 15 min centrifuge, not the g-force
    expect(steps[5].durationSec).toBe(300); // 5 min at 95 °C
    expect(steps[6].durationSec).toBe(3600); // 1 h run
    expect(steps[7].durationSec).toBe(5400); // 90 min transfer
    expect(steps[8].durationSec).toBe(300); // Ponceau stain
    expect(steps[14].durationSec).toBe(60); // ECL exposure
    expect(steps[0].durationSec).toBeUndefined();
    expect(steps[4].durationSec).toBeUndefined(); // measure concentration: no time
  });

  it('moves the caution out of the title and into cautions', () => {
    const lysis = steps[1];
    expect(lysis.title.startsWith('Sample preparation: Add 200')).toBe(true);
    expect(lysis.cautions).toEqual(['Caution: RIPA contains SDS and deoxycholate.', 'Wear gloves and eye protection.']);
  });
});
