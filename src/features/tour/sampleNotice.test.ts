import { describe, expect, it } from 'vitest';
import {
  DEMO_EXPERIMENT_NAME,
  SAMPLE_METHODS_PREFIX,
  SAMPLE_NOTICE,
  isDemoExperiment,
  withSampleCsvNote,
  withSampleJsonNote,
  withSampleMethods,
} from './sampleNotice';
import { DEMO_EXPERIMENT_NAME as SEEDED_DEMO_NAME } from '../../content/seed';
import { reportToJSON } from '../report/reportText';
import type { Report } from '../report/buildReport';

describe('isDemoExperiment', () => {
  it('recognises the seeded demo by its stable name', () => {
    expect(isDemoExperiment({ name: DEMO_EXPERIMENT_NAME })).toBe(true);
  });

  it('uses the same marker the seed writes', () => {
    expect(SEEDED_DEMO_NAME).toBe(DEMO_EXPERIMENT_NAME);
    expect(isDemoExperiment({ name: SEEDED_DEMO_NAME })).toBe(true);
  });

  it('does not match a user experiment, a similar name, or a missing experiment', () => {
    expect(isDemoExperiment({ name: 'My Western blot' })).toBe(false);
    expect(isDemoExperiment({ name: `${DEMO_EXPERIMENT_NAME} copy` })).toBe(false);
    expect(isDemoExperiment({ name: DEMO_EXPERIMENT_NAME.toLowerCase() })).toBe(false);
    expect(isDemoExperiment(null)).toBe(false);
    expect(isDemoExperiment(undefined)).toBe(false);
  });
});

describe('withSampleMethods', () => {
  it('starts the Methods text with the sample prefix', () => {
    expect(withSampleMethods('Cells were loaded.')).toBe(`${SAMPLE_METHODS_PREFIX} Cells were loaded.`);
    expect(SAMPLE_METHODS_PREFIX).toBe('[SAMPLE DATA — NOT REAL RESULTS]');
  });

  it('adds the prefix only once', () => {
    const once = withSampleMethods('Cells were loaded.');
    expect(withSampleMethods(once)).toBe(once);
  });

  it('gives the prefix alone when there is no text', () => {
    expect(withSampleMethods('')).toBe(SAMPLE_METHODS_PREFIX);
  });
});

describe('withSampleCsvNote', () => {
  it('puts the notice on the first line', () => {
    const csv = withSampleCsvNote('a,b\r\n1,2\r\n');
    const [first, second] = csv.split('\r\n');
    expect(first).toBe(`# ${SAMPLE_NOTICE}`);
    expect(second).toBe('a,b');
  });

  it('keeps a leading byte-order mark ahead of the note', () => {
    const csv = withSampleCsvNote('﻿a,b\r\n');
    expect(csv.startsWith('﻿# ')).toBe(true);
    expect(csv.indexOf('a,b')).toBeGreaterThan(csv.indexOf('# '));
  });
});

describe('withSampleJsonNote', () => {
  it('adds the notice as the first field', () => {
    const json = JSON.parse(JSON.stringify(withSampleJsonNote({ title: 'Run' })));
    expect(Object.keys(json)[0]).toBe('sampleDataNotice');
    expect(json.sampleDataNotice).toBe(SAMPLE_NOTICE);
    expect(json.title).toBe('Run');
  });
});

describe('reportToJSON sample option', () => {
  const report = { title: 'Demo run', notes: 'user note' } as unknown as Report;

  it('adds the notice for a sample run', () => {
    const json = JSON.parse(reportToJSON(report, { sample: true }));
    expect(json.sampleDataNotice).toBe(SAMPLE_NOTICE);
    expect(json.notes).toBe('user note');
    expect(json.sample).toBeUndefined();
  });

  it('leaves a normal run unchanged', () => {
    const json = JSON.parse(reportToJSON(report));
    expect(json.sampleDataNotice).toBeUndefined();
    expect(json).toEqual(report);
  });
});
