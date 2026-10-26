import { buildStarter, input, type StarterSpec } from './build';

export const cryosectioningSpec: StarterSpec = {
  slug: 'cryosectioning',
  title: 'Cryosectioning brain tissue',
  category: 'Histology & imaging',
  overview: {
    objective: 'Cut frozen, cryoprotected brain into free-floating or mounted sections.',
    totalTime: 'About 1 to 2 h per brain, plus equilibration',
    outputs: 'Labelled free-floating sections in antifreeze solution, or mounted sections on slides.',
  },
  materials: [
    ['30% sucrose-cryoprotected brain', 'consumable'],
    ['OCT compound', 'consumable'],
    ['Isopentane, cooled on dry ice', 'solution'],
    ['Dry ice', 'consumable'],
    ['Antifreeze solution (30% ethylene glycol, 20% glycerol in PBS)', 'solution'],
    ['Cryostat blades', 'consumable'],
    ['Gelatin-coated slides', 'consumable'],
    ['Fine paintbrush', 'equipment'],
    ['Cryostat', 'equipment'],
  ],
  hazards: [
    {
      name: 'Isopentane',
      kind: 'chemical',
      reason: 'Highly flammable and a vapor hazard. Use it only in a fume hood, away from ignition sources.',
      ppe: ['Cryo gloves', 'Safety glasses', 'Lab coat'],
      steps: [2],
    },
    {
      name: 'Dry ice and cold surfaces',
      kind: 'physical',
      reason: 'Causes severe cold burns. Use tongs and cryo gloves.',
      ppe: ['Cryo gloves', 'Safety glasses'],
      steps: [2, 3],
    },
    {
      name: 'Cryostat blade',
      kind: 'physical',
      reason: 'Very sharp. Change blades with the blade guard in place.',
      ppe: ['Cut-resistant gloves'],
      steps: [4, 5],
    },
  ],
  steps: [
    {
      title: 'Blot and embed',
      instructions:
        'Blot the cryoprotected brain on a tissue. Embed in OCT in a mold with the cutting face oriented as needed. Remove air bubbles.',
    },
    {
      title: 'Freeze',
      instructions:
        'Float the mold in isopentane cooled on dry ice (about -40 °C) for 30 to 60 s, until the OCT is opaque. Store the block at -80 °C.',
      minutes: 1,
      cautions: ['Work in a fume hood. Isopentane is flammable.'],
    },
    {
      title: 'Set up the cryostat',
      instructions: 'Set the chamber to -20 °C and the specimen head to about -18 to -20 °C. Mount the block and let it equilibrate.',
      minutes: 15,
      variables: [input('cham', 'Chamber temperature', -20, '°C')],
    },
    {
      title: 'Section free-floating',
      instructions:
        'Cut 40 µm sections for free-floating immunostaining. Collect each section into PBS or antifreeze solution in a well plate, using a fine brush.',
      variables: [input('thick', 'Section thickness', 40, 'µm')],
      cautions: ['Change the blade between animals.'],
    },
    {
      title: 'Section for mounting',
      instructions:
        'For mounted sections, cut 10 to 20 µm and thaw-mount onto gelatin-coated slides. Dry at room temperature for 30 min, then store at -80 °C in a sealed box.',
      minutes: 30,
    },
    {
      title: 'Store sections',
      instructions: 'Store free-floating sections in antifreeze solution at -20 °C. Label every well with the animal ID and section level.',
    },
  ],
};

export const cryosectioning = buildStarter(cryosectioningSpec);
