import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { linkInventoryUsage, listInventoryItems, listLinkedInventoryItems, unlinkInventoryUsage } from '../../db/inventory';
import { BUTTON_LINK, BUTTON_SECONDARY, FIELD_INPUT } from '../data/fieldStyles';
import { checkCrossReactivity, type CrossReactivityOptions } from './crossReactivity';
import { ExpiryBadge } from './ExpiryBadge';
import { expiringItems } from './expiry';

/**
 * Links inventory items and lots used in this run. Links are run-level (no step). Cross-reactivity
 * and expiry warnings for the linked items are shown inline. Tissue species and blocking serum can
 * be set in the panel; the props only give their starting values.
 */
export function ExperimentReagentsPanel({
  experimentId,
  multiplex = false,
  tissueSpecies: initialTissue,
  blockingSerum: initialSerum,
}: { experimentId: string } & CrossReactivityOptions) {
  const linked = useLiveQuery(() => listLinkedInventoryItems(experimentId, db), [experimentId], []);
  const all = useLiveQuery(() => listInventoryItems(undefined, db), [], []);
  const [choice, setChoice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tissueSpecies, setTissueSpecies] = useState(initialTissue ?? '');
  const [blockingSerum, setBlockingSerum] = useState(initialSerum ?? '');
  const today = new Date();

  const linkedIds = new Set(linked.map((i) => i.id));
  const available = all.filter((i) => !linkedIds.has(i.id));
  const warnings = checkCrossReactivity(linked, {
    multiplex,
    tissueSpecies: tissueSpecies.trim() || undefined,
    blockingSerum: blockingSerum.trim() || undefined,
  });
  const { expired, expiringSoon } = expiringItems(linked, today);

  async function handleLink() {
    if (!choice) return;
    setError(null);
    try {
      await linkInventoryUsage(experimentId, choice, '', db);
      setChoice('');
    } catch {
      setError('Could not link that item.');
    }
  }

  async function handleUnlink(itemId: string) {
    setError(null);
    try {
      await unlinkInventoryUsage(experimentId, itemId, '', db);
    } catch {
      setError('Could not remove that item.');
    }
  }

  return (
    <section aria-label="Reagents used in this run" className="flex flex-col gap-4 rounded-2xl border border-border p-4">
      <h2 className="text-lg font-semibold">Reagents and lots used</h2>

      {linked.length === 0 ? (
        <p className="text-base text-text-muted">No inventory items linked to this run yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {linked.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-medium">{item.name}</span>
                {item.lotNumber && <span className="text-sm text-text-muted">Lot {item.lotNumber}</span>}
                <ExpiryBadge item={item} today={today} />
              </div>
              <button type="button" className={BUTTON_LINK} onClick={() => handleUnlink(item.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <div className="flex flex-col gap-3 md:flex-row">
          <label className="flex flex-1 flex-col gap-1 text-base font-medium">
            Link an item
            <select className={FIELD_INPUT} value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="">Choose an item</option>
              {available.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.lotNumber ? ` (lot ${item.lotNumber})` : ''}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={`${BUTTON_SECONDARY} md:self-end`} disabled={!choice} onClick={handleLink}>
            Link to run
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row">
        <label className="flex flex-1 flex-col gap-1 text-base font-medium">
          Tissue species (optional)
          <input
            className={FIELD_INPUT}
            placeholder="e.g. mouse"
            value={tissueSpecies}
            onChange={(e) => setTissueSpecies(e.target.value)}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-base font-medium">
          Blocking serum species (optional)
          <input
            className={FIELD_INPUT}
            placeholder="e.g. goat"
            value={blockingSerum}
            onChange={(e) => setBlockingSerum(e.target.value)}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-base text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {(expired.length > 0 || expiringSoon.length > 0) && (
        <ul aria-label="Expiry warnings" className="flex flex-col gap-2 text-base">
          {expired.map((item) => (
            <li key={`expired-${item.id}`} className="text-red-700 dark:text-red-300">
              {item.name} expired on {item.expiresOn}. Check it before using it.
            </li>
          ))}
          {expiringSoon.map((item) => (
            <li key={`soon-${item.id}`} className="text-text-muted">
              {item.name} expires on {item.expiresOn}.
            </li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && (
        <ul aria-label="Cross-reactivity warnings" className="flex flex-col gap-2 text-base">
          {warnings.map((w, index) => (
            <li
              key={`${w.code}-${index}`}
              className={
                w.severity === 'warning'
                  ?'rounded-xl bg-surface-2 p-3 text-text'
                  :'rounded-xl bg-surface-2 p-3 text-accent-text'
              }
            >
              <span className="font-semibold">{w.severity === 'warning' ? 'Warning: ' : 'Suggestion: '}</span>
              {w.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
