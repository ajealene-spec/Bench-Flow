/*
 * Safe evaluator for step-variable formulas. Accepts numbers, identifiers that name other
 * variables, + - * / and parentheses. No eval, no function calls, no property access.
 */

export class FormulaError extends Error {}

const MAX_LENGTH = 500;

type Token = { kind: 'num'; value: number } | { kind: 'id'; name: string } | { kind: 'op'; op: string };

function tokenize(expr: string): Token[] {
  if (expr.length > MAX_LENGTH) throw new FormulaError('Formula is too long');
  const tokens: Token[] = [];
  const re = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|([-+*/()]))/y;
  let pos = 0;
  while (pos < expr.length) {
    if (expr.slice(pos).trim() === '') break;
    re.lastIndex = pos;
    const m = re.exec(expr);
    if (!m) throw new FormulaError(`Unexpected character at ${pos}`);
    if (m[1] !== undefined) tokens.push({ kind: 'num', value: Number(m[1]) });
    else if (m[2] !== undefined) tokens.push({ kind: 'id', name: m[2] });
    else tokens.push({ kind: 'op', op: m[3] });
    pos = re.lastIndex;
  }
  return tokens;
}

/** Evaluates a formula against variable values. Throws FormulaError on bad syntax, unknown names or non-finite results. */
export function evaluateFormula(expr: string, scope: Readonly<Record<string, number>>): number {
  const tokens = tokenize(expr);
  let i = 0;

  const peekOp = (): string | undefined => {
    const t = tokens[i];
    return t && t.kind === 'op' ? t.op : undefined;
  };

  function primary(): number {
    const t = tokens[i];
    if (!t) throw new FormulaError('Unexpected end of formula');
    i += 1;
    if (t.kind === 'num') return t.value;
    if (t.kind === 'id') {
      const v = scope[t.name];
      if (v === undefined || !Number.isFinite(v)) throw new FormulaError(`Unknown value ${t.name}`);
      return v;
    }
    if (t.op === '(') {
      const inner = sum();
      if (peekOp() !== ')') throw new FormulaError('Missing )');
      i += 1;
      return inner;
    }
    throw new FormulaError(`Unexpected ${t.op}`);
  }

  function unary(): number {
    const op = peekOp();
    if (op === '-') {
      i += 1;
      return -unary();
    }
    if (op === '+') {
      i += 1;
      return unary();
    }
    return primary();
  }

  function product(): number {
    let value = unary();
    for (let op = peekOp(); op === '*' || op === '/'; op = peekOp()) {
      i += 1;
      const rhs = unary();
      if (op === '/' && rhs === 0) throw new FormulaError('Division by zero');
      value = op === '*' ? value * rhs : value / rhs;
    }
    return value;
  }

  function sum(): number {
    let value = product();
    for (let op = peekOp(); op === '+' || op === '-'; op = peekOp()) {
      i += 1;
      const rhs = product();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  }

  if (tokens.length === 0) throw new FormulaError('Empty formula');
  const result = sum();
  if (i !== tokens.length) throw new FormulaError('Unexpected trailing input');
  if (!Number.isFinite(result)) throw new FormulaError('Result is not a finite number');
  return result;
}
