/** Landing page copy. Plain language, no invented statistics. Kept apart from the components so tests can check it. */

export interface ProblemCard {
  problem: string;
  solution: string;
}

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
  { title: 'Paste a protocol', body: 'Paste the text or upload a PDF. Get numbered steps with timers, reagents and cautions.' },
  { title: 'Run it hands-free', body: 'Work one step at a time. Timers keep running through page reloads and screen sleep.' },
  { title: 'Log every deviation', body: 'Change a temperature or a volume and note why, on the step where it happened.' },
  {
    title: 'Export a report and data package',
    body: 'Protocol, data, photos and methods in one zip, ready to share or archive.',
  },
];

export const TOOLS: Feature[] = [
  { title: 'Guided calculators', body: 'Dilutions, molarity and master mixes, worked out step by step.' },
  { title: 'Timers that start themselves', body: 'A timer starts when its step begins and keeps running through reloads.' },
  { title: 'Reagent and antibody tracking', body: 'Record lot numbers and expiry dates, and see what is running low.' },
  { title: 'Animal and sample tracking', body: 'Link animals and samples to the run. Surgery coordinates are saved with the experiment.' },
  { title: 'Calendar for multi-day work', body: 'See each day of a multi-day experiment on one calendar.' },
  { title: 'Glossary and "why this step"', body: 'Plain-language terms, plus a short note on why each step matters.' },
];

export const OPEN_ITEMS: Feature[] = [
  { title: 'MIT license', body: 'The code is free to read, use, change and share.' },
  { title: 'CC BY protocols', body: 'Protocols you share can be reused with credit to you.' },
  { title: 'Share links', body: 'Send a read-only link to a protocol or a run.' },
  { title: 'Zenodo DOI', body: 'Archive a release on Zenodo to get a citable DOI.' },
  { title: 'Organized for reuse', body: 'Every protocol and run has a clear record, so others can find and reuse it.' },
  { title: 'Accessible', body: 'Large touch targets, a dyslexia-friendly font, light and dark themes, and reduced motion.' },
];

export const ORGANIZED: Feature[] = [
  { title: 'Easy to find', body: 'Every protocol and run has its own record.' },
  { title: 'Open formats', body: 'Plain files you can open anywhere. The notebook works offline.' },
  { title: 'Standard IDs', body: 'Research Resource Identifiers (RRIDs) for antibodies, animals and software.' },
  { title: 'Easy to reuse', body: 'Licensed and versioned, with the methods written out.' },
];
