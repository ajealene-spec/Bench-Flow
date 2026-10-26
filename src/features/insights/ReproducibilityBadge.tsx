import { useId, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { loadReproducibilityInput } from './loadReproducibility';
import { REPRODUCIBILITY_WEIGHTS, scoreReproducibility, type ReproducibilityScore } from './reproducibility';

const RING_SIZE = 44;
const RING_STROKE = 5;

/**
 * Ring badge with the documentation completeness score. Tapping it opens the breakdown.
 * Frames the number as documentation completeness, not experimental quality.
 */
export function ReproducibilityBadge({ experimentId, compact = false }: { experimentId: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const result = useLiveQuery(
    async () => {
      const input = await loadReproducibilityInput(experimentId, db);
      return input ? scoreReproducibility(input) : undefined;
    },
    [experimentId],
  );
  if (result === undefined) return null;

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-12 items-center gap-2 rounded-xl px-2 text-left text-text active:bg-surface-2"
        aria-label={`Documentation completeness ${label(result)}. How this is calculated.`}
      >
        <Ring score={result.score} />
        {!compact && (
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-medium">Documentation</span>
            <span className="text-sm text-text-muted">How this is calculated</span>
          </span>
        )}
      </button>
      {open && <BreakdownPanel id={panelId} result={result} onClose={() => setOpen(false)} />}
    </div>
  );
}

function label(result: ReproducibilityScore): string {
  return result.score === null ? 'not enough data' : `${result.score} of 100`;
}

function Ring({ score }: { score: number | null }) {
  const r = (RING_SIZE - RING_STROKE) / 2;
  const c = 2 * Math.PI * r;
  const fraction = score === null ? 0 : score / 100;
  return (
    <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} aria-hidden="true" focusable="false">
      <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={r} fill="none" stroke="var(--border-strong)" strokeOpacity={0.35} strokeWidth={RING_STROKE} />
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={r}
        fill="none"
        stroke="var(--accent-text)"
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        strokeDasharray={`${fraction * c} ${c}`}
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--text)">
        {score === null ? '–' : score}
      </text>
    </svg>
  );
}

function BreakdownPanel({ id, result, onClose }: { id: string; result: ReproducibilityScore; onClose: () => void }) {
  return (
    <div
      id={id}
      role="region"
      aria-label="How this is calculated"
      className="absolute left-0 z-30 mt-2 flex w-[min(22rem,90vw)] flex-col gap-3 rounded-2xl border border-border bg-surface p-4 text-text shadow-card shadow-lg"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold">How this is calculated</h3>
        <button type="button" onClick={onClose} className="min-h-12 min-w-12 rounded-lg text-base text-text-muted active:bg-surface-2" aria-label="Close breakdown">
          ×
        </button>
      </div>
      <p className="text-sm text-text-muted">
        Documentation completeness: how fully this run was recorded. It is not a measure of experimental quality. Components with no data for this run are left out.
      </p>
      <ul className="flex flex-col gap-3">
        {result.components.map((c) => (
          <li key={c.id} className="flex flex-col gap-1">
            <div className="flex justify-between gap-2 text-sm font-medium">
              <span>{c.label}</span>
              <span className="text-text-muted">
                {c.fraction === null ? 'n/a' : `${Math.round(c.fraction * 100)}%`} · weight {c.weight}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
              <div className="h-full bg-accent" style={{ width: `${c.fraction === null ? 0 : Math.round(c.fraction * 100)}%` }} />
            </div>
            <p className="text-xs text-text-muted">{c.detail}</p>
          </li>
        ))}
      </ul>
      <p className="text-sm text-text-muted">
        Score = weighted average of the components that apply, rounded. Weights: {Object.entries(REPRODUCIBILITY_WEIGHTS).map(([id, w]) => `${id} ${w}`).join(', ')}.
      </p>
    </div>
  );
}
