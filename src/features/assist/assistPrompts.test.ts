import { describe, expect, it } from 'vitest';
import {
  MAX_LITERATURE_STEPS,
  PRESET_IDS,
  buildLiteratureRequestBody,
  buildLiteratureUserMessage,
  buildTroubleshootRequestBody,
  buildTroubleshootUserMessage,
  collectSearchResults,
  parseLiteratureRequest,
  parseModelJson,
  parseTroubleshootRequest,
  presetLabel,
  searchErrorOf,
  textOf,
  validateLiteratureResult,
  validateTroubleshootResult,
  type RunSummary,
} from './assistPrompts';

const report: RunSummary = {
  experimentName: 'WB 12 Mar',
  status: 'done',
  steps: [
    {
      number: 1,
      title: 'Block',
      instructions: 'Block the membrane in 5% milk.',
      completed: true,
      timers: [{ label: 'Block', plannedSec: 3600, actualSec: 1800 }],
    },
  ],
  reagents: [{ name: 'Milk', amount: '5', unit: '%', stepNumbers: [1] }],
  deviations: ['Timer "Block" in step 1 ran 30m, planned 1h (-50%)'],
};

describe('troubleshoot prompt builder', () => {
  it('includes the protocol, symptom, scientist text and the exact run parameters', () => {
    const msg = buildTroubleshootUserMessage({
      protocolTitle: 'Western blot',
      problem: { preset: 'high_background', text: 'grey everywhere' },
      report,
    });
    expect(msg).toContain('Protocol: Western blot');
    expect(msg).toContain('Symptom: High background');
    expect(msg).toContain("Scientist's description: grey everywhere");
    expect(msg).toContain('"plannedSec":3600');
    expect(msg).toContain('"actualSec":1800');
  });

  it('omits the symptom line when only free text is given', () => {
    const msg = buildTroubleshootUserMessage({ protocolTitle: 'PCR', problem: { text: 'no band' }, report });
    expect(msg).not.toContain('Symptom:');
    expect(msg).toContain('no band');
  });

  it('builds a request body with the configured model and no tools', () => {
    const body = buildTroubleshootRequestBody('claude-sonnet-5-5', {
      protocolTitle: 'WB',
      problem: { preset: 'no_signal' },
      report,
    });
    expect(body.model).toBe('claude-sonnet-5-5');
    expect(body.tools).toBeUndefined();
    expect(String(body.system)).toContain('"causes"');
  });
});

describe('literature prompt builder', () => {
  it('numbers the steps and asks for suggestions only', () => {
    const msg = buildLiteratureUserMessage({ protocolTitle: 'WB', steps: ['Block: 1 h', 'Transfer'] });
    expect(msg).toContain('1. Block: 1 h');
    expect(msg).toContain('2. Transfer');
  });

  it('enables the web search server tool with max_uses 5', () => {
    const body = buildLiteratureRequestBody('claude-sonnet-5-5', { protocolTitle: 'WB', steps: ['Block'] });
    expect(body.tools).toEqual([{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }]);
    expect(String(body.system)).toContain('SUGGEST');
  });
});

describe('request validation', () => {
  it('accepts a valid troubleshoot request and trims text', () => {
    const r = parseTroubleshootRequest({
      protocolTitle: '  WB ',
      problem: { preset: 'smeared_bands', text: '  smear  ' },
      report,
    });
    expect(r).toEqual({ ok: true, value: { protocolTitle: 'WB', problem: { preset: 'smeared_bands', text: 'smear' }, report } });
  });

  it('rejects unknown presets, missing problems and missing reports', () => {
    expect(parseTroubleshootRequest({ protocolTitle: 'WB', problem: { preset: 'nope' }, report })).toEqual({ ok: false, error: 'invalid_preset' });
    expect(parseTroubleshootRequest({ protocolTitle: 'WB', problem: {}, report })).toEqual({ ok: false, error: 'missing_problem' });
    expect(parseTroubleshootRequest({ protocolTitle: 'WB', problem: { text: 'x' } })).toEqual({ ok: false, error: 'missing_report' });
    expect(parseTroubleshootRequest({ problem: { text: 'x' }, report })).toEqual({ ok: false, error: 'missing_protocol_title' });
    expect(parseTroubleshootRequest(null)).toEqual({ ok: false, error: 'invalid_body' });
  });

  it('rejects oversized run reports', () => {
    const big = { ...report, notes: 'x'.repeat(50_000) };
    expect(parseTroubleshootRequest({ protocolTitle: 'WB', problem: { text: 'x' }, report: big })).toEqual({
      ok: false,
      error: 'report_too_large',
    });
  });

  it('validates literature requests and drops blank step lines', () => {
    const r = parseLiteratureRequest({ protocolTitle: 'WB', steps: ['Block', '   ', 42] });
    expect(r).toEqual({ ok: true, value: { protocolTitle: 'WB', steps: ['Block'] } });
    expect(parseLiteratureRequest({ protocolTitle: 'WB', steps: [] })).toEqual({ ok: false, error: 'missing_steps' });
    const many = Array.from({ length: MAX_LITERATURE_STEPS + 1 }, (_, i) => `step ${i}`);
    expect(parseLiteratureRequest({ protocolTitle: 'WB', steps: many })).toEqual({ ok: false, error: 'too_many_steps' });
  });

  it('knows every preset id and its label', () => {
    expect(PRESET_IDS).toHaveLength(8);
    expect(presetLabel('primer_dimers')).toBe('Primer dimers');
    expect(presetLabel(undefined)).toBeUndefined();
  });
});

