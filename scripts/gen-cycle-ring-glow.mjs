/*
 * Generates assets/lottie/cycle-ring-glow.json — a SUBTLE, looping
 * Genshin-style ambient glow that sits BEHIND the cycle orbital ring
 * (CycleRing.tsx). The ring itself (arcs + traveling moon) is Reanimated
 * SVG on top; this layer only adds depth: a faint breathing halo around
 * the ring radius, a handful of drifting cool dust motes, and a couple of
 * slow gold glints. Cool silver-blue + oro palette (the cycle dimension),
 * NOT the magenta/peach of the Mes sky. Deliberately quiet so it never
 * competes with the lit arc or the moon.
 *
 * SEAMLESS: every animated property returns to its t=0 value at t=LOOP.
 *
 * Run:  node scripts/gen-cycle-ring-glow.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = `${__dirname}/../assets/lottie/cycle-ring-glow.json`

const W = 200
const H = 200
const CX = W / 2
const CY = H / 2
const FR = 30
const LOOP = 480 // 16 s @ 30fps — calm master loop

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

// Cycle palette (cool silver-blue + oro) as Lottie [r,g,b].
const WHITE = [1, 1, 1]
const CICLO = [0.71, 0.769, 0.867] // #B5C4DD
const ORO = [0.851, 0.682, 0.435] // #D9AE6F
const ORO_LECHE = [1, 0.965, 0.898] // #FFF6E5

// Halo for the drifting motes — warm-pale centre fading into cool.
const MOTE_HALO = [
  { pos: 0, c: ORO_LECHE, a: 0.5 },
  { pos: 0.45, c: CICLO, a: 0.22 },
  { pos: 1, c: CICLO, a: 0 },
]

const EASE_IO = { o: { x: [0.33], y: [0] }, i: { x: [0.67], y: [1] } }
const EASE_SNAP = { o: { x: [0.16], y: [1] }, i: { x: [0.3], y: [1] } }

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

// Seamless scalar oscillation lo↔hi over `cycles` full cycles.
function oscK(cycles, lo, hi, startHi) {
  const segs = cycles * 2
  const k = []
  for (let i = 0; i <= segs; i++) {
    const t = Math.round((LOOP / segs) * i)
    const hiHere = startHi ? i % 2 === 0 : i % 2 === 1
    const v = hiHere ? hi : lo
    k.push(i === segs ? { t, s: [v] } : { t, s: [v], ...EASE_IO })
  }
  return { a: 1, k }
}

const DUST = []
const WASH = []
const GLINTS = []

// ── Breathing halo ring — a faint cool glow around the ring radius. The
//    centre is transparent so the ring's day/phase text stays clean. ──
WASH.push(
  layer(
    'halo',
    {
      o: oscK(2, 50, 85, false),
      r: { a: 0, k: 0 },
      p: { a: 0, k: [CX, CY, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: {
        a: 1,
        k: [
          { t: 0, s: [98, 98, 100], ...EASE_IO },
          { t: 120, s: [104, 104, 100], ...EASE_IO },
          { t: 240, s: [98, 98, 100], ...EASE_IO },
          { t: 360, s: [104, 104, 100], ...EASE_IO },
          { t: LOOP, s: [98, 98, 100] },
        ],
      },
    },
    [
      group([
        ellipse(200),
        radialFill(
          [
            { pos: 0, c: CICLO, a: 0 },
            { pos: 0.52, c: CICLO, a: 0 },
            { pos: 0.7, c: CICLO, a: 0.1 },
            { pos: 0.86, c: ORO, a: 0.05 },
            { pos: 1, c: ORO, a: 0 },
          ],
          100,
        ),
      ]),
    ],
  ),
)

// ── Drifting cool dust (12) — float gently out-and-back, breathe alpha ──
for (let i = 0; i < 12; i++) {
  const angle = rand() * Math.PI * 2
  const radius = 52 + rand() * 44 // 52–96, around the ring (r 78)
  const bx = CX + Math.cos(angle) * radius
  const by = CY + Math.sin(angle) * radius
  const tier = rand()
  const coreD = tier < 0.33 ? 1.6 : tier < 0.66 ? 1.1 : 0.7
  const haloD = tier < 0.33 ? 9 : tier < 0.66 ? 6 : 4
  const driftMag = 3 + rand() * 4
  const dx = -Math.sin(angle) * driftMag
  const dy = Math.cos(angle) * driftMag
  const cycles = rand() < 0.5 ? 1 : 2
  const startHi = rand() < 0.5
  const ks = {
    o: oscK(cycles, 12, 40, startHi),
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
  DUST.push(
    layer(`dust${i}`, ks, [
      group([ellipse(haloD), radialFill(MOTE_HALO, haloD / 2)]),
      group([ellipse(coreD), solidFill(WHITE)]),
    ]),
  )
}

// ── Gold glints (3) — slow staggered twinkles near the ring ──
const GLINT_POS = [
  [150, 70],
  [56, 120],
  [120, 156],
]
for (let i = 0; i < GLINT_POS.length; i++) {
  const [gx, gy] = GLINT_POS[i]
  const or = 3.5 + rand() * 2.5
  const ir = or * (0.18 + rand() * 0.05)
  const haloD = or * 2.4
  const popAt = 40 + i * 150 // 40, 190, 340 — last ends well before LOOP
  const ks = {
    o: {
      a: 1,
      k: [
        { t: popAt, s: [0], ...EASE_SNAP },
        { t: popAt + 4, s: [90], ...EASE_IO },
        { t: popAt + 12, s: [25], ...EASE_IO },
        { t: popAt + 16, s: [80], ...EASE_IO },
        { t: popAt + 30, s: [0] },
      ],
    },
    r: {
      a: 1,
      k: [
        { t: popAt, s: [0], ...EASE_IO },
        { t: popAt + 30, s: [28] },
      ],
    },
    p: { a: 0, k: [gx, gy, 0] },
    a: { a: 0, k: [0, 0, 0] },
    s: {
      a: 1,
      k: [
        { t: popAt, s: [0, 0, 100], ...EASE_SNAP },
        { t: popAt + 4, s: [120, 120, 100], ...EASE_IO },
        { t: popAt + 30, s: [80, 80, 100] },
      ],
    },
  }
  GLINTS.push(
    layer(`glint${i}`, ks, [
      group([ellipse(haloD), radialFill(MOTE_HALO, haloD / 2)]),
      group([star4(or, ir), solidFill(ORO_LECHE)]),
    ]),
  )
}

// Layer order (index 0 = TOP): glints, dust, halo (back).
const layers = [...GLINTS, ...DUST, ...WASH]
layers.forEach((l, i) => (l.ind = i))

const lottie = { v: '5.7.4', fr: FR, ip: 0, op: LOOP, w: W, h: H, nm: 'cycle-ring-glow', ddd: 0, assets: [], layers }

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(lottie))
console.log(`[lottie] wrote ${OUT} — ${layers.length} layers, loop ${(LOOP / FR).toFixed(1)}s @ ${FR}fps`)
