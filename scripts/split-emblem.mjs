/*
 * split-emblem.mjs — splitter GENÉRICO de emblemas zodiacales.
 *
 * Generaliza split-leo-emblem.mjs a cualquier signo del template
 * cuadrado 1024×1024 (anillo + glifo arriba + estrellas + luna + ramas
 * + figura central). Produce las capas del reveal por etapas:
 *
 *   marco   · anillo + glifo + estrellas de borde   → etapa "despierta"
 *   nucleo  · masa interior de la figura             → etapa "forma"
 *   detalle · extremos de la figura + ornamentos     → etapa "revela"
 *
 * (Leo usa un split anatómico hecho a mano —cabeza/melena— en
 *  split-leo-emblem.mjs; este script es para los demás signos, donde
 *  la figura se parte por geometría: núcleo = mitad cercana al centro
 *  de la figura, detalle = mitad lejana. La usuaria aprobó núcleo→
 *  detalle como equivalente del beat anatómico de Leo.)
 *
 * Clasificación robusta: solo depende de lo que el template comparte
 * (radio del anillo, glifo arriba, estrellas <polygon>). La luna y las
 * ramas caen en las capas de figura — aparecen con ella, no se pierden.
 *
 * Cada trazo se mide rasterizándolo solo (resvg, alpha>10): los paths
 * relativos hacen inútil parsear coordenadas crudas.
 *
 * Uso: node scripts/split-emblem.mjs <raw.svg> <prefijo>
 *   p.ej. node scripts/split-emblem.mjs assets/zodiac-art/ar-2.svg aries
 *   → assets/zodiac-art/aries-emblem.svg  (normalizado full, para el mini)
 *     assets/zodiac-art/aries-emblem-{marco,marco-mono,nucleo,detalle}.svg
 *     /tmp/aries-groups.png  (debug: cada trazo coloreado por capa)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'

import { Resvg } from '@resvg/resvg-js'

const [, , rawArg, prefix] = process.argv
if (!rawArg || !prefix) {
  console.error('uso: node scripts/split-emblem.mjs <raw.svg> <prefijo>')
  process.exit(1)
}

const OUT_DIR = new URL('../assets/zodiac-art/', import.meta.url)
const raw = readFileSync(rawArg, 'utf8')

// ── 1 · normalizar: class .cls-N → fill inline ───────────────────────
const styleBlock = raw.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? ''
const classFill = new Map()
for (const m of styleBlock.matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)) {
  const fill = m[2].match(/fill:\s*([^;]+)\s*;?/)?.[1]?.trim()
  if (fill) classFill.set(m[1], fill)
}
const viewBox = raw.match(/viewBox="[^"]*"/)?.[0] ?? 'viewBox="0 0 1024 1024"'
const [, , , vbW] = viewBox.match(/viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/) ?? [, , , , 1024]
const SIZE = Number(vbW) || 1024
const openTag = `<svg xmlns="http://www.w3.org/2000/svg" ${viewBox}>`

const els = [...raw.matchAll(/<(?:path|polygon|circle|rect|ellipse)\b[^>]*?\/>/g)].map((m) => {
  let el = m[0]
  const cls = el.match(/class="([^"]+)"/)?.[1]
  if (cls) {
    const fill = cls.split(/\s+/).map((c) => classFill.get(c)).find(Boolean)
    el = el.replace(/\s*class="[^"]*"/, '')
    if (fill && !/fill="/.test(el)) el = el.replace(/\/>$/, ` fill="${fill}"/>`)
  }
  return el
})

writeFileSync(new URL(`${prefix}-emblem.svg`, OUT_DIR), `${openTag}\n  ${els.join('\n  ')}\n</svg>\n`)

// ── 2 · caja real por trazo (raster 256px, alpha>10) ─────────────────
const S = 256
const K = SIZE / S
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

// ── 3 · clasificación ────────────────────────────────────────────────
// Centro del emblema: el template comparte anillo centrado en (512,545)
// (ligeramente bajo el centro geométrico). Escalado por si el viewBox
// no es 1024.
const CX = SIZE * 0.5
const CY = SIZE * 0.532
const R_RING = SIZE * 0.36 // dentro de esto es figura/ornamento; fuera, anillo
const GLYPH_TOP = SIZE * 0.21
const GLYPH_HALF = SIZE * 0.14

// Mide todas las cajas una vez (reuso para centroide de figura).
const boxes = els.map(bboxOf)

function isMarco(el, e) {
  if (!e) return false // sin tinta medible → que caiga a figura (detalle)
  const d = Math.hypot(e.cx - CX, e.cy - CY)
  if (el.startsWith('<polygon')) return true // estrellas de 4 puntas
  if (d > R_RING) return true // arcos del anillo + estrellas del borde
  if (e.cy < GLYPH_TOP && Math.abs(e.cx - CX) < GLYPH_HALF) return true // glifo
  if (e.cy > SIZE * 0.83 && e.w < SIZE * 0.11) return true // estrella inferior central
  return false
}

const marcoIdx = []
const figIdx = []
els.forEach((el, i) => (isMarco(el, boxes[i]) ? marcoIdx : figIdx).push(i))

// Centroide de la figura (ponderado por presencia: cada caja cuenta 1).
let fcx = 0, fcy = 0, n = 0
for (const i of figIdx) {
  const e = boxes[i]
  if (!e) continue
  fcx += e.cx
  fcy += e.cy
  n++
}
fcx = n ? fcx / n : CX
fcy = n ? fcy / n : CY

// Split núcleo/detalle por la MEDIANA de distancia al centro de la
// figura → ~50/50 visual, sea cual sea la silueta. Trazos sin caja van
// a detalle (entran al final, nada se pierde).
const dist = (i) => {
  const e = boxes[i]
  return e ? Math.hypot(e.cx - fcx, e.cy - fcy) : Infinity
}
const measured = figIdx.filter((i) => boxes[i]).sort((a, b) => dist(a) - dist(b))
const median = measured.length ? dist(measured[Math.floor(measured.length / 2)]) : 0
const nucleoIdx = []
const detalleIdx = []
for (const i of figIdx) (dist(i) <= median ? nucleoIdx : detalleIdx).push(i)

console.log(
  `${prefix}: ${els.length} trazos → marco ${marcoIdx.length} · núcleo ${nucleoIdx.length} · detalle ${detalleIdx.length}`,
)

// ── 4 · escribir capas ───────────────────────────────────────────────
function write(name, idxs, mono) {
  const body = idxs
    .map((i) => (mono ? els[i].replace(/fill="[^"]*"/, 'fill="currentColor"') : els[i]))
    .join('\n  ')
  writeFileSync(new URL(name, OUT_DIR), `${openTag}\n  ${body}\n</svg>\n`)
}
write(`${prefix}-emblem-marco.svg`, marcoIdx, false)
write(`${prefix}-emblem-marco-mono.svg`, marcoIdx, true)
write(`${prefix}-emblem-nucleo.svg`, nucleoIdx, false)
write(`${prefix}-emblem-detalle.svg`, detalleIdx, false)

// ── 5 · debug: cada trazo coloreado por capa ─────────────────────────
const COLOR = { marco: '#E8B872', nucleo: '#FF4886', detalle: '#5BA8FF' }
// Recolorea el fill existente; si el trazo no traía fill, lo agrega una
// sola vez (nunca dos → resvg rechaza 'fill' duplicado).
const tinted = (idxs, color) =>
  idxs.map((i) =>
    /fill="/.test(els[i])
      ? els[i].replace(/fill="[^"]*"/, `fill="${color}"`)
      : els[i].replace(/\/>$/, ` fill="${color}"/>`),
  )
const debug = `${openTag}
  <rect width="${SIZE}" height="${SIZE}" fill="#0A0608"/>
  ${tinted(marcoIdx, COLOR.marco).join('\n  ')}
  ${tinted(nucleoIdx, COLOR.nucleo).join('\n  ')}
  ${tinted(detalleIdx, COLOR.detalle).join('\n  ')}
</svg>`
writeFileSync(
  `/tmp/${basename(prefix)}-groups.png`,
  new Resvg(debug, { fitTo: { mode: 'width', value: 360 } }).render().asPng(),
)
