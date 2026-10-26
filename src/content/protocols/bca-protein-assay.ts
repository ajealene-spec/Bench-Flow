import { buildStarter, derived, input, type StarterSpec } from './build';

export const bcaSpec: StarterSpec = {
  slug: 'bca-protein-assay',
  title: 'BCA protein assay',
  category: 'Protein',
  overview: {
    objective: 'Measure total protein concentration of lysates against a BSA standard curve.',
    totalTime: 'About 1.5 h, including the 37 °C incubation',
    outputs: 'Absorbance at 562 nm and sample concentrations (µg/µL) from the standard curve.',
  },
  materials: [
    ['BCA reagent A (contains sodium hydroxide)', 'solution'],
    ['BCA reagent B (4% copper sulfate)', 'solution'],
    ['BSA standard, 2 mg/mL', 'solution'],
    ['Lysis buffer (sample diluent)', 'solution'],
    ['96-well flat-bottom plate', 'consumable'],
    ['Multichannel pipette', 'equipment'],
    ['37 °C incubator', 'equipment'],
    ['Plate reader with 562 nm filter', 'equipment'],
  ],
  hazards: [
    {
      name: 'BCA reagent A (sodium hydroxide) and reagent B (copper sulfate)',
      kind: 'chemical',
      reason: 'Reagent A is corrosive and reagent B is harmful if swallowed. Wear gloves and eye protection.',
      ppe: ['Nitrile gloves', 'Safety goggles', 'Lab coat'],
      steps: [1, 2],
    },
  ],
  steps: [
    {
      title: 'Prepare standards',
      instructions:
        'Make a BSA standard of 0.5 mg/mL from the 2 mg/mL stock with lysis buffer. The stock volume is calculated from the target and stock concentrations. Make the full series (0, 0.125, 0.25, 0.5, 1.0, 1.5 and 2 mg/mL) in duplicate.',
      variables: [
        input('sstock', 'BSA stock concentration', 2, 'mg/mL'),
        input('starget', 'Standard concentration', 0.5, 'mg/mL'),
        input('sfv', 'Standard volume', 1, 'mL'),
        derived('sv', 'BSA stock volume', 'mL', 'sfv * starget / sstock'),
      ],
    },
    {
      title: 'Make working reagent',
      instructions:
        'Mix 50 parts reagent A with 1 part reagent B (50:1). Make enough for all wells plus overage, fresh on the day of use. Reagent B volume is calculated from the total.',
      cautions: ['Make working reagent fresh on the day of use.'],
      variables: [
        input('wells', 'Wells to fill', 40, 'wells'),
        input('per', 'Working reagent per well', 200, 'µL'),
        input('oe', 'Overage', 10, '%'),
        derived('wr', 'Total working reagent', 'µL', 'wells * per * (1 + oe / 100)'),
        derived('rb', 'Reagent B volume', 'µL', 'wr / 51'),
      ],
    },
    {
      title: 'Load plate',
      instructions:
        'Add 10 µL of each standard or diluted sample to duplicate wells. Add 200 µL of working reagent to each well and mix on a plate shaker for 30 s.',
    },
    {
      title: 'Incubate',
      instructions: 'Incubate the plate at 37 °C for 30 min, covered to prevent evaporation.',
      minutes: 30,
    },
    {
      title: 'Read absorbance',
      instructions:
        'Cool to room temperature and read absorbance at 562 nm. Subtract the blank, fit the standard curve and calculate sample concentrations. Dilute samples that fall outside the curve.',
    },
  ],
};

export const bcaProteinAssay = buildStarter(bcaSpec);
