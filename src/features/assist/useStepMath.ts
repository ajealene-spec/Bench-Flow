import { useCallback, useMemo, useState } from 'react';
import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { RunValue, Step } from '../../types';
import { computeValues, setRunValue } from './stepMath';
import { detectVariables } from './detectVariables';

/**
 * Variables for one step, with this run's overrides applied. Without an experiment (template
 * review), overrides live in component state and are not saved or logged.
 */
export function useStepMath(step: Step, experimentId?: string) {
  const variables = useMemo(
    () => step.variables ?? detectVariables(step.instructions),
    [step.variables, step.instructions],
  );

  const stored = useLiveQuery(
    async (): Promise<RunValue[]> =>
      experimentId
        ? db.runValues
            .where('[experimentId+stepId+varId]')
            .between([experimentId, step.id, Dexie.minKey], [experimentId, step.id, Dexie.maxKey])
            .toArray()
        : [],
    [experimentId, step.id],
  );

  const [localOverrides, setLocalOverrides] = useState<Record<string, number>>({});

  const overrides = useMemo(() => {
    if (!experimentId) return localOverrides;
    const map: Record<string, number> = {};
    for (const row of stored ?? []) map[row.varId] = row.value;
    return map;
  }, [experimentId, localOverrides, stored]);

  const templateValues = useMemo(() => computeValues(variables), [variables]);
  const values = useMemo(() => computeValues(variables, overrides), [variables, overrides]);

  const setValue = useCallback(
    async (varId: string, value: number) => {
      const variable = variables.find((v) => v.id === varId);
      if (!variable) return;
      if (!experimentId) {
        setLocalOverrides((prev) => ({ ...prev, [varId]: value }));
        return;
      }
      await setRunValue({
        experimentId,
        stepId: step.id,
        variable,
        planned: templateValues[varId],
        value,
      });
    },
    [variables, experimentId, step.id, templateValues],
  );

  return { variables, values, templateValues, setValue };
}
