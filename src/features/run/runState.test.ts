import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from '../../db';
import { createLab, getRunState, saveRunState } from '../../db/helpers';
import { fixtureProcedure } from './fixtures';
import {
  completeCurrentStep,
  freshRunState,
  goBack,
  goNext,
  jumpTo,
  restoreRunState,
} from './runState';

const procedure = fixtureProcedure('lab-1');

describe('restoreRunState', () => {
  it('starts fresh when nothing is saved', () => {
    expect(restoreRunState('lab-1', undefined, procedure)).toEqual(freshRunState('lab-1'));
  });

  it('restores the exact step and completed steps', () => {
    const restored = restoreRunState(
      'lab-1',
      { labId: 'lab-1', currentStepIndex: 1, completedStepIds: ['step-lyse'], updatedAt: 5 },
      procedure,
    );
    expect(restored).toEqual({ labId: 'lab-1', currentStepIndex: 1, completedStepIds: ['step-lyse'] });
  });

  it('ignores a save that belongs to another lab', () => {
    const restored = restoreRunState(
      'lab-1',
      { labId: 'other', currentStepIndex: 2, completedStepIds: [], updatedAt: 5 },
      procedure,
    );
    expect(restored.currentStepIndex).toBe(0);
  });

  it('repairs state when the procedure changed since saving', () => {
    const restored = restoreRunState(
      'lab-1',
      { labId: 'lab-1', currentStepIndex: 9, completedStepIds: ['step-lyse', 'deleted', 'step-lyse'], updatedAt: 5 },
      procedure,
    );
    expect(restored.currentStepIndex).toBe(2);
    expect(restored.completedStepIds).toEqual(['step-lyse']);
  });
});

describe('step transitions', () => {
  it('completing a step records it and advances', () => {
    const { state, finished } = completeCurrentStep(freshRunState('lab-1'), procedure);
    expect(state).toEqual({ labId: 'lab-1', currentStepIndex: 1, completedStepIds: ['step-lyse'] });
    expect(finished).toBe(false);
  });

  it('completing the last step reports finished and does not run past the end', () => {
    const atEnd = jumpTo(freshRunState('lab-1'), 2, procedure);
    const { state, finished } = completeCurrentStep(atEnd, procedure);
    expect(finished).toBe(true);
    expect(state.currentStepIndex).toBe(2);
    expect(state.completedStepIds).toEqual(['step-transfer']);
  });

  it('back and next stay within bounds and do not complete steps', () => {
    const start = freshRunState('lab-1');
    expect(goBack(start).currentStepIndex).toBe(0);
    expect(goNext(goNext(goNext(start, procedure), procedure), procedure).currentStepIndex).toBe(2);
    expect(goNext(start, procedure).completedStepIds).toEqual([]);
  });
});

describe('resume through storage', () => {
  let database: LabCompanionDB;

  beforeEach(async () => {
    database = new LabCompanionDB(`run-${crypto.randomUUID()}`);
    await database.open();
  });

  it('a run saved before a reload comes back on the same step', async () => {
    const lab = await createLab('Blot', database);
    const p = fixtureProcedure(lab.id);
    const { state } = completeCurrentStep(freshRunState(lab.id), p);
    await saveRunState(state, database);

    const saved = await getRunState(lab.id, database);
    const restored = restoreRunState(lab.id, saved, p);
    expect(restored.currentStepIndex).toBe(1);
    expect(restored.completedStepIds).toEqual(['step-lyse']);
  });
});
