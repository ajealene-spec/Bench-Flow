/*
 * Stereotaxic helpers. Pure math, no React or database.
 * Coordinates are in mm from bregma: ap (+ anterior), ml (+ right), dv (+ ventral is negative in
 * most atlases; here dv is the depth below the skull surface, positive numbers go deeper).
 */

/** Bregma-to-lambda distance in the adult mouse atlas reference, in mm. */
export const ATLAS_BREGMA_LAMBDA_MM = 4.2;

export class StereotaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StereotaxError';
  }
}

/** Scale factor from the measured bregma–lambda distance. 1 means the skull matches the atlas. */
export function skullScale(measuredBregmaLambdaMm: number, atlasMm = ATLAS_BREGMA_LAMBDA_MM): number {
  if (!Number.isFinite(measuredBregmaLambdaMm) || measuredBregmaLambdaMm <= 0) {
    throw new StereotaxError('Measured bregma–lambda distance must be greater than 0 mm');
  }
  if (!Number.isFinite(atlasMm) || atlasMm <= 0) throw new StereotaxError('Atlas distance must be greater than 0 mm');
  return measuredBregmaLambdaMm / atlasMm;
}

export interface ScaledAp {
  atlasAp: number;
  scale: number;
  /** AP coordinate to use on this animal, rounded to 0.01 mm. */
  ap: number;
}

/** Scales an atlas AP coordinate by the measured bregma–lambda distance. */
export function scaleAp(atlasAp: number, measuredBregmaLambdaMm: number, atlasMm = ATLAS_BREGMA_LAMBDA_MM): ScaledAp {
  if (!Number.isFinite(atlasAp)) throw new StereotaxError('AP coordinate must be a number');
  const scale = skullScale(measuredBregmaLambdaMm, atlasMm);
  return { atlasAp, scale, ap: round2(atlasAp * scale) };
}

export interface AngledApproach {
  /** Angle of the pipette or needle from vertical, in degrees. */
  angleDeg: number;
  /** Target coordinates at the tip. */
  ml: number;
  dv: number;
  /** Lateral point on the skull where the trajectory enters (ML at DV = 0). */
  entryMl: number;
  /** Lateral shift between entry and the tip ML in the same plane. */
  mlShift: number;
  /** Distance to advance along the tilted pipette from the skull surface to reach the tip. */
  insertionDepth: number;
}

/**
 * Angled approach. The trajectory leaves the skull at ML = targetMl - dv·tan(angle) so that the tip
 * lands on the target. Insertion along the tilted axis is dv / cos(angle).
 * The trajectory moves in the +ML direction as it descends, so a positive ML target with a
 * positive angle enters the skull further lateral (smaller ML) than the target.
 */
export function angledApproach(ml: number, dv: number, angleDeg: number): AngledApproach {
  if (!Number.isFinite(ml) || !Number.isFinite(dv)) throw new StereotaxError('ML and DV must be numbers');
  if (dv < 0) throw new StereotaxError('DV is the depth below the skull and must be 0 or more');
  if (!Number.isFinite(angleDeg) || angleDeg < 0 || angleDeg >= 60) {
    throw new StereotaxError('Angle must be from 0 up to (not including) 60 degrees');
  }
  const rad = (angleDeg * Math.PI) / 180;
  const mlShift = dv * Math.tan(rad);
  return {
    angleDeg,
    ml: round2(ml),
    dv: round2(dv),
    entryMl: round2(ml - mlShift),
    mlShift: round2(mlShift),
    insertionDepth: round2(dv / Math.cos(rad)),
  };
}

/** Converts a list of values to a printable one-line summary for the target card. */
export function formatCoordinate(label: string, value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${label} ${sign}${Math.abs(value).toFixed(2)} mm`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
