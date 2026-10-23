import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CARDIO_KINDS } from '../cardio/cardioKinds'
import { useSettings } from '../data/hooks'
import type { WeightUnit } from '../domain/types'
import { formatDurationShort, formatNumber } from '../ui/format'
import {
  IconCalendar,
  IconChevronRight,
  IconClock,
  IconCrown,
  IconDumbbell,
  IconFlame,
  IconHeartPulse,
  IconLayers,
  IconPin,
  IconPlate,
  IconRepeat,
  IconStar,
  IconSunrise,
  IconTrophy,
} from '../ui/icons'
import {
  formatMass,
  MAX_LEVEL,
  milestoneTitle,
  rankOf,
  RANKS,
  tierName,
  TRACKS,
  type HallOfFame,
  type TrackId,
  type TrackProgress,
  type Unlock,
} from './achievements'
import { useAchievements } from './hooks'
import { Medal } from './Medal'
import { milestoneDate, ProgressBar, progressText, tierStyle } from './parts'
import { TracksSheet } from './TracksSheet'

const MAX_TOTAL = TRACKS.length * MAX_LEVEL

/** The playful corner of Progress: medals per track, the latest milestones and a hall of fame of favourites. */
export function TrophiesTab() {
  const achievements = useAchievements()
  const { units } = useSettings()
  const [overview, setOverview] = useState<{ open: boolean; focus: TrackId | null }>({ open: false, focus: null })
  const open = (focus: TrackId | null = null) => setOverview({ open: true, focus })

  if (!achievements) return <div className="skeleton block" />
  const { tracks, unlocks, totalLevel, hall } = achievements

  return (
    <section className="stack loose trophies" aria-label="Trophies">
      <RankHero tracks={tracks} totalLevel={totalLevel} medals={unlocks.length} onOpen={open} />
      <Showcase unlocks={unlocks} unit={units} />
      <AlmostThere tracks={tracks} unit={units} onOpen={open} />
      <HallOfFameGrid hall={hall} unit={units} />
      <TracksSheet
        open={overview.open}
        focus={overview.focus}
        tracks={tracks}
        unit={units}
        onClose={() => setOverview((o) => ({ ...o, open: false }))}
      />
    </section>
  )
}

