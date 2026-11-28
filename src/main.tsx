import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App'
import { initPwa } from './app/pwa'

initPwa()
// Android app only. __NATIVE__ is a build-time constant: the Pages build drops this branch and every Capacitor
// import with it; initNative() itself checks Capacitor.isNativePlatform() at runtime.
if (__NATIVE__) void import('./native/initNative').then((m) => m.initNative())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
