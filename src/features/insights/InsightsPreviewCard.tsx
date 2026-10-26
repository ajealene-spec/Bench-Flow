import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../../db';
import { CARD } from '../experiments/styles';
import { filterRuns, scoresOverTime, timerDeviationBars } from './insightsData';
import { loadInsightsRuns } from './loadInsights';

/** Small summary for the Command Center. Links to the full Insights page. */
export function InsightsPreviewCard() {
  const runs = useLiveQuery(() => loadInsightsRuns(db), []);
  if (runs === undefined) return null;

  const scored = scoresOverTime(filterRuns(runs, {}));
  const recent = scored.slice(-5);
  const average = recent.length > 0 ? Math.round(recent.reduce((a, p) => a + p.score, 0) / recent.length) : null;
  const worstStep = timerDeviationBars(runs)[0];

  return (
    <section aria-label="Insights preview" className={`${CARD} flex flex-col gap-3 p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-text">Insights</h2>
        <Link to="/insights" className="inline-flex min-h-12 items-center rounded-xl px-3 font-medium text-accent-text underline">
          Open Insights
        </Link>
      </div>
      {runs.length === 0 ? (
        <p className="text-base text-text-muted">Charts appear here once runs have recorded numbers, timers or scores.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-base text-text">
          <li>
            {runs.length} {runs.length === 1 ? 'run' : 'runs'} recorded
          </li>
          <li>
            {average === null
              ? 'No documentation scores yet.'
              : `Documentation completeness, last ${recent.length} scored: average ${average} of 100.`}
          </li>
          {worstStep && (
            <li>
              Largest average timer drift: {worstStep.stepTitle}, {Math.round(worstStep.meanAbsPct)}% from plan.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
