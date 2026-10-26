/*
 * Beginner explanations for a step. Pure: keyword-based generic text (offline), link builders and
 * validation for the AI-generated version. No React, no database.
 */

import type { ExplanationLink, StepExplanation } from '../../types';
import { validateExplainResult } from './explainPrompts';

export interface GenericExplanation {
  keyword: string;
  /** Regex source matched against the step title and text (case-insensitive). */
  match: string;
  why: string;
  mistakes: string[];
  /** Search term used for the Learn more links. */
  query: string;
  /** Adds the Allen Brain Atlas link when true. */
  brain?: boolean;
}

export const GENERIC_EXPLANATIONS: GenericExplanation[] = [
  {
    keyword: 'blocking',
    match: 'block',
    why: 'Blocking covers sticky spots on the membrane or tissue with protein, so antibodies stick only to your target and background stays low.',
    mistakes: ['Blocking for too short a time', 'Using milk with a phospho-specific antibody', 'Letting the membrane dry out during blocking'],
    query: 'blocking western blot',
  },
  {
    keyword: 'washing',
    match: 'wash',
    why: 'Washes remove unbound antibody and buffer residue. Enough washes keep the background low and the signal clean.',
    mistakes: ['Skipping washes to save time', 'Washing too briefly or with too little buffer', 'Letting the sample dry between washes'],
    query: 'washing immunostaining',
  },
  {
    keyword: 'fixation',
    match: 'fix|paraformaldehyde|\\bPFA\\b',
    why: 'Fixation preserves tissue structure and holds proteins in place so they can be stained later.',
    mistakes: ['Fixing for too long, which masks epitopes', 'Using a fixative that is old or not freshly made', 'Leaving tissue in fixative too briefly'],
    query: 'tissue fixation paraformaldehyde',
    brain: true,
  },
  {
    keyword: 'permeabilization',
    match: 'permeabili|triton|tween',
    why: 'Permeabilization opens membranes so antibodies can reach targets inside the cell.',
    mistakes: ['Using too much detergent, which damages structure', 'Skipping it for intracellular targets', 'Using the same concentration for every tissue'],
    query: 'permeabilization immunofluorescence',
  },
  {
    keyword: 'centrifugation',
    match: 'centrifug|spin',
    why: 'Centrifugation separates parts of a sample by density. Use xg rather than rpm, so the force is the same on any rotor.',
    mistakes: ['Using rpm from another rotor', 'Not balancing the rotor', 'Disturbing the pellet when removing the supernatant'],
    query: 'centrifugation protocol',
  },
  {
    keyword: 'transfer',
    match: 'transfer|blot',
    why: 'Transfer moves separated proteins from the gel onto a membrane where antibodies can reach them.',
    mistakes: ['Trapped air bubbles that leave blank spots', 'Wrong transfer time for the protein size', 'Membrane not wetted correctly (PVDF needs methanol)'],
    query: 'western blot transfer',
  },
  {
    keyword: 'perfusion',
    match: 'perfus|transcardial',
    why: 'Perfusion flushes blood out of the tissue and fixes it in place, which keeps brain structure intact for sectioning.',
    mistakes: ['Pumping too fast or too slowly for the animal', 'Air in the line', 'Fixing before the blood is cleared, which leaves the tissue pink'],
    query: 'transcardial perfusion mouse',
    brain: true,
  },
  {
    keyword: 'incubation',
    match: 'incubat|overnight|at 4 ?°?C',
    why: 'Incubation gives the antibody or reagent time to bind. Temperature and time set how strong and specific the binding is.',
    mistakes: ['Incubating at the wrong temperature', 'Shortening overnight steps', 'Letting the sample dry during incubation'],
    query: 'antibody incubation protocol',
  },
  {
    keyword: 'dilution',
    match: 'dilut|1:\\d+',
    why: 'A dilution sets how much antibody or reagent you use. Too strong gives background; too weak gives little signal.',
    mistakes: ['Confusing 1:1000 with 1 in 1000 volume', 'Using an old stock with the wrong dilution', 'Changing the diluent without re-testing'],
    query: 'antibody dilution optimization',
  },
  {
    keyword: 'primary antibody',
    match: 'primary antibod',
    why: 'The primary antibody binds your target. It defines what you see, so its dilution and host species matter.',
    mistakes: ['Using the wrong dilution', 'Forgetting to check the host species against the secondary', 'Storing it at room temperature'],
    query: 'primary antibody validation',
  },
  {
    keyword: 'secondary antibody',
    match: 'secondary antibod',
    why: 'The secondary antibody binds the primary and carries the label you detect. Its host must match a different species than your sample.',
    mistakes: ['Host species mismatch with the primary', 'Exposing fluorophores to light', 'Adding it before the primary has been washed'],
    query: 'secondary antibody cross reactivity',
  },
  {
    keyword: 'stereotaxic surgery',
    match: 'stereotax|bregma|lambda|craniotomy',
    why: 'Stereotaxic coordinates place a probe or injection at a brain region measured from bregma. Skull size varies between animals, so check the scale.',
    mistakes: ['Not measuring bregma and lambda on this animal', 'Forgetting to correct for head tilt', 'Injecting too fast so the virus leaks back out'],
    query: 'stereotaxic surgery mouse',
    brain: true,
  },
  {
    keyword: 'slice preparation',
    match: 'slice|acsf|vibratome|cutting solution',
    why: 'Slicing keeps neurons alive for recording. Cold, oxygenated solution limits damage while the tissue is cut.',
    mistakes: ['Solution not cold or not carbogenated', 'Slicing too slowly so cells die', 'Wrong osmolarity, which swells or shrinks cells'],
    query: 'acute brain slice preparation',
    brain: true,
  },
];

