import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db';
import { getSettings, putSettings } from '../db/settings';
import { needsWelcome } from './welcomeOptions';

const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-medium';
const BUTTON_PRIMARY = `${BUTTON} bg-accent text-white active:bg-accent-hover`;
const BUTTON_SECONDARY = `${BUTTON} border border-border bg-surface shadow-card text-text active:bg-surface-2`;

/**
 * Command Center card that invites the user to the personalization survey. It shows until the survey
 * is finished or skipped (both set onboardedAt), so existing users see it too.
 */
export function PersonalizeCard() {
  const settings = useLiveQuery(() => getSettings(db).catch(() => null), []);
  if (!settings || !needsWelcome('/', settings.onboardedAt)) return null;

  async function skip() {
    try {
      await putSettings({ onboardedAt: Date.now() });
    } catch {
      // The card stays up if the save fails, so the user can try again.
    }
  }

  return (
    <section
      aria-labelledby="personalize-heading"
      className="flex flex-col gap-3 rounded-xl border border-accent/40 bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id="personalize-heading" className="text-lg font-semibold text-text">
          Personalize Bench Flow
        </h2>
        <p className="text-base leading-relaxed text-text-muted">
          Answer a few quick questions to pick your starter protocols, tools and mode. You can skip it or change it later in Settings.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to="/welcome" state={{ from: '/' }} className={BUTTON_PRIMARY}>
          Start (1 min)
        </Link>
        <button type="button" className={BUTTON_SECONDARY} onClick={() => void skip()}>
          Skip
        </button>
      </div>
    </section>
  );
}
