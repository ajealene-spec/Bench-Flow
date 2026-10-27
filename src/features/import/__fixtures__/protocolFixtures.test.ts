import { describe, expect, it } from 'vitest';
import { isVerbatimEvidence, normalizeForMatch } from '../draft';
import { parseOffline } from '../offlineParse';
import type { ProtocolDraft } from '../draft';
import westernBlot from './western-blot-vendor-pdf.txt?raw';
import fluo4 from './fluo4-apoe-calcium.txt?raw';
import ihc from './ihc-free-floating-multiday.txt?raw';
import qpcr from './qpcr-messy-paragraph.txt?raw';
import passaging from './passaging-bullet-notes.txt?raw';
import perfusion from './mouse-perfusion.txt?raw';

/**
 * Realistic protocol texts in the styles of their sources. Each is run through the offline reader
 * and checked for step count, phases, key materials, category, total time and hazards. The
 * non-animal fixtures must have no animal hazards.
 */

const hasMaterial = (d: ProtocolDraft, pattern: RegExp) => d.materials.some((m) => pattern.test(m.name));
const hazardNames = (d: ProtocolDraft) => d.hazards.map((h) => h.name);
const animalHazards = (d: ProtocolDraft) =>
  d.hazards.filter((h) => h.kind === 'animal' || h.id === 'live-animals' || h.id === 'perfusion' || h.id === 'anesthetic');

function expectNoAnimalHazards(d: ProtocolDraft) {
  expect(animalHazards(d).map((h) => h.name)).toEqual([]);
}

function expectEvidenceFromText(d: ProtocolDraft, source: string) {
  for (const h of d.hazards) {
    expect(h.evidence, h.name).toBeTruthy();
    expect(isVerbatimEvidence(h.evidence ?? '', source), `${h.name}: "${h.evidence}"`).toBe(true);
  }
}

describe('fixture: Thermo-style Western blot PDF text with noise', () => {
  const d = parseOffline(westernBlot);

  it('keeps the title and drops the header, footer, URL and legal lines', () => {
    expect(d.title).toBe('Protein Detection by Western Blot');
    const all = [d.title, ...d.steps.map((s) => s.instructions), ...d.materials.map((m) => m.name)].join('\n');
    expect(all).not.toMatch(/Page \d|www\.|©|Research Use|Thermo Fisher/);
  });

  it('finds 8 to 10 steps, in order, with the Caution line attached and not made into a step', () => {
    expect(d.steps.length).toBeGreaterThanOrEqual(8);
    expect(d.steps.length).toBeLessThanOrEqual(10);
    expect(d.steps[0].title).toMatch(/Separate/);
    expect(d.steps.some((s) => /^Caution/i.test(s.title))).toBe(false);
    expect(d.steps.some((s) => s.cautions.some((c) => /methanol/i.test(c)))).toBe(true);
  });

  it('splits into Day 1 and Day 2 around the overnight primary antibody step', () => {
    expect(d.phases.map((p) => p.name.split(':')[0])).toEqual(['Day 1', 'Day 2']);
    const overnight = d.steps.find((s) => /primary antibody/i.test(s.instructions));
    expect(overnight?.durationSec).toBe(16 * 3600);
  });

  it('captures the key materials and equipment, including those in the sections and steps', () => {
    for (const pattern of [/PVDF/i, /TBST/i, /ECL|chemiluminescent/i, /electrophoresis tank/i, /sponges/i, /filter paper/i, /power supply/i]) {
      expect(hasMaterial(d, pattern), pattern.source).toBe(true);
    }
    expect(d.materials.filter((m) => m.name === 'TBST')).toHaveLength(1);
  });

  it('is categorised as Western Blot with a 2 day total', () => {
    expect(d.category).toBe('Western Blot');
    expect(d.overview.totalTime).toMatch(/^2 days/);
  });

  it('flags methanol, SDS and high voltage with verbatim evidence and no animal hazards', () => {
    expect(hazardNames(d)).toEqual(expect.arrayContaining([expect.stringMatching(/Methanol/), expect.stringMatching(/SDS/), expect.stringMatching(/High voltage/)]));
    expectEvidenceFromText(d, westernBlot);
    expectNoAnimalHazards(d);
  });
});

