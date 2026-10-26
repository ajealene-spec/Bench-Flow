import type { PhotoAnnotation, PhotoArrow, PhotoLabel } from '../../../types';

/**
 * Annotations on a photo: text labels and arrows placed by fraction of the image size, plus lane-number
 * strips for gels and blots. The stored form is JSON, so it round-trips exactly. Labels are stored as
 * {id, x, y, text} (the original form); arrows as {id, type: 'arrow', x1, y1, x2, y2, text?}.
 */

export const MAX_LABEL_LENGTH = 60;
export const MAX_LANES = 30;
/** Arrows shorter than this (as a fraction of the image) are treated as a click, not an arrow. */
export const MIN_ARROW_LENGTH = 0.02;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** The text on an annotation: a label's text, or an arrow's caption. Empty when an arrow has none. */
export function annotationText(a: PhotoAnnotation): string {
  return a.type === 'arrow' ? a.text ?? '' : a.text;
}

/** JSON of the annotation array, with only the stored fields. */
export function serializeAnnotations(list: PhotoAnnotation[]): string {
  return JSON.stringify(
    list.map((a) =>
      a.type === 'arrow'
        ? { id: a.id, type: 'arrow', x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2, ...(a.text ? { text: a.text } : {}) }
        : { id: a.id, x: a.x, y: a.y, text: a.text },
    ),
  );
}

function parseArrow(item: Record<string, unknown>): PhotoArrow | undefined {
  const { id, x1, y1, x2, y2, text } = item;
  if (typeof id !== 'string') return undefined;
  for (const v of [x1, y1, x2, y2]) if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  const arrow: PhotoArrow = { id, type: 'arrow', x1: clamp01(x1 as number), y1: clamp01(y1 as number), x2: clamp01(x2 as number), y2: clamp01(y2 as number) };
  if (typeof text === 'string' && text.trim()) arrow.text = text.trim().slice(0, MAX_LABEL_LENGTH);
  return arrow;
}

/**
 * Reads annotations back from JSON. Anything malformed is dropped rather than failing the whole photo:
 * labels need a string id, finite coordinates (clamped to 0 to 1) and non-empty text; arrows need four
 * finite coordinates.
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
    const record = item as Record<string, unknown>;
    if (record.type === 'arrow') {
      const arrow = parseArrow(record);
      if (arrow) out.push(arrow);
      continue;
    }
    const { id, x, y, text } = record;
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

/** Adds an arrow from one point to another. Arrows that are too short are ignored. */
export function addArrow(
  list: PhotoAnnotation[],
  from: { x: number; y: number },
  to: { x: number; y: number },
  id: string,
  text = '',
): PhotoAnnotation[] {
  if (Math.hypot(to.x - from.x, to.y - from.y) < MIN_ARROW_LENGTH) return list;
  const arrow: PhotoArrow = {
    id,
    type: 'arrow',
    x1: clamp01(from.x),
    y1: clamp01(from.y),
    x2: clamp01(to.x),
    y2: clamp01(to.y),
  };
  const clean = text.trim().slice(0, MAX_LABEL_LENGTH);
  if (clean) arrow.text = clean;
  return [...list, arrow];
}

export function removeAnnotation(list: PhotoAnnotation[], id: string): PhotoAnnotation[] {
  return list.filter((a) => a.id !== id);
}

/**
 * Lane-number strip along the top of the image: labels 1..count, evenly spaced. `idPrefix` keeps ids unique
 * when several strips are added to one photo.
 */
export function laneStrip(count: number, idPrefix: string, y = 0.04): PhotoLabel[] {
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
    if (a.type === 'arrow') {
      drawArrow(ctx, width, height, a, fontPx);
      continue;
    }
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

/** Draws one arrow: a line with a filled head at the end, and an optional caption at the tail. */
function drawArrow(ctx: CanvasRenderingContext2D, width: number, height: number, a: PhotoArrow, fontPx: number): void {
  const x1 = a.x1 * width;
  const y1 = a.y1 * height;
  const x2 = a.x2 * width;
  const y2 = a.y2 * height;
  const lineWidth = Math.max(2, Math.round(fontPx / 5));
  const headLength = fontPx * 1.2;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.strokeStyle = '#facc15';
  ctx.fillStyle = '#facc15';
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 7), y2 - headLength * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 7), y2 - headLength * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fill();
  if (a.text) {
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText(a.text, x1, y1 - fontPx);
  }
}

/** Plain-text list of an annotation set, for captions, exports and the research package index. */
export function describeAnnotations(list: PhotoAnnotation[]): string[] {
  return list.map((a) => (a.type === 'arrow' ? `arrow${a.text ? `: ${a.text}` : ''}` : a.text)).filter(Boolean);
}
