import { buildStarter, derived, input, type StarterSpec } from './build';

export const pcrSpec: StarterSpec = {
  slug: 'pcr-amplification',
  title: 'PCR amplification (endpoint)',
  category: 'Molecular biology',
  overview: {
    objective: 'Amplify a target DNA sequence by endpoint PCR and check the product size on an agarose gel.',
    totalTime: 'About 2.5 h, including the cycler run',
    outputs: 'Agarose gel image with product bands compared with a ladder and a no-template control.',
  },
  materials: [
    ['2x PCR master mix (Taq-based)', 'solution'],
    ['Forward and reverse primers, 10 µM each', 'solution'],
    ['Template DNA (about 10 to 100 ng)', 'consumable'],
    ['Nuclease-free water', 'solution'],
    ['PCR tubes or plate', 'consumable'],
    ['Agarose (1.5 to 2%)', 'consumable'],
    ['TAE buffer', 'solution'],
    ['DNA stain (SYBR Safe or equivalent)', 'solution'],
    ['DNA ladder and loading dye', 'consumable'],
    ['Thermal cycler', 'equipment'],
    ['Gel electrophoresis system and UV or blue-light imager', 'equipment'],
  ],
  hazards: [
    {
      name: 'DNA stain',
      kind: 'chemical',
      reason: 'DNA-binding dye. Use a low-hazard stain such as SYBR Safe, and wear gloves when handling gels.',
      ppe: ['Nitrile gloves', 'Safety glasses'],
      steps: [5, 7],
    },
    {
      name: 'Hot agarose',
      kind: 'physical',
      reason: 'Boiling agarose can superheat and burst from the flask. Let it cool before pouring.',
      ppe: ['Heat-resistant gloves', 'Safety glasses'],
      steps: [5],
    },
  ],
  steps: [
    {
      title: 'Plan the plate',
      instructions:
        'Map the tubes, including a no-template control and a positive control if you have one. Thaw reagents on ice and spin them down briefly.',
    },
    {
      title: 'Make master mix',
      instructions:
        'Combine master mix, primers and water for all reactions plus overage in one tube. Vortex briefly and spin down. Each reaction is 25 µL.',
      variables: [
        input('n', 'Reactions', 24, 'reactions'),
        input('mix', 'Master mix per reaction', 12.5, 'µL'),
        input('overage', 'Overage for pipetting loss', 10, '%'),
        derived('tot', 'Total master mix', 'µL', 'n * mix * (1 + overage / 100)'),
        input('rv', 'Reaction volume', 25, 'µL'),
        input('pf', 'Primer final concentration', 0.4, 'µM'),
        input('ps', 'Primer stock concentration', 10, 'µM'),
        derived('pv', 'Primer volume per reaction', 'µL', 'rv * pf / ps'),
      ],
    },
    {
      title: 'Add template',
      instructions: 'Add 2 µL of template DNA to each tube, and water to the no-template control. Add template last to reduce contamination.',
      cautions: ['Use filter tips and change gloves if you touch the template stock.'],
    },
    {
      title: 'Run the cycler',
      instructions:
        'Run 95 °C for 3 min; 35 cycles of 95 °C for 30 s, annealing for 30 s (about 5 °C below the lower primer Tm), and 72 °C for 1 min per kb; then 72 °C for 5 min and hold at 4 °C.',
      minutes: 80,
    },
    {
      title: 'Pour gel',
      instructions:
        'Make a 1.5 to 2% agarose gel in TAE with DNA stain. Microwave in short bursts and let it cool to about 60 °C before pouring.',
      minutes: 20,
    },
    {
      title: 'Run gel',
      instructions: 'Load 5 µL of product mixed with loading dye, next to a ladder. Run at 100 V for 30 to 45 min.',
      minutes: 40,
    },
    {
      title: 'Image and record',
      instructions: 'Image under UV or blue light. Record band sizes against the ladder and compare with the no-template control.',
    },
  ],
};

export const pcrAmplification = buildStarter(pcrSpec);
