/** Shared class strings for calendar controls. Touch targets are at least 48px. */
/** Base for every calendar button. Padding is added per use so classes never conflict. */
export const BTN_BASE = 'inline-flex min-h-12 items-center justify-center rounded-xl text-base font-medium';
export const BTN = `${BTN_BASE} min-w-12 px-4`;
/** Item chips: left-aligned, full touch height. */
export const CHIP = 'inline-flex min-h-12 min-w-0 rounded-lg text-left text-sm font-medium';
export const BTN_PRIMARY = `${BTN} bg-accent text-on-accent active:bg-accent-hover`;
export const BTN_SECONDARY = `${BTN} border border-border bg-surface text-text shadow-card active:bg-surface-2`;
export const BTN_DANGER = `${BTN} border border-border bg-surface text-text shadow-card active:bg-surface-2`;
export const INPUT = 'min-h-12 w-full rounded-xl border border-border bg-surface px-3 text-base text-text';
export const LABEL = 'flex flex-col gap-1 text-sm font-medium text-text';
export const CARD = 'rounded-2xl border border-border bg-surface shadow-card';
