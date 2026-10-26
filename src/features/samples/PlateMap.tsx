import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { listSamples, putSample } from '../../db/samples';
import { newId } from '../../db/helpers';
import type { SampleSheet, SampleWell } from '../../types';
import { downloadText, slug } from '../data/download';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, FIELD_INPUT } from '../data/fieldStyles';
import {
  applyGrid,
  assignWells,
  fitWellsToFormat,
  groupColor,
  groupNames,
  parseGrid,
  PLATE_SHAPE,
  plateCsv,
  type PlateFormat,
  wellIds,
  wellsInRect,
} from './plateMath';

/** Plate map for a run: 96 or 24 wells, tap or drag to select, then assign a sample and group. */
export function PlateMap({ experimentId, experimentName }: { experimentId: string; experimentName: string }) {
  const sheets = useLiveQuery(() => listSamples(experimentId, db), [experimentId]);
  if (sheets === undefined) return <p className="text-base text-text-muted">Loading plate map…</p>;
  const sheet = sheets[0];
  if (!sheet) return <CreatePlate experimentId={experimentId} />;
  return <PlateEditor key={sheet.id} sheet={sheet} experimentName={experimentName} />;
}

function CreatePlate({ experimentId }: { experimentId: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base text-text-muted">No plate map yet.</p>
      <div className="flex flex-wrap gap-3">
        {(['96', '24'] as const).map((format) => (
          <button
            key={format}
            type="button"
            className={format === '96' ? BUTTON_PRIMARY : BUTTON_SECONDARY}
            onClick={() => void putSample({ id: newId(), experimentId, format, wells: {} }, db)}
          >
            Create {format}-well plate
          </button>
        ))}
      </div>
    </div>
  );
}

