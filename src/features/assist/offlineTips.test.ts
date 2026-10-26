import { describe, expect, it } from 'vitest';
import { PRESET_IDS, validateTroubleshootResult } from './assistPrompts';
import { OFFLINE_PRESET_IDS, offlineTroubleshoot } from './offlineTips';

function allText(id: string): string {
  const r = offlineTroubleshoot(id);
  return [...r.causes.flatMap((c) => [c.cause, ...c.adjustments]), ...r.quickChecks].join(' ').toLowerCase();
}

describe('offline troubleshooting rules', () => {
  it('has a rule for every preset', () => {
    expect([...OFFLINE_PRESET_IDS].sort()).toEqual([...PRESET_IDS].sort());
  });

  it('gives every preset a result that passes the same validator as the AI output', () => {
    for (const id of PRESET_IDS) {
      const result = validateTroubleshootResult(offlineTroubleshoot(id));
      expect(result.ok, id).toBe(true);
    }
  });

  it('high background suggests blocking, antibody dilution, washes, fresh buffers and keeping the membrane wet', () => {
    const text = allText('high_background');
    expect(text).toContain('block');
    expect(text).toContain('dilute');
    expect(text).toContain('wash');
    expect(text).toContain('fresh');
    expect(text).toContain('dried');
  });

  it('labels evidence as an offline rule, not run data', () => {
    const first = offlineTroubleshoot('smeared_bands').causes[0];
    expect(first.evidence).toContain('Offline rule');
  });

  it('returns a neutral prompt for an unknown or missing preset', () => {
    expect(offlineTroubleshoot(undefined).causes).toEqual([]);
    expect(offlineTroubleshoot('bogus').quickChecks[0]).toContain('Choose');
  });

  it('returns copies, so callers cannot change the rules', () => {
    const a = offlineTroubleshoot('bubbles');
    a.causes[0].adjustments.push('changed');
    expect(offlineTroubleshoot('bubbles').causes[0].adjustments).not.toContain('changed');
  });
});
