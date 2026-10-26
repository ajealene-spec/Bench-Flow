import { buildStarter, derived, input, type StarterSpec } from './build';

export const golgiSpec: StarterSpec = {
  slug: 'golgi-cox',
  title: 'Golgi-Cox staining',
  category: 'Histology & imaging',
  overview: {
    objective: 'Impregnate a subset of neurons with the Golgi-Cox method to reveal full dendritic morphology.',
    totalTime: 'About 3 weeks (impregnation 14 days, sucrose 3 days, then sectioning and staining)',
    outputs: 'Golgi-stained sections for morphological analysis (dendritic arbor, spine density).',
  },
  materials: [
    ['Golgi-Cox solution (potassium dichromate, mercuric chloride, potassium chromate)', 'solution'],
    ['30% sucrose in distilled water', 'solution'],
    ['Ammonium hydroxide, diluted for development', 'solution'],
    ['Photographic fixer', 'solution'],
    ['Ethanol series and xylene', 'solution'],
    ['DPX mounting medium', 'consumable'],
    ['Gelatin-coated slides and coverslips', 'consumable'],
    ['Light-tight lidded containers', 'consumable'],
    ['Vibratome', 'equipment'],
  ],
  phases: ['Days 1 to 14: impregnation', 'Days 15 to 17: sucrose', 'Day 18 onward: section and develop'],
  hazards: [
    {
      name: 'Golgi-Cox solution (mercuric chloride and dichromate)',
      kind: 'chemical',
      reason:
        'Mercuric chloride is highly toxic and potassium dichromate is a carcinogen and oxidizer. Collect all Golgi-Cox waste as heavy metal hazardous waste. Never pour it down the drain.',
      ppe: ['Nitrile gloves (double)', 'Lab coat', 'Safety goggles'],
      steps: [1, 2, 3],
    },
    {
      name: 'Ammonium hydroxide',
      kind: 'chemical',
      reason: 'Corrosive and gives off irritating vapor. Use in a fume hood.',
      ppe: ['Nitrile gloves', 'Safety goggles'],
      steps: [5],
    },
    {
      name: 'Xylene',
      kind: 'chemical',
      reason: 'Flammable and harmful by inhalation. Use only in a fume hood.',
      ppe: ['Nitrile gloves', 'Safety goggles'],
      steps: [6],
    },
  ],
  steps: [
    {
      title: 'Remove and rinse brain',
      instructions:
        'Remove the fresh, unfixed brain and rinse it briefly in distilled water to remove blood. Blot it dry. Golgi-Cox needs unfixed tissue.',
      phase: 0,
    },
    {
      title: 'Impregnate',
      instructions:
        'Immerse the brain in Golgi-Cox solution in a light-tight, lidded container at room temperature for 14 days. Replace the solution once after 24 h. Keep the container in the dark.',
      minutes: 20160,
      phase: 0,
      variables: [
        input('bpb', 'Golgi-Cox solution per brain', 15, 'mL'),
        input('nb', 'Brains in this batch', 4, 'brains'),
        derived('tot', 'Total Golgi-Cox solution', 'mL', 'bpb * nb'),
      ],
    },
    {
      title: 'Transfer to sucrose',
      instructions:
        'Transfer the brain to 30% sucrose in distilled water at room temperature in the dark for about 3 days, until it sinks.',
      minutes: 4320,
      phase: 1,
    },
    {
      title: 'Section',
      instructions:
        'Blot the brain and cut 100 to 200 µm sections on a vibratome into distilled water. Do not freeze the tissue.',
      phase: 2,
      variables: [input('thick', 'Section thickness', 150, 'µm')],
    },
    {
      title: 'Develop',
      instructions:
        'Mount sections onto gelatin-coated slides and let them dry. Rinse in distilled water, then develop in dilute ammonium hydroxide (about 1 part in 3 parts water) for about 10 min in the dark.',
      minutes: 10,
      phase: 2,
    },
    {
      title: 'Fix and clear',
      instructions:
        'Fix in photographic fixer for 5 min, rinse in water for 3 min, dehydrate through ethanol, clear in xylene, and coverslip with DPX.',
      minutes: 5,
      phase: 2,
    },
  ],
};

export const golgiCox = buildStarter(golgiSpec);
