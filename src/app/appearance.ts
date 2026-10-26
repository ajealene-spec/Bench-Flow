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
}
