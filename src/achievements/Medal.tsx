import { useId, type ReactNode } from 'react'
import {
  IconClock,
  IconDumbbell,
  IconFlame,
  IconBolt,
  IconFlames,
  IconHeartPulse,
  IconLayers,
  IconPlate,
  IconRepeat,
  IconRocket,
} from '../ui/icons'
import { tierName, type TrackId } from './achievements'

export const TRACK_ICON: Record<TrackId, () => ReactNode> = {
  workouts: IconDumbbell,
  volume: IconPlate,
  sets: IconLayers,
  reps: IconRepeat,
  time: IconClock,
  cardio: IconHeartPulse,
  streak1: IconFlame,
  streak2: IconFlames,
  streak3: IconBolt,
  streak4: IconRocket,
}

/** Light, base and dark shade of each medal material (levels 1–12). The last two are multicoloured. */
export const TIER_COLORS: [string, string, string][] = [
  ['#f6c08f', '#c77b3f', '#7c4519'], // Bronze
  ['#f4f7fa', '#b4bec8', '#66727e'], // Silver
  ['#fff1a8', '#efb02a', '#a4600a'], // Gold
  ['#f3fbff', '#a6c4d6', '#53748a'], // Platinum
  ['#b5f5d9', '#22b07d', '#0d6446'], // Jade
  ['#b7d0ff', '#3471e6', '#183d8f'], // Sapphire
  ['#ffb3c7', '#e3255f', '#86102f'], // Ruby
  ['#e2ccff', '#9a5ce6', '#552492'], // Amethyst
  ['#effdff', '#6fd8f2', '#2386a8'], // Diamond
  ['#a99cf0', '#3b3458', '#120f1d'], // Obsidian
  ['#7df0ff', '#9a6bff', '#ff5fb4'], // Aurora
  ['#fff3a3', '#ff9d2e', '#e0247a'], // Legend
]
export const tierColors = (level: number) => TIER_COLORS[Math.max(1, Math.min(12, level)) - 1]

const star = (cx: number, cy: number, outer: number, inner: number, points: number, rotate = -90) =>
  Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner
    const a = ((rotate + (i * 180) / points) * Math.PI) / 180
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`
  }).join(' ')

const hexagon = (cx: number, cy: number, r: number) => star(cx, cy, r, r, 3, -90)

/**
 * A medal for a track level. The shape grows with the level: plain medal (1–3), rosette (4–6),
 * laurelled badge (7–9), crowned star (10–12). `level` 0 or `locked` draws the empty slot.
 */
export function Medal(props: { track: TrackId; level: number; size?: number; locked?: boolean; className?: string }) {
  const { track, size = 56, className = '' } = props
  const level = Math.max(0, Math.min(12, props.level))
  const locked = props.locked || level === 0
  const uid = useId().replace(/:/g, '')
  const group = locked ? 1 : Math.ceil(level / 3)
  const [light, base, dark] = locked ? ['', '', ''] : tierColors(level)
  const Icon = TRACK_ICON[track]
  const fill = (id: string) => (locked ? undefined : `url(#${id}-${uid})`)
  const lockedFill = { fill: 'var(--surface-3)', stroke: 'var(--border-strong)' }
  // Vertical centre of the medal body, for the icon on top.
  const cy = group <= 2 ? 38 : group === 3 ? 34 : 36

  return (
    <span
      className={`medal g${group} ${locked ? 'locked' : `tier-${level}`} ${className}`}
      style={{ width: size, height: size, ['--cy' as string]: `${(cy / 64) * 100}%` }}
      role="img"
      aria-label={locked ? 'Locked medal' : `${tierName(level)} medal`}
    >
      <svg viewBox="0 0 64 64" aria-hidden="true">
        {!locked && (
          <defs>
            <linearGradient id={`face-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={light} />
              <stop offset="0.5" stopColor={base} />
              <stop offset="1" stopColor={dark} />
            </linearGradient>
            <linearGradient id={`core-${uid}`} x1="1" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={level >= 11 ? light : base} />
              <stop offset="1" stopColor={dark} />
            </linearGradient>
            <linearGradient id={`ribbon-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={dark} />
              <stop offset="1" stopColor={base} />
            </linearGradient>
          </defs>
        )}

        {group <= 2 && (
          <g style={locked ? lockedFill : undefined} opacity={locked ? 0.7 : 1}>
            <polygon points="19,2 29,2 34,19 24,19" fill={fill('ribbon')} />
            <polygon points="35,2 45,2 40,19 30,19" fill={fill('ribbon')} />
          </g>
        )}

        {group === 1 && (
          <>
            <circle cx="32" cy={cy} r="23" fill={fill('face')} style={locked ? lockedFill : undefined} />
            <circle
              cx="32"
              cy={cy}
              r="18"
              fill={fill('core')}
              stroke={locked ? undefined : light}
              strokeOpacity="0.55"
              strokeWidth="1.5"
              style={locked ? { fill: 'var(--surface-2)', stroke: 'var(--border)' } : undefined}
            />
          </>
        )}

        {group === 2 && (
          <>
            <polygon points={star(32, cy, 25, 21.5, 14)} fill={fill('face')} />
            <circle cx="32" cy={cy} r="17.5" fill={fill('core')} stroke={light} strokeOpacity="0.6" strokeWidth="1.5" />
          </>
        )}

        {group === 3 && (
          <>
            <Laurel cy={cy} color={dark} highlight={base} />
            <polygon points={hexagon(32, cy, 24)} fill={fill('face')} />
            <polygon
              points={hexagon(32, cy, 18.5)}
              fill={fill('core')}
              stroke={light}
              strokeOpacity="0.6"
              strokeWidth="1.5"
            />
          </>
        )}

        {group === 4 && (
          <>
            <polygon points={star(32, cy, 28, 20, 10)} fill={fill('face')} />
            <circle cx="32" cy={cy} r="16.5" fill={fill('core')} stroke={light} strokeOpacity="0.7" strokeWidth="1.5" />
            <path
              d="M23 13 21 4l6 4 5-6 5 6 6-4-2 9Z"
              fill={light}
              stroke={dark}
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </>
        )}

        {/* Shine */}
        {!locked && (
          <ellipse
            cx="25"
            cy={cy - 9}
            rx="9"
            ry="4.5"
            fill="#fff"
            opacity="0.28"
            transform={`rotate(-30 25 ${cy - 9})`}
          />
        )}
      </svg>
      <span className="medal-icon">
        <Icon />
      </span>
    </span>
  )
}

/** Two laurel branches around the badge. */
function Laurel({ cy, color, highlight }: { cy: number; color: string; highlight: string }) {
  const leaves = [0, 1, 2, 3, 4]
  const branch = (side: 1 | -1) =>
    leaves.map((i) => {
      const a = ((200 - i * 32) * Math.PI) / 180
      const x = 32 + side * 27 * Math.cos(a) * -1
      const y = cy + 27 * Math.sin(a) * -1 + 4
      const rot = side === 1 ? -i * 32 + 20 : i * 32 - 20
      return (
        <ellipse
          key={`${side}-${i}`}
          cx={x.toFixed(2)}
          cy={y.toFixed(2)}
          rx="2.6"
          ry="5.6"
          fill={i % 2 ? highlight : color}
          transform={`rotate(${side === 1 ? rot + 90 : rot - 90} ${x.toFixed(2)} ${y.toFixed(2)})`}
        />
      )
    })
  return (
    <g>
      {branch(1)}
      {branch(-1)}
    </g>
  )
}
