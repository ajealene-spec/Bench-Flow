/*
 * Helpers for the version 8 upgrade. Pure except for reading the old localStorage name, which is wrapped
 * so a blocked storage never fails the database upgrade. The old key is left in place, so the upgrade
 * can be re-run safely.
 */

/** Old localStorage key for the comment author name (before settings had a name field). */
export const LEGACY_AUTHOR_KEY = 'benchflow.authorName';

const RRID_LINE = /^[ \t]*RRID:[ \t]*(?:RRID:)?([A-Za-z0-9_.:-]+)[ \t]*(?:\r?\n|$)/im;

/**
 * Moves the first "RRID:" line out of a notes field. Returns the identifier in the form RRID:... and the
 * notes without that line. Returns undefined when the notes hold no RRID line.
 */
export function splitRridFromNotes(notes: string | undefined): { rrid: string; notes: string | undefined } | undefined {
  if (!notes) return undefined;
  const match = RRID_LINE.exec(notes);
  if (!match) return undefined;
  const rest = (notes.slice(0, match.index) + notes.slice(match.index + match[0].length)).replace(/\n{3,}/g, '\n\n').trim();
  return { rrid: `RRID:${match[1]}`, notes: rest === '' ? undefined : rest };
}

/** Reads the old comment author name from localStorage. Undefined when blocked, missing or blank. */
export function readLegacyAuthorName(): string | undefined {
  try {
    const value = window.localStorage.getItem(LEGACY_AUTHOR_KEY)?.trim();
    return value ? value : undefined;
  } catch {
    return undefined;
  }
}
