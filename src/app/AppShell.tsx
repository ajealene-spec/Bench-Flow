import { useEffect, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { db } from '../db';
import { getSettings } from '../db/settings';
import { TimerTray } from '../features/timers/TimerTray';
import { AppNav } from './AppNav';
import { applyAppearance } from './appearance';
import { needsWelcome } from './welcomeOptions';

/** Layout for every route: appearance, first-run gate, navigation and the timer tray. */
export function AppShell() {
  const settings = useLiveQuery(() => getSettings(db), []);

  useEffect(() => {
    if (settings) applyAppearance(settings);
    // Only the fields that affect the page are dependencies, so unrelated saves do not re-apply.
  }, [settings?.theme, settings?.dyslexiaFont]);

  return (
    <WelcomeGate onboardedAt={settings?.onboardedAt} ready={settings !== undefined}>
      <AppNav />
      <div className="mx-auto w-full max-w-3xl px-4 pt-4">
        <TimerTray />
      </div>
      <Outlet />
    </WelcomeGate>
  );
}

/** Sends a user who has not finished the welcome to /welcome. Welcome and About are always reachable. */
function WelcomeGate({ children, onboardedAt, ready }: { children: ReactNode; onboardedAt: number | undefined; ready: boolean }) {
  const { pathname } = useLocation();
  if (!needsWelcome(pathname, undefined)) return children;
  if (!ready) return null;
  if (needsWelcome(pathname, onboardedAt)) return <Navigate to="/welcome" replace />;
  return children;
}
