import { useNavigate } from 'react-router-dom';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { formatDayLabel, formatMinutes } from './dates';
import type { DayItem } from './dayItems';
import type { ExperimentBlock } from './experimentBlocks';
import type { TaskOccurrence } from './recurrence';
import type { DragPayload } from './dragDrop';
import { BTN_BASE, CARD, CHIP } from './ui';

export interface CalendarViewProps {
  days: string[];
  byDay: Map<string, DayItem[]>;
  today: string;
  /** yyyy-mm of the month shown; days outside it are dimmed in the month view. */
  month: string;
  onQuickAdd: (day: string) => void;
  onOpenTask: (occurrence: TaskOccurrence) => void;
  onToggleTask: (occurrence: TaskOccurrence) => void;
  onOpenDay: (day: string) => void;
  drag: {
    startDrag: (e: ReactPointerEvent<HTMLElement>, payload: DragPayload) => void;
    wasDragged: () => boolean;
  };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Opens a run's run page when a phase block is tapped. */
function useOpenBlock() {
  const navigate = useNavigate();
  return (block: ExperimentBlock) => navigate(`/experiment/${block.experimentId}/run`);
}

/** Button for one item. Tasks and phases are both draggable (phases only on the run's first day). */
function Item({
  item,
  compact,
  props,
}: {
  item: DayItem;
  compact: boolean;
  props: CalendarViewProps;
}) {
  const openBlock = useOpenBlock();
  if (item.kind === 'task') {
    const { occurrence } = item;
    const { task } = occurrence;
    const payload: DragPayload = { kind: 'task', id: task.id, fromDate: occurrence.date, label: task.title };
    const draggable = !occurrence.recurring;
    const titleClass = task.done ? 'line-through text-text-muted' : 'text-text';
    return (
      <div className="flex min-w-0 items-center gap-1">
        {!compact && !occurrence.recurring && (
          <label className="flex min-h-12 min-w-12 shrink-0 cursor-pointer items-center justify-center">
            <span className="sr-only">Done</span>
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => props.onToggleTask(occurrence)}
              className="h-6 w-6 accent-[var(--accent)]"
            />
          </label>
        )}
        <button
          type="button"
          onClick={() => {
            if (!props.drag.wasDragged()) props.onOpenTask(occurrence);
          }}
          onPointerDown={draggable ? (e) => props.drag.startDrag(e, payload) : undefined}
          className={`${CHIP} ${compact ? 'items-center' : 'items-start py-2'} ${draggable ? 'touch-none cursor-grab' : ''} flex-1 gap-2 border border-border bg-surface px-2 shadow-card ${titleClass}`}
        >
          {task.time && <span className="shrink-0 tabular-nums text-text-muted">{task.time}</span>}
          <span className={`min-w-0 ${compact ? 'truncate' : 'break-words'}`}>{task.title}</span>
          {!compact && occurrence.recurring && <span className="shrink-0 text-xs text-text-muted">repeats</span>}
        </button>
      </div>
    );
  }

  const { block } = item;
  const draggable = block.moveHandle;
  const payload: DragPayload = { kind: 'experiment', id: block.experimentId, fromDate: block.date, label: block.experimentName };
  const statusClass =
    block.status === 'done' ? 'opacity-55' : block.status === 'current' ? 'cal-today-ring font-semibold' : '';
  const timeText = `${formatMinutes(block.startMin)}–${block.endMin >= 1440 ? '24:00' : formatMinutes(block.endMin)}`;
  return (
    <button
      type="button"
      onClick={() => {
        if (!props.drag.wasDragged()) openBlock(block);
      }}
      onPointerDown={draggable ? (e) => props.drag.startDrag(e, payload) : undefined}
      title={`${block.label} (${timeText})`}
      className={`${CHIP} ${compact ? 'items-center' : 'items-start py-2'} cal-series-${block.colorIndex} ${statusClass} ${draggable ? 'touch-none cursor-grab' : ''} w-full gap-2 border px-2`}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        {!compact && <span className="text-xs tabular-nums">{formatMinutes(block.startMin)}</span>}
        <span className={`min-w-0 ${compact ? 'truncate' : 'break-words'}`}>{block.label}</span>
      </span>
      {!compact && block.status === 'done' && <span className="shrink-0 text-xs">done</span>}
      {!compact && block.status === 'current' && <span className="shrink-0 text-xs">now</span>}
    </button>
  );
}

