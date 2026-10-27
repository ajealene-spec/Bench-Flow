import { Link } from 'react-router-dom';
import { markIntroSeen } from '../../app/introRedirect';

/*
 * Shared classes for the intro page. The whole page uses five type roles and nothing else:
 * overline, section title, card title, body and stat. Every heading, label and body line picks one of these.
 */

/** Overline: small caps label above each section title and inside cards. */
export const EYEBROW = 'text-xs font-semibold tracking-[0.18em] uppercase text-accent-text';
/** Section title: the light display style from the hero, one step down. */
export const SECTION_TITLE = 'text-3xl md:text-5xl font-light tracking-tight';
/** Card title: the heading inside a card or tile. */
export const CARD_TITLE = 'text-lg font-medium';
/** Body: running text, always in the muted color. */
export const BODY = 'text-base md:text-lg font-normal leading-relaxed text-text-muted';
/** Stat value: large light numerals for the hero stats. */
export const STAT = 'text-4xl font-light';

/** Vertical rhythm shared by every section. Alternate sections use the surface-2 band so the page reads as one flow. */
export const BAND = 'py-20 md:py-28';
/** Inner width for section content: wide on laptops, with comfortable side padding. */
export const INNER = 'mx-auto w-full max-w-7xl px-4 sm:px-6';
/** Section header block. Left-aligned, the same as the hero. */
export const SECTION_HEADER = 'flex max-w-3xl flex-col gap-4';

/**
 * Every card and tile. Same border, radius, padding and hover. On hover the card lifts 4px and gets an accent
 * border with a soft accent glow. The lift is motion, so it is limited to motion-safe.
 */
export const CARD =
  'flex h-full flex-col gap-3 rounded-2xl border border-border bg-surface p-6 shadow-card transition-[transform,box-shadow,border-color] duration-300 ease-out hover:border-accent hover:shadow-[0_0_0_1px_var(--accent),0_18px_40px_-18px_color-mix(in_srgb,var(--accent)_60%,transparent)] motion-safe:hover:-translate-y-1';

/** Primary call to action. Entering the lab from the intro also sets the first-visit flag. */
export function EnterLink({ className = '' }: { className?: string }) {
  return (
    <Link
      to="/"
      onClick={() => markIntroSeen()}
      className={`inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-6 text-base font-medium text-on-accent shadow-card active:bg-accent-hover ${className}`}
    >
      Enter the lab →
    </Link>
  );
}
