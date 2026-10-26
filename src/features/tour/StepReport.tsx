import { useEffect, useMemo, useState } from 'react';
import { loadReproducibilityInput } from '../insights/loadReproducibility';
import { scoreReproducibility, type ReproducibilityScore } from '../insights/reproducibility';
import { db } from '../../db';
import { buildResearchPackageZip } from '../report/researchPackageLoader';
import { loadDemoReportData } from './demoReportData';
import { sampleMethodsParagraph } from './tourText';
import { useTourReducedMotion, useTyped } from './useTourMotion';
import { TOUR_CARD } from './tourShared';
import { SAMPLE_CAPTION } from './sampleData';

const RING_R = 54;
const RING_C = 2 * Math.PI * RING_R;

/** Hook that counts a number up to `target` over about a second. Reduced motion jumps to the target. */
function useCountUp(target: number | null, reduced: boolean): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === null) return;
    if (reduced) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1100);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reduced]);
  return value;
}

/** The documentation completeness ring with its breakdown, read from the demo run's stored data. */
export function StepScore({ demoId }: { demoId: string | null }) {
  const reduced = useTourReducedMotion();
  const [result, setResult] = useState<ReproducibilityScore | null | undefined>(undefined);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!demoId) {
      setResult(null);
      return;
    }
    loadReproducibilityInput(demoId, db)
      .then((input) => {
        if (!cancelled) setResult(input ? scoreReproducibility(input) : null);
      })
      .catch(() => {
        if (!cancelled) setResult(null);
      });
    return () => {
      cancelled = true;
    };
  }, [demoId]);

  // Start the ring from empty, then fill it on the next frame.
  useEffect(() => {
    const id = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const score = result?.score ?? null;
  const shown = useCountUp(score, reduced);
  const offset = RING_C * (1 - (armed && score !== null ? score : 0) / 100);

  if (result === undefined) return <p className="text-text-muted">Reading the run…</p>;
  if (result === null || score === null) {
    return <p className="text-text-muted">The sample run could not be scored right now. Reload the tour to try again.</p>;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(220px,300px)_1fr]">
      <div className={`${TOUR_CARD} items-center text-center`}>
        <svg viewBox="0 0 128 128" className="h-44 w-44" role="img" aria-label={`Documentation score ${score} out of 100`}>
          <circle cx="64" cy="64" r={RING_R} fill="none" strokeWidth="12" className="stroke-surface-2" />
          <circle
            cx="64"
            cy="64"
            r={RING_R}
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            className="stroke-accent"
            strokeDasharray={RING_C}
            strokeDashoffset={offset}
            transform="rotate(-90 64 64)"
            style={{ transition: reduced ? 'none' : 'stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
          <text x="64" y="70" textAnchor="middle" className="fill-text" fontSize="30" fontWeight="700">
            {shown}
          </text>
        </svg>
        <span className="text-lg font-semibold text-text">Documentation score</span>
        <span className="text-sm text-text-muted">
          How completely this run was written down. It does not judge the science.
        </span>
        <span className="text-xs text-text-muted">{SAMPLE_CAPTION}</span>
      </div>

      <div className={TOUR_CARD}>
        <span className="text-sm font-semibold text-text-muted">What the score counts</span>
        <ul className="flex flex-col gap-3">
          {result.components.map((c) => (
            <li key={c.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-text">{c.label}</span>
                <span className="t-num text-sm text-text-muted">{c.fraction === null ? 'Not applicable' : `${Math.round(c.fraction * 100)}%`}</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                <div
                  className="tour-bar h-full rounded-full bg-accent"
                  style={{ width: `${c.fraction === null ? 0 : Math.round(c.fraction * 100)}%` }}
                />
              </div>
              <span className="text-sm text-text-muted">{c.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** The Methods paragraph typed out, then the download of the report and the data package. */
export function StepMethods({ demoId }: { demoId: string | null }) {
  const reduced = useTourReducedMotion();
  const paragraph = useMemo(() => sampleMethodsParagraph(), []);
  const typed = useTyped(paragraph, { reduced, charsPerTick: 4, tickMs: 14 });
  const done = typed.length === paragraph.length;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function download() {
    if (!demoId) {
      setMessage('The sample run is not available. Reload the tour and try again.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const data = await loadDemoReportData(demoId, db);
      if (!data) throw new Error('The sample run could not be read.');
      const bytes = await buildResearchPackageZip(demoId, data, db);
      const name = 'sample-run-report-and-data-package.zip';
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage(`Downloaded ${name}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not build the download.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_minmax(220px,320px)]">
      <div className={TOUR_CARD}>
        <span className="text-sm font-semibold text-text-muted">Methods, written from the run</span>
        <span className="text-xs text-text-muted">{SAMPLE_CAPTION}</span>
        <p className="tour-methods text-base leading-relaxed text-text" aria-live="polite">
          {typed}
          {!done && !reduced && <span className="tour-caret" aria-hidden="true">|</span>}
        </p>
      </div>
      <div className={`${TOUR_CARD} justify-between`}>
        <div className="flex flex-col gap-2">
          <span className="text-lg font-semibold text-text">Take it with you</span>
          <span className="text-sm text-text-muted">
            The zip holds the report (Markdown and JSON), the step records, the event log, and a CSV of the per-cell numbers. It is the sample run, so the numbers are made up.
          </span>
        </div>
        <button
          type="button"
          onClick={() => void download()}
          disabled={busy || !done}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-4 font-semibold text-on-accent active:bg-accent-hover disabled:opacity-50"
        >
          {busy ? 'Building download…' : 'Download report and data package'}
        </button>
        {message && (
          <p role="status" className="text-sm text-text-muted">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
