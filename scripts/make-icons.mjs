// Generates the app icon set from one vector mark: "B2.1 · Pills auf Scheibe"
// (a weight plate whose rim is split into five rounded set-pills, three of them done).
// Run: npm run icons   ->  public/favicon.svg + public/icons/*.png
import { mkdirSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const out = (p) => new URL(`../public/${p}`, import.meta.url)

const BG = '#111214'
const PLATE = '#22242A'
const SLOT = '#111214'
const ACCENT = '#E9743F'
const INK = '#ECE7DF'

const SETS = 5
const DONE = 3
const RADIUS = 236
const PILL_W = 84

function pills() {
  const c = 2 * Math.PI * RADIUS
  const gap = PILL_W + 34
  const len = c / SETS - gap
  return Array.from({ length: SETS }, (_, i) => {
    const color = i < DONE ? ACCENT : SLOT
    const offset = -(i * c) / SETS - gap / 2
    return `<circle cx="512" cy="512" r="${RADIUS}" stroke="${color}" stroke-dasharray="${len.toFixed(1)} ${(c - len).toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"/>`
  }).join('\n      ')
}

// scale: size of the plate relative to the canvas (1 = design as drawn, plate spans 60% of the width).
function svg({ rounded, scale }) {
  const bg = rounded
    ? `<rect width="1024" height="1024" rx="228" fill="${BG}"/>`
    : `<rect width="1024" height="1024" fill="${BG}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  ${bg}
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <circle cx="512" cy="512" r="304" fill="${PLATE}"/>
    <g transform="rotate(-90 512 512)" fill="none" stroke-width="${PILL_W}" stroke-linecap="round">
      ${pills()}
    </g>
    <circle cx="512" cy="512" r="96" fill="${INK}"/>
    <circle cx="512" cy="512" r="34" fill="${PLATE}"/>
  </g>
</svg>
`
}

const render = (source, size) =>
  new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng()

// Favicon: bigger plate so it survives 16px.
writeFileSync(out('favicon.svg'), svg({ rounded: true, scale: 1.3 }))

mkdirSync(out('icons/'), { recursive: true })
const full = svg({ rounded: false, scale: 1 })
writeFileSync(out('icons/icon-192.png'), render(full, 192))
writeFileSync(out('icons/icon-512.png'), render(full, 512))
// Maskable: the OS crops to a circle/squircle; the plate (r 304 of 512) sits inside the 80% safe zone already.
writeFileSync(out('icons/icon-maskable-512.png'), render(svg({ rounded: false, scale: 1 }), 512))
writeFileSync(out('icons/apple-touch-icon.png'), render(full, 180))
console.log('icons written to public/')
