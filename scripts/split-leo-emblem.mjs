/*
 * split-leo-emblem.mjs — parte assets/zodiac-art/leo-emblem.svg en las
 * 4 capas anatómicas del reveal por etapas del Emblema Celeste:
 *
 *   marco   · anillo + glifo + estrellas     → etapa 1 "Despierta"
 *   jardin  · luna + ramas botánicas         → etapa 2 "Toma forma"
 *   cabeza  · cara/cabeza del león           → etapa 3 "Se revela"
 *   melena  · melena + flourishes restantes  → etapa 4 "Casi completo"
 *
 * Cada trazo se clasifica por su caja real (rasterizando el trazo solo
 * con resvg y midiendo los píxeles con tinta — los comandos relativos
 * de los paths hacen inútil parsear coordenadas crudas).
 *
 * Emite en assets/zodiac-art/:
 *   leo-emblem-{marco,jardin,cabeza,melena}.svg        (oro original)
 *   leo-emblem-{marco,jardin}-mono.svg                 (currentColor —
 *     solo marco/jardin tienen fase brasa al aparecer)
 *
 * node scripts/split-leo-emblem.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

import { Resvg } from '@resvg/resvg-js'

const SRC = new URL('../assets/zodiac-art/leo-emblem.svg', import.meta.url)
const OUT_DIR = new URL('../assets/zodiac-art/', import.meta.url)

const svg = readFileSync(SRC, 'utf8')
const openTag = svg.match(/<svg[^>]*>/)[0]
const els = [...svg.matchAll(/<(?:path|polygon)\b[^>]*\/>/g)].map((m) => m[0])

// ── caja real por trazo (raster 256px, alpha > 10) ───────────────────
const S = 256
const K = 1024 / S
function bboxOf(el) {
  const png = new Resvg(openTag + el + '</svg>', { fitTo: { mode: 'width', value: S } }).render()
  const { pixels, width, height } = png
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return {
    cx: ((minX + maxX) / 2) * K,
    cy: ((minY + maxY) / 2) * K,
    w: (maxX - minX) * K,
    h: (maxY - minY) * K,
  }
}

// ── clasificación por región (viewBox 0 0 1024 1024, anillo c(512,545)) ─
const CX = 512
const CY = 545
function groupOf(el) {
  const e = bboxOf(el)
  // Sin tinta medible (motas finísimas): a la melena, que entra al final
  // — así nada del arte se pierde.
  if (!e) return 'melena'
  const d = Math.hypot(e.cx - CX, e.cy - CY)
  if (e.cy < 200 && e.cx > 400 && e.cx < 620) return 'marco' // glifo Leo
  if (d > 380) return 'marco' // arcos del anillo + estrellas del borde
  if (e.cx > 620 && e.cx < 820 && e.cy > 200 && e.cy < 380) return 'jardin' // luna
  if (el.startsWith('<polygon')) return 'marco' // estrellas de 4 puntas sueltas
  if (e.cy > 850 && e.w < 100) return 'marco' // estrella inferior central
  if (e.cx > 660 && e.cy > 420) return 'jardin' // ramas botánicas
  if (e.cx < 470 && e.cy > 280 && e.cy < 780) return 'cabeza'
  return 'melena'
}

const byGroup = { marco: [], jardin: [], cabeza: [], melena: [] }
for (const el of els) byGroup[groupOf(el)].push(el)
console.log(Object.fromEntries(Object.entries(byGroup).map(([g, a]) => [g, a.length])))

function write(name, elements, mono) {
  const body = elements
    .map((el) => (mono ? el.replace(/fill="[^"]*"/, 'fill="currentColor"') : el))
    .join('\n  ')
  writeFileSync(new URL(name, OUT_DIR), `${openTag}\n  ${body}\n</svg>\n`)
  console.log(`assets/zodiac-art/${name}`)
}

write('leo-emblem-marco.svg', byGroup.marco, false)
write('leo-emblem-marco-mono.svg', byGroup.marco, true)
write('leo-emblem-jardin.svg', byGroup.jardin, false)
write('leo-emblem-jardin-mono.svg', byGroup.jardin, true)
write('leo-emblem-cabeza.svg', byGroup.cabeza, false)
write('leo-emblem-melena.svg', byGroup.melena, false)
