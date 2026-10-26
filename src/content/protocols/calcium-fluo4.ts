import { buildStarter, derived, input, type StarterSpec } from './build';

export const calciumFluo4Spec: StarterSpec = {
  slug: 'calcium-fluo4',
  title: 'Fluo-4 AM calcium imaging in iPSC-derived astrocytes',
  category: 'Live-cell imaging',
  overview: {
    objective: 'Measure cytosolic calcium responses in live iPSC-derived astrocytes loaded with Fluo-4 AM, before and after a treatment.',
    totalTime: 'About 2 hours of loading and incubation, then imaging and analysis',
    outputs: 'Time-lapse recordings at 30 fps, per-cell peak ΔF/F0 and AUC, and the analysis files.',
  },
  materials: [
    ['Matrigel, diluted per lot sheet', 'consumable'],
    ['Laminin, 15 µL per coverslip', 'consumable'],
    ['iPSC-derived astrocytes (APOE3 and APOE4) on coverslips', 'consumable'],
    ['Fluo-4 AM, 1 mM stock in DMSO', 'solution'],
    ['Loading buffer', 'solution'],
    ['Tris-HCl (negative control)', 'solution'],
    ['Glutamate, 5 µM (positive control)', 'solution'],
    ['Alpha-synuclein, monomeric, 100 nM and 500 nM', 'solution'],
    ['Live-cell imaging chamber', 'equipment'],
    ['Fluorescence microscope with 30 fps camera', 'equipment'],
    ['FIJI / ImageJ', 'equipment'],
  ],
  phases: ['Prep', 'Loading', 'Imaging', 'Analysis'],
  hazards: [
    {
      name: 'Fluo-4 AM in DMSO',
      kind: 'chemical',
      reason: 'DMSO carries dissolved compounds through the skin. Check your SDS for Fluo-4 AM and DMSO.',
      ppe: ['Nitrile gloves', 'Lab coat', 'Safety glasses'],
      steps: [3],
    },
    {
      name: 'Glutamate',
      kind: 'chemical',
      reason: 'Irritant at the concentrations used here. Check your SDS.',
      ppe: ['Nitrile gloves', 'Safety glasses'],
      steps: [6],
    },
    {
      name: 'iPSC-derived cells',
      kind: 'biological',
      reason: 'Handle human cell cultures in a cell culture hood, using aseptic technique.',
      ppe: ['Lab coat', 'Nitrile gloves'],
      steps: [1, 2],
    },
  ],
  steps: [
    {
      title: 'Coat coverslips',
      instructions: 'Coat each coverslip with Matrigel, then add 15 µL of laminin. Work in a cell culture hood.',
      phase: 0,
    },
    {
      title: 'Culture to 80% confluency',
      instructions: 'Plate iPSC-derived APOE3 and APOE4 astrocytes and culture until they reach about 80% confluency.',
      phase: 0,
    },
    {
      title: 'Load Fluo-4 AM at 37 °C',
      instructions:
        'Load the cells with 5 µM Fluo-4 AM from the 1 mM DMSO stock in loading buffer. Incubate 1 hour at 37 °C.',
      minutes: 60,
      phase: 1,
      variables: [
        input('fstock', 'Fluo-4 AM stock', 1000, 'µM'),
        input('fvol', 'Loading volume', 2, 'mL'),
        input('fplan', 'Planned final Fluo-4 AM', 5, 'µM'),
        derived('fstockvol', 'Stock to add', 'µL', 'fplan * fvol * 1000 / fstock'),
      ],
    },
    {
      title: 'Room temperature incubation',
      instructions: 'Move the cells to room temperature (22 °C) and incubate for 30 minutes.',
      minutes: 30,
      phase: 1,
    },
    {
      title: 'Set up live imaging',
      instructions: 'Set the microscope to 30 fps. Record a 5 s baseline before the treatment is added.',
      minutes: 1,
      phase: 2,
    },
    {
      title: 'Add treatment and record',
      instructions:
        'Add one treatment: Tris-HCl (negative control), 5 µM glutamate (positive control), or alpha-synuclein at 100 nM or 500 nM. Record for 1 min after the addition.',
      phase: 2,
    },
    {
      title: 'Analyze in FIJI',
      instructions:
        'Draw somatic ROIs around individual cells. Measure peak ΔF/F0 and AUC for each ROI, then compare groups with t-tests.',
      phase: 3,
    },
  ],
};

export const calciumFluo4 = buildStarter(calciumFluo4Spec);
