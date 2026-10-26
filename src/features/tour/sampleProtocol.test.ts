import { describe, expect, it } from 'vitest';
import { parseLocal } from '../import/localParse';
import { detectHazards } from '../import/hazards';
import { buildSafetyChecklist } from '../run/safety';
import { SAMPLE_PROTOCOL_TEXT } from './sampleData';

describe('sample protocol', () => {
  it('parses into the steps the tour shows', () => {
    const { steps } = parseLocal(SAMPLE_PROTOCOL_TEXT);
    expect(steps.length).toBeGreaterThanOrEqual(6);
    expect(steps.every((s) => s.title.trim().length > 0)).toBe(true);
  });

  it('produces a safety checklist that includes the baseline PPE', () => {
    const steps = parseLocal(SAMPLE_PROTOCOL_TEXT).steps;
    const items = buildSafetyChecklist(detectHazards(steps));
    const labels = items.map((i) => i.label);
    expect(labels).toEqual(expect.arrayContaining(['Lab coat', 'Gloves', 'Eye protection']));
  });
});
