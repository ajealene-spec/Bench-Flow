/*
 * Audience spectrum: a line from "first-year student" to "principal investigator" with dots flowing along it.
 * The point is that the same open notebook serves every level. Labels sit in HTML below the art so they stay
 * readable at phone width. Colors come from theme tokens. Reduced motion draws the dots at fixed positions.
 */

const X_START = 40;
const X_END = 600;
const Y = 40;
const PATH = `M${X_START} ${Y} L${X_END} ${Y}`;
const DOTS = [0, 1, 2, 3, 4];
const DUR = 7;

/** Fixed positions for the reduced-motion frame, spread evenly along the line. */
function staticX(i: number): number {
  return X_START + ((X_END - X_START) * (i + 0.5)) / DOTS.length;
}

export function AudienceSpectrum({ reduced }: { reduced: boolean }) {
  return (
    <figure className="flex flex-col gap-3">
      <svg viewBox="0 0 640 80" className="h-auto w-full" focusable="false" aria-hidden="true">
        <line x1={X_START} y1={Y} x2={X_END} y2={Y} strokeWidth={4} strokeLinecap="round" style={{ stroke: 'var(--border-strong)' }} />
        <circle cx={X_START} cy={Y} r={7} style={{ fill: 'var(--accent)' }} />
        <circle cx={X_END} cy={Y} r={7} style={{ fill: 'var(--accent)' }} />
        {DOTS.map((i) =>
          reduced ? (
            <circle key={i} cx={staticX(i)} cy={Y} r={9} style={{ fill: i % 2 ? 'var(--text-muted)' : 'var(--accent-text)' }} />
          ) : (
            <circle key={i} r={9} style={{ fill: i % 2 ? 'var(--text-muted)' : 'var(--accent-text)' }}>
              <animateMotion path={PATH} dur={`${DUR}s`} begin={`${(-i * DUR) / DOTS.length}s`} repeatCount="indefinite" calcMode="linear" />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                keyTimes="0;0.12;0.88;1"
                dur={`${DUR}s`}
                begin={`${(-i * DUR) / DOTS.length}s`}
                repeatCount="indefinite"
              />
            </circle>
          ),
        )}
      </svg>
      <figcaption className="flex justify-between gap-4 text-sm font-semibold text-text-muted">
        <span>First-year student</span>
        <span>Principal investigator</span>
      </figcaption>
    </figure>
  );
}
