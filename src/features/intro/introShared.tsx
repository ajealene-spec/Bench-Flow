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
/** Vertical rhythm shared by every section. Alternate sections use the surface-2 band so the page reads as one flow. */
export const BAND = 'py-12 md:py-16';
/** Inner width for section content: wide on laptops, with comfortable side padding. */
export const INNER = 'mx-auto w-full max-w-7xl px-4 sm:px-6';
export const SECTION_TITLE = 'mt-3 text-3xl font-semibold tracking-tight sm:text-4xl';
