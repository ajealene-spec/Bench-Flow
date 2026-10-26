import { buildStarter, derived, input, type StarterSpec } from './build';

export const dapiSpec: StarterSpec = {
  slug: 'dapi-counterstain',
  title: 'DAPI counterstain and mounting',
  category: 'Histology & imaging',
  overview: {
    objective: 'Counterstain nuclei with DAPI and mount sections for fluorescence imaging.',
    totalTime: 'About 1 h, plus 30 min curing',
    outputs: 'Mounted sections with blue nuclear staining, ready to image.',
  },
  materials: [
    ['DAPI stock, 5 mg/mL', 'solution'],
    ['PBS (0.1 M, pH 7.4)', 'solution'],
    ['Antifade mounting medium', 'consumable'],
    ['Coverslips', 'consumable'],
    ['Slides or free-floating sections', 'consumable'],
  ],
  hazards: [
    {
      name: 'DAPI',
      kind: 'chemical',
      reason: 'Harmful if swallowed and a DNA-binding agent. Wear gloves and keep the stock covered and dark.',
      ppe: ['Nitrile gloves', 'Lab coat', 'Safety glasses'],
      steps: [1],
    },
  ],
  steps: [
    {
      title: 'Prepare working DAPI',
      instructions:
        'Dilute the DAPI stock to 1 µg/mL in PBS. Protect from light. The stock volume is calculated from the target and stock concentrations.',
      cautions: ['DAPI is harmful if swallowed. Wear gloves.'],
      variables: [
        input('stock', 'DAPI stock concentration', 5000, 'µg/mL'),
        input('target', 'Working DAPI concentration', 1, 'µg/mL'),
        input('final', 'Final volume', 10, 'mL'),
        derived('v1', 'DAPI stock volume', 'µL', 'final * 1000 * target / stock'),
      ],
    },
    {
      title: 'Stain',
      instructions: 'Incubate the sections in DAPI for 5 min at room temperature, protected from light.',
      minutes: 5,
    },
    {
      title: 'Wash',
      instructions: 'Wash 3 times for 5 min each in PBS.',
      minutes: 15,
    },
    {
      title: 'Mount',
      instructions:
        'Mount the sections with antifade medium and lower a coverslip. Cure flat in the dark for at least 30 min at room temperature before imaging.',
      minutes: 30,
    },
    {
      title: 'Store slides',
      instructions: 'Store slides flat at 4 °C in the dark. Image within 1 to 2 weeks for the best signal.',
    },
  ],
};

export const dapiCounterstain = buildStarter(dapiSpec);
