import { buildStarter, derived, input, type StarterSpec } from './build';

export const perfusionPfaSpec: StarterSpec = {
  slug: 'perfusion-pfa',
  title: 'Transcardial perfusion with paraformaldehyde',
  category: 'Surgery & tissue',
  overview: {
    objective: 'Fix brain tissue by perfusing the vasculature with saline and then 4% paraformaldehyde (PFA).',
    totalTime: 'About 4 days (perfusion on day 0; post-fixation overnight; cryoprotection 2 to 3 days)',
    outputs: 'Post-fixed, cryoprotected brain ready for sectioning.',
  },
  materials: [
    ['Ice-cold PBS (0.1 M, pH 7.4)', 'solution'],
    ['4% paraformaldehyde in PBS, freshly made from 16% stock', 'solution'],
    ['16% PFA stock (ampoule, fresh)', 'solution'],
    ['30% sucrose in PBS', 'solution'],
    ['Anesthetic (as set out in your IACUC-approved protocol)', 'consumable'],
    ['Heparin (optional, as approved)', 'solution'],
    ['23 to 25 G butterfly needle and perfusion tubing', 'consumable'],
    ['Peristaltic pump', 'equipment'],
    ['Surgical instruments', 'equipment'],
  ],
  phases: ['Day 0: perfuse', 'Day 1: post-fix', 'Days 2 to 4: cryoprotect'],
  hazards: [
    {
      name: 'Paraformaldehyde',
      kind: 'chemical',
      reason: 'Toxic, a sensitizer and a suspected carcinogen. Prepare and use it in a fume hood and collect waste as hazardous waste.',
      ppe: ['Nitrile gloves', 'Lab coat', 'Safety glasses'],
      steps: [1, 5, 7],
    },
    {
      name: 'Anesthetic agents',
      kind: 'chemical',
      reason: 'Overdose is dangerous to the operator too. Follow the approved agent, dose and controlled-substance rules.',
      ppe: ['Nitrile gloves'],
      steps: [2],
    },
  ],
  steps: [
    {
      title: 'Prepare perfusate',
      instructions:
        'Make 4% PFA from 16% stock, diluting in ice-cold PBS in a fume hood. The stock volume is calculated from the target and stock percentages.',
      variables: [
        input('stock', 'PFA stock strength', 16, '%'),
        input('tgt', 'Target PFA concentration', 4, '%'),
        input('vol', 'Perfusate volume', 100, 'mL'),
        derived('pfa', 'PFA stock volume', 'mL', 'vol * tgt / stock'),
      ],
    },
    {
      title: 'Anesthetize',
      instructions:
        'Anesthetize the animal per your IACUC-approved protocol. Confirm surgical depth with a toe pinch and no pedal withdrawal before opening the chest.',
      phase: 0,
      cautions: ['Follow the approved humane endpoints.'],
    },
    {
      title: 'Open the chest',
      instructions:
        'Make a midline abdominal incision, open the diaphragm and cut the ribs laterally to expose the heart. Make a small cut in the right atrium so blood can drain. Do not cut the heart before perfusion starts.',
      phase: 0,
    },
    {
      title: 'Perfuse with PBS',
      instructions:
        'Insert the needle into the left ventricle and start the pump. Flush with ice-cold PBS until the liver clears and the effluent runs clear.',
      minutes: 5,
      phase: 0,
      variables: [
        input('pbs', 'PBS perfusate per animal', 25, 'mL'),
        input('flow', 'Flow rate', 5, 'mL/min'),
        derived('pt', 'PBS perfusion time', 'min', 'pbs / flow'),
      ],
    },
    {
      title: 'Perfuse with PFA',
      instructions:
        'Switch to 4% PFA at about 5 mL/min for 20 to 30 mL. Stiffening of the limbs and tail is a sign of good fixation.',
      minutes: 5,
      phase: 0,
      cautions: ['PFA is toxic. Keep the waste in the labeled hazardous waste container.'],
    },
    {
      title: 'Remove the brain',
      instructions: 'Decapitate, remove the skin and skull over the brain, and lift the brain out gently with a spatula. Place it in 4% PFA.',
      phase: 0,
    },
    {
      title: 'Post-fix',
      instructions: 'Keep the brain in 4% PFA at 4 °C overnight (about 16 to 24 h).',
      minutes: 960,
      phase: 1,
    },
    {
      title: 'Cryoprotect',
      instructions:
        'Transfer the brain to 30% sucrose in PBS at 4 °C. Change the solution when the brain sinks, and keep going until it has sunk completely (about 2 to 3 days).',
      minutes: 2880,
      phase: 2,
    },
  ],
};

export const perfusionPfa = buildStarter(perfusionPfaSpec);
