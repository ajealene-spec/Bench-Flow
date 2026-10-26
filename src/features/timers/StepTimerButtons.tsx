import type { Timer } from '../../types';
import { formatRemaining } from './timeMath';
import { requestNotificationPermission, unlockAlarmAudio } from './alarm';
import { startStepTimer } from './timerActions';

/**"Start timer" buttons for a step's timer definitions. */
export function StepTimerButtons({ timers, experimentId }: { timers: Timer[]; experimentId?: string }) {
  if (timers.length === 0) return null;

  async function handleStart(template: Timer) {
    // Taps are user gestures: unlock audio and ask for notifications here, once.
    unlockAlarmAudio();
    await requestNotificationPermission();
    // The experiment id travels with the run so its finished time can be recorded.
    await startStepTimer({ ...template, experimentId });
  }

  return (
    <section aria-label="Step timers" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Timers</h3>
      <div className="flex flex-wrap gap-3">
        {timers.map((timer) => (
          <button
            key={timer.id}
            type="button"
            onClick={() => void handleStart(timer)}
            className="min-h-16 rounded-xl border-2 border-accent px-5 text-left font-medium text-accent-text active:bg-surface-2"
          >
            Start timer: {timer.label} ({formatRemaining(timer.durationSec)})
          </button>
        ))}
      </div>
    </section>
  );
}
