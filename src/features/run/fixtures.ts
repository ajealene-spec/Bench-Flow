import type { Procedure } from '../../types';

/** A three-step procedure with timers, reagents and cautions, for tests and demos. */
export function fixtureProcedure(labId = 'lab-fixture'): Procedure {
  return {
    id: 'proc-fixture',
    labId,
    title: 'Western blot',
    createdAt: 0,
    updatedAt: 0,
    steps: [
      {
        id: 'step-lyse',
        title: 'Lyse cells',
        instructions: 'Add 200 µL ice-cold RIPA buffer.\nRock gently for 10 minutes.',
        timers: [{ id: 'def-rock', stepId: 'step-lyse', label: 'Rock on ice', durationSec: 600, status: 'idle' }],
        reagents: [{ name: 'RIPA buffer', amount: '200', unit: 'µL' }],
        dataFields: [],
        cautions: ['Keep lysate on ice at all times'],
      },
      {
        id: 'step-gel',
        title: 'Run gel',
        instructions: 'Load 20 µg protein per lane and run at 120 V.',
        timers: [{ id: 'def-run', stepId: 'step-gel', label: 'Gel run', durationSec: 5400, status: 'idle' }],
        reagents: [{ name: 'Laemmli buffer', amount: '5', unit: 'µL' }],
        dataFields: [],
        cautions: [],
      },
      {
        id: 'step-transfer',
        title: 'Transfer',
        instructions: 'Transfer to PVDF at 100 V for 1 hour.',
        timers: [],
        reagents: [],
        dataFields: [],
        cautions: ['Methanol is flammable'],
      },
    ],
  };
}
