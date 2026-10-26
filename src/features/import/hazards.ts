import type { Hazard, HazardKind, Step } from '../../types';

/**
 * Offline hazard detection for parsed protocols. The rule list covers common hazards in
 * neuroscience and molecular biology. The AI parser can add more (validated in parseAiHazards),
 * and both sources are merged by mergeHazards.
 *
 * Matching runs over each step's title, instructions, cautions and reagent names. Abbreviations
 * such as SDS, APS or DTT are matched case-sensitively so that ordinary words are not flagged.
 */

export interface HazardRule {
  id: string;
  name: string;
  kind: HazardKind;
  reason: string;
  ppe: string[];
  /** Other names the same hazard goes by. Used to match AI output to a rule. */
  aliases: string[];
  /** Patterns tested against step text. Any match flags the step. */
  patterns: RegExp[];
}

const GLOVES = 'Nitrile gloves';
const GOGGLES = 'Safety glasses or goggles';
const COAT = 'Lab coat';
const HOOD = 'Work in a fume hood';

export const HAZARD_RULES: HazardRule[] = [
  {
    id: 'acrylamide',
    name: 'Acrylamide (gel powder and solution)',
    kind: 'chemical',
    reason: 'Unpolymerized acrylamide is a neurotoxin and a suspected carcinogen. Weigh the powder in a fume hood or with a mask.',
    ppe: [GLOVES, GOGGLES, COAT, 'Weigh powder in a fume hood or wear a dust mask'],
    aliases: ['acrylamide', 'polyacrylamide', 'bis-acrylamide', 'bisacrylamide', '30% acrylamide'],
    patterns: [/\b(?:bis[\s-]?)?acrylamide\b/i, /\bpolyacrylamide\b/i],
  },
  {
    id: 'temed',
    name: 'TEMED',
    kind: 'chemical',
    reason: 'Volatile, flammable and corrosive. It irritates the eyes, skin and airways.',
    ppe: [GLOVES, GOGGLES, COAT, HOOD],
    aliases: ['TEMED', 'tetramethylethylenediamine'],
    patterns: [/\bTEMED\b/, /\btetramethylethylenediamine\b/i],
  },
  {
    id: 'aps',
    name: 'Ammonium persulfate (APS)',
    kind: 'chemical',
    reason: 'Strong oxidizer and skin and eye irritant. Keep away from combustibles.',
    ppe: [GLOVES, GOGGLES, COAT],
    aliases: ['APS', 'ammonium persulfate', 'ammonium peroxodisulfate'],
    patterns: [/\bAPS\b/, /\bammonium\s+(?:per|peroxo)sulfate\b/i],
  },
  {
    id: 'beta-me',
    name: 'β-mercaptoethanol (2-ME)',
    kind: 'chemical',
    reason: 'Toxic, volatile and strongly smelling. Harmful if inhaled or absorbed through the skin.',
    ppe: [GLOVES, GOGGLES, COAT, HOOD],
    aliases: ['β-mercaptoethanol', 'beta-mercaptoethanol', '2-mercaptoethanol', '2-ME', 'β-ME', 'bME'],
    patterns: [
      /(?:β|\bbeta)[\s-]?mercaptoethanol\b/i,
      /\b2[\s-]?mercaptoethanol\b/i,
      /\bmercaptoethanol\b/i,
      /(?:β|\bbeta)[\s-]?ME\b/i,
      /\b2-ME\b/i,
    ],
  },
  {
    id: 'dtt',
    name: 'DTT (dithiothreitol)',
    kind: 'chemical',
    reason: 'Irritant with a strong odor. Harmful if swallowed or absorbed through the skin.',
    ppe: [GLOVES, GOGGLES, COAT],
    aliases: ['DTT', 'dithiothreitol'],
    patterns: [/\bDTT\b/, /\bdithiothreitol\b/i],
  },
  {
    id: 'sds',
    name: 'SDS (sodium dodecyl sulfate)',
    kind: 'chemical',
    reason: 'Irritant to eyes and airways. The powder is harmful if inhaled.',
    ppe: [GLOVES, GOGGLES, COAT, 'Weigh powder in a fume hood or wear a dust mask'],
    aliases: ['SDS', 'sodium dodecyl sulfate', 'sodium dodecyl sulphate'],
    patterns: [/\bSDS\b/, /\bsodium\s+dodecyl\s+sulfate\b/i, /\bsodium\s+dodecyl\s+sulphate\b/i],
  },
  {
    id: 'methanol',
    name: 'Methanol',
    kind: 'chemical',
    reason: 'Flammable and toxic. Vapor and skin contact can cause blindness or organ damage.',
    ppe: [GLOVES, GOGGLES, COAT, HOOD, 'Keep away from flames and ignition sources'],
    aliases: ['methanol', 'MeOH', 'methyl alcohol'],
    patterns: [/\bmethanol\b/i, /\bMeOH\b/i, /\bmethyl alcohol\b/i],
  },
  {
    id: 'formaldehyde',
    name: 'Paraformaldehyde / formaldehyde (PFA, formalin)',
    kind: 'chemical',
    reason: 'Toxic, a suspected carcinogen and a sensitizer. Vapor irritates the eyes and airways.',
    ppe: [GLOVES, GOGGLES, COAT, HOOD],
    aliases: ['PFA', 'paraformaldehyde', 'formaldehyde', 'formalin'],
    patterns: [/\bPFA\b/i, /\bparaformaldehyde\b/i, /\bformaldehyde\b/i, /\bformalin\b/i],
  },
  {
    id: 'glutaraldehyde',
    name: 'Glutaraldehyde',
    kind: 'chemical',
    reason: 'Toxic and a strong sensitizer. Vapor irritates the eyes and airways.',
    ppe: [GLOVES, GOGGLES, COAT, HOOD],
    aliases: ['glutaraldehyde', 'glutaldehyde'],
    patterns: [/\bglutar?aldehyde\b/i],
  },
  {
    id: 'ethidium',
    name: 'Ethidium bromide',
    kind: 'chemical',
    reason: 'Mutagen that intercalates DNA. Handle with dedicated waste and avoid UV exposure.',
    ppe: [GLOVES, COAT, GOGGLES, 'Dispose of gels and solutions as mutagenic waste'],
    aliases: ['ethidium bromide', 'EtBr', 'ethidium'],
    patterns: [/\bethidium(?:\s+bromide)?\b/i, /\bEtBr\b/],
  },
  {
    id: 'sybr',
    name: 'SYBR nucleic acid stain',
    kind: 'chemical',
    reason: 'DNA stain that may be mutagenic. Read the safety data sheet for the specific product.',
    ppe: [GLOVES, COAT, 'UV-blocking eye protection when imaging under UV'],
    aliases: ['SYBR', 'SYBR Safe', 'SYBR Gold', 'SYBR Green'],
    patterns: [/\bSYBR\b/],
  },
  {
    id: 'chloroform',
    name: 'Chloroform',
    kind: 'chemical',
    reason: 'Toxic, a suspected carcinogen and harmful to the liver, kidneys and nervous system.',
    ppe: [GLOVES, GOGGLES, COAT, HOOD],
    aliases: ['chloroform', 'CHCl3'],
    patterns: [/\bchloroform\b/i, /\bCHCl3\b/],
  },
  {
    id: 'phenol',
    name: 'Phenol / TRIzol',
    kind: 'chemical',
    reason: 'Phenol is corrosive and toxic and is absorbed through the skin. TRIzol contains phenol and guanidine.',
    ppe: [GLOVES, GOGGLES, COAT, HOOD],
    aliases: ['phenol', 'TRIzol', 'TRI reagent'],
    patterns: [/\bphenol\b(?!\s+red)/i, /\bTRIzol\b/i, /\bTRI\s+reagent\b/i],
  },
  {
    id: 'dmso',
    name: 'DMSO',
    kind: 'chemical',
    reason: 'Carries dissolved chemicals through the skin. Wear gloves that resist it and do not touch contaminated gloves to skin.',
    ppe: [GLOVES, GOGGLES, COAT],
    aliases: ['DMSO', 'dimethyl sulfoxide', 'dimethyl sulphoxide'],
    patterns: [/\bDMSO\b/, /\bdimethyl\s+sulph?oxide\b/i],
  },
  {
    id: 'sodium-azide',
    name: 'Sodium azide',
    kind: 'chemical',
    reason: 'Highly toxic. It forms explosive metal azides in drains, so never pour it down the sink.',
    ppe: [GLOVES, GOGGLES, COAT, 'Collect azide waste separately; never drain it'],
    aliases: ['sodium azide', 'NaN3'],
    patterns: [/\bsodium\s+azide\b/i, /\bNaN3\b/],
  },
  {
    id: 'triton',
    name: 'Triton X-100 / NP-40 detergent',
    kind: 'chemical',
    reason: 'Irritates the eyes and skin.',
    ppe: [GLOVES, GOGGLES],
    aliases: ['Triton X-100', 'Triton', 'NP-40'],
    patterns: [/\bTriton\s+X-?100\b/i, /\bNP-?40\b/i],
  },
  {
    id: 'cryogen',
    name: 'Cryogens (liquid nitrogen, dry ice)',
    kind: 'physical',
    reason: 'Extremely cold. Contact causes cold burns, and a sealed container can build pressure.',
    ppe: ['Cryo-gloves', 'Face shield or goggles', 'Closed-toe shoes', 'Never seal liquid nitrogen in a container'],
    aliases: ['liquid nitrogen', 'LN2', 'dry ice'],
    patterns: [/\bliquid\s+nitrogen\b/i, /\bLN2\b/, /\bdry\s+ice\b/i],
  },
  {
    id: 'open-flame',
    name: 'Open flame (Bunsen burner)',
    kind: 'physical',
    reason: 'Fire and burn risk. Keep flammable solvents and paper away from the flame.',
    ppe: [COAT, GOGGLES, 'Tie back long hair and loose sleeves', 'Keep flammables away from the flame'],
    aliases: ['Bunsen burner', 'open flame', 'flame sterilization'],
    patterns: [/\bBunsen\b/i, /\bopen\s+flame\b/i, /\bflame[\s-]steriliz\w*/i],
  },
  {
    id: 'uv',
    name: 'UV transilluminator / UV light',
    kind: 'physical',
    reason: 'UV light damages eyes and skin.',
    ppe: ['UV-blocking face shield or goggles', 'Long sleeves and gloves', 'Keep the UV hood closed while imaging'],
    aliases: ['UV transilluminator', 'UV light', 'UV lamp'],
    patterns: [/\bUV[\s-](?:transilluminat\w*|light|lamp|box|imag\w*)\b/i, /\btransilluminator\b/i],
  },
  {
    id: 'sharps',
    name: 'Sharps (needles, syringes, scalpels)',
    kind: 'physical',
    reason: 'Puncture and cut risk. Used sharps can carry infectious material.',
    ppe: ['Cut-resistant gloves when cutting', 'Sharps container for disposal', 'Do not recap needles'],
    aliases: ['needle', 'syringe', 'scalpel', 'sharps', 'lancet'],
    patterns: [/\b(?:needles?|syringes?|scalpels?|lancets?|sharps?|hypodermic)\b/i],
  },
  {
    id: 'perfusion',
    name: 'Perfusion (transcardial)',
    kind: 'biological',
    reason: 'Surgery on an anesthetized animal with fixatives and sharps. Follow the approved animal protocol.',
    ppe: [COAT, GLOVES, GOGGLES, HOOD, 'Sharps container for needles and blades'],
    aliases: ['perfusion', 'transcardial perfusion', 'intracardiac perfusion'],
    patterns: [/\bperfus(?:ion|e|ed|es|ing)\b/i, /\btranscardial\b/i, /\bintracardiac\b/i],
  },
  {
    id: 'anesthetic',
    name: 'Anesthetics (isoflurane, ketamine, xylazine)',
    kind: 'chemical',
    reason: 'Sedatives that depress breathing. Isoflurane vapor is harmful to people who breathe it.',
    ppe: [GLOVES, COAT, 'Use a scavenging system or fume hood for isoflurane', 'Trained personnel only'],
    aliases: ['isoflurane', 'ketamine', 'xylazine', 'sevoflurane', 'pentobarbital', 'anesthesia', 'anaesthesia'],
    patterns: [
      /\bisoflurane\b/i,
      /\bsevoflurane\b/i,
      /\bketamine\b/i,
      /\bxylazine\b/i,
      /\bpentobarbital\b/i,
      /\banaesthe(?:sia|tic|tize|tized|tizing)\b/i,
      /\banesthe(?:sia|tic|tize|tized|tizing)\b/i,
    ],
  },
  {
    id: 'live-animals',
    name: 'Live animals (in vivo work)',
    kind: 'biological',
    reason: 'Animal work needs an approved protocol, trained handlers and humane endpoints.',
    ppe: [COAT, GLOVES, 'Follow the animal care protocol (IACUC or equivalent)'],
    aliases: ['live animals', 'mice', 'rats', 'in vivo'],
    patterns: [
      /(?<!anti[\s-])\b(?:mice|mouse|rats?|guinea\s+pigs?|rabbits?|zebrafish|animals?)\b(?![\s-]*(?:anti|igg|igm|antibod\w*|secondary|monoclonal|polyclonal|hrp|ap\b))/i,
      /\bin\s+vivo\b/i,
    ],
  },
  {
    id: 'human-samples',
    name: 'Human samples (BSL-2 precautions)',
    kind: 'biological',
    reason: 'Human tissue, blood and fluids may carry bloodborne pathogens. Treat them as potentially infectious.',
    ppe: [GLOVES, COAT, GOGGLES, 'Work in a biosafety cabinet for blood or fluids', 'Decontaminate with bleach'],
    aliases: ['human samples', 'human tissue', 'human serum', 'human blood', 'patient samples', 'postmortem'],
    patterns: [
      /\bhuman\s+(?:tissues?|samples?|serum|plasma|blood|brain|cells?|patients?|donors?|subjects?|post-?mortem)\b/i,
      /\bpatient\s+samples?\b/i,
      /\bpost-?mortem\b/i,
      /\bbiops(?:y|ies)\b/i,
      /\bwhole\s+blood\b/i,
      /\bPBMCs?\b/,
    ],
  },
  {
    id: 'viral-vectors',
    name: 'Viral vectors (AAV, lentivirus)',
    kind: 'biological',
    reason: 'Replication-deficient viral vectors, usually handled at BSL-2.',
    ppe: [GLOVES, COAT, GOGGLES, 'Work in a biosafety cabinet', 'Decontaminate waste with bleach or autoclave'],
    aliases: ['AAV', 'lentivirus', 'lentiviral', 'retrovirus', 'adenovirus', 'viral vector'],
    patterns: [/\bAAV\w*/, /\blentivir\w*/i, /\bretrovir\w*/i, /\badenovir\w*/i, /\bviral\s+vectors?\b/i],
  },
  {
    id: 'bacteria',
    name: 'Bacteria (E. coli)',
    kind: 'biological',
    reason: 'Bacterial cultures can contaminate the bench. Lab strains are usually BSL-1, but follow your institution\'s rules.',
    ppe: [GLOVES, COAT, GOGGLES, 'Decontaminate cultures before disposal'],
    aliases: ['E. coli', 'Escherichia coli', 'bacteria', 'LB medium'],
    patterns: [/\bE\.\s?coli\b/, /\bEscherichia\b/, /\bbacteri(?:a|al)\b/i, /\bLB\s+(?:agar|broth|medium)\b/i],
  },
  {
    id: 'radioisotope',
    name: 'Radioisotopes (32P, 33P, 35S)',
    kind: 'radiological',
    reason: 'Ionizing radiation. Follow radiation safety rules, monitor contamination and track dose.',
    ppe: [COAT, 'Double nitrile gloves', 'Dosimeter ring or badge', 'Monitor hands and bench with a survey meter'],
    aliases: ['32P', '33P', '35S', 'radioactive', 'radioisotope'],
    patterns: [/\b(?:32|33)P\b/, /\b35S\b/, /\bradioactiv\w*/i, /\bradioisotope\w*/i, /\bradiolabel\w*/i],
  },
  {
    id: 'high-voltage',
    name: 'High voltage (electrophoresis power supply)',
    kind: 'physical',
    reason: 'Electric shock risk from power supplies and electrodes at 10 V and above.',
    ppe: ['Switch the power off before touching electrodes or connecting leads', 'Do not open the chamber while it is running'],
    aliases: ['high voltage', 'power supply'],
    patterns: [/\bhigh\s+voltage\b/i, /\bpower\s+supply\b/i, /\b(?:[1-9]\d|[1-9]\d{2,3})\s?(?:V|[Vv]olts?)\b/],
  },
  {
    id: 'centrifuge',
    name: 'Centrifuge',
    kind: 'physical',
    reason: 'Rotating rotors can fail or fly apart if unbalanced.',
    ppe: ['Balance rotor tubes', 'Close the lid before spinning', 'Wait for the rotor to stop before opening'],
    aliases: ['centrifuge', 'microcentrifuge'],
    patterns: [/\bcentrifug(?:e|es|ed|ing|ation)\b/i, /\bmicrocentrifuge\b/i],
  },
];

