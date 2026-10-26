import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from '../../../db';
import { putPhoto } from '../../../db/photos';
import { parseAnnotations } from './annotations';
import { photosForReport } from './photosForReport';

let database: LabCompanionDB;

beforeEach(async () => {
  database = new LabCompanionDB(`test-${crypto.randomUUID()}`);
  await database.open();
});

describe('photosForReport', () => {
  it('returns one run\'s photos in time order, with annotations as JSON', async () => {
    const blob = new Blob(['img'], { type: 'image/jpeg' });
    await putPhoto({ id: 'late', experimentId: 'e1', stepId: 's2', blob, annotations: [], caption: 'Gel', at: 2 }, database);
    await putPhoto(
      { id: 'early', experimentId: 'e1', blob, annotations: [{ id: 'a', x: 0.1, y: 0.2, text: 'Lane 1' }], caption: '', at: 1 },
      database,
    );
    await putPhoto({ id: 'other', experimentId: 'e2', blob, annotations: [], caption: '', at: 0 }, database);

    const report = await photosForReport('e1', database);
    expect(report.map((p) => p.id)).toEqual(['early', 'late']);
    expect(parseAnnotations(report[0].annotations)).toEqual([{ id: 'a', x: 0.1, y: 0.2, text: 'Lane 1' }]);
    expect(report[1]).toMatchObject({ stepId: 's2', caption: 'Gel' });
    // jsdom does not keep Blob identity through fake-indexeddb, so only check that the blob is carried over.
    expect(report[0].blob).toBeDefined();
  });
});
