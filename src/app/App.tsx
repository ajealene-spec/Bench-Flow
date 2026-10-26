import { createBrowserRouter, NavLink, Outlet, RouterProvider } from 'react-router-dom';
import { Workspace } from './Workspace';
import ImportPage from '../features/import/ImportPage';
import LibraryPage from '../features/library/LibraryPage';
import TemplatePage from '../features/library/TemplatePage';
import RunPage from '../features/run/RunPage';
import { TimerTray } from '../features/timers/TimerTray';
import ExperimentPage from './ExperimentPage';
import ExperimentImportRedirect from './ExperimentImportRedirect';
import ReportPage from '../features/report/ReportPage';
import InventoryPage from '../features/inventory/InventoryPage';

const NAV_LINK = 'inline-flex min-h-12 items-center rounded-xl border px-4 font-medium';

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? `${NAV_LINK} border-accent bg-accent text-white`
    : `${NAV_LINK} border-slate-300 bg-white text-slate-900 active:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100`;
}

// Top navigation and the timer tray live in the layout so they stay visible on every screen.
function Layout() {
  return (
    <>
      <nav aria-label="Main" className="mx-auto flex w-full max-w-3xl flex-wrap gap-2 px-4 pt-4">
        <NavLink to="/" end className={navClass}>
          Home
        </NavLink>
        <NavLink to="/library" className={navClass}>
          Protocol Library
        </NavLink>
        <NavLink to="/inventory" className={navClass}>
          Inventory
        </NavLink>
      </nav>
      <div className="mx-auto w-full max-w-3xl px-4 pt-4">
        <TimerTray />
      </div>
      <Outlet />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Workspace /> },
      { path: '/experiment/:id', element: <ExperimentPage /> },
      { path: '/experiment/:id/import', element: <ExperimentImportRedirect /> },
      { path: '/experiment/:id/run', element: <RunPage /> },
      { path: '/experiment/:id/report', element: <ReportPage /> },
      { path: '/inventory', element: <InventoryPage /> },
      { path: '/library', element: <LibraryPage /> },
      { path: '/library/new', element: <ImportPage /> },
      { path: '/library/:templateId', element: <TemplatePage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
