import { describe, expect, it } from 'vitest';
import type { ProtocolTemplate } from '../../types';
import { parseDuration, parseTemplateSource, templateToJson, templateToMarkdown } from './templateSource';

const template: ProtocolTemplate = {
  id: 't1',
  title: 'Western blot',
  category: 'Western Blot',
  createdAt: 0,
  updatedAt: 0,
  hazards: [],
  steps: [
    {
      id: 's1',
      title: 'Block membrane',
      instructions: 'Incubate in 5% milk for one hour at room temperature.',
      timers: [{ id: 'x1', stepId: 's1', label: 'Block', durationSec: 3600, status: 'idle' }],
      reagents: [{ name: 'Milk', amount: '5', unit: 'g' }],
      dataFields: [],
      cautions: ['Wear gloves'],
    },
    {
      id: 's2',
      title: 'Wash',
      instructions: 'Wash three times with TBST.',
      timers: [],
      reagents: [],
      dataFields: [],
      cautions: [],
    },
  ],
};

describe('parseDuration', () => {
  it('reads minutes, seconds and hours', () => {
    expect(parseDuration('30 min')).toBe(1800);
    expect(parseDuration('90 s')).toBe(90);
    expect(parseDuration('2 h')).toBe(7200);
    expect(parseDuration('45')).toBe(45);
    expect(parseDuration('soon')).toBeUndefined();
  });
});

describe('template source round trips', () => {
  it('JSON export validates and keeps step titles, instructions and timers', () => {
    const result = parseTemplateSource('json', templateToJson(template));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.title).toBe('Western blot');
    expect(result.steps.map((s) => s.title)).toEqual(['Block membrane', 'Wash']);
    expect(result.steps[0].timers[0].durationSec).toBe(3600);
    expect(result.steps[0].cautions).toEqual(['Wear gloves']);
  });

  it('Markdown export validates and keeps the same content', () => {
    const md = templateToMarkdown(template);
    const result = parseTemplateSource('markdown', md);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps[0].instructions).toBe('Incubate in 5% milk for one hour at room temperature.');
    expect(result.steps[0].timers[0]).toMatchObject({ label: 'Block', durationSec: 3600 });
    expect(result.steps[0].reagents[0]).toMatchObject({ name: 'Milk', amount: '5 g' });
    expect(result.steps[1].title).toBe('Wash');
  });
});

describe('parseTemplateSource errors', () => {
  it('reports invalid JSON without throwing', () => {
    const result = parseTemplateSource('json', '{ "steps": [');
    expect(result).toEqual({ ok: false, error: expect.stringContaining('not valid JSON') });
  });

  it('runs the shared validator, so a step without a title is rejected', () => {
    const result = parseTemplateSource('json', JSON.stringify({ steps: [{ instructions: 'x' }] }));
    expect(result.ok).toBe(false);
  });

  it('asks for a duration on a timer line that lacks one', () => {
    const result = parseTemplateSource('markdown', '# T\n## Step\n- timer: Incubate, whenever');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Incubate');
  });

  it('needs at least one step heading', () => {
    expect(parseTemplateSource('markdown', '# Only a title').ok).toBe(false);
  });
});
