import { describe, expect, it } from 'vitest';
import { diffSteps, diffWords, lcsPairs, summarizeStepDiff } from './diff';
import type { Step } from '../../types';

function step(id: string, title: string, instructions = ''): Step {
  return { id, title, instructions, timers: [], reagents: [], dataFields: [], cautions: [] };
}

describe('lcsPairs', () => {
  it('finds a longest common subsequence', () => {
    const pairs = lcsPairs(['a', 'b', 'c', 'd'], ['b', 'x', 'd'], (x, y) => x === y);
    expect(pairs).toEqual([
      [1, 0],
      [3, 2],
    ]);
  });
});

describe('diffWords', () => {
  it('marks only the words that changed', () => {
    const segments = diffWords('Add 200 µL buffer', 'Add 300 µL buffer');
    expect(segments.filter((s) => s.type === 'removed').map((s) => s.text)).toEqual(['200']);
    expect(segments.filter((s) => s.type === 'added').map((s) => s.text)).toEqual(['300']);
    const rebuilt = segments.filter((s) => s.type !== 'added').map((s) => s.text).join('');
    expect(rebuilt).toBe('Add 200 µL buffer');
  });

  it('returns a single equal segment for identical text', () => {
    expect(diffWords('same text', 'same text')).toEqual([{ type: 'equal', text: 'same text' }]);
  });
});

describe('diffSteps', () => {
  it('reports added, removed, changed and unchanged steps in order', () => {
    const before = [step('1', 'Prep', 'Mix 1 part'), step('2', 'Incubate', '1 h at 37 C'), step('3', 'Wash')];
    const after = [
      step('1', 'Prep', 'Mix 1 part'),
      step('2', 'Incubate', '2 h at 37 C'),
      step('4', 'Image', 'Scan the membrane'),
    ];
    const rows = diffSteps(before, after);
    expect(rows.map((r) => r.kind)).toEqual(['unchanged', 'changed', 'removed', 'added']);
    const changed = rows[1];
    expect(changed.fields).toEqual(['instructions']);
    expect(changed.instructionWords?.filter((s) => s.type === 'removed').map((s) => s.text)).toEqual(['1']);
    expect(changed.instructionWords?.filter((s) => s.type === 'added').map((s) => s.text)).toEqual(['2']);
    expect(summarizeStepDiff(rows)).toEqual({ added: 1, removed: 1, changed: 1, unchanged: 1 });
  });

  it('pairs a re-created step with the same title as changed, not removed plus added', () => {
    const before = [step('1', 'Block', 'PBS milk')];
    const after = [step('9', 'Block', 'PBS BSA')];
    const rows = diffSteps(before, after);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('changed');
  });

  it('treats identical lists as unchanged', () => {
    const list = [step('1', 'A'), step('2', 'B')];
    expect(diffSteps(list, list).every((r) => r.kind === 'unchanged')).toBe(true);
  });
});
