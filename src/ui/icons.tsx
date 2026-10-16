import type { SVGProps } from 'react'

const base: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export const IconDumbbell = () => (
  <svg {...base}>
    <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
  </svg>
)
export const IconClock = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)
export const IconSettings = () => (
  <svg {...base}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
)
export const IconCheck = () => (
  <svg {...base} strokeWidth={2.5}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)
export const IconPin = () => (
  <svg {...base} width={16} height={16}>
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
)
export const IconList = () => (
  <svg {...base}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M8.5 9h7M8.5 12h7M8.5 15h4" />
  </svg>
)
export const IconChart = () => (
  <svg {...base}>
    <path d="M4 19h16" />
    <path d="m5 15 4-4 3.5 3L19 7.5" />
  </svg>
)
export const IconStar = ({ filled = false }: { filled?: boolean }) => (
  <svg {...base} width={20} height={20} fill={filled ? 'currentColor' : 'none'}>
    <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8L12 3.5Z" />
  </svg>
)
export const IconPlus = () => (
  <svg {...base} width={18} height={18}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const IconX = () => (
  <svg {...base} width={18} height={18}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)
export const IconMore = () => (
  <svg {...base} width={20} height={20} strokeWidth={2.5}>
    <path d="M5.5 12h.01M12 12h.01M18.5 12h.01" />
  </svg>
)
export const IconArrowUp = () => (
  <svg {...base} width={16} height={16}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
)
export const IconArrowDown = () => (
  <svg {...base} width={16} height={16}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
)
export const IconChevronLeft = () => (
  <svg {...base} width={18} height={18}>
    <path d="m15 6-6 6 6 6" />
  </svg>
)
export const IconChevronRight = () => (
  <svg {...base} width={18} height={18}>
    <path d="m9 6 6 6-6 6" />
  </svg>
)
export const IconSliders = () => (
  <svg {...base} width={16} height={16}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
)
export const IconCalendar = () => (
  <svg {...base}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
)
export const IconInbox = () => (
  <svg {...base}>
    <path d="M4 13.5 6.2 6.3A2 2 0 0 1 8.1 5h7.8a2 2 0 0 1 1.9 1.3L20 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4.5Z" />
    <path d="M4 13.5h4.5l1.5 2.5h4l1.5-2.5H20" />
  </svg>
)
export const IconTranslate = () => (
  <svg {...base} width={20} height={20}>
    <path d="M4 5h9M8.5 3v2M6 5c.5 3 2.5 5.5 5.5 7M12 5c-.5 3-3 6-7.5 7.5" />
    <path d="m12.5 20 4-9 4 9M14 17h5" />
  </svg>
)
export const IconPencil = () => (
  <svg {...base} width={16} height={16}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
)
export const IconHeartPulse = () => (
  <svg {...base} width={18} height={18}>
    <path d="M20.5 9.5c0 5-8.5 10.5-8.5 10.5S3.5 14.5 3.5 9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8.5 2.5Z" />
    <path d="M3.5 12h4l1.5-2.5 2.5 5 1.5-2.5h7.5" />
  </svg>
)
export const IconRepeat = () => (
  <svg {...base} width={20} height={20}>
    <path d="M17 3l3 3-3 3" />
    <path d="M4 12V10a4 4 0 0 1 4-4h12M7 21l-3-3 3-3" />
    <path d="M20 12v2a4 4 0 0 1-4 4H4" />
  </svg>
)
export const IconRefresh = () => (
  <svg {...base} width={20} height={20}>
    <path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4" />
    <path d="M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4" />
  </svg>
)
export const IconShare = () => (
  <svg {...base} width={20} height={20}>
    <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
    <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
  </svg>
)
export const IconTrash = () => (
  <svg {...base} width={16} height={16}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
)
export const IconNote = () => (
  <svg {...base} width={18} height={18}>
    <path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M9 12h6M9 16h4" />
  </svg>
)
export const IconChevronDown = () => (
  <svg {...base} width={18} height={18}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)
export const IconPlay = () => (
  <svg {...base} width={20} height={20}>
    <path d="M7 4.5v15l12.5-7.5L7 4.5Z" />
  </svg>
)
export const IconCopy = () => (
  <svg {...base} width={20} height={20}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </svg>
)
export const IconArchive = () => (
  <svg {...base} width={20} height={20}>
    <rect x="3" y="4" width="18" height="5" rx="1.5" />
    <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" />
  </svg>
)
export const IconSun = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
  </svg>
)
export const IconSwipe = () => (
  <svg {...base}>
    <path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" />
  </svg>
)
export const IconDatabase = () => (
  <svg {...base}>
    <ellipse cx="12" cy="6" rx="7.5" ry="3" />
    <path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
  </svg>
)
