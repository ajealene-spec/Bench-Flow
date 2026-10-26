import { SplashScreen } from '@capacitor/splash-screen';
import { Style, StatusBar } from '@capacitor/status-bar';
import { isNativeApp } from './apiBase';

/**
 * One-time native setup after the first render: match the status bar text to the theme and hide the
 * splash. Every call is best-effort; on the web this does nothing.
 */
export async function initNativeShell(): Promise<void> {
  if (!isNativeApp()) return;
  const isDark = document.documentElement.classList.contains('dark');
  try {
    await StatusBar.setStyle({ style: isDark ? Style.Light : Style.Dark });
  } catch {
    /* status bar unavailable */
  }
  try {
    await SplashScreen.hide({ fadeOutDuration: 200 });
  } catch {
    /* splash already hidden */
  }
}