function PlateEditor({ sheet, experimentName }: { sheet: SampleSheet; experimentName: string }) {
  const format: PlateFormat = sheet.format === '24' ? '24' : '96';
  const { rows, cols } = PLATE_SHAPE[format];
  const wells = sheet.wells;
  const groups = groupNames(format, wells);
  const [selection, setSelection] = useState<string[]>([]);
  const [label, setLabel] = useState('');
  const [group, setGroup] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [message, setMessage] = useState<string | undefined>(undefined);
  const anchor = useRef<string | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const stop = () => {
      dragging.current = false;
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

  function save(next: Record<string, SampleWell>) {
    void putSample({ ...sheet, wells: next }, db);
  }

  function onPointerDown(id: string) {
    dragging.current = true;
    anchor.current = id;
    setSelection([id]);
  }

  // Dragging: the pointer's element is found under the finger, so touch drags work too (touch events do not
  // fire pointerenter reliably on touch screens).
  function onGridPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current || anchor.current === null) return;
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const id = target?.dataset.well;
    if (id) setSelection(wellsInRect(format, anchor.current, id));
  }

  function assign(clear: boolean) {
    if (selection.length === 0) return setMessage('Select wells first, by tapping or dragging.');
    save(assignWells(format, wells, selection, clear ? { label: '', group: '' } : { label, group }));
    setMessage(clear ? `Cleared ${selection.length} wells.` : `Assigned ${selection.length} wells.`);
  }

  function paste() {
    const grid = parseGrid(pasteText);
    if (grid.length === 0) return setMessage('Paste cells from a spreadsheet first.');
    save(applyGrid(format, wells, selection[0] ?? 'A1', grid));
    setPasteText('');
    setMessage(`Placed ${grid.length} rows from ${selection[0] ?? 'A1'}.`);
  }

  function changeFormat(next: PlateFormat) {
    if (next === format) return;
    setSelection([]);
    void putSample({ ...sheet, format: next, wells: fitWellsToFormat(next, wells) }, db);
  }

  const selected = new Set(selection);
  const rowLetters = 'ABCDEFGH'.slice(0, rows).split('');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-muted">Plate</span>
          <select className={`${FIELD_INPUT} w-auto`} value={format} onChange={(e) => changeFormat(e.target.value as PlateFormat)}>
            <option value="96">96-well</option>
            <option value="24">24-well</option>
          </select>
        </label>
        <span className="text-base text-text-muted">
          {Object.keys(wells).length} filled{selection.length > 0 ? ` · ${selection.length} selected` : ''}
        </span>
      </div>

      <div className="overflow-x-auto pb-2" onPointerMove={onGridPointerMove}>
        <div
          role="grid"
          aria-label={`${format}-well plate map`}
          className="inline-grid gap-1"
          style={{ gridTemplateColumns: `3rem repeat(${cols}, 3rem)` }}
        >
          <div />
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} className="flex h-12 items-center justify-center text-sm text-text-muted">
              {c + 1}
            </div>
          ))}
          {rowLetters.map((letter) => (
            <Row key={letter} letter={letter}>
              {Array.from({ length: cols }, (_, c) => {
                const id = `${letter}${c + 1}`;
                const well = wells[id];
                const fill = groupColor(groups, well?.group ?? '');
                const isSelected = selected.has(id);
                return (
                  <button
                    key={id}
                    type="button"
                    data-well={id}
                    aria-label={`Well ${id}${well ? `, ${well.label}${well.group ? `, ${well.group}` : ''}` : ''}`}
                    aria-pressed={isSelected}
                    onPointerDown={() => onPointerDown(id)}
                    style={{ backgroundColor: fill, color: inkOn(fill) }}
                    className={`flex h-12 w-12 touch-none select-none items-center justify-center overflow-hidden rounded-md border text-[11px] leading-tight ${
                      isSelected ?'border-2 border-accent ring-2 ring-accent' :'border-border'
                    } ${fill ==='transparent' ?'bg-surface shadow-card' :''}`}
                  >
                    <span className="max-w-full truncate px-0.5">{well?.label ?? ''}</span>
                  </button>
                );
              })}
            </Row>
          ))}
        </div>
      </div>

      {groups.length > 0 && (
        <ul className="flex flex-wrap gap-3" aria-label="Groups">
          {groups.map((g) => (
            <li key={g} className="flex items-center gap-2 text-base">
              <span className="inline-block h-5 w-5 rounded border border-border-strong" style={{ backgroundColor: groupColor(groups, g) }} aria-hidden="true" />
              {g}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-muted">Sample</span>
          <input className={FIELD_INPUT} value={label} placeholder="e.g. S1 or Ctrl" onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-muted">Group</span>
          <input className={FIELD_INPUT} list={`groups-${sheet.id}`} value={group} placeholder="e.g. Control" onChange={(e) => setGroup(e.target.value)} />
          <datalist id={`groups-${sheet.id}`}>
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={BUTTON_PRIMARY} onClick={() => assign(false)}>
          Assign to selection
        </button>
        <button type="button" className={BUTTON_SECONDARY} onClick={() => assign(true)}>
          Clear selection
        </button>
        <button type="button" className={BUTTON_SECONDARY} onClick={() => setSelection(wellIds(format))}>
          Select all
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text-muted">Paste from a spreadsheet</span>
        <textarea
          aria-label="Paste from a spreadsheet"
          className="min-h-24 w-full rounded-xl border border-border bg-surface shadow-card p-3 text-base"
          value={pasteText}
          placeholder="Copy a block of cells and paste here. It starts at the first selected well."
          onChange={(e) => setPasteText(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={BUTTON_SECONDARY} onClick={paste}>
          Place pasted cells
        </button>
        <button
          type="button"
          className={BUTTON_SECONDARY}
          onClick={() => downloadText(`${slug(experimentName)}-plate-${format}.csv`, plateCsv(format, wells))}
        >
          Export CSV
        </button>
      </div>

      <p role="status" className="min-h-6 text-base text-text-muted">
        {message}
      </p>
    </div>
  );
}

function Row({ letter, children }: { letter: string; children: ReactNode }) {
  return (
    <>
      <div className="flex h-12 w-12 items-center justify-center text-sm font-medium text-text-muted" aria-hidden="true">
        {letter}
      </div>
      {children}
    </>
  );
}

/** Dark text on light fills and light text on dark fills. */
export function inkOn(hex: string): string {
  if (hex === 'transparent') return '#0f172a';
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.55 ? '#ffffff' : '#0f172a';
}
