import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from './index';
import {
  createInventoryItem,
  deleteInventoryItem,
  getInventoryItem,
  linkInventoryUsage,
  listInventoryItems,
  listInventoryUsageForExperiment,
  listLinkedInventoryItems,
  unlinkInventoryUsage,
  updateInventoryItem,
} from './inventory';

let database: LabCompanionDB;

beforeEach(async () => {
  database = new LabCompanionDB(`test-${crypto.randomUUID()}`);
  await database.open();
});

describe('inventory items', () => {
  it('creates an item with trimmed fields and drops blanks', async () => {
    const item = await createInventoryItem(
      { name: '  Rabbit anti-GFAP ', kind: 'antibody', lotNumber: ' 12345 ', vendor: '  ', reactivity: ['human', ' '] },
      database,
    );
    const stored = await getInventoryItem(item.id, database);
    expect(stored).toMatchObject({ name: 'Rabbit anti-GFAP', lotNumber: '12345', reactivity: ['human'] });
    expect(stored?.vendor).toBeUndefined();
    expect(stored?.createdAt).toBeTypeOf('number');
  });

  it('updates fields, keeps createdAt, and bumps updatedAt', async () => {
    const item = await createInventoryItem({ name: 'PBS', kind: 'buffer' }, database);
    await new Promise((r) => setTimeout(r, 5));
    await updateInventoryItem(item.id, { name: 'PBS 10X', kind: 'buffer', expiresOn: '2027-01-01' }, database);
    const stored = await getInventoryItem(item.id, database);
    expect(stored).toMatchObject({ name: 'PBS 10X', expiresOn: '2027-01-01', createdAt: item.createdAt });
    expect(stored!.updatedAt).toBeGreaterThan(item.updatedAt);
  });

  it('throws when updating a missing item', async () => {
    await expect(updateInventoryItem('nope', { name: 'x', kind: 'reagent' }, database)).rejects.toThrow('not found');
  });

  it('lists items sorted by kind then name, optionally filtered by kind', async () => {
    await createInventoryItem({ name: 'Zeta', kind: 'reagent' }, database);
    await createInventoryItem({ name: 'Alpha', kind: 'antibody' }, database);
    await createInventoryItem({ name: 'Beta', kind: 'antibody' }, database);
    expect((await listInventoryItems(undefined, database)).map((i) => i.name)).toEqual(['Alpha', 'Beta', 'Zeta']);
    expect((await listInventoryItems('reagent', database)).map((i) => i.name)).toEqual(['Zeta']);
  });

  it('deletes an item and every run link to it', async () => {
    const item = await createInventoryItem({ name: 'Goat anti-rabbit', kind: 'antibody' }, database);
    await linkInventoryUsage('exp-1', item.id, 's1', database);
    await linkInventoryUsage('exp-2', item.id, '', database);
    await deleteInventoryItem(item.id, database);
    expect(await getInventoryItem(item.id, database)).toBeUndefined();
    expect(await listInventoryUsageForExperiment('exp-1', database)).toEqual([]);
    expect(await listInventoryUsageForExperiment('exp-2', database)).toEqual([]);
  });
});

describe('inventory usage', () => {
  it('links an item to a run once per step', async () => {
    const item = await createInventoryItem({ name: 'PBS', kind: 'buffer' }, database);
    await linkInventoryUsage('exp-1', item.id, '', database);
    await linkInventoryUsage('exp-1', item.id, '', database);
    await linkInventoryUsage('exp-1', item.id, 's2', database);
    const usages = await listInventoryUsageForExperiment('exp-1', database);
    expect(usages.map((u) => u.stepId).sort()).toEqual(['', 's2']);
    expect(usages[0]).toMatchObject({ experimentId: 'exp-1', inventoryItemId: item.id });
  });

  it('unlinks an item from a run', async () => {
    const item = await createInventoryItem({ name: 'PBS', kind: 'buffer' }, database);
    await linkInventoryUsage('exp-1', item.id, '', database);
    await unlinkInventoryUsage('exp-1', item.id, '', database);
    expect(await listInventoryUsageForExperiment('exp-1', database)).toEqual([]);
  });

  it('keeps usage for other runs separate', async () => {
    const item = await createInventoryItem({ name: 'PBS', kind: 'buffer' }, database);
    await linkInventoryUsage('exp-1', item.id, '', database);
    await linkInventoryUsage('exp-2', item.id, '', database);
    expect(await listInventoryUsageForExperiment('exp-1', database)).toHaveLength(1);
    expect(await listInventoryUsageForExperiment('exp-2', database)).toHaveLength(1);
  });

  it('lists linked items for a run and skips links to deleted items', async () => {
    const a = await createInventoryItem({ name: 'A', kind: 'reagent' }, database);
    const b = await createInventoryItem({ name: 'B', kind: 'reagent' }, database);
    await linkInventoryUsage('exp-1', a.id, '', database);
    await linkInventoryUsage('exp-1', b.id, 's1', database);
    await database.inventory.delete(b.id);
    const linked = await listLinkedInventoryItems('exp-1', database);
    expect(linked.map((i) => i.name)).toEqual(['A']);
  });
});
