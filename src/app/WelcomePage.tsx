import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { putSettings } from '../db/settings';
import { seedStarterContent } from '../content/seed';
import type { ExperienceMode, ResearchField } from '../types';
import { FIELD_OPTIONS, TECHNIQUE_OPTIONS } from './welcomeOptions';

const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-medium disabled:opacity-50';
const BUTTON_PRIMARY = `${BUTTON} bg-accent text-white active:bg-accent-hover`;
const BUTTON_SECONDARY = `${BUTTON} border border-slate-300 bg-white text-slate-900 active:bg-slate-100`;
const OPTION = 'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2 has-[:checked]:border-accent has-[:checked]:bg-accent/5';

/** First-run questions. Shown until onboardedAt is set, and then never again unless the data is cleared. */
export default function WelcomePage() {
  const navigate = useNavigate();
  const [field, setField] = useState<ResearchField | null>(null);
  const [experience, setExperience] = useState<ExperienceMode>('beginner');
  const [techniques, setTechniques] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function toggleTechnique(name: string) {
    setTechniques((current) => (current.includes(name) ? current.filter((t) => t !== name) : [...current, name]));
  }

  async function finish(loadStarter: boolean) {
    setBusy(true);
    setError('');
    try {
      // Starter content first: if it fails, onboarding stays open so the user can try again or start empty.
      if (loadStarter) await seedStarterContent();
      await putSettings({ field, mode: experience, techniques, onboardedAt: Date.now() });
      navigate('/', { replace: true });
    } catch {
      setError(
        loadStarter
          ? 'Could not load the starter content. Try again, or start empty.'
          : 'Could not save your choices. Please try again.',
      );
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 p-4 pb-12 sm:p-6">
      <header className="flex flex-col gap-2 pt-4">
        <span className="text-sm font-medium uppercase tracking-wide text-accent">Bench Flow</span>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Welcome to your lab notebook</h1>
        <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
          Three quick questions tune the app to you. Everything stays on this device, and you can change any answer later in Settings.
        </p>
      </header>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">1. What is your field?</legend>
        {FIELD_OPTIONS.map((option) => (
          <label key={option.value} className={OPTION}>
            <input
              type="radio"
              name="field"
              value={option.value}
              checked={field === option.value}
              onChange={() => setField(option.value)}
              className="size-5 accent-[var(--color-accent)]"
            />
            <span className="text-base text-slate-900">{option.label}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">2. How experienced are you at the bench?</legend>
        {(
          [
            ['beginner', 'Beginner', 'Show more explanation and reminders with each step.'],
            ['advanced', 'Advanced', 'Keep the view lean. I know the techniques.'],
          ] as Array<[ExperienceMode, string, string]>
        ).map(([value, label, hint]) => (
          <label key={value} className={OPTION}>
            <input
              type="radio"
              name="experience"
              value={value}
              checked={experience === value}
              onChange={() => setExperience(value)}
              className="size-5 accent-[var(--color-accent)]"
            />
            <span className="flex flex-col">
              <span className="text-base font-medium text-slate-900">{label}</span>
              <span className="text-sm text-slate-600">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">3. Which techniques do you use? Pick any.</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {TECHNIQUE_OPTIONS.map((name) => (
            <label key={name} className={OPTION}>
              <input
                type="checkbox"
                checked={techniques.includes(name)}
                onChange={() => toggleTechnique(name)}
                className="size-5 accent-[var(--color-accent)]"
              />
              <span className="text-base text-slate-900">{name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <section aria-label="Finish setup" className="flex flex-col gap-3 rounded-2xl border border-slate-300 bg-white p-4 sm:p-5">
        <button type="button" className={BUTTON_PRIMARY} disabled={busy} onClick={() => void finish(true)}>
          Load starter protocols + demo experiment
        </button>
        <button type="button" className={BUTTON_SECONDARY} disabled={busy} onClick={() => void finish(false)}>
          Start empty
        </button>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
