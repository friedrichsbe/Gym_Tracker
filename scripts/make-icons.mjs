// Generates the PWA icons (PNG) without external tools. Run: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const BG = [0x0e, 0x10, 0x12]
const ACCENT = [0xb8, 0xf0, 0x5a]

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function png(size, drawPixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b] = drawPixel(x / size, y / size)
      const i = y * (size * 4 + 1) + 1 + x * 4
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
      raw[i + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const inRect = (u, v, x0, y0, x1, y1) => u >= x0 && u <= x1 && v >= y0 && v <= y1

// Simple dumbbell glyph; `safe` shrinks it into the maskable safe zone.
function glyph(scale) {
  return (u, v) => {
    const x = (u - 0.5) / scale + 0.5
    const y = (v - 0.5) / scale + 0.5
    const hit =
      inRect(x, y, 0.3, 0.46, 0.7, 0.54) || // bar
      inRect(x, y, 0.2, 0.3, 0.28, 0.7) || // inner plates
      inRect(x, y, 0.72, 0.3, 0.8, 0.7) ||
      inRect(x, y, 0.1, 0.38, 0.17, 0.62) || // outer plates
      inRect(x, y, 0.83, 0.38, 0.9, 0.62)
    return hit ? ACCENT : BG
  }
}

mkdirSync(new URL('../public/icons/', import.meta.url), { recursive: true })
const out = (name, size, scale) =>
  writeFileSync(new URL(`../public/icons/${name}`, import.meta.url), png(size, glyph(scale)))

out('icon-192.png', 192, 1)
out('icon-512.png', 512, 1)
out('icon-maskable-512.png', 512, 0.68)
out('apple-touch-icon.png', 180, 0.8)
console.log('icons written to public/icons')
