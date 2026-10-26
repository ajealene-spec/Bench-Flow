import { buildStarter, derived, input, type StarterSpec } from './build';

export const slicePhysSpec: StarterSpec = {
  slug: 'slice-electrophysiology',
  title: 'Acute slice electrophysiology: solutions and recording',
  category: 'Electrophysiology',
  overview: {
    objective: 'Prepare acute brain slices and record passive membrane properties by whole-cell patch clamp.',
    totalTime: 'About 4 h per session, including slice recovery',
    outputs: 'Per-cell Rm, Ra, Cm and holding values, logged with the run.',
  },
  materials: [
    ['10x ACSF stock without CaCl2 or MgCl2', 'solution'],
    ['CaCl2 and MgCl2 stock solutions', 'solution'],
    ['Sucrose cutting solution (ice-cold, carbogenated)', 'solution'],
    ['ACSF (1x), carbogenated, pH 7.3 to 7.4, 300 to 310 mOsm', 'solution'],
    ['Internal solution (K-gluconate based)', 'solution'],
    ['Carbogen (95% O2, 5% CO2)', 'consumable'],
    ['Isoflurane', 'consumable'],
    ['Borosilicate glass capillaries', 'consumable'],
    ['Vibratome', 'equipment'],
    ['Recording chamber and perfusion pump', 'equipment'],
    ['Patch-clamp amplifier and micromanipulator', 'equipment'],
    ['Pipette puller and osmometer', 'equipment'],
  ],
  hazards: [
    {
      name: 'Carbogen cylinder',
      kind: 'physical',
      reason: 'Compressed gas under high pressure. Secure the cylinder and use a regulator.',
      ppe: ['Safety glasses'],
      steps: [1],
    },
    {
      name: 'Isoflurane',
      kind: 'chemical',
      reason: 'Inhaled anesthetic. Use it in a ventilated area with scavenging.',
      ppe: ['Nitrile gloves'],
      steps: [3],
    },
  ],
  steps: [
    {
      title: 'Prepare ACSF',
      instructions:
        'Make 1 L of 1x ACSF from the 10x stock with water, then add CaCl2 (2 mM) and MgCl2 (1 mM) last. Check osmolarity (300 to 310 mOsm). Bubble with carbogen for 15 min before use. Stock volume is calculated from the dilution factor.',
      minutes: 15,
      variables: [
        input('stock', 'ACSF stock strength', 10, 'x'),
        input('fv', 'Final ACSF volume', 1000, 'mL'),
        derived('v10', 'Stock volume', 'mL', 'fv / stock'),
      ],
    },
    {
      title: 'Prepare cutting solution',
      instructions:
        'Prepare the ice-cold sucrose cutting solution, then carbogenate it for at least 15 min. Keep it at 0 to 4 °C until slicing.',
      minutes: 20,
    },
    {
      title: 'Anesthetize and remove brain',
      instructions:
        'Anesthetize the animal per your approved protocol. Remove the brain into ice-cold, carbogenated cutting solution within about 1 min.',
      cautions: ['Speed matters: keep the brain cold and oxygenated during slicing.'],
    },
    {
      title: 'Slice',
      instructions:
        'Glue the block to the vibratome stage in cold carbogenated cutting solution. Cut 300 µm slices at a slow speed.',
      variables: [input('thk', 'Slice thickness', 300, 'µm')],
    },
    {
      title: 'Recover slices',
      instructions:
        'Transfer the slices to ACSF at 32 to 34 °C for 30 min, then hold them at room temperature for at least 1 h before recording.',
      minutes: 30,
    },
    {
      title: 'Set up chamber',
      instructions: 'Place a slice in the recording chamber. Perfuse with carbogenated ACSF at 2 to 3 mL/min at 30 to 32 °C.',
    },
    {
      title: 'Patch a cell',
      instructions:
        'Pull pipettes to 3 to 6 MΩ and fill with internal solution. Approach a cell under visual control and form a gigaohm seal before breaking in.',
    },
    {
      title: 'Measure passive properties',
      instructions:
        'In voltage clamp, record Rm, Ra, Cm and holding current for each cell and log the values. Discard cells with unstable Rm or Ra above about 25 MΩ.',
    },
  ],
};

export const slicePhysiology = buildStarter(slicePhysSpec);
