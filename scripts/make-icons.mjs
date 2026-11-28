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
// shape: 'square' | 'rounded' | 'circle' | 'none' (glyph only on transparent, for Android adaptive/monochrome layers).
function svg({ rounded, scale, shape = rounded ? 'rounded' : 'square' }) {
  const bg = {
    rounded: `<rect width="1024" height="1024" rx="228" fill="${BG}"/>`,
    square: `<rect width="1024" height="1024" fill="${BG}"/>`,
    circle: `<circle cx="512" cy="512" r="512" fill="${BG}"/>`,
    none: '',
  }[shape]
  // Without a background the hub's hole must be real transparency, so draw it as a ring.
  const hub =
    shape === 'none'
      ? `<circle cx="512" cy="512" r="65" fill="none" stroke="${GLYPH}" stroke-width="62"/>`
      : `<circle cx="512" cy="512" r="96" fill="${GLYPH}"/>
    <circle cx="512" cy="512" r="34" fill="${BG}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  ${bg}
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <g transform="rotate(-90 512 512)" fill="none" stroke-width="${PILL_W}" stroke-linecap="round">
      ${pills()}
    </g>
    ${hub}
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

// ---- Android (Capacitor) launcher icons ----
// Legacy (pre-Android 8) square + round icons, and the adaptive-icon layers: a transparent foreground and a
// monochrome layer (themed icons, Android 13+) on a 108dp canvas, background = @color/ic_launcher_background.
// The mark stays inside the 66dp safe circle (scale 0.95 → ~51% of the canvas).
const res = new URL('../android/app/src/main/res/', import.meta.url)
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
const legacy = svg({ shape: 'rounded', scale: 1.3 })
const round = svg({ shape: 'circle', scale: 1.25 })
const layer = svg({ shape: 'none', scale: 0.95 })
for (const [d, f] of Object.entries(DENSITIES)) {
  const dir = new URL(`mipmap-${d}/`, res)
  mkdirSync(dir, { recursive: true })
  writeFileSync(new URL('ic_launcher.png', dir), render(legacy, 48 * f))
  writeFileSync(new URL('ic_launcher_round.png', dir), render(round, 48 * f))
  writeFileSync(new URL('ic_launcher_foreground.png', dir), render(layer, 108 * f))
  writeFileSync(new URL('ic_launcher_monochrome.png', dir), render(layer, 108 * f))
}
console.log('android launcher icons written to android/app/src/main/res/')
