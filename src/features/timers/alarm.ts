import type { Timer } from '../../types';
import { hapticTimerDone } from './nativeTimerAlerts';

/*
 * Alarm side effects: Web Audio beeps, vibration and a Notification. Every
 * call is best-effort and must never throw into the UI.
 */

let audio: AudioContext | undefined;

function getAudio(): AudioContext | undefined {
  try {
    audio ??= new AudioContext();
    return audio;
  } catch {
    return undefined;
  }
}

/** Call from a user gesture (Start timer tap) so later alarms can play on iOS/Safari. */
export function unlockAlarmAudio(): void {
  const ctx = getAudio();
  if (ctx?.state === 'suspended') void ctx.resume().catch(() => undefined);
}

export function playAlarm(bursts = 3): void {
  const ctx = getAudio();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  try {
    const start = ctx.currentTime;
    for (let i = 0; i < bursts; i++) {
      const t = start + i * 0.6;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    }
  } catch {
    /* audio unavailable */
  }
}

export function vibrate(pattern: number[] = [300, 150, 300, 150, 300]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch {
    /* unsupported */
  }
}

/** Asks once; browsers remember the answer. Returns the resulting permission or 'unsupported'. */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  try {
    if (typeof Notification === 'undefined') return 'unsupported';
    if (Notification.permission === 'default') return await Notification.requestPermission();
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
}

export function notifyTimerDone(timer: Pick<Timer, 'id' | 'label'>): void {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    new Notification(`${timer.label} done`, { body: 'Bench Flow timer finished.', tag: timer.id });
  } catch {
    /* some platforms only allow notifications through a service worker */
  }
}

export function alertTimerDone(timer: Pick<Timer, 'id' | 'label'>): void {
  playAlarm();
  vibrate();
  notifyTimerDone(timer);
  void hapticTimerDone();
}

/**
 * Rings the alarm (beeps and vibration) every `intervalMs` until the returned function is called.
 * Used by the run view so a finished timer keeps sounding until the user dismisses it.
 */
export function startRepeatingAlarm(intervalMs = 2500): () => void {
  let stopped = false;
  const ring = () => {
    if (stopped) return;
    playAlarm();
    vibrate();
  };
  ring();
  const id = window.setInterval(ring, intervalMs);
  return () => {
    stopped = true;
    window.clearInterval(id);
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(0);
    } catch {
      /* unsupported */
    }
  };
}