/** Lowercases an alias and strips spaces and punctuation, so "β-ME" and "b me" compare equal. */
export function normalizeHazardName(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
}

/** Distinct, normalized alias keys for a rule, so the same name is never listed twice. */
export function dedupeAliases(aliases: string[]): string[] {
  return [...new Set(aliases.map(normalizeHazardName).filter(Boolean))];
}

const ALIAS_INDEX: Map<string, HazardRule> = (() => {
  const index = new Map<string, HazardRule>();
  for (const rule of HAZARD_RULES) {
    for (const key of dedupeAliases([rule.name, ...rule.aliases])) {
      if (!index.has(key)) index.set(key, rule);
    }
  }
  return index;
})();

/** The rule whose name or alias matches, or undefined. */
export function findRuleByName(name: string): HazardRule | undefined {
  const key = normalizeHazardName(name);
  return key ? ALIAS_INDEX.get(key) : undefined;
}

/** Text of a step that the rules scan. */
function stepText(step: Step): string[] {
  return [
    step.title,
    step.instructions,
    ...step.cautions,
    ...step.reagents.map((r) => r.name),
  ].filter(Boolean);
}

/** Runs the offline rule list over the steps. One hazard per rule, with the step ids where it appears. */
export function detectHazards(steps: Step[]): Hazard[] {
  const hazards: Hazard[] = [];
  for (const rule of HAZARD_RULES) {
    const stepIds = steps
      .filter((step) => stepText(step).some((text) => rule.patterns.some((p) => p.test(text))))
      .map((step) => step.id);
    if (stepIds.length === 0) continue;
    hazards.push({
      id: rule.id,
      name: rule.name,
      kind: rule.kind,
      reason: rule.reason,
      ppe: [...rule.ppe],
      stepIds,
    });
  }
  return hazards;
}

