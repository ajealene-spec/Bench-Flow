import type { AppSettings, ThemePreference } from '../types';

/** Resolves "system" against the operating system preference. */
export function resolveTheme(theme: ThemePreference, prefersDark: boolean): 'light' | 'dark' {
  if (theme === 'system') return prefersDark ? 'dark' : 'light';
  return theme;
}

/**
 * Applies theme and dyslexia-font settings to the document root. Tailwind's dark variant keys off the
 * .dark class, and index.css uses .font-dyslexia for the reading font.
 */
export function applyAppearance(
  settings: Pick<AppSettings, 'theme' | 'dyslexiaFont'>,
  root: HTMLElement = document.documentElement,
  prefersDark: boolean = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true,
): void {
  const resolved = resolveTheme(settings.theme, prefersDark);
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  root.classList.toggle('font-dyslexia', settings.dyslexiaFont);
  // Mirror the choice so index.html can apply it before the first paint (no flash of the wrong theme).
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, settings.theme);
  } catch {
    // Storage can be blocked (private windows). The page still works without the mirror.
  }
}

/** localStorage key for the theme mirror. index.html reads it before React loads. */
export const THEME_STORAGE_KEY = 'lab-companion-theme';

/**
 * Calls onChange when the operating system switches between light and dark. Returns an unsubscribe
 * function. Used so a "system" theme follows the OS while the app is open.
 */
export function watchSystemTheme(onChange: (prefersDark: boolean) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (event: MediaQueryListEvent) => onChange(event.matches);
  query.addEventListener('change', handler);
  return () => query.removeEventListener('change', handler);
}
