/** Text the tour writes out from the sample run. Pure: the same inputs always give the same paragraph. */

import {
  CELLS_PER_GROUP,
  FLUO4_ACTUAL_UM,
  FLUO4_PLANNED_UM,
  FLUO4_STOCK_MM,
  INCUBATION_37_SEC,
  INCUBATION_RT_SEC,
  ROIS_PER_COVERSLIP,
  SAMPLE_COVERSLIPS,
  SAMPLE_LOADING_VOLUME_ML,
} from './sampleData';

/** Stock volume (µL) for a given final concentration (µM) in a loading volume (mL), from a stock in mM. */
function stockMicroliters(finalUM: number, volumeMl: number, stockMM: number): number {
  return (finalUM * volumeMl * 1000) / (stockMM * 1000);
}

/**
 * A Methods paragraph built from the sample run. It states the actual Fluo-4 AM loading concentration
 * (4.17 µM, planned 5 µM) and draws no conclusion about the genotypes.
 */
export function sampleMethodsParagraph(): string {
  const plannedUl = stockMicroliters(FLUO4_PLANNED_UM, SAMPLE_LOADING_VOLUME_ML, FLUO4_STOCK_MM);
  const actualUl = stockMicroliters(FLUO4_ACTUAL_UM, SAMPLE_LOADING_VOLUME_ML, FLUO4_STOCK_MM);
  return [
    'iPSC-derived APOE3 and APOE4 astrocytes were plated on coverslips coated with Matrigel and 15 µL of laminin, and cultured to 80% confluency.',
    `Cells were loaded with Fluo-4 AM from a ${FLUO4_STOCK_MM} mM DMSO stock. The planned loading concentration was ${FLUO4_PLANNED_UM} µM, but the cells were loaded at ${FLUO4_ACTUAL_UM} µM, so ${actualUl.toFixed(2)} µL of stock was used in a ${SAMPLE_LOADING_VOLUME_ML} mL loading volume instead of the planned ${plannedUl.toFixed(0)} µL. The deviation was logged.`,
    `Loading ran for ${INCUBATION_37_SEC / 3600} h at 37 °C, followed by ${INCUBATION_RT_SEC / 60} min at room temperature (22 °C).`,
    'Live-cell imaging ran at 30 fps: a 5 s baseline, then the treatment (Tris-HCl as the negative control, 5 µM glutamate as the positive control, or alpha-synuclein at 100 nM or 500 nM), then 1 min of recording.',
    `Somatic regions of interest were drawn in FIJI/ImageJ. Peak ΔF/F0 and AUC were measured per cell (${SAMPLE_COVERSLIPS} coverslips × ${ROIS_PER_COVERSLIP} ROIs, n = ${CELLS_PER_GROUP} cells per group) and reported as mean ± SD. Groups were compared with two-sided Welch t-tests.`,
    'Sample data for demonstration only; these numbers are not real results.',
  ].join(' ');
}
