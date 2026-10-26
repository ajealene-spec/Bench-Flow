import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from './AppShell';
import { featureRoutes } from './featureRoutes';

// Routes come from the registry in featureRoutes.tsx. Add new screens there, not here.
const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: featureRoutes.map(({ path, element }) => ({ path, element })),
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
