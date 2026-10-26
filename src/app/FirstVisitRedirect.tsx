import { useEffect, type ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { markIntroSeen, shouldRedirectToIntro } from './introRedirect';

/**
 * Wraps the home route. A first-time visitor is sent to /intro once. The flag is set on the redirect
 * itself, so the intro never loops or repeats, and the "Enter the lab" button sets it too.
 */
export function FirstVisitRedirect({ children }: { children: ReactElement }) {
  const { pathname } = useLocation();
  const redirect = shouldRedirectToIntro(pathname);

  useEffect(() => {
    if (redirect) markIntroSeen();
  }, [redirect]);

  if (redirect) return <Navigate to="/intro" replace />;
  return children;
}
