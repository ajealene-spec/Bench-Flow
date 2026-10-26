import { buildStarter, derived, input, type StarterSpec } from './build';

export const tailGenotypingSpec: StarterSpec = {
  slug: 'mouse-tail-genotyping',
  title: 'Mouse tail genomic DNA genotyping',
  category: 'Molecular biology',
  overview: {
    objective: 'Prepare crude genomic DNA from a mouse tail clip (or ear punch) for genotyping PCR.',
    totalTime: 'About 1.5 h, plus the PCR run',
    outputs: 'Genotype calls for each animal, scored against controls.',
  },
  materials: [
    ['Tail clip (3 to 5 mm) or ear punch', 'consumable'],
    ['Sodium hydroxide, 1 M stock', 'solution'],
    ['Sodium hydroxide, 50 mM working solution', 'solution'],
    ['Tris-HCl, 1 M, pH 8.0', 'solution'],
    ['Genotyping PCR master mix and primers', 'solution'],
    ['1.5 mL tubes', 'consumable'],
    ['Heat block at 95 °C', 'equipment'],
    ['Ear punch or tail clip tool', 'equipment'],
  ],
  hazards: [
    {
      name: 'Sodium hydroxide',
      kind: 'chemical',
      reason: 'Corrosive. Causes severe skin and eye burns. Add it to water, not the reverse.',
      ppe: ['Nitrile gloves', 'Safety goggles', 'Lab coat'],
      steps: [2, 3],
    },
    {
      name: 'Hot heat block',
      kind: 'physical',
      reason: 'Tubes at 95 °C can burn and may leak. Use a tube rack and closed caps.',
      ppe: ['Heat-resistant gloves'],
      steps: [3],
    },
  ],
  steps: [
    {
      title: 'Collect tail clip',
      instructions:
        'Collect a 3 to 5 mm tail clip (or an ear punch) per your approved animal identification method. Place it in a labeled 1.5 mL tube.',
      cautions: ['Follow the identification method in your approved protocol.'],
    },
    {
      title: 'Prepare lysis buffer',
      instructions:
        'Dilute the 1 M NaOH stock to 50 mM in water. The stock volume is calculated from the target and stock concentrations.',
      variables: [
        input('stock', 'NaOH stock', 1000, 'mM'),
        input('target', 'NaOH working concentration', 50, 'mM'),
        input('fv', 'Lysis buffer volume', 50, 'mL'),
        derived('v1', 'NaOH stock volume', 'mL', 'fv * target / stock'),
      ],
    },
    {
      title: 'Lyse tissue',
      instructions:
        'Add 75 µL of 50 mM NaOH to each tube. Heat at 95 °C for 30 to 60 min, vortexing briefly every 15 min.',
      minutes: 45,
    },
    {
      title: 'Neutralize',
      instructions:
        'Cool to room temperature. Add one tenth of the lysate volume of 1 M Tris-HCl, pH 8.0. Vortex and spin briefly. Store at 4 °C.',
      variables: [input('lys', 'Lysate volume', 75, 'µL'), derived('neut', 'Tris-HCl volume', 'µL', 'lys / 10')],
    },
    {
      title: 'Set up genotyping PCR',
      instructions:
        'Use 1 µL of DNA lysate per 25 µL PCR reaction. Include a positive control and a no-template control on every plate.',
    },
    {
      title: 'Run gel and score genotypes',
      instructions:
        'Run the genotyping PCR and resolve the products on a 2% agarose gel. Score wild-type, heterozygous and mutant bands against the controls.',
      minutes: 40,
    },
  ],
};

export const mouseTailGenotyping = buildStarter(tailGenotypingSpec);
