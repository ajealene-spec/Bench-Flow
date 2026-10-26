import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface EmptyAction {
  label: string;
  /** Route to open. Use either `to` or `onClick`. */
  to?: string;
  onClick?: () => void;
}

const ACTION_BASE = 'inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-medium';
const ACTION_PRIMARY = `${ACTION_BASE} bg-accent text-white active:bg-accent-hover`;
const ACTION_SECONDARY =`${ACTION_BASE} border border-border bg-surface shadow-card text-text active:bg-surface-2`;

/** Friendly placeholder for a list with nothing in it yet. Gives one clear next step, plus an optional second. */
export function EmptyState({
  title,
  children,
  primary,
  secondary,
}: {
  title: string;
  children: ReactNode;
  primary?: EmptyAction;
  secondary?: EmptyAction;
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border-strong bg-surface shadow-card p-5 sm:p-6"
    >
      <p className="text-lg font-semibold text-text">{title}</p>
      <div className="max-w-prose text-base leading-relaxed text-text-muted">{children}</div>
      {(primary || secondary) && (
        <div className="flex flex-wrap gap-2">
          {primary && <Action action={primary} className={ACTION_PRIMARY} />}
          {secondary && <Action action={secondary} className={ACTION_SECONDARY} />}
        </div>
      )}
    </section>
  );
}

function Action({ action, className }: { action: EmptyAction; className: string }) {
  if (action.to) {
    return (
      <Link to={action.to} className={className}>
        {action.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}
