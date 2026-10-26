import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { isNativeApp } from '../../app/apiBase';

/*
 * Native-only timer alerts. A local notification is scheduled for the end time so the alarm still
 * fires with the app in the background. Haptics fire when a timer completes in the foreground.
 * Everything here is a no-op on the web, where the Web Audio and Notification alarms run instead.
 */

/** Stable Int32 id for a timer row, so a timer can be cancelled later. iOS requires a number. */
export function notificationIdFor(timerId: string): number {
  let hash = 5381;
  for (let i = 0; i < timerId.length; i++) {
    hash = ((hash << 5) + hash + timerId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

/**
 * Asks for notification permission the first time a timer starts. A denied answer is remembered by iOS,
 * so this never asks again. Returns whether notifications may be shown.
 */
export async function ensureNativeNotificationPermission(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === 'granted') return true;
    if (current.display === 'denied') return false;
    const requested = await LocalNotifications.requestPermissions();
    return requested.display === 'granted';
  } catch {
    return false;
  }
}

/** Schedules the end-of-timer notification. Replaces any earlier one for the same timer. */
export async function scheduleNativeTimerAlert(timer: { id: string; label: string }, endsAt: number): Promise<void> {
  if (!isNativeApp() || endsAt <= Date.now()) return;
  if (!(await ensureNativeNotificationPermission())) return;
  try {
    const id = notificationIdFor(timer.id);
    await LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => undefined);
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: `${timer.label} done`,
          body: 'Bench Flow timer finished.',
          schedule: { at: new Date(endsAt), allowWhileIdle: true },
        },
      ],
    });
  } catch {
    /* scheduling can fail when the device is out of notification slots; the in-app alarm still runs */
  }
}

/** Cancels the pending notification for a timer that was paused, reset, dismissed or finished. */
export async function cancelNativeTimerAlert(timerId: string): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: notificationIdFor(timerId) }] });
  } catch {
    /* nothing pending */
  }
}

/** A success tap when a timer completes. */
export async function hapticTimerDone(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    /* haptics unsupported on this device */
  }
}
