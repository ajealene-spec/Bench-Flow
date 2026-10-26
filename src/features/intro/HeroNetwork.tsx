import { useRef } from 'react';
import { useScrollFrame } from './introHooks';

interface Soma {
  id: string;
  x: number;
  y: number;
}

const SOMAS: Soma[] = [
  { id: 'a', x: 110, y: 130 },
  { id: 'b', x: 260, y: 70 },
  { id: 'c', x: 410, y: 150 },
  { id: 'd', x: 500, y: 300 },
  { id: 'e', x: 300, y: 280 },
  { id: 'f', x: 160, y: 340 },
  { id: 'g', x: 400, y: 400 },
];

/** Dendrite paths between somas. Each id is referenced by a pulse below. */
const DENDRITES: Array<{ id: string; d: string }> = [
  { id: 'n1', d: 'M110 130 C160 80 210 74 260 70' },
  { id: 'n2', d: 'M260 70 C320 96 360 122 410 150' },
  { id: 'n3', d: 'M410 150 C450 190 480 240 500 300' },
  { id: 'n4', d: 'M260 70 C262 150 280 220 300 280' },
  { id: 'n5', d: 'M300 280 C360 290 430 292 500 300' },
  { id: 'n6', d: 'M110 130 C120 210 140 280 160 340' },
  { id: 'n7', d: 'M160 340 C210 330 260 300 300 280' },
  { id: 'n8', d: 'M300 280 C330 320 360 370 400 400' },
  { id: 'n9', d: 'M500 300 C490 350 450 380 400 400' },
  { id: 'n10', d: 'M410 150 C380 200 340 240 300 280' },
];

/** Action potentials: each travels one dendrite on its own delay. */
const PULSES: Array<{ path: string; begin: string; dur: string }> = [
  { path: 'n1', begin: '0s', dur: '3.2s' },
  { path: 'n2', begin: '1.1s', dur: '3.6s' },
  { path: 'n4', begin: '2.0s', dur: '3s' },
  { path: 'n5', begin: '0.6s', dur: '3.4s' },
  { path: 'n8', begin: '1.8s', dur: '3.1s' },
  { path: 'n3', begin: '2.6s', dur: '3.5s' },
  { path: 'n7', begin: '1.4s', dur: '3.3s' },
];

/** Decorative neuron network. Parallax moves the artwork on scroll; pulses are skipped under reduced motion. */
export function HeroNetwork({ reduced }: { reduced: boolean }) {
  const artRef = useRef<HTMLDivElement>(null);

  useScrollFrame((scrollY) => {
    const el = artRef.current;
    if (!el || reduced) return;
    el.style.transform = `translate3d(0, ${Math.round(scrollY * 0.12)}px, 0)`;
  });

  return (
    <div ref={artRef} className="will-change-transform" aria-hidden="true">
      <svg viewBox="0 0 600 460" className="mx-auto h-auto w-full max-w-md" focusable="false">
        {DENDRITES.map((p) => (
          <path
            key={p.id}
            id={p.id}
            d={p.d}
            fill="none"
            strokeWidth={2.5}
            strokeLinecap="round"
            style={{ stroke: 'var(--border-strong)', opacity: 0.6 }}
          />
        ))}

        {!reduced &&
          PULSES.map((p) => (
            <g key={`${p.path}-${p.begin}`}>
              <circle r={10} style={{ fill: 'var(--accent-text)', opacity: 0.2 }}>
                <animateMotion dur={p.dur} begin={p.begin} repeatCount="indefinite">
                  <mpath href={`#${p.path}`} />
                </animateMotion>
              </circle>
              <circle r={4.5} style={{ fill: 'var(--accent-text)' }}>
                <animateMotion dur={p.dur} begin={p.begin} repeatCount="indefinite">
                  <mpath href={`#${p.path}`} />
                </animateMotion>
              </circle>
            </g>
          ))}

        {SOMAS.map((s, i) => (
          <g key={s.id}>
            <circle
              className="soma-halo"
              cx={s.x}
              cy={s.y}
              r={20}
              style={{ fill: 'var(--accent-text)', animationDelay: `${i * 0.35}s`, animationName: reduced ? 'none' : undefined }}
            />
            <circle cx={s.x} cy={s.y} r={9} strokeWidth={3} style={{ fill: 'var(--surface)', stroke: 'var(--accent-text)' }} />
          </g>
        ))}
      </svg>
    </div>
  );
}
