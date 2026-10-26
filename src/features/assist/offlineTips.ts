import { presetLabel, type PresetId, type TroubleshootResult } from './assistPrompts';

/**
 * Built-in troubleshooting rules used when there is no internet or no API key.
 * They are generic lab knowledge, not based on the run's data, and say so in the evidence line.
 */
interface OfflineRule {
  causes: { cause: string; adjustments: string[] }[];
  quickChecks: string[];
}

const RULES: Record<PresetId, OfflineRule> = {
  high_background: {
    causes: [
      {
        cause: 'Blocking too short or too dilute',
        adjustments: [
          'Block for 1 h at room temperature in 5% milk or BSA in TBST.',
          'If milk is the problem, switch blocking agent (BSA for phospho-antibodies).',
        ],
      },
      {
        cause: 'Antibody concentration too high',
        adjustments: [
          'Dilute the primary antibody 2 to 5 fold and try an overnight incubation at 4 °C.',
          'Dilute the secondary antibody and shorten its incubation.',
        ],
      },
      {
        cause: 'Insufficient washing',
        adjustments: ['Wash 3 x 10 min in TBST with enough buffer to cover the membrane.'],
      },
      {
        cause: 'Membrane dried out or buffers contaminated',
        adjustments: [
          'Keep the membrane wet at all times.',
          'Make fresh TBST and blocking buffer; filter if cloudy.',
        ],
      },
    ],
    quickChecks: ['Compare with a no-primary control to see whether the secondary is the source.'],
  },
  no_signal: {
    causes: [
      {
        cause: 'Transfer failed or protein load too low',
        adjustments: [
          'Stain the membrane with Ponceau S after transfer to confirm protein moved.',
          'Load more protein (for example 20 to 40 µg per lane for a whole-cell lysate).',
        ],
      },
      {
        cause: 'Antibody too dilute or inactive',
        adjustments: [
          'Try a more concentrated primary antibody (for example 1:500 instead of 1:2000).',
          'Check the antibody datasheet and expiry; avoid repeated freeze-thaw cycles.',
        ],
      },
      {
        cause: 'Detection reagent exhausted',
        adjustments: ['Use fresh ECL substrate and a longer exposure time.'],
      },
    ],
    quickChecks: ['Run a positive control lysate known to express the target.'],
  },
  smeared_bands: {
    causes: [
      {
        cause: 'Protein overloaded or lysate not clarified',
        adjustments: [
          'Load less protein per lane.',
          'Spin the lysate at high speed to clear debris before loading.',
        ],
      },
      {
        cause: 'Sample not fully denatured or gel run too hot',
        adjustments: [
          'Boil samples in loading buffer for 5 min with fresh reducing agent.',
          'Run the gel at a lower voltage or in a cold room.',
        ],
      },
    ],
    quickChecks: ['Check the gel percentage suits the target size.'],
  },
  nonspecific_bands: {
    causes: [
      {
        cause: 'Primary or secondary antibody cross-reacting',
        adjustments: [
          'Dilute the primary antibody further and use an antibody validated for this application.',
          'Use a secondary antibody raised against the primary host species and run a secondary-only control.',
        ],
      },
      {
        cause: 'Insufficient blocking',
        adjustments: ['Extend blocking to 1 h and use fresh blocking buffer.'],
      },
      {
        cause: 'Protein degradation',
        adjustments: ['Add protease and phosphatase inhibitors to the lysis buffer and keep samples on ice.'],
      },
    ],
    quickChecks: ['Compare band sizes with the antibody datasheet to identify known isoforms or degradation products.'],
  },
  uneven_transfer: {
    causes: [
      {
        cause: 'Poor contact in the transfer sandwich',
        adjustments: [
          'Roll out air bubbles between the gel and membrane before closing the sandwich.',
          'Check that the sponges and filter papers are fully wetted.',
        ],
      },
      {
        cause: 'Uneven current or buffer',
        adjustments: [
          'Use fresh transfer buffer and keep it cold during transfer.',
          'Run the transfer on ice or with a cooling unit at the same voltage and time as before.',
        ],
      },
    ],
    quickChecks: ['Stain the membrane with Ponceau S to see which areas transferred.'],
  },
  bubbles: {
    causes: [
      {
        cause: 'Air trapped between gel and membrane',
        adjustments: [
          'Remove bubbles with a roller or tube before closing the transfer cassette.',
          'Soak the membrane in methanol, then transfer buffer, before assembly.',
        ],
      },
      {
        cause: 'Membrane allowed to dry',
        adjustments: ['Keep the membrane fully submerged during every incubation and wash.'],
      },
    ],
    quickChecks: ['Use enough buffer in each tray to cover the membrane at all times.'],
  },
  no_amplification: {
    causes: [
      {
        cause: 'Template quality or amount',
        adjustments: [
          'Check template concentration and purity (A260/280 near 1.8).',
          'Use 1 to 100 ng of template for a standard PCR.',
        ],
      },
      {
        cause: 'Annealing temperature or Mg2+ not optimal',
        adjustments: [
          'Run a gradient PCR around 5 °C below the primer melting temperature.',
          'Check MgCl2 concentration (typically 1.5 to 2.5 mM).',
        ],
      },
      {
        cause: 'Primer or enzyme problem',
        adjustments: ['Check primer sequences and fresh dilution; use a positive control template.'],
      },
    ],
    quickChecks: ['Run a no-template control and a positive control in the same reaction set.'],
  },
  primer_dimers: {
    causes: [
      {
        cause: 'Primer concentration too high',
        adjustments: ['Lower each primer to 0.1 to 0.3 µM.'],
      },
      {
        cause: 'Annealing temperature too low',
        adjustments: ['Raise the annealing temperature in 2 °C steps.', 'Use a hot-start polymerase.'],
      },
    ],
    quickChecks: ['Check primers for 3′ complementarity with an online tool before ordering or reusing them.'],
  },
};

/** Offline troubleshooting result for a preset, in the same shape the AI returns. */
export function offlineTroubleshoot(presetId: string | undefined): TroubleshootResult {
  const rule = RULES[presetId as PresetId];
  if (!rule) {
    return {
      causes: [],
      quickChecks: ['Choose the closest symptom above to see offline tips.'],
    };
  }
  return {
    causes: rule.causes.map((c) => ({
      cause: c.cause,
      evidence: `Common cause for "${presetLabel(presetId)}". Offline rule, not based on this run's data.`,
      adjustments: [...c.adjustments],
    })),
    quickChecks: [...rule.quickChecks],
  };
}

export const OFFLINE_PRESET_IDS: readonly PresetId[] = Object.keys(RULES) as PresetId[];
