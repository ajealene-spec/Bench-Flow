/*
 * Detects which bench tools a step probably needs, so the step can offer them inline.
 * Pure: keyword matching on the step text.
 */

export type ToolId = 'stereotax' | 'perfusion' | 'acsf' | 'virus' | 'molarity';

const RULES: Array<{ id: ToolId; label: string; re: RegExp }> = [
  { id: 'stereotax', label: 'Stereotaxic helper', re: /stereotax|bregma|lambda|craniotomy|injection site|\bAP\b.*\bML\b/i },
  { id: 'perfusion', label: 'Perfusion volumes', re: /perfus|transcardial|paraformaldehyde|\bPFA\b/i },
  { id: 'acsf', label: 'ACSF recipe scaler', re: /\bACSF\b|aCSF|artificial cerebrospinal|cutting solution|slicing solution/i },
  { id: 'virus', label: 'Virus dilution', re: /\bAAV\b|lentivir|virus|viral|titer|titre|vg\/mL|injection volume/i },
  { id: 'molarity', label: 'Molarity and dilution', re: /\bmol(ar|arity)?\b|\bmM\b|\bµM\b|\bnM\b|dilut|C1V1|stock solution/i },
];

export interface ToolHint {
  id: ToolId;
  label: string;
}

/** Tools that match the step text, in a fixed order. Empty when nothing matches. */
export function detectToolHints(text: string | undefined): ToolHint[] {
  if (!text) return [];
  return RULES.filter((r) => r.re.test(text)).map(({ id, label }) => ({ id, label }));
}
