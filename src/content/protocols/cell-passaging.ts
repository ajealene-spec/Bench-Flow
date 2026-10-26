import { buildStarter, derived, input, type StarterSpec } from './build';

export const cellPassagingSpec: StarterSpec = {
  slug: 'cell-passaging',
  title: 'Cell culture passaging (adherent cells)',
  category: 'Cell culture',
  overview: {
    objective: 'Split adherent cells to a new flask at a set ratio while keeping them healthy and uncontaminated.',
    totalTime: 'About 45 min per flask',
    outputs: 'A new flask at the target split ratio, labeled with passage number and date.',
  },
  materials: [
    ['Complete growth medium (DMEM with 10% FBS and penicillin-streptomycin)', 'solution'],
    ['Fetal bovine serum (heat-inactivated)', 'solution'],
    ['PBS without calcium or magnesium', 'solution'],
    ['Trypsin-EDTA, 0.25%', 'solution'],
    ['Trypan blue, 0.4%', 'solution'],
    ['T75 tissue culture flasks', 'consumable'],
    ['Serological pipettes and 15 mL tubes', 'consumable'],
    ['Biosafety cabinet', 'equipment'],
    ['Hemocytometer and microscope', 'equipment'],
    ['37 °C, 5% CO2 incubator', 'equipment'],
    ['Centrifuge', 'equipment'],
  ],
  hazards: [
    {
      name: 'Cell line biosafety',
      kind: 'biological',
      reason: 'Human-derived and some other cell lines need BSL-2 precautions. Check your cell line biosafety level before handling.',
      ppe: ['Lab coat', 'Gloves', 'Safety glasses'],
      steps: [1, 4, 6],
    },
  ],
  steps: [
    {
      title: 'Check the cells',
      instructions:
        'Check under the microscope for 70 to 80% confluence, normal morphology and no contamination. Warm the medium and trypsin to 37 °C.',
      cautions: ['Do not passage cells that look contaminated.'],
    },
    {
      title: 'Wash',
      instructions: 'Aspirate the medium and wash once with 5 mL of PBS (for a T75) to remove serum, which inactivates trypsin.',
    },
    {
      title: 'Detach cells',
      instructions:
        'Add 2 mL of trypsin-EDTA (for a T75) and incubate at 37 °C for 2 to 5 min, until the cells round up. Tap the flask to release them.',
      minutes: 5,
    },
    {
      title: 'Neutralize and collect',
      instructions:
        'Add 8 mL of complete medium to stop the trypsin. Pipette up and down to make a single-cell suspension, then transfer it to a 15 mL tube.',
    },
    {
      title: 'Count cells',
      instructions:
        'Mix 10 µL of cell suspension with 10 µL of trypan blue. Count the unstained (live) cells on a hemocytometer and calculate cells per mL.',
    },
    {
      title: 'Seed new flask',
      instructions:
        'Spin at 300 × g for 5 min, resuspend, and seed a new flask at the split ratio. The fraction of cells kept is calculated from the ratio. Add medium to 15 mL and label the flask with passage number, date and initials.',
      variables: [
        input('split', 'Split ratio', 10, '1:N'),
        derived('frac', 'Fraction of cells kept', '%', '100 / split'),
      ],
    },
    {
      title: 'Return to incubator',
      instructions:
        'Place the flask in the 37 °C, 5% CO2 incubator. Record the passage number. Discard cultures that show contamination or that pass the passage limit for the line.',
    },
  ],
};

export const cellPassaging = buildStarter(cellPassagingSpec);
