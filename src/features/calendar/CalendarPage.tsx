import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { setTaskDone, updateTask } from '../../db/tasks';
import type { Task } from '../../types';
import { addDays, dayKey, daysBetween, formatDayLabel, monthGridDays, startOfWeek } from './dates';
import { AgendaView, MonthView, WeekView, type CalendarViewProps } from './CalendarViews';
import { listCalendarItems } from './calendarData';
import { buildIcs } from './ics';
import { groupItemsByDay } from './dayItems';
import { useDragToDay, type DragPayload } from './dragDrop';
import { moveExperimentToDay } from './experimentSchedule';
import { TaskDialog } from './TaskDialog';
import { ScheduleExperimentDialog } from './ScheduleExperimentDialog';
import type { TaskOccurrence } from './recurrence';
import { BTN_BASE, BTN_PRIMARY, BTN_SECONDARY, CARD } from './ui';
import { SERIES_COUNT } from './experimentBlocks';
import './calendar.css';

type View = 'month' | 'week' | 'agenda';
const AGENDA_DAYS = 30;
const PHONE_QUERY = '(max-width: 639px)';

interface Range {
  start: string;
  end: string;
  days: string[];
}

function rangeFor(view: View, anchor: string): Range {
  if (view === 'month') {
    const days = monthGridDays(anchor);
    return { start: days[0], end: days[days.length - 1], days };
  }
  if (view === 'week') {
    const start = startOfWeek(anchor);
    const days = daysBetween(start, addDays(start, 6));
    return { start, end: days[6], days };
  }
  const days = daysBetween(anchor, addDays(anchor, AGENDA_DAYS - 1));
  return { start: anchor, end: days[days.length - 1], days };
}

