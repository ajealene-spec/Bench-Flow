/** Text the tour writes out from the sample run. Pure: the same inputs always give the same paragraph. */

import {
  SAMPLE_ANTIBODY_RATIO,
  SAMPLE_BLOCK_ACTUAL_SEC,
  SAMPLE_BLOCK_PLANNED_SEC,
  SAMPLE_COUNTS,
  SAMPLE_COUNT_UNIT,
  SAMPLE_FINAL_VOLUME_ML,
  SAMPLE_REGIONS,
} from './sampleData';
import { formatMeanSd, summarize } from './tourStats';

/**
 * A Methods paragraph built from the sample run. Numbers come from the same constants the tour
 * uses for its charts, so the text and the figures agree.
 */
export function sampleMethodsParagraph(): string {
  const blockDeltaMin = Math.round((SAMPLE_BLOCK_ACTUAL_SEC - SAMPLE_BLOCK_PLANNED_SEC) / 60);
  const counts = SAMPLE_REGIONS.map((region) => {
    const s = summarize(SAMPLE_COUNTS[region]);
    return `${region} ${formatMeanSd(s)}`;
  }).join('; ');
  return [
    'Free-floating dorsal hippocampal sections were washed in PBS, then permeabilized and blocked in 0.3% Triton X-100 with 5% donkey serum.',
    `The block ran ${blockDeltaMin} minutes over its ${SAMPLE_BLOCK_PLANNED_SEC / 60}-minute plan (${SAMPLE_BLOCK_ACTUAL_SEC / 60} minutes actual), and the deviation was logged.`,
    `Rabbit anti-NeuN was applied at 1:${SAMPLE_ANTIBODY_RATIO} in a ${SAMPLE_FINAL_VOLUME_ML} mL final volume, which is 4 µL of antibody per reaction; the stock had settled, so the volume was raised to 5 µL.`,
    'Sections were incubated with donkey anti-rabbit Alexa Fluor 488 at 1:500, counterstained with DAPI and mounted in antifade medium.',
    `NeuN+ cell density (${SAMPLE_COUNT_UNIT}, mean ± SD, n = 3 animals): ${counts}.`,
  ].join(' ');
}
