import { buildStarter, derived, input, type StarterSpec } from './build';

export const westernBlotSpec: StarterSpec = {
  slug: 'western-blot',
  title: 'Western blot',
  category: 'Protein',
  overview: {
    objective: 'Detect a specific protein in tissue or cell lysate by size and antibody binding.',
    totalTime: 'About 2 days (lysis and transfer on day 1; primary antibody overnight)',
    outputs: 'Chemiluminescent image of the target band and a loading control, with quantified band density.',
  },
  materials: [
    ['RIPA lysis buffer with protease and phosphatase inhibitors', 'solution'],
    ['BCA protein assay reagents', 'solution'],
    ['Laemmli sample buffer (4x)', 'solution'],
    ['10% SDS-polyacrylamide gel', 'consumable'],
    ['Tris-glycine-SDS running buffer', 'solution'],
    ['PVDF membrane (0.45 µm)', 'consumable'],
    ['Transfer buffer (Tris-glycine with 20% methanol)', 'solution'],
    ['Blocking solution: 5% non-fat milk in TBST', 'solution'],
    ['Primary antibody (target and loading control)', 'consumable'],
    ['HRP-conjugated secondary antibody', 'consumable'],
    ['ECL substrate', 'consumable'],
    ['Electrophoresis cell and power supply', 'equipment'],
    ['Wet transfer tank', 'equipment'],
    ['Chemiluminescence imager', 'equipment'],
  ],
  hazards: [
    {
      name: 'Acrylamide and bis-acrylamide',
      kind: 'chemical',
      reason: 'Unpolymerized acrylamide is a neurotoxin and a suspected carcinogen. Avoid skin contact and weigh it in a ventilated area.',
      ppe: ['Nitrile gloves', 'Lab coat', 'Safety glasses'],
      steps: [4],
    },
    {
      name: 'Methanol (transfer buffer)',
      kind: 'chemical',
      reason: 'Flammable, and toxic by inhalation or skin contact.',
      ppe: ['Nitrile gloves', 'Safety glasses'],
      steps: [5],
    },
    {
      name: 'Lysis buffer with detergents',
      kind: 'chemical',
      reason: 'Irritant. Tissue lysates may carry biological material, so handle them as potentially infectious.',
      ppe: ['Nitrile gloves', 'Safety glasses'],
      steps: [1],
    },
  ],
  steps: [
    {
      title: 'Lyse and clear the lysate',
      instructions:
        'Homogenize tissue or pellet cells in ice-cold RIPA with inhibitors (about 100 µL per 10 mg of tissue). Incubate on ice for 30 min, vortexing every 10 min. Centrifuge at 14,000 × g for 15 min at 4 °C and keep the supernatant.',
      minutes: 30,
      cautions: ['Keep everything on ice.'],
    },
    {
      title: 'Quantify protein',
      instructions: 'Measure protein concentration with the BCA assay (see the BCA protein assay protocol). Record the value in µg/µL.',
    },
    {
      title: 'Prepare samples',
      instructions:
        'Dilute each lysate with lysis buffer to the same concentration. Add 4x Laemmli buffer to 1x and heat at 95 °C for 5 min. Load the volume calculated here.',
      minutes: 5,
      variables: [
        input('load', 'Protein per lane', 20, 'µg'),
        input('conc', 'Lysate concentration', 2, 'µg/µL'),
        derived('vol', 'Lysate volume per lane', 'µL', 'load / conc'),
      ],
    },
    {
      title: 'Run the gel',
      instructions:
        'Load equal protein per lane next to a molecular weight ladder. Run at 120 V for about 90 min, until the dye front reaches the bottom of the gel.',
      minutes: 90,
    },
    {
      title: 'Transfer to membrane',
      instructions:
        'Transfer to PVDF at 100 V for 60 min in cold transfer buffer (or follow your tank guide). Check the transfer with Ponceau S, then wash it off with TBST.',
      minutes: 60,
    },
    {
      title: 'Block',
      instructions: 'Block the membrane in 5% non-fat milk in TBST for 1 h at room temperature with gentle rocking.',
      minutes: 60,
    },
    {
      title: 'Primary antibody',
      instructions:
        'Incubate the membrane with primary antibody diluted in 5% BSA in TBST, overnight at 4 °C on a rocker. The antibody volume is calculated from the dilution and the total solution volume.',
      minutes: 960,
      variables: [
        input('dil', 'Primary antibody dilution', 1000, '1:N'),
        input('final', 'Antibody solution volume', 10, 'mL'),
        derived('ab', 'Primary antibody volume', 'µL', 'final * 1000 / dil'),
      ],
    },
    {
      title: 'Wash after primary',
      instructions: 'Wash 3 times for 5 min each in TBST.',
      minutes: 15,
    },
    {
      title: 'Secondary antibody',
      instructions: 'Incubate with HRP-conjugated secondary antibody (1:5,000 in 5% milk in TBST) for 1 h at room temperature.',
      minutes: 60,
      variables: [input('sdil', 'Secondary antibody dilution', 5000, '1:N')],
    },
    {
      title: 'Wash after secondary',
      instructions: 'Wash 3 times for 10 min each in TBST.',
      minutes: 30,
    },
    {
      title: 'Detect',
      instructions: 'Mix ECL substrate as the manufacturer directs. Incubate for 1 min and image several exposures, staying in the linear range.',
      minutes: 1,
    },
    {
      title: 'Quantify and record',
      instructions: 'Quantify band density against the loading control. Record exposure times and imager settings with the run.',
    },
  ],
};

export const westernBlot = buildStarter(westernBlotSpec);
