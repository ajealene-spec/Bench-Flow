import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { createInventoryItem, deleteInventoryItem, listInventoryItems } from '../../db/inventory';
import { listTemplates } from '../../db/templates';
import type { InventoryItem, InventoryKind } from '../../types';
import { BUTTON_LINK, BUTTON_PRIMARY, BUTTON_SECONDARY, FIELD_INPUT } from '../data/fieldStyles';
import { ExpiryBadge } from './ExpiryBadge';
import { InventoryForm } from './InventoryForm';
import { expiringItems } from './expiry';
import { extractReagents, toInventoryInput, type ExtractedReagent } from './extractReagents';
import { EmptyState } from '../../app/EmptyState';

const KIND_LABELS: Record<InventoryKind, string> = { antibody: 'Antibody', reagent: 'Reagent', buffer: 'Buffer', kit: 'Kit' };

type KindFilter = 'all' | InventoryKind;

function matchesQuery(item: InventoryItem, query: string): boolean {
  if (!query) return true;
  const haystack = [item.name, item.vendor, item.catalogNumber, item.lotNumber, item.target, item.hostSpecies, item.conjugate]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

/** Inventory list with search, kind filter, expiry badges, add/edit/delete, and import from a protocol. */
export default function InventoryPage() {
  const items = useLiveQuery(() => listInventoryItems(undefined, db), [], []);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [editing, setEditing] = useState<InventoryItem | 'new' | null>(null);
  const [showImport, setShowImport] = useState(false);
  const today = new Date();

  const filtered = useMemo(
    () =>
      items.filter((item) => (kind === 'all' || item.kind === kind) && matchesQuery(item, query.trim().toLowerCase())),
    [items, kind, query],
  );
  const { expired, expiringSoon } = expiringItems(items, today);

  async function handleDelete(item: InventoryItem) {
    if (!window.confirm(`Delete ${item.name}? It will also be unlinked from any runs.`)) return;
    await deleteInventoryItem(item.id, db);
  }

  if (editing !== null) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4">
        <InventoryForm item={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={BUTTON_PRIMARY} onClick={() => setEditing('new')}>
            Add item
          </button>
          <button type="button" className={BUTTON_SECONDARY} onClick={() => setShowImport((s) => !s)} aria-expanded={showImport}>
            Import from protocol
          </button>
        </div>
      </header>

      {(expired.length > 0 || expiringSoon.length > 0) && (
        <section aria-label="Expiry summary" className="flex flex-col gap-1 rounded-2xl border border-border p-4 text-base">
          {expired.length > 0 && <p className="text-red-700 dark:text-red-300">{expired.length} expired</p>}
          {expiringSoon.length > 0 && <p className="text-text-muted">{expiringSoon.length} expiring in the next 30 days</p>}
        </section>
      )}

      {showImport && <ImportFromProtocol existing={items} />}

      <div className="flex flex-col gap-3 md:flex-row">
        <input
          type="search"
          aria-label="Search inventory"
          placeholder="Search name, lot, target, vendor"
          className={FIELD_INPUT}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select aria-label="Filter by kind" className={`${FIELD_INPUT} md:w-56`} value={kind} onChange={(e) => setKind(e.target.value as KindFilter)}>
          <option value="all">All kinds</option>
          {(Object.keys(KIND_LABELS) as InventoryKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No reagents or antibodies yet"
          primary={{ label: 'Add item', onClick: () => setEditing('new') }}
          secondary={{ label: 'Import from protocol', onClick: () => setShowImport(true) }}
        >
          Keep lots, expiry dates and antibody host species in one place. Add an item by hand, or import the reagents a protocol lists.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <p className="text-base text-text-muted">Nothing matches that search.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold">{item.name}</span>
                <span className="rounded-full bg-surface-2 px-3 py-1 text-sm">{KIND_LABELS[item.kind]}</span>
                <ExpiryBadge item={item} today={today} />
              </div>
              <p className="text-base text-text-muted">
                {[item.lotNumber && `Lot ${item.lotNumber}`, item.catalogNumber && `Cat ${item.catalogNumber}`, item.stockDilution, item.location]
                  .filter(Boolean)
                  .join(' · ') || 'No lot or catalog recorded'}
              </p>
              <div className="flex gap-2">
                <button type="button" className={BUTTON_LINK} onClick={() => setEditing(item)}>
                  Edit
                </button>
                <button type="button" className={BUTTON_LINK} onClick={() => handleDelete(item)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/** Lists reagents extracted from a chosen protocol. Each one can be added to the inventory in one tap. */
function ImportFromProtocol({ existing }: { existing: InventoryItem[] }) {
  const templates = useLiveQuery(() => listTemplates(db), [], []);
  const [templateId, setTemplateId] = useState('');
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const template = templates.find((t) => t.id === templateId);
  const extracted = useMemo(() => (template ? extractReagents(template.steps) : []), [template]);
  const existingNames = new Set(existing.map((i) => i.name.toLowerCase()));

  async function handleAdd(item: ExtractedReagent) {
    setError(null);
    try {
      await createInventoryItem(toInventoryInput(item), db);
      setAdded((prev) => new Set(prev).add(item.name.toLowerCase()));
    } catch {
      setError(`Could not add ${item.name}.`);
    }
  }

  return (
    <section aria-label="Import from protocol" className="flex flex-col gap-4 rounded-2xl border border-border p-4">
      <label className="flex flex-col gap-1 text-base font-medium">
        Protocol
        <select className={FIELD_INPUT} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          <option value="">Choose a protocol</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </label>

      {template && extracted.length === 0 && <p className="text-base text-text-muted">No reagents found in this protocol.</p>}

      {extracted.length > 0 && (
        <ul className="flex flex-col gap-2">
          {extracted.map((item) => {
            const key = item.name.toLowerCase();
            const inInventory = existingNames.has(key) || added.has(key);
            const details = [item.hostSpecies && `host ${item.hostSpecies}`, item.target && `target ${item.target}`, item.conjugate, item.stockDilution, item.concentration]
              .filter(Boolean)
              .join(' · ');
            return (
              <li key={key + item.kind} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="flex flex-col">
                  <span className="text-base font-medium">{item.name}</span>
                  <span className="text-sm text-text-muted">
                    {KIND_LABELS[item.kind]}
                    {details ? ` · ${details}` : ''}
                  </span>
                </div>
                <button type="button" className={BUTTON_SECONDARY} disabled={inInventory} onClick={() => handleAdd(item)}>
                  {inInventory ? 'In inventory' : 'Add to inventory'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-base text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
