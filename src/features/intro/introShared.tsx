import { Link } from 'react-router-dom';
import { markIntroSeen } from '../../app/introRedirect';

/** Primary call to action. Entering the lab from the intro also sets the first-visit flag. */
export function EnterLink({ className = '' }: { className?: string }) {
  return (
    <Link
      to="/"
      onClick={() => markIntroSeen()}
      className={`inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-6 text-base font-semibold text-on-accent shadow-card active:bg-accent-hover ${className}`}
    >
      Enter the lab →
    </Link>
  );
}

export const CARD = 'rounded-2xl border border-border bg-surface p-6 shadow-card';
export const EYEBROW = 'text-sm font-semibold uppercase tracking-[0.16em] text-accent-text';
