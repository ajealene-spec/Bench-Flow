import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from './AppShell';
import { featureRoutes } from './featureRoutes';
import { FeedbackProvider } from './feedback';

// Routes come from the registry in featureRoutes.tsx. Add new screens there, not here.
const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: featureRoutes.map(({ path, element }) => ({ path, element })),
  },
]);

export function App() {
  return (
    <FeedbackProvider>
      <RouterProvider router={router} />
    </FeedbackProvider>
  );
}
