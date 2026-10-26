/*
 * SAMPLE data for the guided tour and the demo experiment. Every number here is made up for
 * illustration. Nothing in this file is a real measurement.
 */

export const SAMPLE_LABEL = 'Sample data';

export const SAMPLE_ANIMALS = ['Animal 1', 'Animal 2', 'Animal 3'] as const;
export const SAMPLE_REGIONS = ['CA1', 'CA3', 'DG'] as const;
export type SampleRegion = (typeof SAMPLE_REGIONS)[number];

/** NeuN+ cells per 100 µm² of section, [animal 1, animal 2, animal 3], per hippocampal region. */
export const SAMPLE_COUNTS: Record<SampleRegion, readonly number[]> = {
  CA1: [184, 196, 171],
  CA3: [142, 151, 137],
  DG: [268, 255, 281],
};

export const SAMPLE_COUNT_UNIT = 'cells/100 µm²';

/** Label used for each sample count record, so the seed can tell whether they already exist. */
export function sampleCountLabel(region: SampleRegion, animal: string): string {
  return `${SAMPLE_LABEL}: NeuN+ ${region}, ${animal}`;
}

export const SAMPLE_LABEL_PREFIX = `${SAMPLE_LABEL}: NeuN+`;

/** A short IF protocol used by the tour's paste step. Written for the demo, not copied from a source. */
export const SAMPLE_PROTOCOL_TEXT = `Wash sections in PBS, 3 x 10 min.
Permeabilize and block in 0.3% Triton X-100 with 5% donkey serum for 60 min at room temperature.
Primary antibody: rabbit anti-NeuN 1:1000 in blocking buffer, 4 µL in a 4 mL final volume. Incubate overnight at 4 °C.
Wash after primary, 3 x 10 min in PBS.
Secondary antibody: donkey anti-rabbit Alexa Fluor 488 at 1:500 for 2 h in the dark.
Wash and counterstain with DAPI, 15 min.
Mount sections with antifade medium and image.`;

/** Planned and actual durations, in minutes, for the run timeline in the tour. */
export interface SampleTimelineRow {
  label: string;
  startMin: number;
  endMin: number;
  plannedMin?: number;
}

export const SAMPLE_TIMELINE: SampleTimelineRow[] = [
  { label: 'Wash sections', startMin: 0, endMin: 32, plannedMin: 30 },
  { label: 'Permeabilize and block', startMin: 35, endMin: 104, plannedMin: 60 },
  { label: 'Primary antibody', startMin: 110, endMin: 1100 },
  { label: 'Secondary antibody', startMin: 1150, endMin: 1280 },
  { label: 'Mount and image', startMin: 1310, endMin: 1340 },
];

/** The block timer: planned and actual, in seconds. */
export const SAMPLE_BLOCK_PLANNED_SEC = 3600;
export const SAMPLE_BLOCK_ACTUAL_SEC = 4020;

/** Antibody dilution used in the tour's focus-mode calculator. */
export const SAMPLE_ANTIBODY_RATIO = 1000;
export const SAMPLE_FINAL_VOLUME_ML = 4;
