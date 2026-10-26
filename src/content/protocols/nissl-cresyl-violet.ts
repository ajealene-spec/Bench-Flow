import { buildStarter, derived, input, type StarterSpec } from './build';

export const nisslSpec: StarterSpec = {
  slug: 'nissl-cresyl-violet',
  title: 'Nissl staining with cresyl violet',
  category: 'Histology & imaging',
  overview: {
    objective: 'Stain Nissl substance in mounted sections to show cell bodies and cytoarchitecture.',
    totalTime: 'About 3 h of hands-on time, plus drying overnight',
    outputs: 'Mounted, coverslipped Nissl-stained sections.',
  },
  materials: [
    ['Mounted 20 µm sections on gelatin-coated slides', 'consumable'],
    ['0.1% cresyl violet acetate (w/v) in distilled water', 'solution'],
    ['Glacial acetic acid', 'solution'],
    ['Ethanol: 70%, 95% and 100%', 'solution'],
    ['Xylene or xylene substitute', 'solution'],
    ['DPX mounting medium', 'consumable'],
    ['Coverslips', 'consumable'],
    ['Staining jars and slide rack', 'equipment'],
  ],
  hazards: [
    {
      name: 'Xylene',
      kind: 'chemical',
      reason: 'Flammable and harmful by inhalation and skin contact. Use only in a fume hood.',
      ppe: ['Nitrile gloves', 'Safety glasses'],
      steps: [7, 8],
    },
    {
      name: 'Glacial acetic acid',
      kind: 'chemical',
      reason: 'Corrosive. Causes burns to skin and eyes.',
      ppe: ['Nitrile gloves', 'Safety glasses'],
      steps: [5],
    },
    {
      name: 'Ethanol',
      kind: 'chemical',
      reason: 'Flammable. Keep away from ignition sources.',
      ppe: ['Nitrile gloves'],
      steps: [6],
    },
  ],
  steps: [
    {
      title: 'Dry slides',
      instructions: 'Dry the mounted sections at room temperature for 1 h, or at 37 °C overnight.',
      minutes: 60,
    },
    {
      title: 'Rehydrate',
      instructions: 'Rinse the slides in distilled water for 2 min to rehydrate the tissue.',
      minutes: 2,
    },
    {
      title: 'Stain',
      instructions:
        'Stain in 0.1% cresyl violet for 5 to 10 min. Filter the stain before use. The stain powder mass is calculated from the volume and the w/v percentage.',
      minutes: 8,
      variables: [
        input('pct', 'Cresyl violet concentration', 0.1, '%'),
        input('vol', 'Stain volume', 100, 'mL'),
        derived('cv', 'Cresyl violet powder', 'mg', 'vol * pct * 10'),
      ],
    },
    {
      title: 'Rinse',
      instructions: 'Dip the slides briefly in distilled water to remove excess stain.',
      minutes: 1,
    },
    {
      title: 'Differentiate',
      instructions:
        'Differentiate in 70% ethanol with 1 to 2 drops of glacial acetic acid, checking under the microscope until the Nissl bodies are sharp. This usually takes 30 s to 2 min.',
      minutes: 2,
      cautions: ['Acetic acid is corrosive. Add it to the ethanol carefully.'],
    },
    {
      title: 'Dehydrate',
      instructions: 'Pass the slides through 95% ethanol for 1 min, then 100% ethanol twice for 2 min each.',
      minutes: 5,
    },
    {
      title: 'Clear',
      instructions: 'Clear in xylene (or xylene substitute) twice for 5 min each, in a fume hood.',
      minutes: 10,
    },
    {
      title: 'Mount',
      instructions: 'Mount with DPX, lower a coverslip without trapping bubbles, and dry flat overnight in a fume hood.',
    },
  ],
};

export const nisslCresylViolet = buildStarter(nisslSpec);
