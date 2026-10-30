import { useEffect, useRef, useState } from 'react'
import type { WeightUnit } from '../domain/types'
import { Sheet } from '../ui/Sheet'
import { IconChevronDown } from '../ui/icons'
import { formatTrackValue, MAX_LEVEL, milestoneTitle, tierName, type TrackId, type TrackProgress } from './achievements'
import { Medal } from './Medal'
import { milestoneDate, ProgressBar, progressText } from './parts'

/** Every track with its level and progress; a track opens into its ladder of twelve medals. */
export function TracksSheet(props: {
  open: boolean
  focus: TrackId | null
  tracks: TrackProgress[]
  unit: WeightUnit
  onClose: () => void
}) {
  const { open, focus, tracks, unit, onClose } = props
  const [expanded, setExpanded] = useState<TrackId | null>(focus)
  const rows = useRef(new Map<TrackId, HTMLLIElement>())

  useEffect(() => {
    if (!open) return
    setExpanded(focus)
    if (focus) requestAnimationFrame(() => rows.current.get(focus)?.scrollIntoView({ block: 'start' }))
  }, [open, focus])

  return (
    <Sheet open={open} title="Tracks & levels" onClose={onClose}>
      <ul className="plain-list track-list">
        {tracks.map((t) => {
          const isOpen = expanded === t.def.id
          return (
            <li
              key={t.def.id}
              ref={(el) => {
                if (el) rows.current.set(t.def.id, el)
              }}
              className={`track-item ${isOpen ? 'open' : ''}`}
            >
              <button
                type="button"
                className="track-row"
                aria-expanded={isOpen}
                onClick={() => setExpanded(isOpen ? null : t.def.id)}
              >
                <Medal track={t.def.id} level={t.level} size={50} />
                <span className="grow stack tight">
                  <span className="track-head">
                    <strong>{t.def.name}</strong>
                    <span className="small muted num">
                      {t.level > 0 ? `Lv ${t.level} · ${tierName(t.level)}` : 'Not started'}
                    </span>
                  </span>
                  <ProgressBar fraction={t.fraction} track={t.def.id} />
                  <span className="small muted num">{progressText(t, unit)}</span>
                </span>
                <span className="track-chevron">
                  <IconChevronDown />
                </span>
              </button>
              {isOpen && <Ladder track={t} unit={unit} />}
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}

/**
 * How far along you are towards a medal, measured from zero (253 of 500 sets = 50 %), so it matches the numbers shown.
 * Streaks count the streak still alive. Rounded down, so 100 % only shows once it is reached.
 */
const absolutePercent = (t: TrackProgress, threshold: number) =>
  Math.min(99, Math.floor(((t.def.streak ? (t.current ?? 0) : t.value) / threshold) * 100))

function Ladder({ track: t, unit }: { track: TrackProgress; unit: WeightUnit }) {
  return (
    <div className="ladder">
      <p className="small secondary">
        {t.def.blurb}
        {t.def.streak && (
          <>
            {' '}
            Best streak so far: <strong className="num">{t.value}</strong> {t.value === 1 ? 'week' : 'weeks'}. The
            running week never breaks a streak.
          </>
        )}
      </p>
      <ol className="ladder-grid" aria-label={`${t.def.name} levels`}>
        {t.def.thresholds.map((threshold, i) => {
          const level = i + 1
          const reached = t.unlocked[i]
          const isNext = level === t.level + 1
          return (
            <li
              key={level}
              className={`rung ${reached ? 'reached' : isNext ? 'next' : 'locked'}`}
              title={milestoneTitle(t.def.id, threshold, unit)}
            >
              <Medal
                track={t.def.id}
                level={level}
                size={46}
                locked={!reached && !isNext}
                className={isNext ? 'preview' : ''}
              />
              <span className="rung-value num">{formatTrackValue(t.def.id, threshold, unit)}</span>
              <span className="rung-sub">
                {reached ? milestoneDate(reached.at) : isNext ? `${absolutePercent(t, threshold)} %` : tierName(level)}
              </span>
            </li>
          )
        })}
      </ol>
      {t.level === MAX_LEVEL && <p className="small ladder-done">Every level of this track is yours. Legendary.</p>}
    </div>
  )
}