describe('troubleshoot response validation', () => {
  it('keeps well-formed causes and trims lists to the limits', () => {
    const raw = {
      causes: [
        { cause: 'Short blocking', evidence: 'Block 30 min vs 1 h', adjustments: ['Extend to 1 h', '', 'x'.repeat(10)] },
        { evidence: 'no cause text' },
      ],
      quickChecks: ['Stain with Ponceau'],
    };
    const result = validateTroubleshootResult(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.causes).toHaveLength(1);
      expect(result.value.causes[0].adjustments).toEqual(['Extend to 1 h', 'xxxxxxxxxx']);
      expect(result.value.quickChecks).toEqual(['Stain with Ponceau']);
    }
  });

  it('rejects output without causes or quick checks', () => {
    expect(validateTroubleshootResult({ causes: 'nope' }).ok).toBe(false);
    expect(validateTroubleshootResult({ causes: [], quickChecks: [] }).ok).toBe(false);
    expect(validateTroubleshootResult(null).ok).toBe(false);
  });
});

describe('literature response validation', () => {
  const suggestion = (citations: unknown[]) => ({
    title: 'Longer blocking',
    change: 'Block 1 h in 5% BSA',
    rationale: 'Reduces nonspecific binding in the cited study.',
    citations,
  });

  it('drops citations whose URL the search did not return, and suggestions left without citations', () => {
    const allowed = new Set(['https://example.org/paper']);
    const raw = {
      suggestions: [
        suggestion([
          { title: 'Paper', url: 'https://example.org/paper' },
          { title: 'Invented', url: 'https://made-up.example/x' },
        ]),
        suggestion([{ title: 'Invented only', url: 'https://made-up.example/y' }]),
      ],
      summary: 'One source found.',
    };
    const result = validateLiteratureResult(raw, allowed);
    expect(result).toEqual({
      ok: true,
      value: {
        suggestions: [
          {
            title: 'Longer blocking',
            change: 'Block 1 h in 5% BSA',
            rationale: 'Reduces nonspecific binding in the cited study.',
            citations: [{ title: 'Paper', url: 'https://example.org/paper' }],
          },
        ],
        summary: 'One source found.',
      },
    });
  });

  it('requires https citations', () => {
    const result = validateLiteratureResult({ suggestions: [suggestion([{ title: 'T', url: 'http://example.org' }])], summary: '' });
    expect(result.ok && result.value.suggestions).toEqual([]);
  });

  it('accepts an empty list with a summary and rejects a non-list', () => {
    expect(validateLiteratureResult({ suggestions: [], summary: 'Nothing credible.' })).toEqual({
      ok: true,
      value: { suggestions: [], summary: 'Nothing credible.' },
    });
    expect(validateLiteratureResult({ suggestions: 'x' }).ok).toBe(false);
  });
});

describe('model response helpers', () => {
  it('reads only text blocks and parses fenced JSON', () => {
    const blocks = [
      { type: 'server_tool_use', content: 'ignored' },
      { type: 'text', text: '```json\n{"causes":[]}\n```' },
    ];
    expect(textOf(blocks)).toBe('```json\n{"causes":[]}\n```');
    expect(parseModelJson(textOf(blocks))).toEqual({ ok: true, value: { causes: [] } });
    expect(parseModelJson('no json here')).toEqual({ ok: false, error: 'model_output_not_json' });
  });

  it('collects search result URLs and detects a failed search', () => {
    const ok = [
      {
        type: 'web_search_tool_result',
        content: [{ type: 'web_search_result', url: 'https://a.example', title: 'A' }],
      },
    ];
    expect(collectSearchResults(ok).get('https://a.example')).toBe('A');
    expect(searchErrorOf(ok)).toBeUndefined();

    const failed = [{ type: 'web_search_tool_result', content: { type: 'web_search_tool_result_error', error_code: 'unavailable' } }];
    expect(searchErrorOf(failed)).toBe('unavailable');
  });
});
