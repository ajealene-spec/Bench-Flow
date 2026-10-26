import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { isNativeApp } from './app/apiBase';
import { initNativeShell } from './app/nativeShell';
import './index.css';
// Self-hosted reading font for the dyslexia-friendly option (offline, no CDN).
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The service worker caches the app for the browser. The native shell bundles the app itself, so it skips this.
if (isNativeApp()) {
  void initNativeShell();
} else {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}
