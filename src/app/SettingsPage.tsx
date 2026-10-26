import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { getSettings, putSettings } from '../db/settings';
import type { AppSettings, ExperienceMode, ThemePreference } from '../types';
import { testApiKey, type KeyTestResult } from './apiKey';

const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-medium disabled:opacity-50';
const BUTTON_PRIMARY = `${BUTTON} bg-accent text-white active:bg-accent-hover`;
const BUTTON_SECONDARY = `${BUTTON} border border-slate-300 bg-white text-slate-900 active:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100`;
const INPUT =
  'min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';
const CARD = 'flex flex-col gap-4 rounded-2xl border border-slate-300 bg-white p-4 sm:p-6 dark:border-slate-700 dark:bg-slate-900';
const OPTION = 'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-300 px-3 py-2 has-[:checked]:border-accent has-[:checked]:bg-accent/5 dark:border-slate-600';

export default function SettingsPage() {
  const settings = useLiveQuery(() => getSettings(db), []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 p-4 pb-12 sm:p-6">
      <header className="flex flex-col gap-1">
        <span className="text-sm text-slate-500 dark:text-slate-400">Bench Flow</span>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Settings</h1>
      </header>

      {settings === undefined ? (
        <p className="text-slate-500">Loading settings…</p>
      ) : (
        <>
          <PreferencesCard settings={settings} />
          <ApiKeyCard savedKey={settings.apiKey} />
        </>
      )}
    </main>
  );
}

function PreferencesCard({ settings }: { settings: AppSettings }) {
  const update = (changes: Partial<Omit<AppSettings, 'id'>>) => void putSettings(changes);

  return (
    <section aria-labelledby="prefs-heading" className={CARD}>
      <h2 id="prefs-heading" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Preferences
      </h2>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium text-slate-900 dark:text-slate-100">Experience</legend>
        {(
          [
            ['beginner', 'Beginner', 'More explanation and reminders with each step.'],
            ['advanced', 'Advanced', 'A leaner view for people who know the techniques.'],
          ] as Array<[ExperienceMode, string, string]>
        ).map(([value, label, hint]) => (
          <label key={value} className={OPTION}>
            <input
              type="radio"
              name="mode"
              value={value}
              checked={settings.mode === value}
              onChange={() => update({ mode: value })}
              className="size-5 accent-[var(--color-accent)]"
            />
            <span className="flex flex-col">
              <span className="font-medium text-slate-900 dark:text-slate-100">{label}</span>
              <span className="text-sm text-slate-600 dark:text-slate-400">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="font-medium text-slate-900 dark:text-slate-100">Theme</span>
        <select
          className={INPUT}
          value={settings.theme}
          onChange={(e) => update({ theme: e.target.value as ThemePreference })}
        >
          <option value="system">Match this device</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>

      <label className={OPTION}>
        <input
          type="checkbox"
          checked={settings.dyslexiaFont}
          onChange={(e) => update({ dyslexiaFont: e.target.checked })}
          className="size-5 accent-[var(--color-accent)]"
        />
        <span className="flex flex-col">
          <span className="font-medium text-slate-900 dark:text-slate-100">Dyslexia-friendly font</span>
          <span className="text-sm text-slate-600 dark:text-slate-400">Wider letter and word spacing, with a plainer typeface.</span>
        </span>
      </label>

      <label className={OPTION}>
        <input
          type="checkbox"
          checked={settings.voiceEnabled}
          onChange={(e) => update({ voiceEnabled: e.target.checked })}
          className="size-5 accent-[var(--color-accent)]"
        />
        <span className="flex flex-col">
          <span className="font-medium text-slate-900 dark:text-slate-100">Voice control in run mode</span>
          <span className="text-sm text-slate-600 dark:text-slate-400">Saves your choice now. Voice features arrive in a later update.</span>
        </span>
      </label>
    </section>
  );
}

const RESULT_TEXT: Record<KeyTestResult, string> = {
  valid: 'The key works.',
  invalid: 'Anthropic did not accept this key. Check that you copied all of it.',
  missing: 'Paste a key first, or save one.',
  unavailable: 'Could not check the key. Try again when you are online.',
};

function ApiKeyCard({ savedKey }: { savedKey: string | undefined }) {
  const [draft, setDraft] = useState('');
  const [result, setResult] = useState<KeyTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');

  const tail = savedKey ? savedKey.slice(-4) : '';

  async function test() {
    setTesting(true);
    setMessage('');
    setResult(await testApiKey(draft.trim() || savedKey || ''));
    setTesting(false);
  }

  async function save() {
    const key = draft.trim();
    if (!key) return;
    await putSettings({ apiKey: key });
    setDraft('');
    setResult(null);
    setMessage('Key saved on this device.');
  }

  async function remove() {
    await putSettings({ apiKey: undefined });
    setResult(null);
    setMessage('Key removed from this device.');
  }

  return (
    <section aria-labelledby="key-heading" className={CARD}>
      <div className="flex flex-col gap-1">
        <h2 id="key-heading" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Anthropic API key
        </h2>
        <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
          The key stays on this device. It is saved in this browser&apos;s local database, is never synced, and is never written to logs. When you
          use an AI feature, the app sends the key only to its own <code>/api</code> route, which passes it to Anthropic and does not store it.
          Without a key, the app uses its built-in offline tools.
        </p>
      </div>

      <p className="text-base text-slate-900 dark:text-slate-100" aria-live="polite">
        {savedKey ? `A key is saved (ends in ${tail}).` : 'No key saved.'}
      </p>

      <label className="flex flex-col gap-1">
        <span className="font-medium text-slate-900 dark:text-slate-100">{savedKey ? 'Replace key' : 'Paste your key'}</span>
        <input
          type="password"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="sk-ant-…"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setResult(null);
          }}
          className={INPUT}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={BUTTON_PRIMARY} onClick={() => void save()} disabled={!draft.trim()}>
          Save key
        </button>
        <button type="button" className={BUTTON_SECONDARY} onClick={() => void test()} disabled={testing}>
          {testing ? 'Testing…' : 'Test key'}
        </button>
        {savedKey && (
          <button type="button" className={BUTTON_SECONDARY} onClick={() => void remove()}>
            Remove key
          </button>
        )}
      </div>

      {result && (
        <p role="status" className={result === 'valid' ? 'text-accent' : 'text-red-700 dark:text-red-300'}>
          {RESULT_TEXT[result]}
        </p>
      )}
      {message && <p role="status" className="text-slate-700 dark:text-slate-300">{message}</p>}
    </section>
  );
}
