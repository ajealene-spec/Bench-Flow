import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export interface DragPayload {
  kind: 'task' | 'experiment';
  /** Task id, or experiment id. */
  id: string;
  /** The day the item sits on now. */
  fromDate: string;
  /** Short text shown under the pointer. */
  label: string;
}

interface Pending {
  payload: DragPayload;
  startX: number;
  startY: number;
  pointerId: number;
  dragging: boolean;
}

interface GhostState {
  payload: DragPayload;
  x: number;
  y: number;
  overDate?: string;
}

/** Pointer movement before a press counts as a drag. Keeps taps and scrolls working. */
export const DRAG_THRESHOLD_PX = 8;

/**
 * Drag-to-reschedule with pointer events, so it works with a finger on iPad and with a mouse. Any
 * element marked with data-drop-date is a drop target for that day. A press that does not move
 * past the threshold is left alone and becomes a normal click.
 */
export function useDragToDay(onDrop: (payload: DragPayload, toDate: string) => void) {
  const [ghost, setGhost] = useState<GhostState | null>(null);
  const pending = useRef<Pending | null>(null);
  const suppressClick = useRef(false);
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;

  const detach = useCallback(() => {
    window.removeEventListener('pointermove', handleMove);
    window.removeEventListener('pointerup', handleUp);
    window.removeEventListener('pointercancel', handleCancel);
    pending.current = null;
    setGhost(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleMove(e: PointerEvent) {
    const p = pending.current;
    if (!p || e.pointerId !== p.pointerId) return;
    if (!p.dragging) {
      if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < DRAG_THRESHOLD_PX) return;
      p.dragging = true;
    }
    e.preventDefault();
    setGhost({ payload: p.payload, x: e.clientX, y: e.clientY, overDate: dropDateAt(e.clientX, e.clientY) });
  }

  function handleUp(e: PointerEvent) {
    const p = pending.current;
    if (!p || e.pointerId !== p.pointerId) return;
    if (p.dragging) {
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      const target = dropDateAt(e.clientX, e.clientY);
      if (target && target !== p.payload.fromDate) dropRef.current(p.payload, target);
    }
    detach();
  }

  function handleCancel() {
    detach();
  }

  useEffect(() => detach, [detach]);

  const startDrag = useCallback((e: ReactPointerEvent<HTMLElement>, payload: DragPayload) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pending.current = { payload, startX: e.clientX, startY: e.clientY, pointerId: e.pointerId, dragging: false };
    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    // handleMove and handleUp read refs only, so re-binding per press is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** True right after a drag ended, so the click that follows does not also open the item. */
  const wasDragged = useCallback(() => suppressClick.current, []);

  return { ghost, startDrag, wasDragged };
}

function dropDateAt(x: number, y: number): string | undefined {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  return el?.closest<HTMLElement>('[data-drop-date]')?.dataset.dropDate;
}
