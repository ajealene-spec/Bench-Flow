import type { Hazard, SafetyChecklistItem } from '../../types';

/** Baseline PPE every run needs, even when the protocol lists no hazards. */
const BASELINE_PPE = [
  { key: 'lab-coat', label: 'Lab coat' },
  { key: 'gloves', label: 'Gloves' },
  { key: 'eye-protection', label: 'Eye protection' },
] as const;

/** Keyword rules that map free-text PPE from hazards onto one canonical checklist item. */
const PPE_RULES: { key: string; label: string; match: RegExp }[] = [
  { key: 'lab-coat', label: 'Lab coat', match: /\blab(oratory)? coat\b/i },
  { key: 'gloves', label: 'Gloves', match: /\bglove/i },
  { key: 'eye-protection', label: 'Eye protection', match: /\b(eye|goggle|safety glasses)/i },
  { key: 'face-shield', label: 'Face shield', match: /\bface shield/i },
  { key: 'fume-hood', label: 'Fume hood available', match: /\bfume hood/i },
  { key: 'respirator', label: 'Respirator', match: /\brespirator|\bn95\b/i },
  { key: 'uv-shield', label: 'UV-blocking shield', match: /\buv\b/i },
];

function ppeKeyAndLabel(text: string): { key: string; label: string } {
  const trimmed = text.trim();
  const rule = PPE_RULES.find((r) => r.match.test(trimmed));
  if (rule) return { key: rule.key, label: rule.label };
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { key: `other-${slug}`, label: trimmed.charAt(0).toUpperCase() + trimmed.slice(1) };
}

/**
 * Builds the pre-run safety & PPE checklist from a protocol's hazards.
 * One item per hazard, followed by deduplicated PPE items. Baseline PPE is always included.
 * Pure: the same hazards always produce the same item ids, so checked state can be matched on resume.
 */
export function buildSafetyChecklist(hazards: Hazard[]): SafetyChecklistItem[] {
  const items: SafetyChecklistItem[] = [];
  const seenPpe = new Set<string>();

  const addPpe = (key: string, label: string) => {
    if (seenPpe.has(key)) return;
    seenPpe.add(key);
    items.push({ itemId: `ppe:${key}`, label, checked: false });
  };

  for (const { key, label } of BASELINE_PPE) addPpe(key, label);

  for (const hazard of hazards) {
    const name = hazard.name.trim();
    if (!name) continue;
    const ppe = hazard.ppe.map((p) => p.trim()).filter(Boolean);
    const detail = ppe.length > 0 ? ppe.join('; ') : hazard.reason.trim();
    items.push({
      itemId: `hazard:${hazard.id}`,
      label: detail ? `${name} — ${detail}` : name,
      checked: false,
    });
    for (const p of ppe) {
      const { key, label } = ppeKeyAndLabel(p);
      addPpe(key, label);
    }
  }

  return items;
}

/** True when there is at least one item and every item is checked. */
export function allChecked(items: SafetyChecklistItem[]): boolean {
  return items.length > 0 && items.every((item) => item.checked);
}

/** Returns a new checklist with one item's checked state changed. Other items are untouched. */
export function setItemChecked(
  items: SafetyChecklistItem[],
  itemId: string,
  checked: boolean,
): SafetyChecklistItem[] {
  return items.map((item) => (item.itemId === itemId ? { ...item, checked } : item));
}

/** Hazards that apply to a step, matched by the template step id they were written against. */
export function hazardsForStep(hazards: Hazard[], templateStepId: string | undefined): Hazard[] {
  if (!templateStepId) return [];
  return hazards.filter((h) => h.stepIds.includes(templateStepId));
}
