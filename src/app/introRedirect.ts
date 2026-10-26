/**
 * First-visit routing to the /intro page. The flag lives in localStorage, so every read and write is
 * wrapped in try/catch: a blocked or private storage never breaks the app.
 */

export const INTRO_SEEN_KEY = 'bf.introSeen';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The browser's localStorage, or null when the browser refuses access to it. */
export function getLocalStorage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * True when the visitor has already seen the intro. If storage cannot be read, this returns true,
 * so a broken store never sends the visitor into a redirect.
 */
export function hasSeenIntro(storage: KeyValueStorage | null = getLocalStorage()): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(INTRO_SEEN_KEY) !== null;
  } catch {
    return true;
  }
}

/** Records that the intro has been seen. Failures are ignored; the worst case is one extra visit to /intro. */
export function markIntroSeen(storage: KeyValueStorage | null = getLocalStorage()): void {
  try {
    storage?.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    /* storage is full or blocked */
  }
}

/** A first-time visitor landing on the home route is sent to /intro once. */
export function shouldRedirectToIntro(pathname: string, storage: KeyValueStorage | null = getLocalStorage()): boolean {
  return pathname === '/' && !hasSeenIntro(storage);
}
