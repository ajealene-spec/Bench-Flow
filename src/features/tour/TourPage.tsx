import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../../db';
import { ensureDemoExperimentId } from './demoLookup';
import { StepPaste, StepSafety } from './StepPrepare';
import { StepFocus } from './StepFocus';
import { StepDeviation, StepRecord } from './StepRecord';
import { StepResults } from './StepResults';
import { StepMethods, StepScore } from './StepReport';
import { StepFrame, SampleChip } from './tourShared';
import { useTourReducedMotion } from './useTourMotion';
import './tour.css';

interface TourStep {
  title: string;
  blurb: string;
  render: (demoId: string | null) => ReactNode;
}

/** The eight steps of the tour. Each one shows the real component or a close copy, with sample data. */
const STEPS: TourStep[] = [
  {
    title: 'Paste a protocol, get steps',
    blurb: 'Paste the text of a protocol and Bench Flow turns it into steps you can follow at the bench. This is sample text.',
    render: () => <StepPaste />,
  },
  {
    title: 'Check safety before you start',
    blurb: 'Every hazard and piece of PPE from the protocol goes on a checklist. The first step stays locked until every item is checked.',
    render: () => <StepSafety />,
  },
  {
    title: 'Focus mode with a calculator and timer',
    blurb: 'Each step can carry its own calculator and timer. Change the final volume and the antibody volume updates. The timer here runs 60 times faster than real time.',
    render: () => <StepFocus />,
  },
  {
    title: 'Record the numbers as you go',
    blurb: 'Counts go into the step as they are measured, per animal and per region. These NeuN+ counts are made-up sample numbers.',
    render: () => <StepRecord />,
  },
  {
    title: 'Deviations are logged for you',
    blurb: 'The block timer ran 7 minutes over plan. When it stopped, the app logged the difference with no extra typing.',
    render: () => <StepDeviation />,
  },
  {
    title: 'See the results and the run',
    blurb: 'Means and standard deviations for each region, with every animal shown as a dot, and a timeline of planned against actual times.',
    render: () => <StepResults />,
  },
  {
    title: 'A documentation score',
    blurb: 'The ring counts how completely the run is documented: steps, timers, deviations, lots, RRIDs, safety and methods. It does not grade the science.',
    render: (demoId) => <StepScore demoId={demoId} />,
  },
  {
    title: 'Methods, written from the run',
    blurb: 'The Methods paragraph is drafted from what was recorded. Then download the report and the data package for the run.',
    render: (demoId) => <StepMethods demoId={demoId} />,
  },
];

/** Full-screen guided tour at /demo. Works offline: the demo is seeded locally. */
export default function TourPage() {
  const navigate = useNavigate();
  const reduced = useTourReducedMotion();
  const [index, setIndex] = useState(0);
  const [demoId, setDemoId] = useState<string | null>(null);
  const [demoChecked, setDemoChecked] = useState(false);
  const firstRender = useRef(true);
  const total = STEPS.length;
  const atEnd = index === total;

  useEffect(() => {
    let cancelled = false;
    ensureDemoExperimentId(db)
      .catch(() => null)
      .then((id) => {
        if (cancelled) return;
        setDemoId(id);
        setDemoChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Start each step at the top of the page, except the very first render.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }, [index, reduced]);

  const progress = ((index + 1) / (total + 1)) * 100;

  return (
    <div className="tour-root min-h-dvh bg-page text-text">
      <header className="sticky top-0 z-20 border-b border-border bg-page/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-text">Guided tour</span>
              <SampleChip />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIndex(total)}
                disabled={atEnd}
                className="inline-flex min-h-12 items-center rounded-xl px-4 font-medium text-text-muted active:bg-surface-2 disabled:opacity-40"
              >
                Skip tour
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex min-h-12 items-center rounded-xl border border-border bg-surface px-4 font-medium text-text shadow-card active:bg-surface-2"
              >
                Exit to app
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm text-text-muted">
              <span>{atEnd ? 'Tour complete' : `Step ${index + 1} of ${total}`}</span>
              <span className="t-num">{Math.round(progress)}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Tour progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
              className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
            >
              <div className="tour-progress h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-10 pt-6 sm:px-6">
        {atEnd ? (
          <EndCard demoId={demoId} demoChecked={demoChecked} onOpenDemo={() => demoId && navigate(`/experiment/${demoId}/report`)} onStartOwn={() => navigate('/library')} />
        ) : (
          <StepFrame
            key={index}
            number={index + 1}
            total={total}
            title={STEPS[index].title}
            blurb={STEPS[index].blurb}
          >
            {STEPS[index].render(demoId)}
          </StepFrame>
        )}

        {!atEnd && (
          <nav aria-label="Tour steps" className="flex items-center justify-between gap-3 border-t border-border pt-6">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="inline-flex min-h-12 min-w-28 items-center justify-center rounded-xl border border-border bg-surface px-5 font-semibold text-text shadow-card active:bg-surface-2 disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(total, i + 1))}
              className="inline-flex min-h-12 min-w-28 items-center justify-center rounded-xl bg-accent px-5 font-semibold text-on-accent active:bg-accent-hover"
            >
              {index === total - 1 ? 'Finish tour' : 'Next'}
            </button>
          </nav>
        )}
        {atEnd && (
          <nav aria-label="Tour end" className="flex items-center justify-start border-t border-border pt-6">
            <button
              type="button"
              onClick={() => setIndex(total - 1)}
              className="inline-flex min-h-12 min-w-28 items-center justify-center rounded-xl border border-border bg-surface px-5 font-semibold text-text shadow-card active:bg-surface-2"
            >
              Back
            </button>
          </nav>
        )}
      </main>
    </div>
  );
}

function EndCard({
  demoId,
  demoChecked,
  onOpenDemo,
  onStartOwn,
}: {
  demoId: string | null;
  demoChecked: boolean;
  onOpenDemo: () => void;
  onStartOwn: () => void;
}) {
  return (
    <section aria-labelledby="tour-end-title" className="tour-enter flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <SampleChip />
        <h2 id="tour-end-title" className="text-3xl font-bold leading-tight sm:text-4xl">
          That is the whole loop
        </h2>
        <p className="max-w-3xl text-lg leading-relaxed text-text-muted">
          Paste, check, follow with timers and calculators, record, log deviations, see results, score the documentation, and export. The demo experiment keeps all of it, with sample numbers, so you can look around.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onOpenDemo}
          disabled={!demoId}
          className="inline-flex min-h-14 items-center justify-center rounded-xl bg-accent px-5 text-lg font-semibold text-on-accent active:bg-accent-hover disabled:opacity-50"
        >
          {demoChecked && !demoId ? 'Demo unavailable' : 'Open the demo experiment'}
        </button>
        <button
          type="button"
          onClick={onStartOwn}
          className="inline-flex min-h-14 items-center justify-center rounded-xl border border-border bg-surface px-5 text-lg font-semibold text-text shadow-card active:bg-surface-2"
        >
          Start your own
        </button>
      </div>
      <p className="text-sm text-text-muted">
        Prefer to stay in the app? <Link to="/" className="font-medium text-accent-text underline">Go to the Command Center</Link>.
      </p>
    </section>
  );
}
