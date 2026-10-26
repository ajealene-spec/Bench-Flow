import { buildStarter, derived, input, type StarterSpec } from './build';

export const primaryNeuronSpec: StarterSpec = {
  slug: 'primary-neuron-culture',
  title: 'Primary cortical neuron culture',
  category: 'Cell culture',
  overview: {
    objective: 'Dissociate embryonic cortex and grow primary neurons on poly-D-lysine coated coverslips.',
    totalTime: 'About 1 day to plate, then 14 days of maintenance',
    outputs: 'Mature cortical neurons at the chosen days in vitro (DIV), ready for imaging or treatment.',
  },
  materials: [
    ['Poly-D-lysine, 1 mg/mL stock', 'solution'],
    ['Sterile water', 'solution'],
    ['Cold HBSS', 'solution'],
    ['Papain (20 U/mL) with DNase I, per kit', 'solution'],
    ['Plating medium (Neurobasal with B-27, GlutaMAX and serum, as set out in your SOP)', 'solution'],
    ['Maintenance medium (Neurobasal with B-27 and GlutaMAX)', 'solution'],
    ['Trypan blue', 'solution'],
    ['Glass coverslips in 24-well plates', 'consumable'],
    ['Dissection tools and stereo microscope', 'equipment'],
    ['Hemocytometer', 'equipment'],
    ['37 °C, 5% CO2 incubator', 'equipment'],
  ],
  phases: ['Day 0: coat, dissect and plate', 'Days 1 to 14: maintain'],
  hazards: [
    {
      name: 'Embryonic rodent tissue',
      kind: 'biological',
      reason: 'Animal tissue may carry pathogens. Follow your biosafety rules and the animal use protocol.',
      ppe: ['Lab coat', 'Gloves', 'Safety glasses'],
      steps: [3, 5],
    },
    {
      name: 'Papain',
      kind: 'chemical',
      reason: 'Enzyme that can cause respiratory and skin sensitization. Avoid inhaling the powder.',
      ppe: ['Nitrile gloves', 'Safety glasses'],
      steps: [4],
    },
  ],
  steps: [
    {
      title: 'Coat coverslips',
      instructions:
        'Coat coverslips with poly-D-lysine for at least 1 h at room temperature (or overnight). Rinse 3 times with sterile water and dry in the hood. The stock volume is calculated from the target and stock concentrations.',
      minutes: 60,
      phase: 0,
      variables: [
        input('pstock', 'Poly-D-lysine stock', 1000, 'µg/mL'),
        input('ptgt', 'Working poly-D-lysine concentration', 50, 'µg/mL'),
        input('pvol', 'Coating volume', 10, 'mL'),
        derived('pdl', 'Poly-D-lysine stock volume', 'mL', 'pvol * ptgt / pstock'),
      ],
    },
    {
      title: 'Prepare dissection',
      instructions: 'Chill HBSS on ice. Prepare the papain digest with DNase I and warm it to 37 °C for about 15 min before use.',
      phase: 0,
    },
    {
      title: 'Dissect cortex',
      instructions:
        'Remove embryonic cortices into ice-cold HBSS, strip the meninges and keep the tissue cold. Record the number of embryos and the genotype of each.',
      phase: 0,
    },
    {
      title: 'Digest',
      instructions:
        'Incubate the tissue in papain with DNase I at 37 °C for 20 min, swirling gently every 5 min. Wash 3 times in plating medium to stop the digest.',
      minutes: 20,
      phase: 0,
    },
    {
      title: 'Triturate and count',
      instructions:
        'Triturate gently with fire-polished Pasteur pipettes until no clumps remain. Count live cells with trypan blue.',
      phase: 0,
    },
    {
      title: 'Plate cells',
      instructions:
        'Plate the target number of cells per well onto the coated coverslips in plating medium. The total cell number is calculated from the cells per well and the well count.',
      phase: 0,
      variables: [
        input('dens', 'Cells per well', 100000, 'cells/well'),
        input('wells', 'Wells', 24, 'wells'),
        derived('tot', 'Total cells needed', 'cells', 'dens * wells'),
      ],
    },
    {
      title: 'Maintain cultures',
      instructions:
        'On day 1, replace the plating medium with maintenance medium. Then replace half of the medium every 3 to 4 days. Optionally add AraC (2 µM) on DIV 3 to limit glial growth.',
      phase: 1,
    },
    {
      title: 'Check health',
      instructions: 'Check the morphology by phase microscopy at each feed. Record DIV, feeding dates and any changes.',
      phase: 1,
    },
  ],
};

export const primaryNeuronCulture = buildStarter(primaryNeuronSpec);
