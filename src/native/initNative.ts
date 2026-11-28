import { App } from '@capacitor/app'
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { syncWidget, watchWidget } from './widgetBridge'

/**
 * Entry point for everything Android-only. Loaded lazily from main.tsx, only in the native build.
 * Later native features (notifications, a foreground service for the rest timer, …) get their own module here
 * and one call below.
 */
export async function initNative() {
  if (!Capacitor.isNativePlatform()) return
  const root = document.documentElement
  // Hook for native-only CSS (safe-area insets under the edge-to-edge system bars), see index.css.
  root.classList.add('native')

  // WebView >= 140: edge-to-edge, the page shows through the transparent bars -> icons follow the app palette.
  // Older WebViews: Capacitor pads the WebView, the bars sit on the dark window background -> always light icons.
  const chromium = Number(/Chrome\/(\d+)/.exec(navigator.userAgent)?.[1] ?? 0)
  const applyBars = () => {
    const theme = root.dataset.theme
    const dark = chromium < 140 || theme === 'dark' || theme === 'midnight' || theme === 'system'
    void SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {})
  }
  applyBars()
  new MutationObserver(applyBars).observe(root, { attributes: true, attributeFilter: ['data-theme'] })

  // Widget: follow data changes live, and refresh on start and whenever the app goes to the background.
  watchWidget()
  void syncWidget(true)
  void App.addListener('pause', () => void syncWidget(true))

  // Give React a frame to paint before lifting the splash.
  requestAnimationFrame(() => void SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {}))
}
