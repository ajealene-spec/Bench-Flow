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
const ACTION_SECONDARY = `${ACTION_BASE} border border-slate-300 bg-white text-slate-900 active:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100`;

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
      className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-slate-400 bg-white p-5 sm:p-6 dark:border-slate-600 dark:bg-slate-900"
    >
      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</p>
      <div className="max-w-prose text-base leading-relaxed text-slate-600 dark:text-slate-300">{children}</div>
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
