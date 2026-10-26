import { useEffect, useRef, useState } from 'react';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

/** True when the OS asks for less motion. Components use it to skip scroll and loop animation. */
export function usePrefersReducedMotion(): boolean {
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
 * Calls onFrame once per animation frame while the page scrolls, with the scroll offset and the
 * maximum offset. Writes go straight to the DOM through the callback, so React does not re-render 60 times a second.
 */
export function useScrollFrame(onFrame: (scrollY: number, maxScroll: number) => void): void {
  const callback = useRef(onFrame);
  callback.current = onFrame;

  useEffect(() => {
    let frame = 0;
    const run = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      callback.current(window.scrollY, max);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(run);
    };
    run();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
}

/**
 * Adds the reveal-in class to every [data-reveal] element as it enters the viewport.
 * With reduced motion, or without IntersectionObserver, everything is revealed at once.
 */
export function useRevealOnScroll(reduced: boolean): void {
  useEffect(() => {
    const root = document.documentElement;
    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (reduced || !('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('reveal-in'));
      return;
    }
    // Arm the hidden state only now that the observer exists. Before this, everything is visible.
    root.classList.add('reveal-armed');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('reveal-in');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -5% 0px', threshold: 0.02 },
    );
    targets.forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      root.classList.remove('reveal-armed');
    };
  }, [reduced]);
}

/**
 * Returns the data-attribute value of the element currently crossing the middle of the viewport,
 * for example the active section or sticky step. `attribute` is the camel-cased dataset key.
 */
export function useActiveAnchor(selector: string, attribute: string, rootMargin: string): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive((entry.target as HTMLElement).dataset[attribute] ?? null);
        }
      },
      { rootMargin },
    );
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [selector, attribute, rootMargin]);
  return active;
}
