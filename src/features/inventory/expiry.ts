import type { InventoryItem } from '../../types';

export type ExpiryStatus = 'expired' | 'expiring' | 'ok' | 'none';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Local calendar date as YYYY-MM-DD. */
export function toIsoDate(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function resolveToday(today: Date | string): string {
  return typeof today === 'string' ? today : toIsoDate(today);
}

/** Expiry status of one item. Items with no valid expiry date are "none". */
export function expiryStatus(item: Pick<InventoryItem, 'expiresOn'>, today: Date | string, days = 30): ExpiryStatus {
  if (!item.expiresOn || !ISO_DATE.test(item.expiresOn)) return 'none';
  const now = resolveToday(today);
  if (item.expiresOn < now) return 'expired';
  if (item.expiresOn <= addDays(now, days)) return 'expiring';
  return 'ok';
}

/**
 * Items already expired, and items that expire within `days` days from today (inclusive). Both
 * lists are sorted by expiry date, earliest first.
 */
export function expiringItems(
  items: InventoryItem[],
  today: Date | string,
  days = 30,
): { expired: InventoryItem[]; expiringSoon: InventoryItem[] } {
  const byDate = (a: InventoryItem, b: InventoryItem) => (a.expiresOn ?? '').localeCompare(b.expiresOn ?? '');
  const expired: InventoryItem[] = [];
  const expiringSoon: InventoryItem[] = [];
  for (const item of items) {
    const status = expiryStatus(item, today, days);
    if (status === 'expired') expired.push(item);
    else if (status === 'expiring') expiringSoon.push(item);
  }
  return { expired: expired.sort(byDate), expiringSoon: expiringSoon.sort(byDate) };
}
