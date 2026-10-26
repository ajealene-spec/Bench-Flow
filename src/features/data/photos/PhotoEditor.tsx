import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { db } from '../../../db';
import { putPhoto } from '../../../db/photos';
import { newId } from '../../../db/helpers';
import type { Photo, PhotoAnnotation } from '../../../types';
import { downloadBlob } from '../download';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, FIELD_INPUT } from '../fieldStyles';
import { addLabel, drawAnnotations, laneStrip, MAX_LABEL_LENGTH, removeAnnotation } from './annotations';
import { useObjectUrl } from './objectUrl';

const MAX_CANVAS_WIDTH = 1200;

/**
 * Annotation sheet for one photo. Tap the image to choose where the next label goes, type the text, and add it.
 * A lane strip adds numbered labels along the top for gels and blots. Save stores the annotation array on the photo.
 */
export function PhotoEditor({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const url = useObjectUrl(photo.blob);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | undefined>(undefined);
  const [annotations, setAnnotations] = useState<PhotoAnnotation[]>(photo.annotations);
  const [point, setPoint] = useState({ x: 0.5, y: 0.5 });
  const [text, setText] = useState('');
  const [lanes, setLanes] = useState('6');
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!url) return;
    const img = new Image();
    img.onload = () => setImage(img);
    img.onerror = () => setError('This photo could not be opened.');
    img.src = url;
  }, [url]);

  // Redraw whenever the picture or the annotations change.
  useEffect(() => {
    const el = canvas.current;
    if (!el || !image) return;
    const scale = Math.min(1, MAX_CANVAS_WIDTH / image.naturalWidth);
    el.width = Math.round(image.naturalWidth * scale);
    el.height = Math.round(image.naturalHeight * scale);
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(image, 0, 0, el.width, el.height);
    drawAnnotations(ctx, el.width, el.height, annotations);
  }, [image, annotations]);

  function onTap(e: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setPoint({
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    });
  }

  function addText() {
    const next = addLabel(annotations, point.x, point.y, text, newId());
    if (next === annotations) return setError('Type the label text first.');
    setError(undefined);
    setAnnotations(next);
    setText('');
  }

  function addLanes() {
    const count = Number(lanes);
    if (!Number.isFinite(count) || count < 1) return setError('Enter how many lanes.');
    setError(undefined);
    setAnnotations([...annotations, ...laneStrip(count, newId())]);
  }

  async function save() {
    await putPhoto({ ...photo, annotations }, db);
    onClose();
  }

  function exportPng() {
    const el = canvas.current;
    el?.toBlob((blob) => {
      if (blob) downloadBlob(`photo-${photo.at}.png`, blob);
    }, 'image/png');
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Annotate photo" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:p-6">
      <div className="flex w-full max-w-3xl flex-col gap-4 rounded-2xl bg-surface shadow-card p-4 text-text">
        <h2 className="text-xl font-semibold">Annotate photo</h2>
        {image ? (
          <canvas
            ref={canvas}
            onPointerDown={onTap}
            className="h-auto w-full touch-none rounded-lg bg-surface-2"
            aria-label="Photo. Tap where the next label should go."
          />
        ) : (
          <p className="text-base">{error ?? 'Loading photo…'}</p>
        )}
        <p className="text-sm text-text-muted">
          Next label goes at {Math.round(point.x * 100)}% across, {Math.round(point.y * 100)}% down. Tap the photo to move it.
        </p>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            aria-label="Label text"
            className={FIELD_INPUT}
            value={text}
            maxLength={MAX_LABEL_LENGTH}
            placeholder="Label text, e.g. Actin"
            onChange={(e) => setText(e.target.value)}
          />
          <button type="button" className={BUTTON_PRIMARY} onClick={addText}>
            Add label
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            aria-label="Number of lanes"
            className={FIELD_INPUT}
            inputMode="numeric"
            value={lanes}
            onChange={(e) => setLanes(e.target.value)}
          />
          <button type="button" className={BUTTON_SECONDARY} onClick={addLanes}>
            Add lane numbers
          </button>
        </div>

        {error && <p role="alert" className="text-base text-rose-700 dark:text-rose-300">{error}</p>}

        {annotations.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label="Annotations">
            {annotations.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                <span className="text-base">{a.text}</span>
                <button type="button" className={BUTTON_SECONDARY} onClick={() => setAnnotations(removeAnnotation(annotations, a.id))}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="button" className={BUTTON_PRIMARY} onClick={() => void save()}>
            Save annotations
          </button>
          <button type="button" className={BUTTON_SECONDARY} onClick={exportPng} disabled={!image}>
            Download PNG
          </button>
          <button type="button" className={BUTTON_SECONDARY} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
