import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { Link, NavLink, Navigate, useParams } from 'react-router-dom'
import { UpdateBanner } from '../app/UpdateBanner'
import { useDayTypes, useLocations, useNow, useSettings } from '../data/hooks'
import { DayTypesPanel } from '../daytypes/DayTypesPanel'
import { DataPanel } from '../portability/DataPanel'
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconDatabase,
  IconDumbbell,
  IconList,
  IconPin,
  IconSun,
  IconSwipe,
} from '../ui/icons'
import { formatClock } from '../workout/restTimer'
import { AppearancePanel } from './AppearancePanel'
import { ACCENTS, THEMES } from './appearanceOptions'
import { LocationsPanel } from './LocationsPanel'
import { StorageStatus } from './StorageStatus'
import { SwipePanel } from './SwipePanel'
import { WorkoutPanel } from './WorkoutPanel'

/** Side-by-side layout (section list + detail) from the same breakpoint where the sidebar nav appears. */
const WIDE = '(min-width: 900px)'
function useWide(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(WIDE)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(WIDE).matches,
  )
}

type SectionId = 'appearance' | 'workout' | 'gestures' | 'days' | 'locations' | 'backup'

interface Section {
  id: SectionId
  title: string
  description: string
  icon: ReactNode
  render: () => ReactNode
}

const SECTIONS: Record<SectionId, Section> = {
  appearance: {
    id: 'appearance',
    title: 'Appearance',
    description: 'Theme, style and accent colour.',
    icon: <IconSun />,
    render: () => <AppearancePanel />,
  },
  workout: {
    id: 'workout',
    title: 'Workout',
    description: 'Units, rest timer and what counts in your statistics.',
    icon: <IconDumbbell />,
    render: () => <WorkoutPanel />,
  },
  gestures: {
    id: 'gestures',
    title: 'Swipe gestures',
    description: 'Swipe a workout or preset sideways on your phone for a quick action.',
    icon: <IconSwipe />,
    render: () => <SwipePanel />,
  },
  days: {
    id: 'days',
    title: 'Training days',
    description:
      'The day you pick when starting a workout decides which exercises and presets are suggested. Name them however you split your training (Leg / Upper / Mix, Push / Pull / Legs, …).',
    icon: <IconCalendar />,
    render: () => <DayTypesPanel />,
  },
  locations: {
    id: 'locations',
    title: 'Locations',
    description: 'The gyms and places you train at, with notes about their equipment.',
    icon: <IconPin />,
    render: () => <LocationsPanel />,
  },
  backup: {
    id: 'backup',
    title: 'Backup & data',
    description:
      'Your data lives only in this browser on this device. A backup file is the only protection against a lost phone or cleared browser data.',
    icon: <IconDatabase />,
    render: () => (
      <>
        <DataPanel />
        <StorageStatus />
      </>
    ),
  },
}

/** What the hub shows, in order. "exercises" is its own page, so it is listed here but not in SECTIONS. */
const GROUPS: { label: string; items: (SectionId | 'exercises')[] }[] = [
  { label: 'Preferences', items: ['appearance', 'workout', 'gestures'] },
  { label: 'Training setup', items: ['days', 'exercises', 'locations'] },
  { label: 'Data', items: ['backup'] },
]

const isSection = (id: string | undefined): id is SectionId => id != null && id in SECTIONS

export function SettingsPage() {
  const { section } = useParams()
  const wide = useWide()
  const current = isSection(section) ? SECTIONS[section] : null

  // Pages share one scroll container (the window): start each section at its top.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [section])

  if (section && !current) return <Navigate to="/settings" replace />
  // Side by side there is always something to show on the right.
  if (wide && !current) return <Navigate to="/settings/appearance" replace />

  // Phone: either the list of sections or one section — never one long page.
  if (!wide) {
    return current ? (
      <main className="content">
        <Link to="/settings" className="link-subtle">
          <IconChevronLeft />
          Settings
        </Link>
        <SectionHeading section={current} level={1} />
        {current.render()}
      </main>
    ) : (
      <main className="content">
        <div className="page-head">
          <h1>Settings</h1>
        </div>
        <UpdateBanner />
        <SectionList wide={false} />
        <AppFooter />
      </main>
    )
  }

  return (
    <main className="content wide">
      <div className="page-head">
        <h1>Settings</h1>
      </div>
      <UpdateBanner />
      <div className="settings-layout">
        <SectionList wide />
        <div className="settings-detail stack loose">
          {current && <SectionHeading section={current} level={2} />}
          {current?.render()}
        </div>
      </div>
      <AppFooter />
    </main>
  )
}

function SectionHeading({ section, level }: { section: Section; level: 1 | 2 }) {
  const Heading = level === 1 ? 'h1' : 'h2'
  return (
    <div className="stack tight settings-heading">
      <Heading>{section.title}</Heading>
      <p className="page-intro">{section.description}</p>
    </div>
  )
}

function AppFooter() {
  return <p className="hint text-center">Gym Tracker · data is stored only on this device · Schema v2</p>
}

function SectionList({ wide }: { wide: boolean }) {
  const summaries = useSummaries()
  return (
    <nav className="settings-nav" aria-label="Settings sections">
      {GROUPS.map((group) => (
        <div key={group.label} className="settings-group">
          <h2 className="section-label">{group.label}</h2>
          <ul className="card flush list nav-list">
            {group.items.map((id) => {
              const isPage = id === 'exercises'
              const title = isPage ? 'Exercises' : SECTIONS[id].title
              const icon = isPage ? <IconList /> : SECTIONS[id].icon
              const summary = summaries[id]
              return (
                <li key={id}>
                  <NavLink to={isPage ? '/exercises' : `/settings/${id}`} className="nav-row">
                    <span className="nav-icon" aria-hidden="true">
                      {icon}
                    </span>
                    <span className="grow">
                      <span className="list-title">{title}</span>
                      <span className={`list-sub nav-summary${summary.warn ? ' warn' : ''}`}>{summary.text}</span>
                    </span>
                    {!wide || isPage ? (
                      <span className="chev" aria-hidden="true">
                        <IconChevronRight />
                      </span>
                    ) : null}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/** One line per hub row showing the current state, so most questions are answered without opening anything. */
function useSummaries(): Record<SectionId | 'exercises', { text: string; warn?: boolean }> {
  const settings = useSettings()
  const { active: locations } = useLocations()
  const { active: days } = useDayTypes()
  const now = useNow(60_000)

  const last = settings.lastExportAt ? Date.parse(settings.lastExportAt) : null
  const daysAgo = last == null ? null : Math.floor((now - last) / 86_400_000)
  const list = (names: string[]) => (names.length ? names.join(', ') : 'None yet')

  return {
    appearance: {
      text: `${THEMES.find((t) => t.id === settings.theme)?.label ?? 'System'} · ${
        ACCENTS.find((a) => a.id === settings.accent)?.label ?? 'Teal'
      }`,
    },
    workout: {
      text: `${settings.units} · rest ${formatClock(settings.restDefaultSeconds)}${settings.restAutoStart ? ' (auto)' : ''}`,
    },
    gestures: { text: 'History and presets' },
    days: { text: list(days.map((d) => d.name)) },
    exercises: { text: 'Names, muscles, rest times' },
    locations: { text: list(locations.map((l) => l.name)) },
    backup:
      daysAgo == null
        ? { text: 'No backup yet', warn: true }
        : { text: `Last backup ${daysAgo === 0 ? 'today' : `${daysAgo} days ago`}` },
  }
}
