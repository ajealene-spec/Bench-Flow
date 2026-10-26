import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Outlet, useLocation } from 'react-router-dom';
import { db } from '../db';
import { getSettings } from '../db/settings';
import { TimerTray } from '../features/timers/TimerTray';
import { AppNav } from './AppNav';
import { applyAppearance, watchSystemTheme } from './appearance';

/** Layout for every route: appearance, first-run gate, navigation and the timer tray. */
export function AppShell() {
  // A settings read that fails resolves to null, so a broken read never leaves the app on a blank screen.
  // The personalization survey is never forced: the Command Center card and Settings offer it.
  const loaded = useLiveQuery(async () => ({ settings: await getSettings(db).catch(() => null) }), []);
  const settings = loaded?.settings ?? undefined;

  useEffect(() => {
    if (settings) applyAppearance(settings);
    // Only the fields that affect the page are dependencies, so unrelated saves do not re-apply.
  }, [settings?.theme, settings?.dyslexiaFont]);

  // With the "system" theme, follow the OS while the app stays open.
  const followSystem = settings?.theme === 'system';
  useEffect(() => {
    if (!followSystem) return;
    return watchSystemTheme(() => {
      void getSettings(db).then((current) => applyAppearance(current));
    });
  }, [followSystem]);

  const location = useLocation();

  return (
    // safe-top keeps the nav under the status bar and notch; safe-bottom keeps the last content above the home bar.
    <div className="safe-top safe-bottom">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <AppNav />
      <div className="mx-auto w-full max-w-7xl px-4 pt-4">
        <TimerTray />
      </div>
      <div id="main-content" tabIndex={-1} className="outline-none">
        {/* Keyed by path so each route fades in. Reduced motion turns the fade off (see index.css). */}
        <div key={location.pathname} className="route-enter">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
