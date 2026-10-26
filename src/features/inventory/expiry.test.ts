import { describe, expect, it } from 'vitest';
import type { InventoryItem } from '../../types';
import { expiringItems, expiryStatus, toIsoDate } from './expiry';

const item = (id: string, expiresOn?: string): InventoryItem => ({
  id,
  name: id,
  kind: 'reagent',
  expiresOn,
  createdAt: 0,
  updatedAt: 0,
});

const TODAY = '2026-10-26';

describe('expiringItems', () => {
  it('splits expired from expiring-soon and sorts each by date', () => {
    const items = [
      item('late', '2026-11-20'),
      item('old', '2026-10-01'),
      item('soon', '2026-11-01'),
      item('far', '2027-03-01'),
      item('older', '2026-09-15'),
    ];
    const result = expiringItems(items, TODAY);
    expect(result.expired.map((i) => i.id)).toEqual(['older', 'old']);
    expect(result.expiringSoon.map((i) => i.id)).toEqual(['soon', 'late']);
  });

  it('counts an item expiring exactly on the window edge as expiring soon', () => {
    // 2026-10-26 plus 30 days is 2026-11-25.
    expect(expiringItems([item('edge', '2026-11-25')], TODAY).expiringSoon).toHaveLength(1);
    expect(expiringItems([item('past', '2026-11-26')], TODAY).expiringSoon).toHaveLength(0);
  });

  it('treats an item expiring today as expiring, not expired', () => {
    const result = expiringItems([item('today', TODAY)], TODAY);
    expect(result.expired).toEqual([]);
    expect(result.expiringSoon).toHaveLength(1);
  });

  it('respects a custom window', () => {
    expect(expiringItems([item('a', '2026-11-05')], TODAY, 7).expiringSoon).toHaveLength(0);
    expect(expiringItems([item('a', '2026-11-05')], TODAY, 14).expiringSoon).toHaveLength(1);
  });

  it('ignores items with no or invalid expiry', () => {
    expect(expiringItems([item('none'), item('bad', '26/10/2026')], TODAY)).toEqual({ expired: [], expiringSoon: [] });
  });

  it('accepts a Date for today', () => {
    expect(expiringItems([item('x', '2026-10-01')], new Date(2026, 9, 26)).expired).toHaveLength(1);
  });
});

describe('expiryStatus and toIsoDate', () => {
  it('gives one status per item', () => {
    expect(expiryStatus(item('a', '2026-10-01'), TODAY)).toBe('expired');
    expect(expiryStatus(item('b', '2026-10-30'), TODAY)).toBe('expiring');
    expect(expiryStatus(item('c', '2027-01-01'), TODAY)).toBe('ok');
    expect(expiryStatus(item('d'), TODAY)).toBe('none');
  });

  it('formats a local date as YYYY-MM-DD', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