describe('fixture: APOE astrocyte calcium imaging with Fluo-4 (no animals)', () => {
  const d = parseOffline(fluo4);

  it('uses the purpose sentence as the objective and the title line as the title', () => {
    expect(d.title).toBe('Calcium imaging of APOE astrocytes with Fluo-4');
    expect(d.overview.objective).toMatch(/^To measure intracellular calcium/);
  });

  it('finds the 8 procedure steps, with the 1 h + 30 min dye load summed to 90 min', () => {
    expect(d.steps.length).toBeGreaterThanOrEqual(7);
    expect(d.steps.length).toBeLessThanOrEqual(9);
    const load = d.steps.find((s) => /Fluo-4/.test(s.instructions));
    expect(load?.durationSec).toBe(5400);
  });

  it('does not count 37 °C or 30 fps as durations, and times the 30 fps imaging run', () => {
    const imaging = d.steps.find((s) => /30 fps/.test(s.instructions));
    expect(imaging?.durationSec).toBe(65);
  });

  it('has no phases because the text has no day or overnight cues', () => {
    expect(d.phases).toEqual([]);
  });

  it('captures the reagents, the treatments and FIJI', () => {
    for (const pattern of [/Matrigel/i, /Laminin/i, /Fluo-4 AM/i, /Tris-HCl/i, /Glutamate/i, /synuclein/i, /FIJI/i]) {
      expect(hasMaterial(d, pattern), pattern.source).toBe(true);
    }
  });

  it('is categorised as Imaging with a 1 h 31 min total and no hazards at all', () => {
    expect(d.category).toBe('Imaging');
    expect(d.overview.totalTime).toBe('1 h 31 min');
    expect(d.hazards).toEqual([]);
  });
});

describe('fixture: multi-day immunohistochemistry with an overnight primary', () => {
  const d = parseOffline(ihc);

  it('finds 8 steps across three explicit Day phases', () => {
    expect(d.steps).toHaveLength(8);
    expect(d.phases.map((p) => p.name.split(':')[0])).toEqual(['Day 1', 'Day 2', 'Day 3']);
  });

  it('puts each step in its day', () => {
    const dayOf = (re: RegExp) => d.phases.findIndex((p) => p.id === d.steps.find((s) => re.test(s.instructions))?.phaseId);
    expect(dayOf(/paraformaldehyde/)).toBe(0);
    expect(dayOf(/Block sections/)).toBe(1);
    expect(dayOf(/DAPI/)).toBe(2);
  });

  it('times the repeated washes (3 x 5 min is 15 min) and the overnight incubation', () => {
    expect(d.steps.find((s) => /Wash sections/.test(s.instructions))?.durationSec).toBe(900);
    expect(d.steps.find((s) => /primary antibody/.test(s.instructions))?.durationSec).toBe(16 * 3600);
  });

  it('captures the antibody, fixative and detergent reagents', () => {
    for (const pattern of [/Paraformaldehyde/i, /Triton/i, /DAPI/i, /serum/i, /Alexa/i]) {
      expect(hasMaterial(d, pattern), pattern.source).toBe(true);
    }
  });

  it('flags fixative and detergent, not the antibody host species, and has no animal hazard', () => {
    expect(hazardNames(d)).toEqual(expect.arrayContaining([expect.stringMatching(/Paraformaldehyde/), expect.stringMatching(/Triton/)]));
    expectNoAnimalHazards(d);
    expectEvidenceFromText(d, ihc);
  });

  it('is categorised as Immunostaining with a 3 day total', () => {
    expect(d.category).toBe('Immunostaining');
    expect(d.overview.totalTime).toMatch(/^3 days/);
  });
});