/** Month grid. Phones show colored dots instead of item names. */
export function MonthView(props: CalendarViewProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-7 text-center text-xs font-medium text-text-muted">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {props.days.map((day) => {
          const items = props.byDay.get(day) ?? [];
          const isToday = day === props.today;
          const dayNumber = Number(day.slice(8));
          return (
            <div
              key={day}
              data-drop-date={day}
              className={`${CARD} flex min-w-0 flex-col gap-1 p-1 sm:p-2 ${day.slice(0, 7) !== props.month ? 'opacity-60' : ''}`}
            >
              <button
                type="button"
                onClick={() => props.onQuickAdd(day)}
                aria-label={`Add to ${formatDayLabel(day)}`}
                className={`${BTN_BASE} min-w-12 self-start px-2 text-sm ${isToday ? 'bg-accent text-on-accent' : 'text-text'}`}
              >
                {dayNumber}
              </button>
              <div className="flex flex-wrap gap-1 lg:hidden" aria-hidden="true">
                {items.slice(0, 4).map((item) => (
                  <span
                    key={item.key}
                    className={`h-2 w-2 rounded-full ${item.kind === 'block' ? `cal-swatch-${item.block.colorIndex}` : 'bg-text-muted'}`}
                  />
                ))}
              </div>
              <div className="hidden flex-col gap-1 lg:flex">
                {items.slice(0, 3).map((item) => (
                  <Item key={item.key} item={item} compact props={props} />
                ))}
                {items.length > 3 && (
                  <button type="button" onClick={() => props.onOpenDay(day)} className={`${BTN_BASE} px-2 text-xs text-text-muted`}>
                    +{items.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Seven day columns on laptops and iPads, stacked days on phones. */
export function WeekView(props: CalendarViewProps) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
      {props.days.map((day) => {
        const items = props.byDay.get(day) ?? [];
        const isToday = day === props.today;
        return (
          <section
            key={day}
            data-drop-date={day}
            aria-label={formatDayLabel(day)}
            className={`${CARD} flex min-w-0 flex-col gap-2 p-2 ${isToday ? 'cal-today-ring' : ''}`}
          >
            <button
              type="button"
              onClick={() => props.onQuickAdd(day)}
              className={`${BTN_BASE} justify-start px-2 text-sm font-semibold ${isToday ? 'text-accent-text' : 'text-text'}`}
            >
              {formatDayLabel(day)}
              <span className="sr-only">, add item</span>
            </button>
            {items.length === 0 && <p className="px-2 text-sm text-text-muted">Nothing planned</p>}
            {items.map((item) => (
              <Item key={item.key} item={item} compact={false} props={props} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

/** Day-by-day list. The default on phones. Empty days are skipped. */
export function AgendaView(props: CalendarViewProps) {
  const days = props.days.filter((d) => (props.byDay.get(d)?.length ?? 0) > 0);
  return (
    <div className="flex flex-col gap-3">
      {days.length === 0 && (
        <p className={`${CARD} p-4 text-text-muted`}>Nothing planned in this stretch. Add a task or schedule a run.</p>
      )}
      {days.map((day) => (
        <section key={day} data-drop-date={day} aria-label={formatDayLabel(day)} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className={`text-base font-semibold ${day === props.today ? 'text-accent-text' : 'text-text'}`}>
              {formatDayLabel(day)}
              {day === props.today && <span className="ml-2 text-sm font-medium">Today</span>}
            </h2>
            <button type="button" onClick={() => props.onQuickAdd(day)} className={`${BTN_BASE} px-3 text-sm`}>
              Add
            </button>
          </div>
          {(props.byDay.get(day) ?? []).map((item) => (
            <Item key={item.key} item={item} compact={false} props={props} />
          ))}
        </section>
      ))}
    </div>
  );
}

