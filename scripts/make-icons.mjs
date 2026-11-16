// Generates the app icon set from one vector mark: "F1 · Flat Orange"
// (a white weight plate of five rounded set-pills, three done, on a flat orange field).
// Run: npm run icons   ->  public/favicon.svg + public/icons/*.png
import { mkdirSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const out = (p) => new URL(`../public/${p}`, import.meta.url)

const BG = '#E9743F'
const GLYPH = '#FFFFFF'
const OPEN_OPACITY = 0.35

const SETS = 5
const DONE = 3
const RADIUS = 236
const PILL_W = 84

function pills() {
  const c = 2 * Math.PI * RADIUS
  const gap = PILL_W + 34
  const len = c / SETS - gap
  return Array.from({ length: SETS }, (_, i) => {
    const opacity = i < DONE ? 1 : OPEN_OPACITY
    const offset = -(i * c) / SETS - gap / 2
    return `<circle cx="512" cy="512" r="${RADIUS}" stroke="${GLYPH}" opacity="${opacity}" stroke-dasharray="${len.toFixed(1)} ${(c - len).toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"/>`
  }).join('\n      ')
}

// scale: size of the mark relative to the canvas (1 = design as drawn, the pills span 54% of the width at 1).
function svg({ rounded, scale }) {
  const bg = rounded
    ? `<rect width="1024" height="1024" rx="228" fill="${BG}"/>`
    : `<rect width="1024" height="1024" fill="${BG}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  ${bg}
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <g transform="rotate(-90 512 512)" fill="none" stroke-width="${PILL_W}" stroke-linecap="round">
      ${pills()}
    </g>
    <circle cx="512" cy="512" r="96" fill="${GLYPH}"/>
    <circle cx="512" cy="512" r="34" fill="${BG}"/>
  </g>
</svg>
`
}

const render = (source, size) =>
  new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng()

// Favicon: bigger mark so it survives 16px.
writeFileSync(out('favicon.svg'), svg({ rounded: true, scale: 1.4 }))

mkdirSync(out('icons/'), { recursive: true })
const full = svg({ rounded: false, scale: 1.3 })
writeFileSync(out('icons/icon-192.png'), render(full, 192))
writeFileSync(out('icons/icon-512.png'), render(full, 512))
// Maskable: the OS crops to a circle/squircle; the mark (r ≈ 330 of 1024 at this scale) stays inside the 80% safe zone.
writeFileSync(out('icons/icon-maskable-512.png'), render(svg({ rounded: false, scale: 1.2 }), 512))
writeFileSync(out('icons/apple-touch-icon.png'), render(full, 180))
console.log('icons written to public/')