/** Moves the anchor by one month, keeping it on the first of the month. */
function shiftMonth(anchor: string, delta: number): string {
  const [y, m] = anchor.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function headingFor(view: View, anchor: string, range: Range): string {
  if (view === 'month') {
    const [y, m] = anchor.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  return `${formatDayLabel(range.start)} – ${formatDayLabel(range.end)}`;
}

function startsNarrow(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;
}

export default function CalendarPage() {
  const [view, setView] = useState<View>(() => (startsNarrow() ? 'agenda' : 'month'));
  const [anchor, setAnchor] = useState(() => dayKey(Date.now()));
  const [editing, setEditing] = useState<{ date: string; task?: Task } | null>(null);
  const [scheduling, setScheduling] = useState<{ day?: string } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const today = dayKey(Date.now());

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);
  const items = useLiveQuery(() => listCalendarItems(range.start, range.end, db), [range.start, range.end]);
  const byDay = useMemo(() => (items ? groupItemsByDay(items) : new Map()), [items]);

  const drag = useDragToDay(async (payload: DragPayload, toDate: string) => {
    if (payload.kind === 'task') {
      await updateTask(payload.id, { date: toDate });
    } else {
      await moveExperimentToDay(payload.id, payload.fromDate, toDate);
    }
  });

  const views: CalendarViewProps = {
    days: range.days,
    byDay,
    today,
    month: anchor.slice(0, 7),
    onQuickAdd: (date) => setEditing({ date }),
    onOpenTask: (occurrence: TaskOccurrence) => setEditing({ date: occurrence.date, task: occurrence.task }),
    onToggleTask: (occurrence: TaskOccurrence) => {
      void setTaskDone(occurrence.task.id, !occurrence.task.done);
    },
    onOpenDay: (day) => {
      setAnchor(day);
      setView('agenda');
    },
    drag,
  };

  function step(delta: number) {
    if (view === 'month') setAnchor(shiftMonth(anchor, delta));
    else if (view === 'week') setAnchor(addDays(anchor, 7 * delta));
    else setAnchor(addDays(anchor, AGENDA_DAYS * delta));
  }

  async function exportIcs() {
    setExportError(null);
    try {
      const [tasks, calendar] = await Promise.all([
        db.tasks.toArray(),
        listCalendarItems(addDays(today, -365), addDays(today, 365), db),
      ]);
      const ics = buildIcs({ tasks, blocks: calendar.blocks, now: Date.now() });
      const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `bench-flow-${today}.ics`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Could not build the calendar file. Try again.');
    }
  }

  const runs = useMemo(() => {
    const seen = new Map<string, { name: string; colorIndex: number }>();
    for (const b of items?.blocks ?? []) {
      if (!seen.has(b.experimentId)) seen.set(b.experimentId, { name: b.experimentName, colorIndex: b.colorIndex });
    }
    return [...seen.entries()];
  }, [items]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 p-4 pb-12 sm:p-6 md:max-w-5xl">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-text">Calendar</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setAnchor(today)} className={BTN_SECONDARY}>
            Today
          </button>
          <button type="button" onClick={() => step(-1)} aria-label="Previous" className={BTN_SECONDARY}>
            ‹
          </button>
          <button type="button" onClick={() => step(1)} aria-label="Next" className={BTN_SECONDARY}>
            ›
          </button>
          <h2 className="min-w-0 flex-1 text-lg font-semibold text-text" aria-live="polite">
            {headingFor(view, anchor, range)}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="View" className="inline-flex rounded-xl border border-border bg-surface p-1 shadow-card">
            {(['month', 'week', 'agenda'] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`${BTN_BASE} min-w-12 px-3 capitalize ${view === v ? 'bg-accent text-on-accent' : 'text-text'}`}
              >
                {v}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setEditing({ date: anchor })} className={BTN_PRIMARY}>
            Add task
          </button>
          <button type="button" onClick={() => setScheduling({ day: anchor })} className={BTN_SECONDARY}>
            Schedule experiment
          </button>
          <button type="button" onClick={exportIcs} className={BTN_SECONDARY}>
            Export .ics
          </button>
        </div>
        {exportError && (
          <p role="alert" className="text-sm font-medium text-text">
            {exportError}
          </p>
        )}
        {runs.length > 0 && (
          <ul aria-label="Runs in view" className="flex flex-wrap gap-2 text-sm text-text">
            {runs.map(([id, run]) => (
              <li key={id} className="flex min-h-12 items-center gap-2 rounded-lg px-2">
                <span className={`h-3 w-3 rounded-full cal-swatch-${run.colorIndex % SERIES_COUNT}`} aria-hidden="true" />
                {run.name}
              </li>
            ))}
          </ul>
        )}
      </header>

      {items === undefined ? (
        <p className="text-text-muted">Loading…</p>
      ) : view === 'month' ? (
        <MonthView {...views} />
      ) : view === 'week' ? (
        <WeekView {...views} />
      ) : (
        <AgendaView {...views} />
      )}

      {editing && (
        <TaskDialog
          key={`${editing.date}-${editing.task?.id ?? 'new'}`}
          date={editing.date}
          task={editing.task}
          onClose={() => setEditing(null)}
        />
      )}
      {scheduling && (
        <ScheduleExperimentDialog defaultDay={scheduling.day} onClose={() => setScheduling(null)} />
      )}

      {drag.ghost && (
        <div
          aria-hidden="true"
          className={`${CARD} pointer-events-none fixed z-50 max-w-[70vw] px-3 py-2 text-sm text-text`}
          style={{ left: drag.ghost.x + 12, top: drag.ghost.y + 12 }}
        >
          <span className="font-medium">{drag.ghost.payload.label}</span>
          {drag.ghost.overDate && <span className="text-text-muted"> → {formatDayLabel(drag.ghost.overDate)}</span>}
        </div>
      )}

      <p className="text-sm text-text-muted">
        Drag a task to another day. Drag the first day of a run that has not started to move the whole run. Tap a
        phase to open its run.
      </p>
    </main>
  );
}
