import { describe, expect, it } from 'vitest';
import { HOW_STEPS, MISSION_PILLARS, MISSION_SENTENCE, OPEN_ITEMS, ORGANIZED, PROBLEMS, TOOLS } from './introContent';

const ALL_TEXT = JSON.stringify({ MISSION_SENTENCE, MISSION_PILLARS, PROBLEMS, HOW_STEPS, TOOLS, OPEN_ITEMS, ORGANIZED });

describe('intro copy', () => {
  it('states the mission in one sentence with three pillars', () => {
    expect(MISSION_SENTENCE).toMatch(/free and open to everyone/i);
    expect(MISSION_SENTENCE).toMatch(/first-year students/);
    expect(MISSION_SENTENCE).toMatch(/professional researchers/);
    expect(MISSION_PILLARS).toEqual(['Free for everyone', 'Learn as you work', 'Share openly']);
  });

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

  it('explains DOI and Zenodo in plain words', () => {
    const citable = OPEN_ITEMS.find((item) => item.title === 'Citable archive');
    expect(citable?.body).toBe('Get a permanent citable link (DOI) by archiving on Zenodo, a free research archive.');
    expect(ALL_TEXT).not.toMatch(/Zenodo DOI|citable DOI/);
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
