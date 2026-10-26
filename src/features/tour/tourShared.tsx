import type { ReactNode } from 'react';
import { SAMPLE_LABEL } from './sampleData';

export const TOUR_CARD = 'flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-6';

/** Badge that marks figures and numbers on screen as sample data. */
export function SampleChip() {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface-2 px-3 py-1 text-sm font-medium text-text-muted">
      {SAMPLE_LABEL}
    </span>
  );
}

/** Frame around one tour step: number, plain-language title and a short explanation, then the live demo. */
export function StepFrame({ number, total, title, blurb, children }: { number: number; total: number; title: string; blurb: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`tour-step-${number}`} className="tour-enter flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold uppercase tracking-wide text-accent-text">
            Step {number} of {total}
          </span>
          <SampleChip />
        </div>
        <h2 id={`tour-step-${number}`} className="text-2xl font-bold leading-tight text-text sm:text-3xl">
          {title}
        </h2>
        <p className="max-w-3xl text-lg leading-relaxed text-text-muted">{blurb}</p>
      </header>
      {children}
    </section>
  );
}
