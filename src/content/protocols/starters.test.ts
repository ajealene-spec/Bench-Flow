import { describe, expect, it } from 'vitest';
import { computeValues } from '../../features/assist/stepMath';
import { STARTER_SPECS, STARTER_TEMPLATES } from './index';
import { VERIFY_NOTE } from './build';

describe('starter protocol library', () => {
  it('ships the 16 planned protocols with unique titles', () => {
    expect(STARTER_TEMPLATES).toHaveLength(16);
    const titles = STARTER_TEMPLATES.map((t) => t.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it.each(STARTER_TEMPLATES.map((t) => [t.title, t] as const))('%s is a complete, valid template', (_title, template) => {
    expect(template.isStarter).toBe(true);
    expect(template.license).toBe('CC BY 4.0');
    expect(template.authors).toEqual(['Bench Flow starter']);
    expect(template.category.trim()).not.toBe('');
    expect(template.overview?.objective).toBeTruthy();
    expect(template.materials?.length).toBeGreaterThan(0);
    expect(template.steps.length).toBeGreaterThan(0);
    expect(template.notes).toContain(VERIFY_NOTE);
    expect(template.steps[0].cautions).toContain(VERIFY_NOTE);

    const stepIds = new Set(template.steps.map((s) => s.id));
    expect(stepIds.size).toBe(template.steps.length);
    for (const step of template.steps) {
      expect(step.title.trim()).not.toBe('');
      expect(step.timers.every((t) => t.stepId === step.id)).toBe(true);
      if (step.durationSec !== undefined) expect(step.durationSec).toBeGreaterThan(0);
    }
  });

  it.each(STARTER_TEMPLATES.map((t) => [t.title, t] as const))('%s has formulas that evaluate and phases that are used', (_title, template) => {
    const phaseIds = new Set((template.phases ?? []).map((p) => p.id));
    const usedPhases = new Set<string>();
    for (const step of template.steps) {
      if (step.phaseId !== undefined) {
        expect(phaseIds.has(step.phaseId)).toBe(true);
        usedPhases.add(step.phaseId);
      }
      const variables = step.variables ?? [];
      const values = computeValues(variables);
      for (const v of variables) {
        if (v.role === 'derived') {
          expect(v.formula, `${step.title}: ${v.token} has a formula`).toBeTruthy();
          expect(Number.isFinite(values[v.id]), `${step.title}: ${v.token} evaluates`).toBe(true);
        }
      }
    }
    // Every phase is used by at least one step.
    for (const id of phaseIds) expect(usedPhases.has(id)).toBe(true);

    const stepIds = new Set(template.steps.map((s) => s.id));
    for (const hazard of template.hazards) {
      expect(hazard.stepIds.every((id) => stepIds.has(id))).toBe(true);
    }
  });

  it('computes the expected planned values for the core formulas', () => {
    const byTitle = (title: string) => STARTER_TEMPLATES.find((t) => t.title === title)!;
    const valueOf = (title: string, token: string) => {
      for (const step of byTitle(title).steps) {
        const values = computeValues(step.variables ?? []);
        const found = step.variables?.find((v) => v.token === token);
        if (found) return values[found.id];
      }
      throw new Error(`no variable ${token}`);
    };
    expect(valueOf('Western blot', 'Primary antibody volume')).toBeCloseTo(10, 9);
    expect(valueOf('Immunofluorescence on free-floating brain sections', 'Primary antibody volume')).toBeCloseTo(4, 9);
    expect(valueOf('Transcardial perfusion with paraformaldehyde', 'PFA stock volume')).toBeCloseTo(25, 9);
    expect(valueOf('DAPI counterstain and mounting', 'DAPI stock volume')).toBeCloseTo(2, 9);
    expect(valueOf('Mouse tail genomic DNA genotyping', 'NaOH stock volume')).toBeCloseTo(2.5, 9);
    expect(valueOf('RT-qPCR with SYBR Green', 'Primer volume per reaction')).toBeCloseTo(0.3, 9);
    expect(valueOf('Stereotaxic viral injection', 'AAV stock volume')).toBeCloseTo(2, 9);
    expect(valueOf('Acute slice electrophysiology: solutions and recording', 'Stock volume')).toBeCloseTo(100, 9);
  });

  it('keeps the spec list in step with the built templates', () => {
    expect(STARTER_SPECS.map((s) => `starter-${s.slug}`)).toEqual(STARTER_TEMPLATES.map((t) => t.id));
  });
});
