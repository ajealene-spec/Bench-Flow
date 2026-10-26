import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { lazy, Suspense, type ReactNode } from 'react';
import { RouteSkeleton } from './RouteSkeleton';
import ImportPage from '../features/import/ImportPage';
import InventoryPage from '../features/inventory/InventoryPage';
import LibraryPage from '../features/library/LibraryPage';
import TemplatePage from '../features/library/TemplatePage';
import RunPage from '../features/run/RunPage';
import { Workspace } from './Workspace';
import ExperimentPage from './ExperimentPage';
import ExperimentImportRedirect from './ExperimentImportRedirect';
import SettingsPage from './SettingsPage';
import WelcomePage from './WelcomePage';
import { FirstVisitRedirect } from './FirstVisitRedirect';
import GlossaryPage from '../features/learn/GlossaryPage';
import SharedPage from '../features/share/SharedPage';
import ExperimentsPage from '../features/experiments/ExperimentsPage';

/**
 * Where a route appears in the navigation.
 * - primary: a top-level link, kept to a few so the bar fits on a phone.
 * - records, app: listed under "More", in that group order.
 */
/** Heavy routes load on first visit. The skeleton keeps the layout stable while the chunk arrives. */
const LazyRoute = ({ children }: { children: ReactNode }) => <Suspense fallback={<RouteSkeleton />}>{children}</Suspense>;

const ReportPage = lazy(() => import('../features/report/ReportPage'));
const IntroPage = lazy(() => import('../features/intro/IntroPage'));
const ToolsPage = lazy(() => import('../features/neuro/ToolsPage'));
const AnimalsPage = lazy(() => import('../features/animals/AnimalsPage'));
const CalendarPage = lazy(() => import('../features/calendar/CalendarPage'));
const InsightsPage = lazy(() => import('../features/insights/InsightsPage'));

export type NavGroup = 'primary' | 'records' | 'app';

export const NAV_GROUP_LABELS: Record<Exclude<NavGroup, 'primary'>, string> = {
  records: 'Lab records',
  app: 'App',
};

export interface FeatureRoute {
  path: string;
  element: ReactElement;
  nav?: { label: string; group: NavGroup };
}

/**
 * The route registry. Feature agents add entries here instead of editing App.tsx.
 * Paths are unique; keep the list in the order you want it to appear within a nav group.
 */
export const featureRoutes: FeatureRoute[] = [
  { path: '/', element: <FirstVisitRedirect><Workspace /></FirstVisitRedirect>, nav: { label: 'Home', group: 'primary' } },
  { path: '/library', element: <LibraryPage />, nav: { label: 'Protocol Library', group: 'primary' } },
  { path: '/inventory', element: <InventoryPage />, nav: { label: 'Inventory', group: 'primary' } },
  { path: '/calendar', element: <LazyRoute><CalendarPage /></LazyRoute>, nav: { label: 'Calendar', group: 'primary' } },
  { path: '/experiments', element: <ExperimentsPage />, nav: { label: 'Experiments', group: 'primary' } },
  { path: '/library/new', element: <ImportPage /> },
  { path: '/library/:templateId', element: <TemplatePage /> },
  { path: '/experiment/:id', element: <ExperimentPage /> },
  { path: '/experiment/:id/import', element: <ExperimentImportRedirect /> },
  { path: '/experiment/:id/run', element: <RunPage /> },
  { path: '/experiment/:id/report', element: <LazyRoute><ReportPage /></LazyRoute> },
  { path: '/welcome', element: <WelcomePage /> },
  { path: '/settings', element: <SettingsPage />, nav: { label: 'Settings', group: 'app' } },
  { path: '/intro', element: <LazyRoute><IntroPage /></LazyRoute>, nav: { label: 'About', group: 'app' } },
  { path: '/about', element: <Navigate to="/intro" replace /> },
  { path: '/shared', element: <SharedPage /> },
  { path: '/animals', element: <LazyRoute><AnimalsPage /></LazyRoute>, nav: { label: 'Animals', group: 'records' } },
  { path: '/glossary', element: <GlossaryPage />, nav: { label: 'Glossary', group: 'app' } },
  { path: '/tools', element: <LazyRoute><ToolsPage /></LazyRoute>, nav: { label: 'Bench tools', group: 'app' } },
  { path: '/insights', element: <LazyRoute><InsightsPage /></LazyRoute>, nav: { label: 'Insights', group: 'records' } },
];
