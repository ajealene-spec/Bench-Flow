import { db as defaultDb, type LabCompanionDB } from './index';
import type { InventoryItem, InventoryKind, ReagentUsage } from '../types';

export type InventoryInput = Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>;

function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Trims text fields and drops blanks so stored items never carry empty strings. */
function cleanInput(input: InventoryInput): InventoryInput {
  const reactivity = (input.reactivity ?? []).map((r) => r.trim()).filter(Boolean);
  return {
    name: input.name.trim(),
    kind: input.kind,
    vendor: blankToUndefined(input.vendor),
    catalogNumber: blankToUndefined(input.catalogNumber),
    lotNumber: blankToUndefined(input.lotNumber),
    concentration: blankToUndefined(input.concentration),
    stockDilution: blankToUndefined(input.stockDilution),
    hostSpecies: blankToUndefined(input.hostSpecies),
    target: blankToUndefined(input.target),
    conjugate: blankToUndefined(input.conjugate),
    isotype: blankToUndefined(input.isotype),
    reactivity: reactivity.length > 0 ? reactivity : undefined,
    expiresOn: blankToUndefined(input.expiresOn),
    location: blankToUndefined(input.location),
    quantity: blankToUndefined(input.quantity),
    rrid: blankToUndefined(input.rrid),
    notes: blankToUndefined(input.notes),
  };
}

export async function createInventoryItem(
  input: InventoryInput,
  database: LabCompanionDB = defaultDb,
): Promise<InventoryItem> {
  const now = Date.now();
  const item: InventoryItem = { id: crypto.randomUUID(), ...cleanInput(input), createdAt: now, updatedAt: now };
  await database.inventory.add(item);
  return item;
}

export async function updateInventoryItem(
  id: string,
  input: InventoryInput,
  database: LabCompanionDB = defaultDb,
): Promise<void> {
  const existing = await database.inventory.get(id);
  if (!existing) throw new Error(`Inventory item ${id} not found`);
  await database.inventory.put({ ...existing, ...cleanInput(input), updatedAt: Date.now() });
}

/** Deletes an item and every run link to it. */
export async function deleteInventoryItem(id: string, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.transaction('rw', database.inventory, database.inventoryUsage, async () => {
    await database.inventoryUsage.where('inventoryItemId').equals(id).delete();
    await database.inventory.delete(id);
  });
}

/** All items sorted by kind, then name. An optional kind narrows the result. */
export async function listInventoryItems(
  kind?: InventoryKind,
  database: LabCompanionDB = defaultDb,
): Promise<InventoryItem[]> {
  const items = kind ? await database.inventory.where('kind').equals(kind).toArray() : await database.inventory.toArray();
  return items.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

export function getInventoryItem(id: string, database: LabCompanionDB = defaultDb): Promise<InventoryItem | undefined> {
  return database.inventory.get(id);
}

/** Links an item to a run (optionally a step). Linking the same item twice is a no-op. */
export async function linkInventoryUsage(
  experimentId: string,
  inventoryItemId: string,
  stepId = '',
  database: LabCompanionDB = defaultDb,
): Promise<void> {
  const existing = await database.inventoryUsage.get([experimentId, inventoryItemId, stepId]);
  if (existing) return;
  await database.inventoryUsage.add({ experimentId, inventoryItemId, stepId, usedAt: Date.now() });
}

export async function unlinkInventoryUsage(
  experimentId: string,
  inventoryItemId: string,
  stepId = '',
  database: LabCompanionDB = defaultDb,
): Promise<void> {
  await database.inventoryUsage.delete([experimentId, inventoryItemId, stepId]);
}

export function listInventoryUsageForExperiment(
  experimentId: string,
  database: LabCompanionDB = defaultDb,
): Promise<ReagentUsage[]> {
  return database.inventoryUsage.where('experimentId').equals(experimentId).sortBy('usedAt');
}

/** Items linked to a run, resolved to their inventory records. Links to deleted items are skipped. */
export async function listLinkedInventoryItems(
  experimentId: string,
  database: LabCompanionDB = defaultDb,
): Promise<InventoryItem[]> {
  const usages = await listInventoryUsageForExperiment(experimentId, database);
  const ids = [...new Set(usages.map((u) => u.inventoryItemId))];
  const items = await database.inventory.bulkGet(ids);
  return items.filter((item): item is InventoryItem => item !== undefined);
}
