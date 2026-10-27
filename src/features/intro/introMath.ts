/*
 * Pure helpers for the intro page's scroll and count-up effects. They have no DOM access so the tests can
 * check them directly.
 */

export function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * Fill (0 to 1) for one segment of the how-it-works track. progress runs 0 to 1 across the whole track, and
 * the track has `segments` pieces, so each piece fills in turn.
 */
export function segmentFill(progress: number, index: number, segments: number): number {
  return clamp01(progress * segments - index);
}

/**
 * Progress of an element through the viewport. 0 when its top reaches 80% of the viewport height, 1 when its
 * bottom has reached that same line.
 */
export function trackProgress(top: number, height: number, viewportHeight: number): number {
  if (height <= 0) return 0;
  return clamp01((viewportHeight * 0.8 - top) / height);
}

/** Splits a stat such as "100%" or "$0" into prefix, whole number and suffix. Returns null if there is no number. */
export function parseStat(value: string): { prefix: string; target: number; suffix: string } | null {
  const match = /^(\D*?)(\d+)(\D*)$/.exec(value);
  if (!match) return null;
  return { prefix: match[1], target: Number(match[2]), suffix: match[3] };
}

/** Ease-out cubic: fast start, soft landing. t runs 0 to 1. */
export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - (1 - x) ** 3;
}
