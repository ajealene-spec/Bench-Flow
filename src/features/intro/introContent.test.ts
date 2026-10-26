import { describe, expect, it } from 'vitest';
import { HOW_STEPS, OPEN_ITEMS, ORGANIZED, PROBLEMS, TOOLS } from './introContent';

const ALL_TEXT = JSON.stringify({ PROBLEMS, HOW_STEPS, TOOLS, OPEN_ITEMS, ORGANIZED });

describe('intro copy', () => {
  it('states three problems, each paired with a solution', () => {
    expect(PROBLEMS).toHaveLength(3);
    for (const card of PROBLEMS) {
      expect(card.problem.length).toBeGreaterThan(0);
      expect(card.solution.length).toBeGreaterThan(0);
    }
  });

  it('has four how-it-works steps and renames the export step without FAIR jargon', () => {
    expect(HOW_STEPS).toHaveLength(4);
    expect(HOW_STEPS[3].title).toBe('Export a report and data package');
    expect(ALL_TEXT).not.toMatch(/FAIR/);
  });

  it('keeps the removed claims and the old neuroscience-only tiles out of the copy', () => {
    expect(ALL_TEXT).not.toMatch(/Often|Scattered|Unlogged|Slice ephys|Ra flag|Stereotaxic|morph|Notes made at the bench/);
  });

  it('uses even grids for the feature and open-science tiles', () => {
    expect([3, 6]).toContain(TOOLS.length);
    expect(OPEN_ITEMS.length % 2).toBe(0);
    expect(ORGANIZED).toHaveLength(4);
  });

  it('gives every tile a unique title and a non-empty body', () => {
    for (const list of [TOOLS, OPEN_ITEMS, ORGANIZED]) {
      const titles = list.map((item) => item.title);
      expect(new Set(titles).size).toBe(titles.length);
      for (const item of list) expect(item.body.length).toBeGreaterThan(0);
    }
  });
});
