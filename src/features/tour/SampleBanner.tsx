import { SAMPLE_NOTICE } from './sampleNotice';

/**
 * Prominent banner that says the numbers on screen are sample data. Neutral bordered surface, no alarm colors.
 * Use `compact` for a slim strip (the tour header). `note` adds a line under the shared notice.
 */
export function SampleBanner({ compact = false, note, className = '' }: { compact?: boolean; note?: string; className?: string }) {
  return (
    <div
      role="note"
      aria-label="Sample data notice"
      className={`flex flex-col gap-1 rounded-xl border border-border bg-surface-2 text-text ${compact ? 'px-3 py-2 text-sm' : 'px-4 py-3 text-base'} ${className}`}
    >
      <p className={compact ? 'font-medium' : 'font-semibold'}>{SAMPLE_NOTICE}</p>
      {note && <p className="text-text-muted">{note}</p>}
    </div>
  );
}

/** One-line caption for under a chart, table or number display. */
export function SampleCaption({ className = '' }: { className?: string }) {
  return <p className={`text-sm text-text-muted ${className}`}>{SAMPLE_NOTICE}</p>;
}
