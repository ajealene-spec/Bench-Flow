import { db as defaultDb, type LabCompanionDB } from './index';
import type { AppSettings } from '../types';

/** The settings table holds one row. */
export const SETTINGS_ID = 'settings';

export const DEFAULT_SETTINGS: Omit<AppSettings, 'id'> = {
  mode: 'beginner',
  field: null,
  techniques: [],
  onboardedAt: undefined,
  theme: 'system',
  dyslexiaFont: false,
  voiceEnabled: false,
  apiKey: undefined,
};

/** Current settings, with defaults filled in for anything not saved yet. */
export async function getSettings(database: LabCompanionDB = defaultDb): Promise<AppSettings> {
  const row = await database.settings.get(SETTINGS_ID);
  return { ...DEFAULT_SETTINGS, ...row, id: SETTINGS_ID };
}

/** Merges changes into the settings row. Keys set to undefined are removed. */
export async function putSettings(
  changes: Partial<Omit<AppSettings, 'id'>>,
  database: LabCompanionDB = defaultDb,
): Promise<AppSettings> {
  return database.transaction('rw', database.settings, async () => {
    const current = await getSettings(database);
    const next: AppSettings = { ...current, ...changes, id: SETTINGS_ID };
    for (const key of Object.keys(next) as Array<keyof AppSettings>) {
      if (next[key] === undefined) delete next[key];
    }
    await database.settings.put(next);
    return next;
  });
}

/** Removes the settings row. The next read returns the defaults. */
export function deleteSettings(database: LabCompanionDB = defaultDb): Promise<void> {
  return database.settings.delete(SETTINGS_ID);
}
