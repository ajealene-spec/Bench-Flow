import { describe, expect, it } from 'vitest';
import { formatAmount } from './variableFormat';

describe('formatAmount', () => {
  it('rounds µL to 0.1', () => {
    expect(formatAmount(10, 'µL')).toBe('10 µL');
    expect(formatAmount(12.345, 'µL')).toBe('12.3 µL');
    expect(formatAmount(10.04, 'µL')).toBe('10 µL');
  });

  it('switches µL to mL at 1000 and above', () => {
    expect(formatAmount(999.9, 'µL')).toBe('999.9 µL');
    expect(formatAmount(5000, 'µL')).toBe('5 mL');
    expect(formatAmount(1234.567, 'µL')).toBe('1.235 mL');
  });

  it('shows tiny non-zero values as a bound instead of zero', () => {
    expect(formatAmount(0.04, 'µL')).toBe('<0.1 µL');
    expect(formatAmount(0, 'µL')).toBe('0 µL');
  });

  it('reads dilutions, percentages, counts and molar units', () => {
    expect(formatAmount(1000, '1:N')).toBe('1:1000');
    expect(formatAmount(5, '%')).toBe('5%');
    expect(formatAmount(12.4, 'samples')).toBe('12 samples');
    expect(formatAmount(0.25, 'mM')).toBe('0.25 mM');
    expect(formatAmount(NaN, 'mL')).toBe('—');
  });
});
