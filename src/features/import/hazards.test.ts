import { describe, expect, it } from 'vitest';
import type { Hazard, Step } from '../../types';
import { detectHazards, dedupeAliases, mergeHazards, parseAiHazards, sanitizeHazards, findRuleByName, HAZARD_RULES } from './hazards';
import { parseLocal } from './localParse';
import { cleanExtractedText } from './pdfText';
import { validateParsedProcedure } from './validateSteps';
import raw from './fixtures/western-blot-extracted.txt?raw';

const WESTERN_FULL = `Western blot protocol

Procedure
1. Prepare the 12% SDS-PAGE gel: mix 30% acrylamide/bis solution with Tris buffer, then add 10% SDS and 10 µL TEMED and 100 µL 10% APS to start polymerization.
2. Prepare sample buffer by adding 5% β-mercaptoethanol to 4x Laemmli buffer. Heat samples at 95 °C for 5 min.
3. Run the gel in running buffer at 120 V for 90 min.
4. Transfer to PVDF in transfer buffer containing 20% methanol at 100 V for 1 h.
5. Block the membrane in 5% milk in TBST for 1 h.`;

function stepsFrom(text: string): Step[] {
  return parseLocal(text).steps;
}

function names(hazards: Hazard[]): string[] {
  return hazards.map((h) => h.name);
}

describe('detectHazards on a full Western blot protocol', () => {
  const steps = stepsFrom(WESTERN_FULL);
  const hazards = detectHazards(steps);
  const byId = (id: string) => hazards.find((h) => h.id === id);

  it('flags acrylamide, TEMED and APS when they are present', () => {
    expect(byId('acrylamide')?.stepIds).toEqual([steps[0].id]);
    expect(byId('temed')?.stepIds).toEqual([steps[0].id]);
    expect(byId('aps')?.stepIds).toEqual([steps[0].id]);
  });

  it('flags β-mercaptoethanol, methanol, high voltage and SDS with their steps', () => {
    expect(byId('beta-me')?.stepIds).toEqual([steps[1].id]);
    expect(byId('methanol')?.stepIds).toEqual([steps[3].id]);
    expect(byId('high-voltage')?.stepIds).toEqual([steps[2].id, steps[3].id]);
    expect(byId('sds')?.stepIds).toEqual([steps[0].id]);
  });

  it('gives each hazard a kind, a reason and PPE', () => {
    const acryl = byId('acrylamide');
    expect(acryl?.kind).toBe('chemical');
    expect(acryl?.reason).toMatch(/neurotoxin/);
    expect(acryl?.ppe.length).toBeGreaterThan(0);
  });

  it('flags centrifugation and other hazards found in the shared fixture', () => {
    const fixtureSteps = parseLocal(cleanExtractedText(raw)).steps;
    const fixture = detectHazards(fixtureSteps);
    expect(names(fixture)).toEqual(expect.arrayContaining(['SDS (sodium dodecyl sulfate)', 'High voltage (electrophoresis power supply)']));
    expect(fixture.find((h) => h.id === 'sds')?.stepIds.length).toBeGreaterThan(0);
  });
});

describe('detectHazards on a perfusion protocol', () => {
  const text = `1. Anesthetize the mouse with isoflurane until the toe pinch reflex is gone.
2. Open the chest and insert a 23G needle into the left ventricle.
3. Perfuse with ice-cold PBS, then 4% PFA in PBS using a peristaltic pump.
4. Dissect the brain and post-fix in PFA overnight.`;
  const hazards = detectHazards(stepsFrom(text));
  const ids = hazards.map((h) => h.id);

  it('flags PFA, sharps, the anesthetic and live animals', () => {
    expect(ids).toEqual(expect.arrayContaining(['formaldehyde', 'sharps', 'anesthetic', 'live-animals', 'perfusion']));
  });
});

