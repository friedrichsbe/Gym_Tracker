import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { ensureSchemaMetadata } from '../data/settings'
import { useSettingsLoaded } from '../data/hooks'
import { ensureDefaultDayTypes } from '../daytypes/dayTypeService'
import { refreshStarterAliases } from '../exercises/exerciseService'
import { ExercisesPage } from '../exercises/ExercisesPage'
import { HistoryPage } from '../history/HistoryPage'
import { SessionDetailPage } from '../history/SessionDetail'
import { RoutineEditorPage } from '../routines/RoutineEditor'
import { RoutinesPage } from '../routines/RoutinesPage'
import { IconChart, IconClock, IconDumbbell, IconList, IconSettings } from '../ui/icons'
import { ToastProvider } from '../ui/Toast'
import { WorkoutPage } from '../workout/WorkoutPage'
import { Onboarding } from './Onboarding'
import { StorageGuard } from './StorageGuard'

// Charts and import/export (with its validation library) are only needed on demand.
const ProgressPage = lazy(() => import('../analytics/ProgressPage').then((m) => ({ default: m.ProgressPage })))
const SettingsPage = lazy(() => import('../settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))

function Shell() {
  const settings = useSettingsLoaded()

  const onboarded = settings?.onboardingDone ?? false
  useEffect(() => {
    void ensureSchemaMetadata()
  }, [])
  // After onboarding (which applies the chosen split) make sure older installs/imports have day types too.
  useEffect(() => {
    if (onboarded) {
      void ensureDefaultDayTypes()
      void refreshStarterAliases() // standard exercises always carry their German and English names
    }
  }, [onboarded])

  const theme = settings?.theme ?? 'system'
  const lightStyle = settings?.lightStyle ?? 'light'
  const darkStyle = settings?.darkStyle ?? 'dark'
  const accent = settings?.accent ?? 'teal'
  useEffect(() => {
    const root = document.documentElement
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    // Resolve the mode to a concrete palette: the chosen light style (light/glow) or dark style (dark/midnight).
    const apply = () => {
      const legacyMidnight = (theme as string) === 'midnight'
      const dark = theme === 'dark' || legacyMidnight || (theme === 'system' && mq.matches)
      root.dataset.theme = dark ? (legacyMidnight ? 'midnight' : darkStyle) : lightStyle
      root.dataset.accent = accent
      // Remembered for index.html, which applies it before the first paint (no flash of the default style).
      try {
        localStorage.setItem('gt-appearance', JSON.stringify({ theme, lightStyle, darkStyle, accent }))
      } catch {
        // storage unavailable (private mode) — only the first paint is affected
      }
      // Keep the browser chrome (status bar / PWA title bar) in step with the page background.
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim())
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme, lightStyle, darkStyle, accent])

  if (!settings) return null
  if (!settings.onboardingDone) return <Onboarding />

  return (
    <div className="shell">
      <StorageGuard />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<WorkoutPage />} />
          <Route path="/routines" element={<RoutinesPage />} />
          <Route path="/routines/:id" element={<RoutineEditorPage />} />
          <Route path="/exercises" element={<ExercisesPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/history/:id" element={<SessionDetailPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/:section" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <nav className="bottom-nav" aria-label="Main">
        <div className="brand" aria-hidden="true">
          <span className="brand-mark">
            <IconDumbbell />
          </span>
          Gym Tracker
        </div>
        <NavLink to="/" end>
          <IconDumbbell />
          Workout
        </NavLink>
        <NavLink to="/routines">
          <IconList />
          Presets
        </NavLink>
        <NavLink to="/history">
          <IconClock />
          History
        </NavLink>
        <NavLink to="/progress">
          <IconChart />
          Progress
        </NavLink>
        <NavLink to="/settings">
          <IconSettings />
          Settings
        </NavLink>
      </nav>
    </div>
  )
}

export function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </ToastProvider>
  )
}
