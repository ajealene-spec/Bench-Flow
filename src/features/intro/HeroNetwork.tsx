import { useRef } from 'react';
import { useScrollFrame } from './introHooks';

/*
 * Hero art: a DNA double helix. Each base pair is a rung between two strand beads. The beads move on
 * their own SMIL path (cos of an angle), so the helix turns without React work. Reduced motion draws the
 * same helix frozen at its starting angle. This file was previously the neuron network; the export is
 * HeroHelix, and the file name is kept so existing imports do not change.
 */

const CX = 120;
const RADIUS = 64;
const PAIRS = 12;
const FRAMES = 24;
const LOOP = '12s';
const PHASE_STEP = 0.5;
const KEY_TIMES = Array.from({ length: FRAMES + 1 }, (_, f) => (f / FRAMES).toFixed(4)).join(';');

/** x positions of one strand bead over a full turn, sampled at FRAMES + 1 keyframes. sign picks the strand. */
function orbitValues(phase: number, sign: 1 | -1): string {
  const values: string[] = [];
  for (let f = 0; f <= FRAMES; f++) {
    const angle = phase + (2 * Math.PI * f) / FRAMES;
    values.push((CX + sign * RADIUS * Math.cos(angle)).toFixed(1));
  }
  return values.join(';');
}

const PAIR_LIST = Array.from({ length: PAIRS }, (_, i) => {
  const phase = i * PHASE_STEP;
  return {
    key: i,
    y: 24 + i * 24,
    ax: CX + RADIUS * Math.cos(phase),
    bx: CX - RADIUS * Math.cos(phase),
    aValues: orbitValues(phase, 1),
    bValues: orbitValues(phase, -1),
  };
});

/** Animated DNA double helix, decorative. Reduced motion shows the static frame. */
export function HeroHelix({ reduced, className = 'mx-auto h-auto w-full max-w-[220px]' }: { reduced: boolean; className?: string }) {
  const artRef = useRef<HTMLDivElement>(null);

  // A light parallax on scroll, transform only, with no React re-render.
  useScrollFrame((scrollY) => {
    const el = artRef.current;
    if (!el || reduced) return;
    el.style.transform = `translate3d(0, ${Math.round(scrollY * 0.08)}px, 0)`;
  });

  return (
    <div ref={artRef} className="will-change-transform" aria-hidden="true">
      <svg viewBox="0 0 240 320" className={className} focusable="false">
        {PAIR_LIST.map((p) => (
          <g key={p.key}>
            <line
              x1={p.ax}
              y1={p.y}
              x2={p.bx}
              y2={p.y}
              strokeWidth={3}
              strokeLinecap="round"
              style={{ stroke: 'var(--border-strong)', opacity: 0.5 }}
            >
              {!reduced && (
                <>
                  <animate attributeName="x1" values={p.aValues} keyTimes={KEY_TIMES} dur={LOOP} repeatCount="indefinite" />
                  <animate attributeName="x2" values={p.bValues} keyTimes={KEY_TIMES} dur={LOOP} repeatCount="indefinite" />
                </>
              )}
            </line>
            <circle cx={p.ax} cy={p.y} r={6} style={{ fill: 'var(--accent-text)' }}>
              {!reduced && <animate attributeName="cx" values={p.aValues} keyTimes={KEY_TIMES} dur={LOOP} repeatCount="indefinite" />}
            </circle>
            <circle cx={p.bx} cy={p.y} r={6} style={{ fill: 'var(--text-muted)', opacity: 0.8 }}>
              {!reduced && <animate attributeName="cx" values={p.bValues} keyTimes={KEY_TIMES} dur={LOOP} repeatCount="indefinite" />}
            </circle>
          </g>
        ))}
      </svg>
    </div>
  );
}
