import { describe, expect, it } from 'vitest';
import { FormulaError, evaluateFormula } from './formulaEval';

const scope = { a: 10, b: 4, c: 0.5, v2: 50 };

describe('evaluateFormula', () => {
  it('handles precedence and parentheses', () => {
    expect(evaluateFormula('1 + 2 * 3', {})).toBe(7);
    expect(evaluateFormula('(1 + 2) * 3', {})).toBe(9);
    expect(evaluateFormula('a - b - c', scope)).toBe(5.5);
    expect(evaluateFormula('a / b / 5', scope)).toBe(0.5);
  });

  it('resolves variable ids from the scope', () => {
    expect(evaluateFormula('v2 * 1000 / a', scope)).toBe(5000);
    expect(evaluateFormula('v2 * 0.001', scope)).toBeCloseTo(0.05, 12);
  });

  it('supports unary minus and plus', () => {
    expect(evaluateFormula('-a + 3', scope)).toBe(-7);
    expect(evaluateFormula('2 * -b', scope)).toBe(-8);
    expect(evaluateFormula('+a', scope)).toBe(10);
  });

  it('rejects unknown names, bad syntax, division by zero and non-finite results', () => {
    expect(() => evaluateFormula('missing * 2', scope)).toThrow(FormulaError);
    expect(() => evaluateFormula('a +', scope)).toThrow(FormulaError);
    expect(() => evaluateFormula('(a + 1', scope)).toThrow(FormulaError);
    expect(() => evaluateFormula('a ) ', scope)).toThrow(FormulaError);
    expect(() => evaluateFormula('a / 0', scope)).toThrow(FormulaError);
    expect(() => evaluateFormula('', scope)).toThrow(FormulaError);
  });

  it('never executes code: calls, property access and strings are refused', () => {
    expect(() => evaluateFormula('alert(1)', scope)).toThrow(FormulaError);
    expect(() => evaluateFormula('a.constructor', scope)).toThrow(FormulaError);
    expect(() => evaluateFormula('"a"', scope)).toThrow(FormulaError);
    expect(() => evaluateFormula('a ** 2', scope)).toThrow(FormulaError);
  });
});
