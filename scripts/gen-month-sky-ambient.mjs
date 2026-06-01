/*
 * Generates assets/lottie/month-sky-ambient.json — the AMBIENT, looping
 * Genshin-style atmosphere for the Órbita → Mes view (MonthSky.tsx).
 *
 * Unlike the Home reward (a one-shot gold burst), this is a CALM INFINITE
 * LOOP in the Mes palette (peach/pink/violet/magenta, NOT gold): drifting
 * star dust, a breathing accretion-disk shimmer, and staggered 4-point
 * glints. Mounted between MonthSky's back/front SVGs, pointerEvents none.
 * Lottie renders it NATIVELY (glow faked with radial gradients, no blur).
 *
 * SEAMLESS: every animated property returns to its t=0 value at t=LOOP, so
 * the loop repeats without a visible seam.
 *
 * Run:  node scripts/gen-month-sky-ambient.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = `${__dirname}/../assets/lottie/month-sky-ambient.json`

const W = 372
const H = 372
const CX = W / 2
const CY = H / 2
const FR = 30
const LOOP = 540 // 18 s @ 30fps — the master loop

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = rng(20260601)

// MonthSky palette (peach/pink/violet/magenta) as Lottie [r,g,b].
const PINK_CORE = [1, 1, 1] // #FFFFFF
const AURA_PALE = [0.988, 0.898, 0.933] // #FCE5EE
const AURA_PINK = [0.984, 0.843, 0.89] // #FBD7E3
const HALO_PEACH = [0.957, 0.671, 0.784] // #F4ABC8
const MAGENTA = [0.914, 0.118, 0.388] // #E91E63
const PLASMA_RIM = [0.604, 0.22, 0.345] // #9A3858

const AMBIENT_HALO = [
  { pos: 0, c: AURA_PALE, a: 0.5 },
  { pos: 0.4, c: AURA_PINK, a: 0.26 },
  { pos: 1, c: HALO_PEACH, a: 0 },
]

const EASE_IO = { o: { x: [0.33], y: [0] }, i: { x: [0.67], y: [1] } }
const EASE_SNAP = { o: { x: [0.16], y: [1] }, i: { x: [0.3], y: [1] } }

// ── shape/gradient builders (same vocabulary as the fireworks generator) ──
function gradStops(stops) {
  const colors = []
  const ops = []
  for (const s of stops) {
    colors.push(s.pos, s.c[0], s.c[1], s.c[2])
    ops.push(s.pos, s.a)
  }
  return { p: stops.length, k: colors.concat(ops) }
}
function radialFill(stops, radius) {
  const g = gradStops(stops)
  return {
    ty: 'gf',
    o: { a: 0, k: 100 },
    r: 1,
    bm: 0,
    g: { p: g.p, k: { a: 0, k: g.k } },
    t: 2,
    s: { a: 0, k: [0, 0] },
    e: { a: 0, k: [radius, 0] },
    h: { a: 0, k: 0 },
    a: { a: 0, k: 0 },
  }
}
function solidFill(color) {
  return { ty: 'fl', c: { a: 0, k: [...color, 1] }, o: { a: 0, k: 100 }, r: 1 }
}
function ellipse(size) {
  return { ty: 'el', d: 1, s: { a: 0, k: [size, size] }, p: { a: 0, k: [0, 0] } }
}
function star4(outerR, innerR) {
  return {
    ty: 'sr',
    sy: 1,
    d: 1,
    p: { a: 0, k: [0, 0] },
    or: { a: 0, k: outerR },
    ir: { a: 0, k: innerR },
    pt: { a: 0, k: 4 },
    r: { a: 0, k: 0 },
    os: { a: 0, k: 0 },
    is: { a: 0, k: 0 },
  }
}
function shapeTransform() {
  return {
    ty: 'tr',
    p: { a: 0, k: [0, 0] },
    a: { a: 0, k: [0, 0] },
    s: { a: 0, k: [100, 100] },
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
  }
}
function group(items) {
  return { ty: 'gr', it: [...items, shapeTransform()] }
}
let ind = 0
function layer(name, ks, shapes) {
  return { ddd: 0, ind: ind++, ty: 4, nm: name, sr: 1, ks, ao: 0, shapes, ip: 0, op: LOOP, st: 0, bm: 0 }
}

// Seamless scalar oscillation between lo↔hi over `cycles` full cycles,
// returning to its start value at t=LOOP. startHi flips the phase.
function oscK(cycles, lo, hi, startHi) {
  const segs = cycles * 2 // lo→hi→lo per cycle = 2 segments; even → seamless
  const k = []
  for (let i = 0; i <= segs; i++) {
    const t = Math.round((LOOP / segs) * i)
    const hiHere = startHi ? i % 2 === 0 : i % 2 === 1
    const v = hiHere ? hi : lo
    k.push(i === segs ? { t, s: [v] } : { t, s: [v], ...EASE_IO })
  }
  return { a: 1, k }
}

const A = [] // dust
const B = [] // shimmer
const C = [] // glints
const D = [] // traveling brilliance
const F = [] // nebula wash

// ── A · Drifting star dust (24) — float + breathe, seamless ──
for (let i = 0; i < 24; i++) {
  const angle = rand() * Math.PI * 2
  const radius = 80 + rand() * 85 // ring r 80–165 (centre left to breathe)
  const bx = CX + Math.cos(angle) * radius
  const by = CY + Math.sin(angle) * radius
  const tier = rand()
  const coreD = tier < 0.25 ? 2.2 : tier < 0.5 ? 1.6 : tier < 0.75 ? 1.1 : 0.7
  const haloD = tier < 0.25 ? 14 : tier < 0.5 ? 9 : tier < 0.75 ? 6 : 4
  // gentle tangential float (out-and-back over the loop → seamless)
  const driftMag = 4 + rand() * 5
  const dx = -Math.sin(angle) * driftMag
  const dy = Math.cos(angle) * driftMag
  const cycles = rand() < 0.5 ? 1 : 2
  const startHi = rand() < 0.5
  const ks = {
    o: oscK(cycles, 22, 70, startHi),
    r: { a: 0, k: 0 },
    p: {
      a: 1,
      k: [
        { t: 0, s: [bx, by, 0], ...EASE_IO, to: [0, 0, 0], ti: [0, 0, 0] },
        { t: LOOP / 2, s: [bx + dx, by + dy, 0], ...EASE_IO, to: [0, 0, 0], ti: [0, 0, 0] },
        { t: LOOP, s: [bx, by, 0] },
      ],
    },
    a: { a: 0, k: [0, 0, 0] },
    s: { a: 0, k: [100, 100, 100] },
  }
  A.push(layer(`dust${i}`, ks, [group([ellipse(haloD), radialFill(AMBIENT_HALO, haloD / 2)]), group([ellipse(coreD), solidFill(PINK_CORE)])]))
}

// ── B · Accretion-disk shimmer — a breathing RING of glow (centre stays
//    transparent so the black-hole PNG shows). 2 sub-cycles per master. ──
B.push(
  layer(
    'shimmer',
    {
      o: oscK(2, 60, 100, false),
      r: { a: 0, k: 0 },
      p: { a: 0, k: [CX, CY, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: {
        a: 1,
        k: [
          { t: 0, s: [96, 96, 100], ...EASE_IO },
          { t: 135, s: [106, 106, 100], ...EASE_IO },
          { t: 270, s: [96, 96, 100], ...EASE_IO },
          { t: 405, s: [106, 106, 100], ...EASE_IO },
          { t: LOOP, s: [96, 96, 100] },
        ],
      },
    },
    [
      group([
        ellipse(300),
        radialFill(
          [
            { pos: 0, c: PLASMA_RIM, a: 0 },
            { pos: 0.42, c: PLASMA_RIM, a: 0 },
            { pos: 0.6, c: HALO_PEACH, a: 0.22 },
            { pos: 0.78, c: MAGENTA, a: 0.1 },
            { pos: 1, c: MAGENTA, a: 0 },
          ],
          150,
        ),
      ]),
    ],
  ),
)

// ── C · 4-point glints (5) — staggered pops, off at the loop boundaries ──
const GLINT_POS = [
  [120, 90],
  [95, 210],
  [160, 270],
  [225, 130],
  [70, 140],
]
for (let i = 0; i < GLINT_POS.length; i++) {
  const [gx, gy] = GLINT_POS[i]
  const or = 5 + rand() * 5
  const ir = or * (0.16 + rand() * 0.06)
  const haloD = or * 2.4
  const popAt = 30 + i * 102 // 30,132,234,336,438 — last ends ~508 < 540
  const ks = {
    o: {
      a: 1,
      k: [
        { t: popAt, s: [0], ...EASE_SNAP },
        { t: popAt + 3, s: [100], ...EASE_IO },
        { t: popAt + 9, s: [30], ...EASE_IO },
        { t: popAt + 13, s: [95], ...EASE_IO },
        { t: popAt + 22, s: [0] },
      ],
    },
    r: {
      a: 1,
      k: [
        { t: popAt, s: [0], ...EASE_IO },
        { t: popAt + 22, s: [32] },
      ],
    },
    p: { a: 0, k: [gx, gy, 0] },
    a: { a: 0, k: [0, 0, 0] },
    s: {
      a: 1,
      k: [
        { t: popAt, s: [0, 0, 100], ...EASE_SNAP },
        { t: popAt + 3, s: [130, 130, 100], ...EASE_IO },
        { t: popAt + 22, s: [80, 80, 100] },
      ],
    },
  }
  C.push(layer(`glint${i}`, ks, [group([ellipse(haloD), radialFill(AMBIENT_HALO, haloD / 2)]), group([star4(or, ir), solidFill(PINK_CORE)])]))
}

// ── D · One travelling brilliance — orbits the main ring once per loop ──
{
  const rx = 150
  const ry = 134
  const N = 12
  const pK = []
  for (let i = 0; i <= N; i++) {
    const t = Math.round((LOOP / N) * i)
    const a = (i / N) * Math.PI * 2 - Math.PI / 2 // start at top
    const x = CX + Math.cos(a) * rx
    const y = CY + Math.sin(a) * ry
    pK.push(i === N ? { t, s: [x, y, 0] } : { t, s: [x, y, 0], ...EASE_IO, to: [0, 0, 0], ti: [0, 0, 0] })
  }
  // brighter on the front (bottom) arc, dimmer behind the BH (top)
  const oK = [
    { t: 0, s: [15], ...EASE_IO },
    { t: LOOP / 4, s: [70], ...EASE_IO },
    { t: LOOP / 2, s: [80], ...EASE_IO },
    { t: (3 * LOOP) / 4, s: [70], ...EASE_IO },
    { t: LOOP, s: [15] },
  ]
  D.push(
    layer(
      'travel',
      { o: { a: 1, k: oK }, r: { a: 0, k: 0 }, p: { a: 1, k: pK }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
      [group([ellipse(11), radialFill(AMBIENT_HALO, 5.5)]), group([ellipse(2), solidFill(PINK_CORE)])],
    ),
  )
}

// ── F · Nebula breath — faint magenta wash, off-centre up-left, 1 slow cycle ──
F.push(
  layer(
    'nebula',
    {
      o: oscK(1, 38, 66, false),
      r: { a: 0, k: 0 },
      p: { a: 0, k: [148, 150, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    [
      group([
        ellipse(300),
        radialFill(
          [
            { pos: 0, c: MAGENTA, a: 0.05 },
            { pos: 0.6, c: PLASMA_RIM, a: 0.025 },
            { pos: 1, c: MAGENTA, a: 0 },
          ],
          150,
        ),
      ]),
    ],
  ),
)

// Layer order (index 0 = TOP): glints, travel, dust, shimmer, nebula (back).
const layers = [...C, ...D, ...A, ...B, ...F]
layers.forEach((l, i) => (l.ind = i))

const lottie = { v: '5.7.4', fr: FR, ip: 0, op: LOOP, w: W, h: H, nm: 'month-sky-ambient', ddd: 0, assets: [], layers }

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(lottie))
console.log(`[lottie] wrote ${OUT} — ${layers.length} layers, loop ${(LOOP / FR).toFixed(1)}s @ ${FR}fps`)
