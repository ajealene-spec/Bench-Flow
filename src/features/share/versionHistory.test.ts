import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from '../../db';
import { createTemplate, updateTemplate } from '../../db/templates';
import { listProtocolVersions } from '../../db/protocolVersions';
import { addComment } from './comments';
import { importBenchflowPayload, copyWithCredit } from './library';
import { buildBenchflowPayload, parseBenchflowText, serializeBenchflow } from './benchflowFile';
import { restoreVersion, saveVersionWithNote, snapshotIfChanged } from './versionHistory';
import { listComments } from '../../db/comments';
import type { Step } from '../../types';

let database: LabCompanionDB;

beforeEach(() => {
  database = new LabCompanionDB(`test-history-${crypto.randomUUID()}`);
});

afterEach(() => {
  database.close();
});

function step(id: string, title: string, instructions = ''): Step {
  return { id, title, instructions, timers: [], reagents: [], dataFields: [], cautions: [] };
}

describe('version on change', () => {
  it('writes version 1 for a new template, then only when content changes', async () => {
    const tpl = await createTemplate({ title: 'PCR', steps: [step('a', 'Mix')] }, database);
    const first = await snapshotIfChanged(tpl.id, { database });
    expect(first?.version).toBe(1);

    expect(await snapshotIfChanged(tpl.id, { database })).toBeNull();

    await updateTemplate(tpl.id, { title: 'PCR (v2)' }, database);
    const second = await snapshotIfChanged(tpl.id, { database, note: 'Renamed' });
    expect(second?.version).toBe(2);
    expect(second?.note).toBe('Renamed');

    const versions = await listProtocolVersions(tpl.id, database);
    expect(versions.map((v) => v.version)).toEqual([1, 2]);
    expect(versions[1].snapshot.title).toBe('PCR (v2)');
  });

  it('ignores timestamp-only changes', async () => {
    const tpl = await createTemplate({ title: 'Stable', steps: [step('a', 'Mix')] }, database);
    await snapshotIfChanged(tpl.id, { database });
    await updateTemplate(tpl.id, { title: 'Stable' }, database);
    expect(await snapshotIfChanged(tpl.id, { database })).toBeNull();
  });

  it('restores an older version as a new version and never removes history', async () => {
    const tpl = await createTemplate({ title: 'Blot', steps: [step('a', 'Block', 'milk')] }, database);
    const v1 = await snapshotIfChanged(tpl.id, { database });
    await updateTemplate(tpl.id, { steps: [step('a', 'Block', 'BSA')] }, database);
    await snapshotIfChanged(tpl.id, { database });

    const changed = await restoreVersion(tpl.id, v1!.id, database);
    expect(changed).toBe(true);
    const restored = await database.templates.get(tpl.id);
    expect(restored?.steps[0].instructions).toBe('milk');

    const versions = await listProtocolVersions(tpl.id, database);
    expect(versions).toHaveLength(3);
    expect(versions[2].note).toBe('Restored from version 1');
    expect(await restoreVersion(tpl.id, v1!.id, database)).toBe(false);
  });

  it('adds a note to the newest version when nothing changed', async () => {
    const tpl = await createTemplate({ title: 'Noted', steps: [] }, database);
    await snapshotIfChanged(tpl.id, { database });
    expect(await saveVersionWithNote(tpl.id, 'Checkpoint', database)).toBe('noted');
    const versions = await listProtocolVersions(tpl.id, database);
    expect(versions[0].note).toBe('Checkpoint');
  });
});

describe('export, import and copy with credit', () => {
  it('keeps authors, license and step comments through a file round trip with new ids', async () => {
    const tpl = await createTemplate({ title: 'Export me', steps: [step('s1', 'Lyse')] }, database);
    await updateTemplate(tpl.id, { steps: [step('s1', 'Lyse')] }, database);
    await database.templates.update(tpl.id, { authors: ['Dr. Lab'], license: 'CC0-1.0' });
    await addComment({ targetType: 'step', targetId: 's1', author: 'Pat', text: 'Use fresh lysis buffer' }, database);
    await addComment({ targetType: 'template', targetId: tpl.id, author: 'Me', text: 'Looks good' }, database);

    const source = (await database.templates.get(tpl.id))!;
    const comments = await listComments(undefined, database);
    const payload = buildBenchflowPayload({ template: source, version: 1, comments, exportedAt: 5 });
    const file = parseBenchflowText(serializeBenchflow(payload));

    const result = await importBenchflowPayload(file, database);
    expect(result.commentCount).toBe(2);
    const imported = (await database.templates.get(result.templateId))!;
    expect(imported.authors).toEqual(['Dr. Lab']);
    expect(imported.license).toBe('CC0-1.0');
    expect(imported.steps[0].id).not.toBe('s1');

    const importedComments = await listComments({ targetType: 'step', targetId: imported.steps[0].id }, database);
    expect(importedComments.map((c) => c.text)).toEqual(['Use fresh lysis buffer']);
    expect(await listComments({ targetType: 'template', targetId: result.templateId }, database)).toHaveLength(1);
  });

  it('copy with credit sets forkedFrom and does not copy comments', async () => {
    const tpl = await createTemplate({ title: 'Original', steps: [step('s1', 'Step')] }, database);
    await database.templates.update(tpl.id, { authors: ['Ana Lee', 'Ben Ko'], license: 'CC-BY-4.0' });
    const source = (await database.templates.get(tpl.id))!;
    await addComment({ targetType: 'template', targetId: tpl.id, author: 'Me', text: 'note' }, database);

    const payload = buildBenchflowPayload({ template: source, version: 2 });
    const copy = await copyWithCredit(payload, { sourceUrl: 'https://lab.example/shared#d=abc', database });
    const stored = (await database.templates.get(copy.id))!;
    expect(stored.forkedFrom).toEqual({
      title: 'Original',
      author: 'Ana Lee, Ben Ko',
      url: 'https://lab.example/shared#d=abc',
      doi: undefined,
    });
    expect(stored.authors).toEqual([]);
    expect(stored.license).toBe('CC-BY-4.0');
    expect(await listComments({ targetType: 'template', targetId: copy.id }, database)).toHaveLength(0);
  });
});