describe('fixture: qPCR written as a messy paragraph', () => {
  const d = parseOffline(qpcr);

  it('splits the paragraph into 7 to 9 steps and does not make the purpose sentence a step', () => {
    expect(d.steps.length).toBeGreaterThanOrEqual(7);
    expect(d.steps.length).toBeLessThanOrEqual(9);
    expect(d.steps.some((s) => /^qPCR to quantify/i.test(s.instructions))).toBe(false);
  });

  it('keeps the Caution sentence as a caution, not a step', () => {
    expect(d.steps.some((s) => /^Caution/i.test(s.instructions))).toBe(false);
    expect(d.steps.some((s) => s.cautions.some((c) => /TRIzol/.test(c)))).toBe(true);
  });

  it('captures the reagents and the thermocycler with its plate', () => {
    for (const pattern of [/TRIzol/i, /cDNA/, /SYBR Green/i, /Thermocycler/i, /96-well/i, /Primers/i]) {
      expect(hasMaterial(d, pattern), pattern.source).toBe(true);
    }
  });

  it('is categorised as PCR/qPCR, flags TRIzol (phenol) and has no animal hazard', () => {
    expect(d.category).toBe('PCR/qPCR');
    expect(hazardNames(d)).toEqual(expect.arrayContaining([expect.stringMatching(/TRIzol|Phenol/)]));
    expectNoAnimalHazards(d);
    expectEvidenceFromText(d, qpcr);
  });

  it('does not flag SYBR Green as a stain hazard', () => {
    expect(hazardNames(d).some((n) => /SYBR/.test(n))).toBe(false);
  });

  it('has a total time from its timed steps', () => {
    expect(d.overview.totalTime).not.toBe('Not stated');
  });
});

describe('fixture: cell passaging as bullet notes', () => {
  const d = parseOffline(passaging);

  it('makes one step per bullet, 8 to 10 in all', () => {
    expect(d.steps.length).toBeGreaterThanOrEqual(8);
    expect(d.steps.length).toBeLessThanOrEqual(10);
    expect(d.steps[0].title).toMatch(/Warm/);
  });

  it('attaches the closing Note to the last step as a caution', () => {
    expect(d.steps[d.steps.length - 1].cautions.some((c) => /trypsin/.test(c))).toBe(true);
  });

  it('captures the media, reagents and equipment, and no mangled material names', () => {
    for (const pattern of [/DMEM/, /FBS|Fetal bovine serum/, /Trypsin-EDTA/, /PBS/, /Water bath/, /Culture flask/]) {
      expect(hasMaterial(d, pattern), pattern.source).toBe(true);
    }
    expect(d.materials.some((m) => /\bML\b|\bPut\b|\bAdd\b/.test(m.name))).toBe(false);
  });

  it('is categorised as Cell Culture with a total of the timed steps', () => {
    expect(d.category).toBe('Cell Culture');
    expect(d.overview.totalTime).toBe('8 min');
  });

  it('has no hazards and no animal hazard', () => {
    expect(d.hazards).toEqual([]);
  });
});

describe('fixture: mouse transcardial perfusion (the one with animal hazards)', () => {
  const d = parseOffline(perfusion);

  it('finds 5 to 7 steps across two days', () => {
    expect(d.steps.length).toBeGreaterThanOrEqual(5);
    expect(d.steps.length).toBeLessThanOrEqual(7);
    expect(d.phases.length).toBe(2);
  });

  it('captures the anesthetic, fixative, sucrose and equipment', () => {
    for (const pattern of [/Isoflurane/i, /Ketamine/i, /Paraformaldehyde/i, /Sucrose/i, /pump/i, /needles/i]) {
      expect(hasMaterial(d, pattern), pattern.source).toBe(true);
    }
  });

  it('flags live animal work with the mouse sentence as evidence', () => {
    const live = d.hazards.find((h) => h.kind === 'animal');
    expect(live?.name).toMatch(/Live animals/);
    expect(live?.evidence).toMatch(/mice/);
    expect(isVerbatimEvidence(live?.evidence ?? '', perfusion)).toBe(true);
  });

  it('flags isoflurane, PFA and sharps too, and is categorised as Animal Procedures', () => {
    expect(hazardNames(d)).toEqual(expect.arrayContaining([expect.stringMatching(/Anesthetics/), expect.stringMatching(/Paraformaldehyde/), expect.stringMatching(/Sharps/)]));
    expect(d.category).toBe('Animal Procedures');
  });
});

describe('normalizeForMatch', () => {
  it('ignores case, spacing and typographic quotes and dashes', () => {
    expect(normalizeForMatch('  Ca2+ – “test”  ')).toBe('ca2+ - "test"');
  });
});
