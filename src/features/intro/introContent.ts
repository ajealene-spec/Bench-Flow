/** Landing page copy. Plain language, no invented statistics. Kept apart from the components so tests can check it. */

export interface ProblemCard {
  problem: string;
  solution: string;
}

/** The mission sentence is set large under the Mission heading. Pillars are the three short promises below it. */
export const MISSION_SENTENCE =
  'Free and open to everyone, from first-year students to professional researchers, to promote learning and open science communication.';

export const MISSION_PILLARS = ['Free for everyone', 'Learn as you work', 'Share openly'];

export const PROBLEMS: ProblemCard[] = [
  { problem: 'Protocols live in PDFs and memory', solution: 'Turn any protocol into guided steps' },
  { problem: 'Changes at the bench go unrecorded', solution: 'Every change is logged automatically' },
  { problem: 'Writing methods takes hours', solution: 'Methods write themselves from your run' },
];

export interface Feature {
  title: string;
  body: string;
}

export const HOW_STEPS: Feature[] = [
  { title: 'Paste a protocol', body: 'Paste text or upload a PDF. Get numbered steps with timers.' },
  { title: 'Run it hands-free', body: 'Work one step at a time. Timers keep running through reloads.' },
  { title: 'Log every deviation', body: 'Change a temperature or volume, and note why, on that step.' },
  { title: 'Export a report and data package', body: 'Protocol, data, photos and methods in one zip.' },
];

export const TOOLS: Feature[] = [
  { title: 'Guided calculators', body: 'Dilutions, molarity and master mixes, step by step.' },
  { title: 'Timers that start themselves', body: 'Each timer starts with its step and survives reloads.' },
  { title: 'Reagent and antibody tracking', body: 'Lot numbers and expiry dates, with low stock flagged.' },
  { title: 'Animal and sample tracking', body: 'Link animals and samples to a run.' },
  { title: 'Calendar for multi-day work', body: 'Each day of a multi-day experiment, on one calendar.' },
  { title: 'Glossary and "why this step"', body: 'Plain-language terms, and why each step matters.' },
];

export const OPEN_ITEMS: Feature[] = [
  { title: 'MIT license', body: 'Free to read, use, change and share.' },
  { title: 'Reusable protocols', body: 'Others can reuse what you share, with credit to you (CC BY).' },
  { title: 'Share links', body: 'Send a read-only link to a protocol or run.' },
  {
    title: 'Citable archive',
    body: 'Get a permanent citable link (DOI) by archiving on Zenodo, a free research archive.',
  },
  { title: 'Organized for reuse', body: 'Each protocol and run has a clear record others can find.' },
  { title: 'Accessible', body: 'Large touch targets, a readable font, light and dark themes.' },
];

export const ORGANIZED: Feature[] = [
  { title: 'Easy to find', body: 'Every protocol and run has its own record.' },
  { title: 'Open formats', body: 'Plain files you can open anywhere. Works offline.' },
  { title: 'Standard IDs', body: 'Unique IDs (RRIDs) for antibodies, animals and software.' },
  { title: 'Easy to reuse', body: 'Licensed and versioned, with methods written out.' },
];
