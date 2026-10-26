import type { CapacitorConfig } from '@capacitor/cli';

// The native shell loads the built web app from dist/. API calls go to the Vercel deployment (see src/app/apiBase.ts).
// NOTE: appId is the bundle identifier. You can change it before the first App Store upload; after that it is permanent.
// See docs/APP_STORE.md.
const config: CapacitorConfig = {
  appId: 'app.benchflow.notebook',
  appName: 'Bench Flow',
  webDir: 'dist',
  ios: {
    // The web view extends under the notch and home bar. The app adds padding with env(safe-area-inset-*).
    contentInset: 'never',
    scheme: 'Bench Flow',
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#006747',
      // Hidden by initNativeShell() after the first render, so the splash does not flash the blank page.
      launchAutoHide: false,
      launchShowDuration: 0,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#006747',
    },
  },
};

export default config;
