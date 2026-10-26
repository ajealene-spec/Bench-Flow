import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../../db';
import { setTaskDone } from '../../db/tasks';
import { addDays, dayKey, daysBetween, formatMinutes } from './dates';
import { listCalendarItems } from './calendarData';
import { groupItemsByDay } from './dayItems';
import { BTN_BASE, CARD } from './ui';

const WEEKDAY = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' });
};

/** Command Center strip: the next seven days, with today's tasks and phases listed below. */
export function ThisWeekStrip() {
  const today = dayKey(Date.now());
  const end = addDays(today, 6);
  const items = useLiveQuery(() => listCalendarItems(today, end, db), [today, end]);
  if (items === undefined) return null;

  const byDay = groupItemsByDay(items);
  const days = daysBetween(today, end);
  const todays = byDay.get(today) ?? [];

  return (
    <section aria-label="This week" className={`${CARD} flex flex-col gap-3 p-4`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-text">This week</h2>
        <Link to="/calendar" className={`${BTN_BASE} px-3 text-sm font-medium text-accent-text`}>
          Open calendar
        </Link>
      </div>
      <ol className="grid grid-cols-7 gap-1 text-center text-xs text-text-muted">
        {days.map((day) => {
          const count = byDay.get(day)?.length ?? 0;
          return (
            <li key={day} className={`flex flex-col items-center gap-1 rounded-lg py-1 ${day === today ? 'cal-today-ring text-text' : ''}`}>
              <span>{WEEKDAY(day)}</span>
              <span className="tabular-nums text-text">{count}</span>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-text">Today</h3>
        {todays.length === 0 && <p className="text-sm text-text-muted">Nothing planned today.</p>}
        {todays.slice(0, 6).map((item) =>
          item.kind === 'task' ? (
            <label key={item.key} className="flex min-h-12 items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={item.occurrence.task.done}
                disabled={item.occurrence.recurring}
                onChange={() => void setTaskDone(item.occurrence.task.id, !item.occurrence.task.done)}
                className="h-6 w-6 accent-[var(--accent)]"
              />
              <span className={item.occurrence.task.done ? 'line-through text-text-muted' : ''}>
                {item.occurrence.task.time ? `${item.occurrence.task.time} ` : ''}
                {item.occurrence.task.title}
              </span>
            </label>
          ) : (
            <Link
              key={item.key}
              to={`/experiment/${item.block.experimentId}/run`}
              className={`flex min-h-12 items-center gap-2 rounded-lg border px-2 text-sm cal-series-${item.block.colorIndex} ${item.block.status === 'done' ? 'opacity-55' : ''}`}
            >
              <span className="tabular-nums">{formatMinutes(item.block.startMin)}</span>
              <span className="min-w-0 truncate">{item.block.label}</span>
            </Link>
          ),
        )}
        {todays.length > 6 && (
          <Link to="/calendar" className="text-sm font-medium text-accent-text">
            +{todays.length - 6} more on the calendar
          </Link>
        )}
      </div>
    </section>
  );
}