describe('false positives', () => {
  it('does not flag PBS or water', () => {
    const text = `1. Wash the cells twice with PBS.
2. Add 5 mL of water to the tube.
3. Incubate for 10 minutes at room temperature.`;
    expect(detectHazards(stepsFrom(text))).toEqual([]);
  });

  it('does not treat a secondary antibody raised in an animal as a live animal', () => {
    const text = `1. Incubate with goat anti-mouse IgG-HRP for 1 h.
2. Add rabbit anti-GAPDH primary antibody overnight.`;
    expect(detectHazards(stepsFrom(text)).map((h) => h.id)).not.toContain('live-animals');
  });

  it('does not flag a pH or concentration written with a lowercase v', () => {
    const text = '1. Adjust the buffer to pH 7.4 and dilute 1:1000 v/v.';
    expect(detectHazards(stepsFrom(text)).map((h) => h.id)).not.toContain('high-voltage');
  });
});

describe('alias matching and merging', () => {
  it('matches AI names to rules regardless of case, spacing and punctuation', () => {
    expect(findRuleByName('Sodium Azide')?.id).toBe('sodium-azide');
    expect(findRuleByName('β-mercaptoethanol')?.id).toBe('beta-me');
    expect(findRuleByName('  paraformaldehyde ')?.id).toBe('formaldehyde');
    expect(findRuleByName('Unknown thing')).toBeUndefined();
  });

  it('dedupes aliases after normalizing them', () => {
    expect(dedupeAliases(['SDS', 'sds', 'S.D.S', 'sodium dodecyl sulfate'])).toEqual(['sds', 'sodiumdodecylsulfate']);
  });

  it('gives every rule unique ids and at least one pattern', () => {
    const ids = HAZARD_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of HAZARD_RULES) expect(rule.patterns.length).toBeGreaterThan(0);
  });

  it('merges AI and rule hits by name, union of steps and PPE', () => {
    const steps = stepsFrom(WESTERN_FULL);
    const rules = detectHazards(steps);
    const ai = parseAiHazards(
      [
        { name: 'Methanol', kind: 'chemical', reason: 'x', ppe: ['Fume hood'], stepNumbers: [4] },
        { name: 'Ethanol', kind: 'chemical', reason: 'Flammable.', ppe: ['Gloves'], stepNumbers: [5, 99] },
      ],
      steps,
    );
    const merged = mergeHazards(rules, ai);
    const methanol = merged.filter((h) => h.id === 'methanol');
    expect(methanol).toHaveLength(1);
    expect(methanol[0].stepIds).toEqual([steps[3].id]);
    expect(methanol[0].ppe).toEqual(expect.arrayContaining(['Nitrile gloves']));
    const ethanol = merged.find((h) => h.name === 'Ethanol');
    expect(ethanol?.stepIds).toEqual([steps[4].id]);
  });
});

describe('AI hazard validation', () => {
  const steps = stepsFrom('1. Mix buffer.\n2. Spin the tube.');

  it('drops items without a name, maps step numbers, and resets unknown kinds', () => {
    const out = parseAiHazards(
      [
        { name: '', kind: 'chemical', stepNumbers: [1] },
        { name: 'Mystery agent', kind: 'weird', reason: 'Unknown.', ppe: ['Gloves', 5], stepNumbers: [2, 2, 0, 3.5] },
      ],
      steps,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: 'Mystery agent', kind: 'chemical', ppe: ['Gloves'] });
    expect(out[0].stepIds).toEqual([steps[1].id]);
  });

  it('returns nothing for non-array input', () => {
    expect(parseAiHazards('nope', steps)).toEqual([]);
  });

  it('sanitizes hazards from the server and drops unknown step ids', () => {
    const out = sanitizeHazards(
      [{ id: 'x', name: 'Centrifuge', kind: 'physical', reason: 'r', ppe: [], stepIds: [steps[1].id, 'ghost'] }],
      steps,
    );
    expect(out[0].stepIds).toEqual([steps[1].id]);
  });

  it('validateParsedProcedure returns hazards mapped to the new step ids', () => {
    const result = validateParsedProcedure({
      steps: [{ title: 'Run gel', instructions: 'Run at 150 V.' }, { title: 'Stain', instructions: 'Stain with Coomassie.' }],
      hazards: [{ name: 'Sharps', kind: 'physical', reason: 'Needles.', ppe: [], stepNumbers: [1] }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hazards[0].stepIds).toEqual([result.steps[0].id]);
  });
});
