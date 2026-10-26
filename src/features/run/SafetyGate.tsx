import type { SafetyChecklistItem } from '../../types';
import { allChecked } from './safety';

interface SafetyGateProps {
  items: SafetyChecklistItem[];
  onToggle: (itemId: string, checked: boolean) => void;
  onConfirm: () => void;
}

/** Mandatory safety & PPE checklist. Steps stay hidden until every item is checked and confirmed. */
export function SafetyGate({ items, onToggle, onConfirm }: SafetyGateProps) {
  const checkedCount = items.filter((i) => i.checked).length;
  const ready = allChecked(items);

  return (
    <section
      aria-labelledby="safety-gate-title"
      className="flex flex-col gap-5 rounded-2xl border-2 border-border bg-surface-2 p-5 sm:p-8"
    >
      <div className="flex flex-col gap-2">
        <h2 id="safety-gate-title" className="text-3xl font-bold leading-tight">
          Safety &amp; PPE checklist
        </h2>
        <p className="text-lg text-text">
          Check every item before the first step unlocks. {checkedCount} of {items.length} checked.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.itemId}>
            <label className="flex min-h-14 cursor-pointer items-center gap-4 rounded-xl bg-surface px-4 py-3 text-lg font-medium">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => onToggle(item.itemId, e.target.checked)}
                className="h-12 w-12 shrink-0 cursor-pointer accent-accent"
              />
              <span>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={!ready}
        onClick={onConfirm}
        className="min-h-16 rounded-2xl bg-accent px-5 text-lg font-semibold text-on-accent active:opacity-80 disabled:opacity-40"
      >
        Confirm and begin
      </button>
    </section>
  );
}

/** Collapsed summary shown above the steps after confirmation. */
export function SafetySummary({ items }: { items: SafetyChecklistItem[] }) {
  return (
    <details className="rounded-xl border border-border bg-surface-2 px-4 py-3">
      <summary className="min-h-12 cursor-pointer text-lg font-semibold text-text">Safety ✓</summary>
      <ul className="mt-3 flex list-disc flex-col gap-1 pl-6 text-base text-text">
        {items.map((item) => (
          <li key={item.itemId}>{item.label}</li>
        ))}
      </ul>
    </details>
  );
}
