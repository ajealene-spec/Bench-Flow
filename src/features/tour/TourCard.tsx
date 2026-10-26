import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../../db';
import { DEMO_EXPERIMENT_NAME } from '../../content/seed';

/**
 * "Take the tour" card for the Command Center. Shown to new users (no experiments yet) and to anyone
 * who still has the demo experiment.
 */
export function TourCard() {
  const experiments = useLiveQuery(() => db.experiments.toArray(), []);
  if (experiments === undefined) return null;
  const isNew = experiments.length === 0;
  const hasDemo = experiments.some((e) => e.name === DEMO_EXPERIMENT_NAME);
  if (!isNew && !hasDemo) return null;

  return (
    <Link
      to="/demo"
      className="flex min-h-24 flex-col gap-2 rounded-xl border border-border bg-surface p-4 shadow-card active:bg-surface-2 sm:p-5"
    >
      <span className="text-lg font-semibold text-accent-text">Take the 2-minute tour</span>
      <span className="text-sm text-text-muted">
        Walk through a sample run: protocol, safety, calculators, timers, results and the report. All numbers are sample data.
      </span>
    </Link>
  );
}
