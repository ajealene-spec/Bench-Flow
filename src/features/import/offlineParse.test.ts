import { describe, expect, it } from 'vitest';
import { parseOffline, scoreCategory, shortTitle, stripNoise } from './offlineParse';
import { detectHazardsInText, hasAnimalContext } from './hazards';
import { summarizeTotalTime, formatDuration } from './draft';
import { materialsFromSectionLines } from './materials';

describe('step splitting across numbering styles', () => {
  it.each([
    ['numbered 1.', '1. Add buffer.\n2. Mix well.\n3. Spin 5 min.'],
    ['numbered 1)', '1) Add buffer.\n2) Mix well.\n3) Spin 5 min.'],
    ['Step n:', 'Step 1: Add buffer.\nStep 2: Mix well.\nStep 3: Spin 5 min.'],
    ['bullets', '• Add buffer.\n• Mix well.\n• Spin 5 min.'],
    ['dashes', '- Add buffer.\n- Mix well.\n- Spin 5 min.'],
  ])('splits %s into three steps', (_name, text) => {
    const d = parseOffline(text);
    expect(d.steps.map((s) => s.title)).toEqual(['Add buffer', 'Mix well', 'Spin 5 min']);
  });

  it('merges a wrapped line into the step above', () => {
    const d = parseOffline('1. Incubate the membrane with the primary antibody diluted in blocking buffer for\n1 hour at room temperature.\n2. Wash.');
    expect(d.steps).toHaveLength(2);
    expect(d.steps[0].instructions).toMatch(/1 hour at room temperature/);
    expect(d.steps[0].durationSec).toBe(3600);
  });

  it('does not treat decimals such as 1.5 mL as list items', () => {
    const d = parseOffline('1. Add 1.5 mL of buffer.\n2. Mix.');
    expect(d.steps).toHaveLength(2);
    expect(d.steps[0].instructions).toBe('Add 1.5 mL of buffer.');
  });
});

describe('noise and sections', () => {
  it('drops page numbers, URLs and research-use-only lines, and joins hyphenated words', () => {
    const lines = stripNoise('For Research Use Only.\nPage 3 of 4\nhttps://example.com/x\nIncubate the mem-\nbrane.\n');
    expect(lines).toEqual(['Incubate the membrane.', '']);
  });

  it('reads materials from a Materials section and drops vendor text and catalog numbers', () => {
    const items = materialsFromSectionLines(['- PVDF membrane, 0.45 µm (Cat. no. 88585)', '- Tris-HCl - 1 M, pH 7.4']);
    expect(items.map((i) => i.name)).toEqual(['PVDF membrane', 'Tris-HCl']);
  });

  it('uses the Procedure section and ignores background text', () => {
    const d = parseOffline('Background\nWestern blots are common.\n\nProcedure\n1. Load the gel.\n2. Run the gel for 1 h.');
    expect(d.steps.map((s) => s.title)).toEqual(['Load the gel', 'Run the gel']);
  });
});

describe('phases', () => {
  it('starts a new Day phase after an overnight step when there are no Day headings', () => {
    const d = parseOffline('1. Plate cells.\n2. Incubate overnight at 37 °C.\n3. Fix the cells for 15 min.');
    expect(d.phases.map((p) => p.name.split(':')[0])).toEqual(['Day 1', 'Day 2']);
    expect(d.steps[2].phaseId).toBe(d.phases[1].id);
  });

  it('uses sub-headings as stages when there are two or more and no day cues', () => {
    const d = parseOffline('Sample preparation\n1. Lyse the cells.\nImaging\n1. Image the field.\n2. Save the file.');
    expect(d.phases.map((p) => p.name)).toEqual(['Sample preparation', 'Imaging']);
  });

  it('has no phases for a single stage', () => {
    expect(parseOffline('1. Add buffer.\n2. Mix well.').phases).toEqual([]);
  });
});

describe('hazards', () => {
  it('does not flag staining, PBS or water', () => {
    expect(detectHazardsInText('Immunostaining with DAPI. Wash in PBS. Use ultrapure water.')).toEqual([]);
  });

  it('does not flag an antibody host species as a live animal', () => {
    const text = 'Incubate with mouse anti-GFAP and goat anti-rabbit IgG for 1 h.';
    expect(hasAnimalContext(text)).toBe(false);
    expect(detectHazardsInText(text).some((h) => h.kind === 'animal')).toBe(false);
  });

  it('flags perfusion and isoflurane only when the text names animals', () => {
    expect(detectHazardsInText('Perfuse with PBS.').some((h) => h.id === 'perfusion')).toBe(false);
    expect(detectHazardsInText('Perfuse the mouse with PBS.').some((h) => h.id === 'perfusion')).toBe(true);
  });

  it('quotes the sentence that triggered each hazard', () => {
    const [h] = detectHazardsInText('Load the gel. Add 1 mL of methanol to the tank. Run it.');
    expect(h.evidence).toBe('Add 1 mL of methanol to the tank.');
  });
});

describe('category, title and objective', () => {
  it('scores by keyword and falls back to Other', () => {
    expect(scoreCategory('Run the SDS-PAGE gel and transfer to PVDF for the western blot.')).toBe('Western Blot');
    expect(scoreCategory('Mix the buffer and add water.')).toBe('Other');
  });

  it('shortens a step to 3 to 5 words without trailing numbers', () => {
    expect(shortTitle('Wash the membrane three times for 5 min each in TBST.')).toBe('Wash the membrane three times');
    expect(shortTitle('Spin the tubes at 300 g for 5 min.')).toBe('Spin the tubes');
  });

  it('falls back to a category title when there is no title line', () => {
    expect(parseOffline('1. Run the PCR.\n2. Read the Ct values.').title).toBe('PCR/qPCR protocol');
  });

  it('builds the objective from the purpose sentence in the intro', () => {
    const d = parseOffline('This protocol describes how to measure cell death in culture.\n1. Add dye.');
    expect(d.overview.objective).toBe('To measure cell death in culture.');
  });
});

describe('total time', () => {
  it('sums durations and counts each overnight step as a day', () => {
    const d = parseOffline('1. Block for 1 h.\n2. Incubate overnight.\n3. Wash 10 min.');
    expect(d.overview.totalTime).toBe('2 days (~1 h 10 min hands-on)');
  });

  it('formats durations for display', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(1800)).toBe('30 min');
    expect(formatDuration(5400)).toBe('1 h 30 min');
    expect(summarizeTotalTime([]).display).toBeNull();
  });
});
