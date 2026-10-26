import { buildStarter, derived, input, type StarterSpec } from './build';

export const stereotaxicSpec: StarterSpec = {
  slug: 'stereotaxic-viral-injection',
  title: 'Stereotaxic viral injection',
  category: 'Surgery & tissue',
  overview: {
    objective: 'Deliver a viral vector to a defined brain region through a small craniotomy under stereotaxic guidance.',
    totalTime: 'Surgery about 1 to 1.5 h; post-operative monitoring for 7 days',
    outputs: 'Recovered animal with the injection recorded, ready for the expression window.',
  },
  materials: [
    ['AAV vector stock (titer in genome copies per mL)', 'consumable'],
    ['Sterile PBS', 'solution'],
    ['Isoflurane and oxygen', 'consumable'],
    ['Analgesic (for example carprofen, as set out in the approved protocol)', 'consumable'],
    ['Povidone-iodine and 70% ethanol', 'solution'],
    ['Sterile ophthalmic ointment', 'consumable'],
    ['Sterile saline', 'solution'],
    ['Sutures or tissue adhesive', 'consumable'],
    ['33 G needle or glass pipette, and Hamilton syringe', 'consumable'],
    ['Stereotaxic frame with ear bars', 'equipment'],
    ['Heating pad', 'equipment'],
    ['Microdrill and burr', 'equipment'],
    ['Syringe pump', 'equipment'],
  ],
  phases: ['Pre-op (day -1)', 'Surgery (day 0)', 'Post-op recovery (days 1 to 7)'],
  hazards: [
    {
      name: 'Isoflurane',
      kind: 'chemical',
      reason: 'Inhaled anesthetic. Use a scavenging system and keep the induction chamber closed.',
      ppe: ['Nitrile gloves'],
      steps: [3],
    },
    {
      name: 'Viral vector (AAV)',
      kind: 'biological',
      reason: 'Replication-incompetent but still a biological agent. Follow the institutional biosafety rules.',
      ppe: ['Nitrile gloves', 'Lab coat', 'Safety glasses'],
      steps: [2, 7],
    },
  ],
  steps: [
    {
      title: 'Pre-op checklist',
      instructions:
        'Confirm the approved protocol, the sterile surgery area and autoclaved instruments. Weigh and record the animal. Give a pre-emptive analgesic as the approved protocol sets out.',
      phase: 0,
    },
    {
      title: 'Prepare virus',
      instructions:
        'Thaw the AAV on ice, aliquot, and dilute it to the working titer in sterile PBS. Keep it on ice and protected from light. The stock volume is calculated from the target and stock titers.',
      phase: 0,
      variables: [
        input('stock', 'AAV stock titer', 10000000000000, 'gc/mL'),
        input('tgt', 'Working titer', 1000000000000, 'gc/mL'),
        input('fv', 'Final volume', 20, 'µL'),
        derived('av', 'AAV stock volume', 'µL', 'fv * tgt / stock'),
      ],
    },
    {
      title: 'Anesthetize',
      instructions:
        'Induce at 3 to 4% isoflurane and maintain at 1 to 2%. Confirm depth with a toe pinch. Apply ophthalmic ointment to both eyes.',
      phase: 1,
      cautions: ['Keep the animal on a heating pad at 37 °C.'],
    },
    {
      title: 'Position and prepare',
      instructions:
        'Secure the head in the stereotaxic frame with ear bars. Shave the scalp, then scrub with povidone-iodine and 70% ethanol three times.',
      phase: 1,
    },
    {
      title: 'Incise and level skull',
      instructions:
        'Make a midline incision, clean the skull, and level it so bregma and lambda sit at the same dorsoventral height. Confirm coordinates against the atlas for your strain and age (for example Paxinos and Franklin). For example, a mouse CA1 target might be AP -2.0, ML 1.5, DV -1.5 mm from bregma. Verify before use.',
      phase: 1,
      cautions: ['Coordinates are examples only. Confirm them against your atlas.'],
    },
    {
      title: 'Drill craniotomy',
      instructions: 'Drill a small craniotomy over the target. Keep the dura intact.',
      phase: 1,
    },
    {
      title: 'Inject virus',
      instructions:
        'Lower the needle to the target depth. Infuse at the set rate, then wait before slowly withdrawing. The infusion time is calculated from the volume and rate.',
      minutes: 10,
      phase: 1,
      variables: [
        input('vol', 'Injection volume', 0.5, 'µL'),
        input('rate', 'Infusion rate', 0.1, 'µL/min'),
        derived('time', 'Infusion time', 'min', 'vol / rate'),
      ],
    },
    {
      title: 'Close incision',
      instructions: 'Suture or glue the scalp and inject sterile saline if the animal is dehydrated. Remove the animal from the frame.',
      phase: 1,
    },
    {
      title: 'Recover',
      instructions:
        'Keep the animal warm until it is awake and moving, then return it to a clean cage. Continue the analgesic as the approved protocol sets out, for at least 48 to 72 h.',
      phase: 2,
    },
    {
      title: 'Daily post-op checks',
      instructions:
        'Check weight, posture, incision and hydration daily for 7 days. Record each check in the animal record and follow the humane endpoints.',
      phase: 2,
    },
  ],
};

export const stereotaxicViralInjection = buildStarter(stereotaxicSpec);
