import { useEffect, useState } from 'react';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

/** True when the OS asks for less motion. The tour then shows its final state at once. */
export function useTourReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(REDUCED_QUERY).matches === true);
  useEffect(() => {
    const mq = window.matchMedia?.(REDUCED_QUERY);
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * Reveals `text` a few characters at a time, like typing. Returns the visible prefix.
 * With reduced motion, or when `enabled` is false, the full text shows at once.
 */
export function useTyped(text: string, options: { enabled?: boolean; charsPerTick?: number; tickMs?: number; reduced: boolean }): string {
  const { enabled = true, charsPerTick = 2, tickMs = 22, reduced } = options;
  const [count, setCount] = useState(0);
  const finished = !enabled || reduced;
  useEffect(() => {
    if (finished || count >= text.length) return;
    const id = window.setTimeout(() => setCount((c) => Math.min(text.length, c + charsPerTick)), tickMs);
    return () => window.clearTimeout(id);
  }, [count, finished, text, charsPerTick, tickMs]);
  return finished ? text : text.slice(0, count);
}

/**
 * Counts up from 0 to `total` one item per `intervalMs`. Reduced motion shows all items at once.
 */
export function useSequence(total: number, options: { intervalMs?: number; reduced: boolean; enabled?: boolean }): number {
  const { intervalMs = 350, reduced, enabled = true } = options;
  const [shown, setShown] = useState(0);
  const finished = !enabled || reduced;
  useEffect(() => {
    if (finished || shown >= total) return;
    const id = window.setTimeout(() => setShown((n) => Math.min(total, n + 1)), intervalMs);
    return () => window.clearTimeout(id);
  }, [shown, finished, total, intervalMs]);
  return finished ? total : shown;
}
