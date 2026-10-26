import { db as defaultDb, type LabCompanionDB } from '../../db';
import { logEvent } from '../../db/executionLog';
import type { StepVariable } from '../../types';
import { evaluateFormula } from './formulaEval';

/** Two values closer than this are treated as the same. */
const EPSILON = 1e-9;

/**
 * Values for a step's variables. Each override replaces the template value for that variable.
 * Derived variables with no override are evaluated from the values before them. A formula that
 * fails gives NaN, which the UI shows as a dash.
 */
export function computeValues(variables: StepVariable[], overrides: Readonly<Record<string, number>> = {}): Record<string, number> {
  const values: Record<string, number> = {};
  for (const v of variables) {
    const override = overrides[v.id];
    if (override !== undefined) {
      values[v.id] = override;
    } else if (v.role === 'derived' && v.formula) {
      try {
        values[v.id] = evaluateFormula(v.formula, values);
      } catch {
        values[v.id] = NaN;
      }
    } else {
      values[v.id] = v.value;
    }
  }
  return values;
}

/** True when the value differs from the template's planned value. */
export function differsFromPlan(value: number, planned: number): boolean {
  if (!Number.isFinite(value) || !Number.isFinite(planned)) return value !== planned;
  return Math.abs(value - planned) > EPSILON;
}

export interface SetRunValueInput {
  experimentId: string;
  stepId: string;
  variable: StepVariable;
  /** What the template planned for this variable (the value without overrides). */
  planned: number;
  value: number;
}

/**
 * Saves a run's value for one variable and logs it. The log entry carries a value deviation
 * when the value differs from the plan.
 */
export async function setRunValue(input: SetRunValueInput, database: LabCompanionDB = defaultDb): Promise<void> {
  const { experimentId, stepId, variable, planned, value } = input;
  await database.runValues.put({
    experimentId,
    stepId,
    varId: variable.id,
    value,
    unit: variable.unit,
    editedAt: Date.now(),
  });
  const deviates = differsFromPlan(value, planned);
  await logEvent(
    {
      experimentId,
      type: 'value_change',
      stepId,
      planned,
      actual: value,
      unit: variable.unit,
      note: variable.token,
      ...(deviates ? { deviation: { kind: 'value' as const, delta: value - planned } } : {}),
    },
    database,
  );
}
