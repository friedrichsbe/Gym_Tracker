import type { CapacitorConfig } from '@capacitor/cli'

// Native (Android) shell around the same web build. Build the web part with `npm run build:native`
// (relative paths, no service worker) before `npx cap sync android`.
const config: CapacitorConfig = {
  appId: 'dev.kiste.gymtracker',
  appName: 'Gym Tracker',
  webDir: 'dist',
  android: {
    // The app's dark background: shown behind the WebView before the first paint.
    backgroundColor: '#111315',
  },
  plugins: {
    SystemBars: {
      // Edge-to-edge: the page handles env(safe-area-inset-*) itself (see :root.native in index.css).
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'DARK',
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#111315',
      showSpinner: false,
    },
  },
}

export default config
