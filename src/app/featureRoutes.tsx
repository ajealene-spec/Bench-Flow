import type { ReactElement } from 'react';
import ReportPage from '../features/report/ReportPage';
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
import AboutPage from './AboutPage';
import GlossaryPage from '../features/learn/GlossaryPage';
import ToolsPage from '../features/neuro/ToolsPage';
import SharedPage from '../features/share/SharedPage';
import AnimalsPage from '../features/animals/AnimalsPage';

/**
 * Where a route appears in the navigation.
 * - primary: a top-level link, kept to a few so the bar fits on a phone.
 * - records, app: listed under "More", in that group order.
 */
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
  { path: '/', element: <Workspace />, nav: { label: 'Home', group: 'primary' } },
  { path: '/library', element: <LibraryPage />, nav: { label: 'Protocol Library', group: 'primary' } },
  { path: '/inventory', element: <InventoryPage />, nav: { label: 'Inventory', group: 'primary' } },
  { path: '/library/new', element: <ImportPage /> },
  { path: '/library/:templateId', element: <TemplatePage /> },
  { path: '/experiment/:id', element: <ExperimentPage /> },
  { path: '/experiment/:id/import', element: <ExperimentImportRedirect /> },
  { path: '/experiment/:id/run', element: <RunPage /> },
  { path: '/experiment/:id/report', element: <ReportPage /> },
  { path: '/welcome', element: <WelcomePage /> },
  { path: '/settings', element: <SettingsPage />, nav: { label: 'Settings', group: 'app' } },
  { path: '/about', element: <AboutPage />, nav: { label: 'About', group: 'app' } },
  { path: '/shared', element: <SharedPage /> },
  { path: '/animals', element: <AnimalsPage />, nav: { label: 'Animals', group: 'records' } },
  { path: '/glossary', element: <GlossaryPage />, nav: { label: 'Glossary', group: 'app' } },
  { path: '/tools', element: <ToolsPage />, nav: { label: 'Bench tools', group: 'app' } },
];