const KINDS: HazardKind[] = ['chemical', 'biological', 'physical', 'radiological'];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Validates hazards returned by the AI parser. Each item needs a name; step numbers are 1-based
 * positions in the steps list and are mapped to step ids. Unknown kinds become "chemical".
 */
export function parseAiHazards(raw: unknown, steps: Step[]): Hazard[] {
  if (!Array.isArray(raw)) return [];
  const out: Hazard[] = [];
  for (const item of raw) {
    if (!isObj(item) || typeof item.name !== 'string' || !item.name.trim()) continue;
    const name = item.name.trim().slice(0, 120);
    const reason = typeof item.reason === 'string' ? item.reason.trim().slice(0, 300) : '';
    const kind = KINDS.includes(item.kind as HazardKind) ? (item.kind as HazardKind) : 'chemical';
    const ppe = Array.isArray(item.ppe)
      ? item.ppe.filter((p): p is string => typeof p === 'string' && p.trim() !== '').map((p) => p.trim().slice(0, 120))
      : [];
    const numbers = Array.isArray(item.stepNumbers) ? item.stepNumbers : [];
    const stepIds = [
      ...new Set(
        numbers
          .filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= steps.length)
          .map((n) => steps[n - 1].id),
      ),
    ];

    const rule = findRuleByName(name);
    out.push({
      id: rule ? rule.id : crypto.randomUUID(),
      name: rule ? rule.name : name,
      kind: rule ? rule.kind : kind,
      reason: rule ? rule.reason : reason,
      ppe: rule ? [...rule.ppe] : [...new Set(ppe)],
      stepIds,
    });
  }
  return out;
}

