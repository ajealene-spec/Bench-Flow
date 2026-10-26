import { buildStarter, derived, input, type StarterSpec } from './build';

export const ifFreeFloatingSpec: StarterSpec = {
  slug: 'if-free-floating',
  title: 'Immunofluorescence on free-floating brain sections',
  category: 'Histology & imaging',
  overview: {
    objective: 'Label a target protein or cell type in 40 µm brain sections with fluorescent antibodies.',
    totalTime: 'About 2 days (block and primary overnight; secondary and mounting on day 2)',
    outputs: 'Mounted sections imaged on a confocal or epifluorescence microscope, with settings recorded.',
  },
  materials: [
    ['PBS (0.1 M, pH 7.4)', 'solution'],
    ['PBS-T: 0.3% Triton X-100 in PBS', 'solution'],
    ['Blocking solution: 5% normal donkey serum in PBS-T', 'solution'],
    ['Primary antibody', 'consumable'],
    ['Fluorophore-conjugated secondary antibody (host matched to serum)', 'consumable'],
    ['DAPI working solution (optional)', 'solution'],
    ['Antifade mounting medium', 'consumable'],
    ['Gelatin-coated microscope slides and coverslips', 'consumable'],
    ['40 µm free-floating sections in PBS', 'consumable'],
    ['24-well plate', 'consumable'],
    ['Orbital shaker', 'equipment'],
    ['Confocal or epifluorescence microscope', 'equipment'],
  ],
  phases: ['Day 1: block and primary antibody', 'Day 2: secondary and mounting'],
  hazards: [
    {
      name: 'Triton X-100',
      kind: 'chemical',
      reason: 'Eye and skin irritant. Use a fume hood when preparing large volumes.',
      ppe: ['Nitrile gloves', 'Safety glasses'],
      steps: [2],
    },
    {
      name: 'Residual paraformaldehyde in fixed tissue',
      kind: 'chemical',
      reason: 'Tissue fixed in PFA can still release formaldehyde. Handle sections in a well-ventilated area.',
      ppe: ['Nitrile gloves', 'Lab coat'],
      steps: [1],
    },
  ],
  steps: [
    {
      title: 'Wash sections',
      instructions: 'Transfer 40 µm sections into a 24-well plate with PBS. Wash 3 times for 10 min each on an orbital shaker at room temperature.',
      minutes: 30,
      phase: 0,
    },
    {
      title: 'Permeabilize and block',
      instructions:
        'Incubate in PBS-T (0.3% Triton X-100) with 5% normal donkey serum for 1 h at room temperature. Use serum from the host species of your secondary antibody.',
      minutes: 60,
      phase: 0,
    },
    {
      title: 'Primary antibody',
      instructions:
        'Replace the blocking solution with primary antibody diluted in the same blocking solution. Incubate overnight at 4 °C with gentle agitation.',
      minutes: 960,
      phase: 0,
      variables: [
        input('pdil', 'Primary antibody dilution', 500, '1:N'),
        input('pvol', 'Antibody solution volume', 2, 'mL'),
        derived('pab', 'Primary antibody volume', 'µL', 'pvol * 1000 / pdil'),
      ],
    },
    {
      title: 'Wash after primary',
      instructions: 'Wash 3 times for 10 min each in PBS-T.',
      minutes: 30,
      phase: 1,
    },
    {
      title: 'Secondary antibody',
      instructions:
        'Incubate with fluorophore-conjugated secondary antibody (1:500) in blocking solution for 2 h at room temperature, protected from light.',
      minutes: 120,
      phase: 1,
      variables: [
        input('sdil', 'Secondary antibody dilution', 500, '1:N'),
        input('per', 'Solution per sample', 1.5, 'mL'),
        input('n', 'Samples', 6, 'samples'),
        derived('tot', 'Total secondary solution', 'mL', 'per * n'),
      ],
    },
    {
      title: 'Wash and counterstain',
      instructions:
        'Wash 3 times for 10 min each in PBS. Optional: incubate in DAPI (1 µg/mL) for 5 min, then rinse (see the DAPI counterstain protocol).',
      minutes: 15,
      phase: 1,
    },
    {
      title: 'Mount',
      instructions:
        'Mount sections onto gelatin-coated slides, air dry briefly, add antifade medium and coverslip. Seal the edges and store at 4 °C in the dark.',
      phase: 1,
    },
  ],
};

export const ifFreeFloating = buildStarter(ifFreeFloatingSpec);