function RankHero(props: {
  tracks: TrackProgress[]
  totalLevel: number
  medals: number
  onOpen: (focus?: TrackId) => void
}) {
  const { tracks, totalLevel, medals, onOpen } = props
  const rank = rankOf(totalLevel)
  const from = [...RANKS].reverse().find((r) => totalLevel >= r.from)!.from
  const toNext = rank.next ? (totalLevel - from) / (rank.next.from - from) : 1
  return (
    <div className="trophy-hero">
      <div className="trophy-hero-top">
        <RankRing level={totalLevel} fraction={toNext} />
        <div className="stack tight grow">
          <span className="overline">Athlete rank</span>
          <h2>{rank.name}</h2>
          <p className="small">
            <strong className="num">{medals}</strong> of {MAX_TOTAL} medals
            {rank.next && (
              <>
                {' '}
                · <span className="num">{rank.next.from - totalLevel}</span> levels to {rank.next.name}
              </>
            )}
          </p>
        </div>
      </div>
      <ul className="trophy-shelf" aria-label="Your medals per track">
        {tracks.map((t) => (
          <li key={t.def.id}>
            <button type="button" onClick={() => onOpen(t.def.id)} aria-label={`${t.def.name}: level ${t.level}`}>
              <Medal track={t.def.id} level={t.level} size={46} />
              <span className="shelf-level num">{t.level > 0 ? `Lv ${t.level}` : '—'}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn hero-btn" onClick={() => onOpen()}>
        <IconTrophy />
        All tracks &amp; levels
        <IconChevronRight />
      </button>
    </div>
  )
}

function RankRing({ level, fraction }: { level: number; fraction: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <span className="rank-ring" aria-label={`Level ${level}`}>
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="40" r={r} className="rank-track" />
        <circle
          cx="40"
          cy="40"
          r={r}
          className="rank-fill"
          strokeDasharray={`${c * Math.max(0.02, fraction)} ${c}`}
          transform="rotate(-90 40 40)"
        />
      </svg>
      <span className="rank-num">
        <span className="num">{level}</span>
        <small>level</small>
      </span>
    </span>
  )
}

function Showcase({ unlocks, unit }: { unlocks: Unlock[]; unit: WeightUnit }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'latest' | 'best'>('latest')
  const list =
    mode === 'latest' ? unlocks : [...unlocks].sort((a, b) => b.level - a.level || Date.parse(b.at) - Date.parse(a.at))
  const [featured, ...rest] = list.slice(0, 12)

  return (
    <section className="stack" aria-labelledby="showcase-label">
      <div className="section-head">
        <h2 id="showcase-label">Milestones</h2>
        {unlocks.length > 1 && (
          <div className="segmented small" role="group" aria-label="Order">
            <button type="button" aria-pressed={mode === 'latest'} onClick={() => setMode('latest')}>
              Latest
            </button>
            <button type="button" aria-pressed={mode === 'best'} onClick={() => setMode('best')}>
              Best
            </button>
          </div>
        )}
      </div>
      {!featured ? (
        <div className="card empty">
          <span className="empty-icon">
            <IconTrophy />
          </span>
          <p className="empty-title">Your trophy cabinet is empty</p>
          <p>Finish your first workout — it unlocks your first medals right away.</p>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="milestone-feature"
            style={tierStyle(featured.level)}
            onClick={() => navigate(`/history/${featured.sessionId}`)}
          >
            <Medal track={featured.track} level={featured.level} size={92} className="pop-in" />
            <span className="stack tight">
              <span className="overline">
                {mode === 'latest' ? 'Latest milestone' : 'Your finest medal'} · {tierName(featured.level)}
              </span>
              <strong className="milestone-title">{milestoneTitle(featured.track, featured.threshold, unit)}</strong>
              <span className="small">on {milestoneDate(featured.at)}</span>
            </span>
          </button>
          {rest.length > 0 && (
            <ul className="milestone-reel" aria-label="More milestones">
              {rest.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    className="milestone-card"
                    style={tierStyle(u.level)}
                    onClick={() => navigate(`/history/${u.sessionId}`)}
                  >
                    <Medal track={u.track} level={u.level} size={54} />
                    <strong>{milestoneTitle(u.track, u.threshold, unit)}</strong>
                    <span className="small muted">{milestoneDate(u.at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

function AlmostThere(props: { tracks: TrackProgress[]; unit: WeightUnit; onOpen: (focus?: TrackId) => void }) {
  const { tracks, unit, onOpen } = props
  const next = tracks
    .filter((t) => t.next != null)
    .sort((a, b) => b.fraction - a.fraction)
    .slice(0, 3)
  if (next.length === 0) return null
  return (
    <section className="stack" aria-labelledby="next-label">
      <div className="section-head">
        <h2 id="next-label">Almost there</h2>
      </div>
      <ul className="plain-list next-list">
        {next.map((t) => (
          <li key={t.def.id}>
            <button type="button" className="next-row" onClick={() => onOpen(t.def.id)}>
              <Medal track={t.def.id} level={t.level + 1} size={48} className="preview" />
              <span className="grow stack tight">
                <span className="next-title">
                  <strong>{milestoneTitle(t.def.id, t.next!, unit)}</strong>
                  <span className="small muted">{tierName(t.level + 1)}</span>
                </span>
                <ProgressBar fraction={t.fraction} track={t.def.id} />
                <span className="small muted num">{progressText(t, unit)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

function HallOfFameGrid({ hall, unit }: { hall: HallOfFame; unit: WeightUnit }) {
  const navigate = useNavigate()
  const cards: { key: string; icon: ReactNode; label: string; value: string; sub: string; to?: string }[] = []
  if (hall.topVolume)
    cards.push({
      key: 'volume',
      icon: <IconPlate />,
      label: 'Volume champion',
      value: hall.topVolume.name,
      sub: `${formatMass(hall.topVolume.volumeKg, unit)} moved in total`,
    })
  if (hall.mostSets)
    cards.push({
      key: 'sets',
      icon: <IconLayers />,
      label: 'Most sets',
      value: hall.mostSets.name,
      sub: `${formatNumber(hall.mostSets.sets)} sets`,
    })
  if (hall.mostFrequent)
    cards.push({
      key: 'frequent',
      icon: <IconRepeat />,
      label: 'Go-to exercise',
      value: hall.mostFrequent.name,
      sub: `in ${formatNumber(hall.mostFrequent.workouts)} workouts`,
    })
  if (hall.heaviest)
    cards.push({
      key: 'heaviest',
      icon: <IconDumbbell />,
      label: 'Heaviest set',
      value: `${formatNumber(hall.heaviest.weight)} ${hall.heaviest.unit} × ${hall.heaviest.reps}`,
      sub: `${hall.heaviest.name} · ${milestoneDate(hall.heaviest.at)}`,
    })
  if (hall.cardio)
    cards.push({
      key: 'cardio',
      icon: <IconHeartPulse />,
      label: 'Favourite cardio',
      value: CARDIO_KINDS[hall.cardio.kind].label,
      sub: `${hall.cardio.sessions}× · ${formatDurationShort(hall.cardio.seconds)}`,
    })
  if (hall.location)
    cards.push({
      key: 'location',
      icon: <IconPin />,
      label: 'Home gym',
      value: hall.location.name,
      sub: `${formatNumber(hall.location.workouts)} workouts`,
    })
  if (hall.dayType)
    cards.push({
      key: 'day',
      icon: <IconStar />,
      label: 'Favourite day',
      value: `${hall.dayType.name} day`,
      sub: `${formatNumber(hall.dayType.workouts)} workouts`,
    })
  if (hall.weekday)
    cards.push({
      key: 'weekday',
      icon: <IconCalendar />,
      label: 'Favourite weekday',
      value: WEEKDAYS[hall.weekday.day],
      sub: `${formatNumber(hall.weekday.workouts)} workouts`,
    })
  if (hall.bestWeek)
    cards.push({
      key: 'week',
      icon: <IconFlame />,
      label: 'Best week',
      value: `${hall.bestWeek.workouts} workouts`,
      // Noon, so the Monday never slips to Sunday in any time zone.
      sub: `Week of ${milestoneDate(`${hall.bestWeek.week}T12:00:00`)} · ${formatNumber(hall.bestWeek.sets)} sets`,
    })
  if (hall.biggest)
    cards.push({
      key: 'biggest',
      icon: <IconCrown />,
      label: 'Biggest workout',
      value: formatMass(hall.biggest.volumeKg, unit),
      sub: milestoneDate(hall.biggest.at),
      to: `/history/${hall.biggest.sessionId}`,
    })
  if (hall.longest)
    cards.push({
      key: 'longest',
      icon: <IconClock />,
      label: 'Longest workout',
      value: formatDurationShort(hall.longest.seconds),
      sub: milestoneDate(hall.longest.at),
      to: `/history/${hall.longest.sessionId}`,
    })
  if (hall.usualStart != null)
    cards.push({
      key: 'start',
      icon: <IconSunrise />,
      label: 'Usual start',
      value: clock(hall.usualStart),
      sub: hall.usualStart < 12 * 60 ? 'Early bird' : hall.usualStart < 17 * 60 ? 'Midday mover' : 'After-work lifter',
    })
  if (cards.length === 0) return null

  return (
    <section className="stack" aria-labelledby="fame-label">
      <div className="section-head">
        <h2 id="fame-label">Hall of fame</h2>
        <span className="small muted">All time</span>
      </div>
      <ul className="fame-grid">
        {cards.map((c, i) => {
          const body = (
            <>
              <span className="fame-icon">{c.icon}</span>
              <span className="overline">{c.label}</span>
              <strong className="fame-value">{c.value}</strong>
              <span className="small fame-sub">{c.sub}</span>
            </>
          )
          return (
            <li key={c.key} className={`fame-card hue-${i % 6}`}>
              {c.to ? (
                <button type="button" onClick={() => navigate(c.to!)}>
                  {body}
                </button>
              ) : (
                <div>{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
