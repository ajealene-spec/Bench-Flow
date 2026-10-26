import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { LabCompanionDB } from '../../db';
import { createTemplate, updateTemplate } from '../../db/templates';
import { listProtocolVersions } from '../../db/protocolVersions';
import { installVersionHistory, SNAPSHOT_DEBOUNCE_MS } from './versionHistory';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('version history hooks', () => {
  it('snapshots after a debounced save and skips saves that change nothing', async () => {
    const database = new LabCompanionDB(`test-hook-${crypto.randomUUID()}`);
    installVersionHistory(database);
    try {
      const tpl = await createTemplate({ title: 'Hooked', steps: [] }, database);
      await wait(SNAPSHOT_DEBOUNCE_MS + 300);
      expect((await listProtocolVersions(tpl.id, database)).map((v) => v.version)).toEqual([1]);

      // Two quick saves collapse into one new version.
      await updateTemplate(tpl.id, { title: 'Hooked 2' }, database);
      await updateTemplate(tpl.id, { title: 'Hooked 3' }, database);
      await wait(SNAPSHOT_DEBOUNCE_MS + 300);
      const versions = await listProtocolVersions(tpl.id, database);
      expect(versions.map((v) => v.version)).toEqual([1, 2]);
      expect(versions[1].snapshot.title).toBe('Hooked 3');

      // A save with the same content writes nothing.
      await updateTemplate(tpl.id, { title: 'Hooked 3' }, database);
      await wait(SNAPSHOT_DEBOUNCE_MS + 300);
      expect(await listProtocolVersions(tpl.id, database)).toHaveLength(2);
    } finally {
      database.close();
    }
  }, 10000);
});
