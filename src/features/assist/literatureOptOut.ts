/**
 * Remembers the literature prompt choices in localStorage. Storage can throw in private windows or
 * with blocked site data; every access is wrapped, and a failure means "no choice saved".
 */
export const OPT_OUT_KEY = 'bf.literature.optOut';

export function dismissKeyFor(templateId: string): string {
  return `bf.literature.dismissed.${templateId}`;
}

function readFlag(key: string): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, '1');
  } catch {
    // Storage unavailable: the choice lasts for this page view only.
  }
}

/** True after "Don't ask again". Applies to every protocol. */
export function isLiteratureOptedOut(): boolean {
  return readFlag(OPT_OUT_KEY);
}

export function optOutOfLiterature(): void {
  writeFlag(OPT_OUT_KEY);
}

/** True after "No thanks" for this template only. */
export function isLiteratureDismissedFor(templateId: string): boolean {
  return readFlag(dismissKeyFor(templateId));
}

export function dismissLiteratureFor(templateId: string): void {
  writeFlag(dismissKeyFor(templateId));
}

/** Whether the prompt card should be offered for a template at all. */
export function shouldOfferLiterature(templateId: string): boolean {
  return !isLiteratureOptedOut() && !isLiteratureDismissedFor(templateId);
}
