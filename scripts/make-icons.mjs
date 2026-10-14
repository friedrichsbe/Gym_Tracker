// Generates the app icon set from one vector mark (see docs/App_Icon_Idea.jpg).
// Run: npm run icons   ->  public/favicon.svg + public/icons/*.png
import { mkdirSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const out = (p) => new URL(`../public/${p}`, import.meta.url)

// The mark lives in the coordinate space of the 2048px concept art; its bounding box is
// x 580–1355, y 600–1335, so (967, 967) is its centre.
const CX = 967
const CY = 967

function mark(weight) {
  const w = (n) => (n * weight).toFixed(1)
  return `
    <g fill="url(#bronze)" stroke="url(#bronze)" stroke-linejoin="miter">
      <g fill="none" stroke-width="${w(52)}">
        <path d="M 590 1305 L 1000 1305 C 1235 1305 1345 1150 1322 950 C 1311 860 1282 792 1236 748"/>
        <path d="M 590 1305 C 800 1295 905 1180 1000 1050 C 1100 915 1170 690 1352 632"/>
        <path stroke-width="${w(44)}" d="M 950 623 C 1040 625 1110 643 1163 676"/>
      </g>
      <g stroke="none">
        <rect x="${580 - (weight - 1) * 10}" y="${940 - (weight - 1) * 12}" width="${w(36)}" height="${w(52)}"/>
        <rect x="${645 - (weight - 1) * 12}" y="850" width="${w(46)}" height="240"/>
        <rect x="${720 - (weight - 1) * 12}" y="795" width="${w(46)}" height="345"/>
        <path d="M 795 940 H 950 L 915 992 H 795 Z"/>
      </g>
    </g>`
}

function svg({ rounded, scale, weight = 1, shadow = true }) {
  const bg = rounded
    ? `<rect width="1024" height="1024" rx="228" fill="url(#face)"/>
       <rect x="3" y="3" width="1018" height="1018" rx="225" fill="none" stroke="url(#rim)" stroke-width="6"/>`
    : `<rect width="1024" height="1024" fill="url(#face)"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="face" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3b3e47"/>
      <stop offset="1" stop-color="#181a20"/>
    </linearGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8b8f9a" stop-opacity=".55"/>
      <stop offset="1" stop-color="#b08a6e" stop-opacity=".25"/>
    </linearGradient>
    <linearGradient id="bronze" gradientUnits="userSpaceOnUse" x1="640" y1="620" x2="1280" y2="1340">
      <stop offset="0" stop-color="#e3d6ca"/>
      <stop offset=".45" stop-color="#b9a190"/>
      <stop offset="1" stop-color="#85604a"/>
    </linearGradient>
    <filter id="drop" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#000" flood-opacity=".5"/>
    </filter>
  </defs>
  ${bg}
  <g transform="translate(512 512) scale(${scale}) translate(${-CX} ${-CY})"${shadow ? ' filter="url(#drop)"' : ''}>${mark(weight)}
  </g>
</svg>
`
}

const render = (source, size) =>
  new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng()

// Favicon: heavier strokes and a bigger mark so it survives 16px.
writeFileSync(out('favicon.svg'), svg({ rounded: true, scale: 1.02, weight: 1.35, shadow: false }))

mkdirSync(out('icons/'), { recursive: true })
const full = svg({ rounded: false, scale: 0.98 })
writeFileSync(out('icons/icon-192.png'), render(full, 192))
writeFileSync(out('icons/icon-512.png'), render(full, 512))
// Maskable: the OS crops to a circle/squircle, so keep the mark inside the 80% safe zone.
writeFileSync(out('icons/icon-maskable-512.png'), render(svg({ rounded: false, scale: 0.8 }), 512))
writeFileSync(out('icons/apple-touch-icon.png'), render(svg({ rounded: false, scale: 0.92 }), 180))
console.log('icons written to public/')
