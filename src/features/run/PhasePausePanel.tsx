import { Link } from 'react-router-dom';
import type { PhaseEnd } from './phasePause';

const BUTTON = 'min-h-16 rounded-2xl px-5 text-lg font-semibold active:opacity-80';

/** Shown after the last step of a phase is completed: pause the run here, or keep going. */
export function PhasePausePrompt({
  end,
  onPause,
  onKeepGoing,
}: {
  end: PhaseEnd;
  onPause: () => void;
  onKeepGoing: () => void;
}) {
  return (
    <section
      role="alertdialog"
      aria-label="Phase complete"
      className="flex flex-col gap-4 rounded-2xl border-2 border-accent p-5"
    >
      <h2 className="text-2xl font-bold">Pause — Day {end.day} complete</h2>
      <p className="text-lg text-text-muted">
        {end.phase.name} is done. Pause here and resume later at the exact next step.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={onPause} className={`${BUTTON} bg-accent text-on-accent`}>
          Pause here
        </button>
        <button type="button" onClick={onKeepGoing} className={`${BUTTON} bg-surface-2 text-text`}>
          Keep going
        </button>
      </div>
    </section>
  );
}

/** Shown while the run is paused between days. Resume restores the step the run was on. */
export function PausedPanel({
  pausedDay,
  resumeDay,
  nextStepTitle,
  onResume,
  experimentId,
}: {
  pausedDay?: number;
  resumeDay?: number;
  nextStepTitle?: string;
  onResume: () => void;
  experimentId: string;
}) {
  return (
    <section aria-label="Paused run" className="flex flex-col gap-4 rounded-2xl border-2 border-accent p-5">
      <h2 className="text-2xl font-bold">Paused{pausedDay ? ` — Day ${pausedDay} complete` : ''}</h2>
      <p className="text-lg text-text-muted">
        {nextStepTitle ? `Next step: ${nextStepTitle}.` : 'Next step is waiting.'}
      </p>
      <button type="button" onClick={onResume} className={`${BUTTON} bg-accent text-on-accent`}>
        Resume{resumeDay ? ` Day ${resumeDay}` : ''}
      </button>
      <Link to={`/experiment/${experimentId}`} className="text-base underline">
        Open experiment details
      </Link>
    </section>
  );
}
