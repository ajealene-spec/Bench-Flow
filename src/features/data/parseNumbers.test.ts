import { describe, expect, it } from 'vitest';
import { fillLabels, isColumnComma, parseNumber, parsePastedValues } from './parseNumbers';

describe('parseNumber', () => {
  it('reads dot and decimal-comma numbers, exponents and unicode minus', () => {
    expect(parseNumber('12.5')).toBe(12.5);
    expect(parseNumber('12,5')).toBe(12.5);
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber('1.2e-3')).toBe(0.0012);
    expect(parseNumber('−4')).toBe(-4);
    expect(parseNumber('abc')).toBeUndefined();
    expect(parseNumber('12.5 µg')).toBeUndefined();
  });
});

describe('isColumnComma', () => {
  it('treats a decimal comma as part of the number', () => {
    expect(isColumnComma('12,5')).toBe(false);
    expect(isColumnComma('12,5 µg/µL')).toBe(false);
  });
  it('treats commas followed by a space or text as column separators', () => {
    expect(isColumnComma('Sample A, 0.85, OD')).toBe(true);
    expect(isColumnComma('Sample A,0.85,OD')).toBe(true);
  });
});

describe('parsePastedValues', () => {
  it('parses a single bare number', () => {
    expect(parsePastedValues('12.5')).toEqual({
      values: [{ label: '', value: 12.5, unit: '' }],
      skippedLines: 0,
    });
  });

  it('parses value with unit, including micro signs and slashes', () => {
    expect(parsePastedValues('12.5 µg/µL').values).toEqual([{ label: '', value: 12.5, unit: 'µg/µL' }]);
  });

  it('parses value with unit abbreviation', () => {
    expect(parsePastedValues('0.85 OD').values).toEqual([{ label: '', value: 0.85, unit: 'OD' }]);
  });

  it('parses a label before a colon', () => {
    expect(parsePastedValues('Absorbance: 0.85 OD').values).toEqual([
      { label: 'Absorbance', value: 0.85, unit: 'OD' },
    ]);
  });

  it('parses tab-separated label, value and unit rows as copied from Excel', () => {
    const text = 'Sample A\t0.85\tOD\nSample B\t0.91\tOD\n';
    expect(parsePastedValues(text).values).toEqual([
      { label: 'Sample A', value: 0.85, unit: 'OD' },
      { label: 'Sample B', value: 0.91, unit: 'OD' },
    ]);
  });

  it('parses newline-separated values and skips a header row', () => {
    const text = 'Abs\r\n0.85\r\n0.91\r\n0.88';
    const result = parsePastedValues(text);
    expect(result.values.map((v) => v.value)).toEqual([0.85, 0.91, 0.88]);
    expect(result.skippedLines).toBe(1);
  });

  it('parses comma-separated label, value, unit rows', () => {
    expect(parsePastedValues('Sample A, 0.85, OD').values).toEqual([
      { label: 'Sample A', value: 0.85, unit: 'OD' },
    ]);
  });

  it('keeps a decimal comma in a single-column list', () => {
    expect(parsePastedValues('12,5\n3,25').values.map((v) => v.value)).toEqual([12.5, 3.25]);
  });

  it('makes one measurement per number on a row of numbers', () => {
    expect(parsePastedValues('1.2\t3.4\t5.6').values.map((v) => v.value)).toEqual([1.2, 3.4, 5.6]);
  });

  it('counts lines without a number as skipped and never throws', () => {
    const result = parsePastedValues('no numbers here\n\n   \n');
    expect(result.values).toEqual([]);
    expect(result.skippedLines).toBe(1);
  });
});

describe('fillLabels', () => {
  it('uses step data field labels by position, then the fallback', () => {
    const values = [
      { label: '', value: 1, unit: '' },
      { label: '', value: 2, unit: '' },
      { label: '', value: 3, unit: '' },
    ];
    expect(fillLabels(values, ['Conc', 'Abs'], 'Value').map((v) => v.label)).toEqual(['Conc', 'Abs', 'Value']);
  });

  it('keeps labels that were pasted', () => {
    const values = [{ label: 'Sample A', value: 1, unit: '' }];
    expect(fillLabels(values, ['Conc'])[0].label).toBe('Sample A');
  });
});
