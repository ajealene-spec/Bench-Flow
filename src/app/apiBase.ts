import { Capacitor } from '@capacitor/core';

/**
 * Where the native app sends /api calls. The Capacitor web view has no Vercel rewrite, so relative
 * paths would hit capacitor://localhost. The web app keeps relative paths.
 */
export const NATIVE_API_BASE = 'https://bench-flow.vercel.app';

/** True inside the iOS (or Android) Capacitor shell. False in any browser, including the dev server. */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Turns an app-relative /api path into the URL to fetch. `native` is injectable for tests. */
export function apiUrl(path: string, native: boolean = isNativeApp()): string {
  return native ? `${NATIVE_API_BASE}${path}` : path;
}
