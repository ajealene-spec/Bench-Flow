import type { ScheduleItem } from './schedule';

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Small list of planned clock times for the steps still to do. */
export function ScheduleList({ items }: { items: ScheduleItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Schedule" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Schedule</h2>
      <ol className="flex flex-col gap-1 text-base">
        {items.map((item, i) => (
          <li key={item.stepId} className="flex justify-between gap-3 rounded-lg px-3 py-2 odd:bg-surface-2">
            <span className={i === 0 ? 'font-semibold' : ''}>{item.title}</span>
            <span className="shrink-0 font-mono tabular-nums text-text-muted">
              {clock(item.startAt)}–{clock(item.endAt)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
