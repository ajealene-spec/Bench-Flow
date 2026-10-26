import { buildStarter, derived, input, type StarterSpec } from './build';

export const rtQpcrSpec: StarterSpec = {
  slug: 'rt-qpcr-sybr',
  title: 'RT-qPCR with SYBR Green',
  category: 'Molecular biology',
  overview: {
    objective: 'Measure relative mRNA levels by reverse transcription followed by SYBR Green real-time PCR.',
    totalTime: 'About 1 day (RNA extraction and cDNA synthesis, then qPCR run)',
    outputs: 'Ct values with melt curves, and fold change relative to a reference gene.',
  },
  materials: [
    ['TRIzol reagent', 'solution'],
    ['Chloroform', 'solution'],
    ['Isopropanol', 'solution'],
    ['75% ethanol made with RNase-free water', 'solution'],
    ['DNase I kit', 'consumable'],
    ['Reverse transcription kit and primers', 'consumable'],
    ['SYBR Green qPCR master mix', 'solution'],
    ['Gene-specific primers, 10 µM stocks', 'solution'],
    ['Optical plate and seals', 'consumable'],
    ['Real-time PCR cycler', 'equipment'],
    ['Spectrophotometer', 'equipment'],
  ],
  hazards: [
    {
      name: 'TRIzol (phenol) and chloroform',
      kind: 'chemical',
      reason: 'Phenol and chloroform are toxic, corrosive and volatile. Work in a fume hood and wear gloves.',
      ppe: ['Nitrile gloves', 'Lab coat', 'Safety goggles'],
      steps: [1, 2],
    },
  ],
  steps: [
    {
      title: 'Extract RNA',
      instructions:
        'Homogenize tissue in 1 mL TRIzol per 50 to 100 mg, in a fume hood. Add 0.2 mL chloroform per 1 mL TRIzol, shake, and centrifuge at 12,000 × g for 15 min at 4 °C. Transfer the upper aqueous phase.',
      minutes: 15,
      cautions: ['Work in a fume hood. TRIzol and chloroform are toxic.'],
    },
    {
      title: 'Precipitate and wash RNA',
      instructions:
        'Precipitate the RNA with isopropanol, wash the pellet in 75% ethanol, air dry briefly, and dissolve in RNase-free water.',
      minutes: 10,
    },
    {
      title: 'Quantify RNA',
      instructions: 'Measure concentration and A260/280. A ratio of about 1.8 to 2.0 indicates pure RNA. Store at -80 °C.',
    },
    {
      title: 'DNase treatment',
      instructions: 'Treat 1 µg of RNA with DNase I, following the kit protocol, to remove genomic DNA.',
      minutes: 15,
    },
    {
      title: 'Reverse transcription',
      instructions:
        'Synthesize cDNA from 1 µg of RNA. Run the kit program (for example 25 °C for 10 min, 37 °C for 60 min, 85 °C for 5 min). Dilute the cDNA 1:10 in water.',
      minutes: 75,
      variables: [
        input('amount', 'RNA input', 1000, 'ng'),
        input('conc', 'RNA concentration', 500, 'ng/µL'),
        derived('rv', 'RNA volume to add', 'µL', 'amount / conc'),
      ],
    },
    {
      title: 'Set up qPCR',
      instructions:
        'Prepare the SYBR master mix with each primer at its final concentration in 10 µL reactions. Include no-template and no-RT controls. Run each sample in triplicate.',
      variables: [
        input('rxn', 'Reaction volume', 10, 'µL'),
        input('pf', 'Primer final concentration', 300, 'nM'),
        input('ps', 'Primer stock concentration', 10000, 'nM'),
        derived('pv', 'Primer volume per reaction', 'µL', 'rxn * pf / ps'),
      ],
    },
    {
      title: 'Run and melt',
      instructions:
        'Run 95 °C for 2 min; 40 cycles of 95 °C for 15 s and 60 °C for 1 min, reading fluorescence at each annealing step; then run a melt curve.',
      minutes: 60,
    },
    {
      title: 'Analyze',
      instructions:
        'Check that each melt curve has a single peak and that triplicate Ct values differ by less than 0.2. Calculate fold change with the 2^-ΔΔCt method against a validated reference gene.',
    },
  ],
};

export const rtQpcr = buildStarter(rtQpcrSpec);
