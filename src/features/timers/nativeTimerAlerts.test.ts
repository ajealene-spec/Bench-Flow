import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({ on: false }));
const notif = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  schedule: vi.fn(),
  cancel: vi.fn(),
}));
const haptics = vi.hoisted(() => ({ notification: vi.fn() }));

vi.mock('../../app/apiBase', () => ({ isNativeApp: () => native.on }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: notif }));
vi.mock('@capacitor/haptics', () => ({
  Haptics: haptics,
  NotificationType: { Success: 'SUCCESS' },
}));

import {
  cancelNativeTimerAlert,
  hapticTimerDone,
  notificationIdFor,
  scheduleNativeTimerAlert,
} from './nativeTimerAlerts';

describe('native timer alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    native.on = true;
    notif.checkPermissions.mockResolvedValue({ display: 'prompt' });
    notif.requestPermissions.mockResolvedValue({ display: 'granted' });
    notif.cancel.mockResolvedValue(undefined);
    notif.schedule.mockResolvedValue(undefined);
  });

  it('does nothing on the web', async () => {
    native.on = false;
    await scheduleNativeTimerAlert({ id: 't1', label: 'Wash' }, Date.now() + 60_000);
    await cancelNativeTimerAlert('t1');
    await hapticTimerDone();
    expect(notif.schedule).not.toHaveBeenCalled();
    expect(notif.cancel).not.toHaveBeenCalled();
    expect(haptics.notification).not.toHaveBeenCalled();
  });

  it('asks for permission the first time and schedules at the end time', async () => {
    const endsAt = Date.now() + 60_000;
    await scheduleNativeTimerAlert({ id: 't1', label: 'Wash' }, endsAt);
    expect(notif.requestPermissions).toHaveBeenCalledTimes(1);
    const sent = notif.schedule.mock.calls[0][0].notifications[0];
    expect(sent.id).toBe(notificationIdFor('t1'));
    expect(sent.title).toBe('Wash done');
    expect(sent.schedule.at.getTime()).toBe(endsAt);
  });

  it('does not schedule when permission is denied, and never re-asks', async () => {
    notif.checkPermissions.mockResolvedValue({ display: 'denied' });
    await scheduleNativeTimerAlert({ id: 't1', label: 'Wash' }, Date.now() + 60_000);
    expect(notif.requestPermissions).not.toHaveBeenCalled();
    expect(notif.schedule).not.toHaveBeenCalled();
  });

  it('skips timers that already ended', async () => {
    await scheduleNativeTimerAlert({ id: 't1', label: 'Wash' }, Date.now() - 1);
    expect(notif.schedule).not.toHaveBeenCalled();
  });

  it('cancels by the same stable id', async () => {
    await cancelNativeTimerAlert('t1');
    expect(notif.cancel).toHaveBeenCalledWith({ notifications: [{ id: notificationIdFor('t1') }] });
  });

  it('gives the same id for the same timer and a positive Int32 otherwise', () => {
    expect(notificationIdFor('abc')).toBe(notificationIdFor('abc'));
    const id = notificationIdFor('some-longer-timer-id-123');
    expect(id).toBeGreaterThan(0);
    expect(id).toBeLessThanOrEqual(2147483647);
  });

  it('fires a success haptic on completion', async () => {
    await hapticTimerDone();
    expect(haptics.notification).toHaveBeenCalledWith({ type: 'SUCCESS' });
  });
});
