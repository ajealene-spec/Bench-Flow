import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { getSettings, putSettings } from '../db/settings';
import { resolveTheme } from './appearance';

/** Header switch between light and dark. Saves to settings.theme; "System" is set on the Settings page. */
export function ThemeSwitch() {
  const settings = useLiveQuery(() => getSettings(db), [], undefined);
  if (!settings) return null;
  const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
  const dark = resolveTheme(settings.theme, prefersDark) === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      onClick={() => void putSettings({ theme: dark ? 'light' : 'dark' })}
      className="inline-flex min-h-12 items-center gap-3 rounded-xl border border-border bg-surface px-3 font-medium text-text shadow-card"
    >
      <span
        aria-hidden="true"
        className={`relative inline-block h-6 w-11 shrink-0 rounded-full border border-border ${dark ? 'bg-accent' : 'bg-surface-2'}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-on-accent shadow transition-transform ${dark ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </span>
      <span>{dark ? 'Dark' : 'Light'}</span>
    </button>
  );
}
