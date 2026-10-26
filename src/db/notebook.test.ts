import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from './index';
import { deleteAnimal, getAnimal, listAnimals, putAnimal } from './animals';
import { deleteCage, listCages, putCage } from './cages';
import { deleteComment, listComments, putComment } from './comments';
import { deleteEphysRecord, listEphysRecords, putEphysRecord } from './ephysRecords';
import { deleteExplanation, getExplanation, putExplanation } from './explanations';
import { deleteGlossaryTerm, listGlossary, putGlossaryTerm } from './glossary';
import { deleteImagingRecord, listImagingRecords, putImagingRecord } from './imagingRecords';
import { deletePhoto, listPhotos, putPhoto } from './photos';
import { deleteProtocolVersion, listProtocolVersions, putProtocolVersion } from './protocolVersions';
import { deleteSample, listSamples, putSample } from './samples';
import { deleteStereotaxTarget, listStereotaxTargets, putStereotaxTarget } from './stereotaxTargets';
import { deleteSettings, getSettings, putSettings } from './settings';

let db: LabCompanionDB;

beforeEach(async () => {
  db = new LabCompanionDB(`notebook-${crypto.randomUUID()}`);
  await db.open();
});

describe('notebook CRUD helpers', () => {
  it('round-trips animals, including nested events, and filters by cage', async () => {
    const now = 1;
    await putCage({ id: 'c1', label: 'C-1', room: 'B12', createdAt: now, updatedAt: now }, db);
    await putAnimal(
      {
        id: 'a2', label: 'Mouse 2', cageId: 'c1', species: 'Mus musculus', strain: 'C57BL/6J', genotype: 'WT', sex: 'female',
        dob: '2026-01-02', events: [{ id: 'e1', kind: 'weight', at: 5, value: 21.4, unit: 'g' }], createdAt: now, updatedAt: now,
      },
      db,
    );
    await putAnimal({ id: 'a1', label: 'Mouse 1', species: 'Mus musculus', strain: 'C57BL/6J', genotype: 'WT', sex: 'male', dob: '2026-01-01', events: [], createdAt: now, updatedAt: now }, db);

    expect((await listAnimals(undefined, db)).map((a) => a.id)).toEqual(['a1', 'a2']);
    expect((await listAnimals('c1', db)).map((a) => a.id)).toEqual(['a2']);
    expect((await getAnimal('a2', db))?.events[0]).toMatchObject({ kind: 'weight', value: 21.4 });

    await deleteAnimal('a1', db);
    expect(await getAnimal('a1', db)).toBeUndefined();
  });

  it('lists cages by room then label', async () => {
    await putCage({ id: 'x', label: 'B', room: 'R2', createdAt: 1, updatedAt: 1 }, db);
    await putCage({ id: 'y', label: 'A', room: 'R2', createdAt: 1, updatedAt: 1 }, db);
    await putCage({ id: 'z', label: 'Z', room: 'R1', createdAt: 1, updatedAt: 1 }, db);
    expect((await listCages(db)).map((c) => c.id)).toEqual(['z', 'y', 'x']);
    await deleteCage('z', db);
    expect((await listCages(db)).length).toBe(2);
  });

  it('keeps run records in time order and scoped to their run', async () => {
    const base = { cellId: 'c', Rm: 100, Ra: 10, Cm: 20, holding: -70 };
    await putEphysRecord({ ...base, id: 'p2', experimentId: 'run-a', at: 20 }, db);
    await putEphysRecord({ ...base, id: 'p1', experimentId: 'run-a', at: 10, stepId: 's1' }, db);
    await putEphysRecord({ ...base, id: 'p3', experimentId: 'run-b', at: 5 }, db);
    expect((await listEphysRecords('run-a', db)).map((r) => r.id)).toEqual(['p1', 'p2']);
    expect((await listEphysRecords(undefined, db)).map((r) => r.id)).toEqual(['p3', 'p1', 'p2']);
    await deleteEphysRecord('p3', db);
    expect((await listEphysRecords('run-b', db)).length).toBe(0);

    await putImagingRecord(
      { id: 'i1', experimentId: 'run-a', microscope: 'Confocal', objective: '40x', laser: '488 nm, 5%', exposure: '200 ms', gain: 1, channels: ['GFP'], at: 3 },
      db,
    );
    expect((await listImagingRecords('run-a', db)).map((r) => r.id)).toEqual(['i1']);
    await deleteImagingRecord('i1', db);
    expect(await listImagingRecords('run-a', db)).toEqual([]);

    await putPhoto({ id: 'ph1', experimentId: 'run-a', blob: new Blob(['x'], { type: 'image/png' }), annotations: [{ id: 'n', x: 0.5, y: 0.5, text: 'band' }], caption: 'Blot', at: 1 }, db);
    const [photo] = await listPhotos('run-a', db);
    expect(photo.annotations).toHaveLength(1);
    await deletePhoto('ph1', db);
    expect(await listPhotos(undefined, db)).toEqual([]);
  });

  it('round-trips samples, glossary, explanations, comments, versions and stereotaxic targets', async () => {
    await putSample({ id: 'sm1', experimentId: 'run-a', format: '96', wells: { A1: { sampleId: 's-1', label: 'WT', group: 'ctrl' } } }, db);
    expect((await listSamples('run-a', db))[0].wells.A1.label).toBe('WT');
    await deleteSample('sm1', db);
    expect(await listSamples(undefined, db)).toEqual([]);

    await putGlossaryTerm({ id: 'g2', term: 'Zeta', definition: 'z', createdAt: 1, updatedAt: 1 }, db);
    await putGlossaryTerm({ id: 'g1', term: 'Alpha', definition: 'a', createdAt: 1, updatedAt: 1 }, db);
    expect((await listGlossary(db)).map((t) => t.term)).toEqual(['Alpha', 'Zeta']);
    await deleteGlossaryTerm('g1', db);
    expect((await listGlossary(db)).length).toBe(1);

    await putExplanation({ templateStepId: 'tpl-step-1', why: 'Why', mistakes: ['Too hot'], links: [{ title: 'Paper', url: 'https://example.org' }] }, db);
    expect(await getExplanation('tpl-step-1', db)).toMatchObject({ mistakes: ['Too hot'] });
    await deleteExplanation('tpl-step-1', db);
    expect(await getExplanation('tpl-step-1', db)).toBeUndefined();

    await putComment({ id: 'cm1', targetType: 'step', targetId: 's1', author: 'me', text: 'Check', createdAt: 2, resolved: false }, db);
    await putComment({ id: 'cm0', targetType: 'step', targetId: 's1', author: 'me', text: 'First', createdAt: 1, resolved: false }, db);
    await putComment({ id: 'cm2', targetType: 'template', targetId: 's1', author: 'me', text: 'Other', createdAt: 0, resolved: true }, db);
    expect((await listComments({ targetType: 'step', targetId: 's1' }, db)).map((c) => c.id)).toEqual(['cm0', 'cm1']);
    await deleteComment('cm2', db);
    expect((await listComments(undefined, db)).length).toBe(2);

    const snapshot = { id: 'tpl', title: 'T', category: 'C', steps: [], hazards: [], createdAt: 1, updatedAt: 1 };
    await putProtocolVersion({ id: 'pv2', templateId: 'tpl', version: 2, snapshot, createdAt: 2 }, db);
    await putProtocolVersion({ id: 'pv1', templateId: 'tpl', version: 1, snapshot, createdAt: 1, note: 'first' }, db);
    expect((await listProtocolVersions('tpl', db)).map((v) => v.version)).toEqual([1, 2]);
    await deleteProtocolVersion('pv1', db);
    expect((await listProtocolVersions(undefined, db)).length).toBe(1);

    await putStereotaxTarget({ id: 'st2', name: 'VTA', atlas: 'Paxinos 5th', ap: -3.2, ml: 0.5, dv: -4.3 }, db);
    await putStereotaxTarget({ id: 'st1', name: 'CA1', atlas: 'Paxinos 5th', ap: -2, ml: 1.4, dv: -1.5, angle: 0 }, db);
    expect((await listStereotaxTargets(db)).map((t) => t.name)).toEqual(['CA1', 'VTA']);
    await deleteStereotaxTarget('st1', db);
    expect((await listStereotaxTargets(db)).length).toBe(1);
  });

  it('removes unset keys when settings are merged, and deleting settings restores defaults', async () => {
    await putSettings({ apiKey: 'sk-test-local', onboardedAt: 10 }, db);
    await putSettings({ apiKey: undefined }, db);
    const settings = await getSettings(db);
    expect(settings.apiKey).toBeUndefined();
    expect(settings.onboardedAt).toBe(10);

    await deleteSettings(db);
    expect(await getSettings(db)).toMatchObject({ onboardedAt: undefined, mode: 'beginner' });
  });
});