export interface GenericResult {
  keyword: string;
  why: string;
  mistakes: string[];
  links: ExplanationLink[];
  generic: true;
}

/** Links to protocol sites for a search term. Only the keyword is sent, never the step text. */
export function learnMoreLinks(query: string, brain = false): ExplanationLink[] {
  const q = encodeURIComponent(query);
  const links: ExplanationLink[] = [
    { title: 'protocols.io search', url: `https://www.protocols.io/search?q=${q}` },
    { title: 'JoVE search', url: `https://www.jove.com/search?query=${q}` },
    { title: 'Addgene protocols', url: `https://www.addgene.org/protocols/?q=${q}` },
  ];
  if (brain) links.push({ title: 'Allen Brain Atlas', url: 'https://mouse.brain-map.org/' });
  return links;
}

/** Generic explanation for the first keyword that matches the step title or text. Null when none match. */
export function genericExplanation(title: string, instructions: string): GenericResult | null {
  const text = `${title}\n${instructions}`;
  const hit = GENERIC_EXPLANATIONS.find((g) => new RegExp(g.match, 'i').test(text));
  if (!hit) return null;
  return { keyword: hit.keyword, why: hit.why, mistakes: hit.mistakes, links: learnMoreLinks(hit.query, hit.brain), generic: true };
}

export const FALLBACK_WHY =
  'This step moves the experiment forward. Read each instruction, check the amounts, and note anything that differs from the plan.';

/** Generic text for a step with no keyword match. Always returns something. */
export function genericOrFallback(title: string, instructions: string): GenericResult {
  return genericExplanation(title, instructions) ?? { keyword: 'general', why: FALLBACK_WHY, mistakes: ['Skipping a step or doing it out of order', 'Using a reagent that has not been checked for lot and expiry'], links: learnMoreLinks(title || 'lab protocol'), generic: true };
}

/**
 * Checks an AI-generated explanation. Returns the cleaned fields, or null if the shape is wrong.
 * Links are kept only when they are https URLs with a title.
 */
export function validateExplanationResponse(data: unknown): { why: string; mistakes: string[]; links: ExplanationLink[] } | null {
  return validateExplainResult(data);
}

/** Builds the cache row for a step from text and links. */
export function toStepExplanation(templateStepId: string, why: string, mistakes: string[], links: ExplanationLink[]): StepExplanation {
  return { templateStepId, why, mistakes, links };
}
