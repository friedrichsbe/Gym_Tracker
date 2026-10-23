import { useNavigate } from 'react-router-dom'
import { useSettings } from '../data/hooks'
import { IconChevronRight, IconX } from '../ui/icons'
import { milestoneTitle, tierName, trackDef } from './achievements'
import { dismissTile, useAchievements, useMilestoneTiles } from './hooks'
import { Medal } from './Medal'
import { milestoneDate, tierStyle } from './parts'

/** Colourful tiles for milestones of the last week on the workout screen. Each one can be dismissed. */
export function MilestoneTiles() {
  const tiles = useMilestoneTiles()
  const { units } = useSettings()
  const navigate = useNavigate()
  if (tiles.length === 0) return null
  return (
    <ul className="milestone-tiles" aria-label="New milestones">
      {tiles.map((u) => (
        <li key={u.id} className="milestone-tile" style={tierStyle(u.level)}>
          <button type="button" className="milestone-tile-main" onClick={() => navigate('/progress?tab=trophies')}>
            <Medal track={u.track} level={u.level} size={52} />
            <span className="stack tight grow">
              <span className="overline">New milestone · {tierName(u.level)}</span>
              <strong className="milestone-title">{milestoneTitle(u.track, u.threshold, units)}</strong>
              <span className="small">
                {trackDef(u.track).name} · {milestoneDate(u.at)}
              </span>
            </span>
            <IconChevronRight />
          </button>
          <button
            type="button"
            className="btn ghost icon small milestone-tile-close"
            aria-label="Hide this milestone"
            onClick={() => dismissTile(u.id)}
          >
            <IconX />
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Milestones reached with this workout; a confetti burst right after finishing it. Renders nothing when there are none. */
export function SessionMilestones({ sessionId, celebrate }: { sessionId: string; celebrate?: boolean }) {
  const achievements = useAchievements()
  const { units } = useSettings()
  const navigate = useNavigate()
  const mine = achievements?.unlocks.filter((u) => u.sessionId === sessionId) ?? []
  if (mine.length === 0) return null
  const best = mine.reduce((a, b) => (b.level > a.level ? b : a))
  return (
    <section
      className={`card session-milestones ${celebrate ? 'celebrate' : ''}`}
      style={tierStyle(best.level)}
      aria-label="Milestones reached"
    >
      {celebrate && <Confetti />}
      <span className="overline">
        {mine.length === 1 ? 'Milestone unlocked' : `${mine.length} milestones unlocked`}
      </span>
      <ul className="plain-list session-milestone-list">
        {mine.map((u) => (
          <li key={u.id}>
            <Medal track={u.track} level={u.level} size={celebrate ? 60 : 48} className={celebrate ? 'pop-in' : ''} />
            <span className="stack tight">
              <strong>{milestoneTitle(u.track, u.threshold, units)}</strong>
              <span className="small muted">
                {trackDef(u.track).name} · Level {u.level} · {tierName(u.level)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <button type="button" className="link-subtle" onClick={() => navigate('/progress?tab=trophies')}>
        See all trophies <IconChevronRight />
      </button>
    </section>
  )
}

const CONFETTI = Array.from({ length: 18 }, (_, i) => i)

function Confetti() {
  return (
    <span className="confetti" aria-hidden="true">
      {CONFETTI.map((i) => (
        <i key={i} style={{ ['--i' as string]: i }} />
      ))}
    </span>
  )
}
