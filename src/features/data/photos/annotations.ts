import type { PhotoAnnotation } from '../../../types';

/**
 * Annotations on a photo: text labels placed by fraction of the image size, and lane-number strips for gels
 * and blots. The stored form is the JSON of the annotation array, so it round-trips exactly.
 */

export const MAX_LABEL_LENGTH = 60;
export const MAX_LANES = 30;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** JSON of the annotation array, with only the stored fields. */
export function serializeAnnotations(list: PhotoAnnotation[]): string {
  return JSON.stringify(list.map((a) => ({ id: a.id, x: a.x, y: a.y, text: a.text })));
}

/**
 * Reads annotations back from JSON. Anything malformed is dropped rather than failing the whole photo:
 * entries need a string id, finite coordinates (clamped to 0 to 1) and non-empty text.
 */
export function parseAnnotations(json: string): PhotoAnnotation[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: PhotoAnnotation[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const { id, x, y, text } = item as Record<string, unknown>;
    if (typeof id !== 'string' || typeof x !== 'number' || typeof y !== 'number') continue;
    if (!Number.isFinite(x) || !Number.isFinite(y) || typeof text !== 'string') continue;
    const clean = text.trim().slice(0, MAX_LABEL_LENGTH);
    if (clean === '') continue;
    out.push({ id, x: clamp01(x), y: clamp01(y), text: clean });
  }
  return out;
}

/** Adds a text label at a fractional position. Blank text is ignored, so the list is returned unchanged. */
export function addLabel(list: PhotoAnnotation[], x: number, y: number, text: string, id: string): PhotoAnnotation[] {
  const clean = text.trim().slice(0, MAX_LABEL_LENGTH);
  if (clean === '') return list;
  return [...list, { id, x: clamp01(x), y: clamp01(y), text: clean }];
}

export function removeAnnotation(list: PhotoAnnotation[], id: string): PhotoAnnotation[] {
  return list.filter((a) => a.id !== id);
}

/**
 * Lane-number strip along the top of the image: labels 1..count, evenly spaced. `idPrefix` keeps ids unique
 * when several strips are added to one photo.
 */
export function laneStrip(count: number, idPrefix: string, y = 0.04): PhotoAnnotation[] {
  const n = Math.min(MAX_LANES, Math.max(1, Math.floor(count)));
  return Array.from({ length: n }, (_, i) => ({
    id: `${idPrefix}-lane-${i + 1}`,
    x: (i + 0.5) / n,
    y: clamp01(y),
    text: String(i + 1),
  }));
}

/** Draws the annotations on a 2D canvas context of the given pixel size. */
export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  list: PhotoAnnotation[],
): void {
  const fontPx = Math.max(12, Math.round(width / 40));
  ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  for (const a of list) {
    const px = a.x * width;
    const py = a.y * height;
    const textWidth = ctx.measureText(a.text).width;
    const pad = fontPx * 0.4;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(px - textWidth / 2 - pad, py - fontPx / 2 - pad / 2, textWidth + pad * 2, fontPx + pad);
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText(a.text, px, py);
  }
}
