import { useEffect, useLayoutEffect, useRef } from 'react';
import { easeOutCubic, parseStat } from './introMath';

const DURATION_MS = 1400;

/**
 * A stat value that counts up from 0 once it enters the viewport. The server markup and reduced motion both
 * show the final value. Counting uses requestAnimationFrame and writes text directly, so React does not re-render.
 */
export function CountUp({ value, reduced, className }: { value: string; reduced: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  // Before paint, drop the element back to 0 so the final value never flashes.
  useLayoutEffect(() => {
    const el = ref.current;
    const parsed = parseStat(value);
    if (!el || !parsed || reduced) return;
    el.textContent = `${parsed.prefix}0${parsed.suffix}`;
  }, [value, reduced]);

  useEffect(() => {
    const el = ref.current;
    const parsed = parseStat(value);
    if (!el || !parsed || reduced || !('IntersectionObserver' in window)) return;
    const { prefix, target, suffix } = parsed;
    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / DURATION_MS);
          el.textContent = `${prefix}${Math.round(target * easeOutCubic(t))}${suffix}`;
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, reduced]);

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
