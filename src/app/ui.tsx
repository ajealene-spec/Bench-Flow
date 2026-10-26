import type { ReactNode } from 'react';

/**
 * Shared page header: an overline, the page title (h1), an optional subtitle and an actions slot.
 * Every top-level page uses it, so titles sit at the same size and position across the app.
 */
export function PageHeader({
  title,
  subtitle,
  overline = 'Bench Flow',
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  overline?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="t-overline">{overline}</span>
        <h1 className="t-h1 text-text">{title}</h1>
        {subtitle && <p className="t-body text-text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Stroke length offset for a ring of the given radius at `percent` complete (0 to 100). */
export function ringOffset(percent: number, radius: number): number {
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
  return circumference * (1 - clamped / 100);
}

/** Circular progress ring with the percentage in the middle. Replaces thin progress bars on cards. */
export function ProgressRing({ percent, size = 56, label }: { percent: number; size?: number; label: string }) {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const clamped = Math.round(Math.min(100, Math.max(0, percent)));
  const circumference = 2 * Math.PI * radius;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={ringOffset(clamped, radius)}
          className="progress-ring-arc"
        />
      </svg>
      <span className="t-num absolute inset-0 flex items-center justify-center text-sm font-semibold text-text">{clamped}%</span>
    </div>
  );
}
