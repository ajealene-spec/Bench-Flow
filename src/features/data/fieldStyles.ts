/** Shared styles for data capture. Every target is at least 48px tall for gloved hands. */
export const FIELD_INPUT =
'min-h-12 w-full rounded-xl border border-border bg-surface shadow-card px-3 text-base text-text';
export const BUTTON_BASE = 'inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-base font-medium';
export const BUTTON_PRIMARY =`${BUTTON_BASE} bg-accent text-white active:bg-accent-hover disabled:opacity-40`;
export const BUTTON_SECONDARY =`${BUTTON_BASE} border border-border bg-surface shadow-card text-text active:bg-surface-2`;
export const BUTTON_LINK ='min-h-12 px-3 text-base font-medium text-accent-text underline';
