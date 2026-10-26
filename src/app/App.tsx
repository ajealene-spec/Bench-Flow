import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import { Workspace } from './Workspace';
import ImportPage from '../features/import/ImportPage';
import RunPage from '../features/run/RunPage';
import { TimerTray } from '../features/timers/TimerTray';

// Timer tray lives in the layout so running timers stay visible on every screen.
function Layout() {
  return (
    <>
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
      { path: '/lab/:id/import', element: <ImportPage /> },
      { path: '/lab/:id/run', element: <RunPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
