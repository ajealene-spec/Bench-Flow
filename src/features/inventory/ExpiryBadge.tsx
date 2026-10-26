import type { InventoryItem } from '../../types';
import { expiryStatus } from './expiry';

/** Red for expired, amber for expiring within the window, plain for later or no date. */
export function ExpiryBadge({ item, today, days = 30 }: { item: Pick<InventoryItem, 'expiresOn'>; today: Date | string; days?: number }) {
  const status = expiryStatus(item, today, days);
  if (status === 'none') return null;
  const tone =
    status === 'expired'
      ? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'
      : status === 'expiring'
        ?'bg-surface-2 text-text'
        :'bg-surface-2 text-text-muted';
  const label = status === 'expired' ? 'Expired' : status === 'expiring' ? 'Expiring' : 'Expires';
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${tone}`}>
      {label} {item.expiresOn}
    </span>
  );
}
