import { describe, expect, it } from 'vitest';
import {
  buildExplainRequestBody,
  cleanLinks,
  EXPLAIN_MAX_INSTRUCTION_CHARS,
  EXPLAIN_MAX_LINKS,
  parseExplainRequest,
  parseExplainText,
  validateExplainResult,
} from './explainPrompts';

describe('parseExplainRequest', () => {
  it('keeps the protocol title, step title and text, trimmed', () => {
    expect(parseExplainRequest({ protocolTitle: ' PCR ', title: ' Anneal ', instructions: ' 55 C for 30 s ' })).toEqual({
      ok: true,
      value: { protocolTitle: 'PCR', title: 'Anneal', instructions: '55 C for 30 s' },
    });
  });

  it('caps long step text and falls back to a default protocol title', () => {
    const long = 'x'.repeat(EXPLAIN_MAX_INSTRUCTION_CHARS + 500);
    const result = parseExplainRequest({ title: 'Step', instructions: long });
    expect(result.ok && result.value.protocolTitle).toBe('Lab protocol');
    expect(result.ok && result.value.instructions).toHaveLength(EXPLAIN_MAX_INSTRUCTION_CHARS);
  });

  it('rejects a body without a step title or that is not an object', () => {
    expect(parseExplainRequest({ instructions: 'x' })).toEqual({ ok: false, error: 'missing_title' });
    expect(parseExplainRequest('nope')).toEqual({ ok: false, error: 'invalid_body' });
  });
});

describe('buildExplainRequestBody', () => {
  it('puts the system prompt and the step in the request, with the model set', () => {
    const body = buildExplainRequestBody('m-1', { protocolTitle: 'Blot', title: 'Wash', instructions: 'TBST 3 x 5 min' });
    expect(body.model).toBe('m-1');
    expect(String(body.system)).toContain('JSON only');
    expect((body.messages as Array<{ content: string }>)[0].content).toContain('TBST 3 x 5 min');
  });
});

describe('cleanLinks', () => {
  it('keeps https links only, normalises them and caps the count', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ title: `T${i}`, url: `https://example.org/${i}` }));
    const kept = cleanLinks(many);
    expect(kept).toHaveLength(EXPLAIN_MAX_LINKS);
    expect(kept[0]).toEqual({ title: 'T0', url: 'https://example.org/0' });
  });

  it('ignores non-arrays and non-objects', () => {
    expect(cleanLinks('https://example.org')).toEqual([]);
    expect(cleanLinks([null, 3])).toEqual([]);
  });
});

describe('validateExplainResult', () => {
  it('accepts a complete reply and defaults the links to none', () => {
    expect(validateExplainResult({ why: 'Because.', mistakes: ['Too cold'] })).toEqual({
      why: 'Because.',
      mistakes: ['Too cold'],
      links: [],
    });
  });

  it('rejects a reply with no why or with non-string mistakes', () => {
    expect(validateExplainResult({ why: ' ', mistakes: [] })).toBeNull();
    expect(validateExplainResult({ why: 'x', mistakes: [1] })).toBeNull();
  });
});

describe('parseExplainText', () => {
  it('reads the object out of text with surrounding words or a code fence', () => {
    expect(parseExplainText('Here: {"why":"a","mistakes":[]}')).toEqual({ why: 'a', mistakes: [] });
    expect(parseExplainText('no json here')).toBeUndefined();
  });
});