/**
 * Unions two hazard lists. Items with the same normalized name (or rule alias) are merged: step ids
 * are combined and the first entry's name, reason and PPE are kept. The first list wins on ties.
 */
export function mergeHazards(...lists: Hazard[][]): Hazard[] {
  const merged: Hazard[] = [];
  const byKey = new Map<string, Hazard>();
  for (const list of lists) {
    for (const hazard of list) {
      const rule = findRuleByName(hazard.name);
      const key = rule ? rule.id : normalizeHazardName(hazard.name);
      const existing = byKey.get(key);
      if (existing) {
        existing.stepIds = [...new Set([...existing.stepIds, ...hazard.stepIds])];
        existing.ppe = [...new Set([...existing.ppe, ...hazard.ppe])];
      } else {
        const copy: Hazard = { ...hazard, ppe: [...new Set(hazard.ppe)], stepIds: [...new Set(hazard.stepIds)] };
        byKey.set(key, copy);
        merged.push(copy);
      }
    }
  }
  return merged;
}

/** Drops step ids that no longer exist, for hazards stored on a list that was edited. */
export function pruneHazardSteps(hazards: Hazard[], stepIds: string[]): Hazard[] {
  const valid = new Set(stepIds);
  return hazards.map((h) => ({ ...h, stepIds: h.stepIds.filter((id) => valid.has(id)) }));
}

/**
 * Re-checks hazards that came back from the server as JSON. Keeps only well-formed entries and
 * drops step ids that are not in the steps being imported.
 */
export function sanitizeHazards(raw: unknown, steps: Step[]): Hazard[] {
  if (!Array.isArray(raw)) return [];
  const valid = new Set(steps.map((s) => s.id));
  const out: Hazard[] = [];
  for (const item of raw) {
    if (!isObj(item) || typeof item.name !== 'string' || !item.name.trim()) continue;
    const ids = Array.isArray(item.stepIds) ? item.stepIds.filter((id): id is string => typeof id === 'string' && valid.has(id)) : [];
    out.push({
      id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
      name: item.name.trim().slice(0, 120),
      kind: KINDS.includes(item.kind as HazardKind) ? (item.kind as HazardKind) : 'chemical',
      reason: typeof item.reason === 'string' ? item.reason.trim().slice(0, 300) : '',
      ppe: Array.isArray(item.ppe) ? item.ppe.filter((p): p is string => typeof p === 'string' && p.trim() !== '') : [],
      stepIds: [...new Set(ids)],
    });
  }
  return out;
}
