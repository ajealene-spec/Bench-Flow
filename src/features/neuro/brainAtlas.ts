/*
 * Schematic brain atlas geometry. Pure: no React, no DOM.
 *
 * Coordinates are mm from bregma, as in stereotax.ts: ap positive anterior, ml positive right,
 * dv the depth below the skull surface (positive deeper). Each view has a fixed frame that maps
 * mm to SVG pixels. Outlines are simplified by hand and are NOT to scale; they orient the user only.
 * The Allen Mouse Brain Common Coordinate Framework is the reference for real targets.
 */
import { angledApproach, ATLAS_BREGMA_LAMBDA_MM } from './stereotax';

export type AtlasView = 'sagittal' | 'coronal';
export interface Point2 {
  x: number;
  y: number;
}
export interface AtlasFrame {
  width: number;
  height: number;
  /** SVG pixels per mm. The same scale in both directions. */
  pxPerMm: number;
  /** SVG position of bregma (the origin of the mm coordinates). */
  originX: number;
  originY: number;
}

/** Sagittal view: anterior to the left, so the olfactory bulbs are on the left. */
export const SAGITTAL_FRAME: AtlasFrame = { width: 420, height: 200, pxPerMm: 24, originX: 150, originY: 40 };
/** Coronal view: ml positive to the right of the drawing, centred on the midline. */
export const CORONAL_FRAME: AtlasFrame = { width: 420, height: 200, pxPerMm: 24, originX: 210, originY: 40 };

/** Simplified midline outline as [ap, dv] pairs in mm. Dorsal surface at dv 0. */
export const SAGITTAL_OUTLINE: ReadonlyArray<readonly [number, number]> = [
  [4.9, 1.6], [4.4, 0.9], [3.6, 0.5], [2.4, 0.15], [0.8, 0.0], [-1.0, 0.0], [-2.8, 0.2], [-4.2, 0.6],
  [-5.2, 1.4], [-6.2, 2.4], [-7.1, 3.6], [-7.2, 4.6], [-6.4, 5.1], [-5.2, 4.9], [-4.2, 4.3], [-3.0, 4.6],
  [-1.6, 4.9], [0.0, 4.5], [1.6, 4.0], [2.8, 3.4], [3.9, 2.9], [4.7, 2.4],
];

/** Simplified coronal section outline as [ml, dv] pairs in mm, drawn for a mid-cortex level. */
export const CORONAL_OUTLINE: ReadonlyArray<readonly [number, number]> = [
  [-4.2, 1.4], [-3.8, 0.5], [-2.6, 0.1], [-1.0, 0.0], [1.0, 0.0], [2.6, 0.1], [3.8, 0.5], [4.2, 1.4],
  [4.4, 2.6], [4.0, 3.6], [3.0, 4.4], [1.6, 4.9], [0, 5.1], [-1.6, 4.9], [-3.0, 4.4], [-4.0, 3.6], [-4.4, 2.6],
];

/** Ranges the outlines cover. Targets outside them are flagged, not drawn off the edge. */
export const SAGITTAL_AP_RANGE: [number, number] = [-7.2, 4.9];
export const CORONAL_ML_LIMIT = 4.4;
export const SCHEMATIC_MAX_DV = Math.max(...SAGITTAL_OUTLINE.map(([, dv]) => dv));

/** Where the lambda suture sits in the sagittal view, just under the skull surface. */
const LAMBDA_DV = 0.6;

export function sagittalPoint(ap: number, dv: number, frame: AtlasFrame = SAGITTAL_FRAME): Point2 {
  return { x: round1(frame.originX - ap * frame.pxPerMm), y: round1(frame.originY + dv * frame.pxPerMm) };
}

export function coronalPoint(ml: number, dv: number, frame: AtlasFrame = CORONAL_FRAME): Point2 {
  return { x: round1(frame.originX + ml * frame.pxPerMm), y: round1(frame.originY + dv * frame.pxPerMm) };
}

/** SVG path for a closed mm outline. `toPoint` maps each [a, b] pair to SVG pixels. */
export function outlinePath(outline: ReadonlyArray<readonly [number, number]>, toPoint: (a: number, b: number) => Point2): string {
  const pts = outline.map(([a, b]) => toPoint(a, b));
  return `${pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')} Z`;
}

export interface CoronalTrack {
  /** Skull entry point at dv 0. */
  entry: Point2;
  /** Tip at the target. */
  tip: Point2;
  entryMl: number;
  insertionDepth: number;
}

/**
 * The injection track for an angled approach in the coronal plane. Returns undefined when the
 * approach cannot be computed (for example a negative depth or an angle of 60 degrees or more).
 */
export function coronalTrack(ml: number, dv: number, angleDeg: number): CoronalTrack | undefined {
  try {
    const a = angledApproach(ml, dv, angleDeg);
    return {
      entry: coronalPoint(a.entryMl, 0),
      tip: coronalPoint(a.ml, a.dv),
      entryMl: a.entryMl,
      insertionDepth: a.insertionDepth,
    };
  } catch {
    return undefined;
  }
}

/** Lambda marker in the sagittal view, at the measured bregma–lambda distance behind bregma. */
export function lambdaPoint(bregmaLambdaMm: number = ATLAS_BREGMA_LAMBDA_MM, frame: AtlasFrame = SAGITTAL_FRAME): Point2 {
  return sagittalPoint(-bregmaLambdaMm, LAMBDA_DV, frame);
}

export interface AtlasTarget {
  ap?: number;
  ml?: number;
  dv?: number;
  angleDeg?: number;
}

/** Plain-language warnings about a target that lies outside the schematic. Empty when it fits. */
export function atlasWarnings(target: AtlasTarget): string[] {
  const out: string[] = [];
  if (target.ap !== undefined && (target.ap > SAGITTAL_AP_RANGE[1] || target.ap < SAGITTAL_AP_RANGE[0])) {
    out.push(`AP ${target.ap} mm is outside the schematic, which spans AP ${SAGITTAL_AP_RANGE[0]} to ${SAGITTAL_AP_RANGE[1]} mm.`);
  }
  if (target.ml !== undefined && Math.abs(target.ml) > CORONAL_ML_LIMIT) {
    out.push(`ML ${target.ml} mm is outside the schematic, which spans ML ±${CORONAL_ML_LIMIT} mm.`);
  }
  if (target.dv !== undefined && target.dv > SCHEMATIC_MAX_DV) {
    out.push(`DV ${target.dv} mm is deeper than the schematic brain (${SCHEMATIC_MAX_DV} mm). Check the target against the atlas.`);
  }
  return out;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
