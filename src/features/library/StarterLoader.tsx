import { useState } from 'react';
import { seedStarterContent, type SeedResult } from '../../content/seed';

const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-medium disabled:opacity-50';
const BUTTON_PRIMARY = `${BUTTON} bg-accent text-white active:bg-accent-hover`;
const CARD =
  'flex flex-col gap-4 rounded-2xl border border-slate-300 bg-white p-4 sm:p-6 dark:border-slate-700 dark:bg-slate-900';

/** Human-readable outcome of a seed run, so a second tap says that nothing changed. */
export function describeSeedResult(result: SeedResult): string {
  if (result.templatesAdded === 0 && !result.demoAdded) return 'The starter protocols and example run are already in your library.';
  const parts: string[] = [];
  if (result.templatesAdded > 0) {
    parts.push(`${result.templatesAdded} starter protocol${result.templatesAdded === 1 ? '' : 's'}`);
  }
  if (result.demoAdded) parts.push('an example run');
  return `Added ${parts.join(' and ')}.`;
}

/** Button that loads the starter protocols and the example run. Safe to press again. */
export function useStarterLoader() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    setBusy(true);
    setMessage('');
    try {
      setMessage(describeSeedResult(await seedStarterContent()));
    } catch {
      setMessage('Could not load the starter protocols. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return { busy, message, load };
}

/** Settings card: loads the starter protocols and the example run. */
export default function StarterLoader() {
  const { busy, message, load } = useStarterLoader();

  return (
    <section aria-labelledby="starter-heading" className={CARD}>
      <div className="flex flex-col gap-1">
        <h2 id="starter-heading" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Starter protocols
        </h2>
        <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
          Adds 15 common lab protocols (Western blot, IHC, perfusion, PCR and more) and a finished example run. Protocols you already
          have are never replaced, and pressing this again adds nothing new. Starter steps are a starting point: verify them against your
          lab&apos;s SOP and SDS.
        </p>
      </div>
      <div>
        <button type="button" className={BUTTON_PRIMARY} onClick={() => void load()} disabled={busy}>
          {busy ? 'Loading…' : 'Load starter protocols'}
        </button>
      </div>
      {message && (
        <p role="status" className="text-slate-700 dark:text-slate-300">
          {message}
        </p>
      )}
    </section>
  );
}
