/*
 * Generates assets/lottie/auth-hero-glow.json — the celestial GLOW behind
 * the auth north-star (BrandAnchor.tsx). Replaces the old flat oro disc
 * (a filled View read as an opaque mauve puck) with REAL light: layered
 * radial-gradient blooms that breathe, plus oro dust orbiting the star and
 * a few staggered 4-point glints (the Genshin signature).
 *
 * Same recipe + helpers as gen-cycle-ring-glow.mjs, but in ORO (not the
 * cycle silver-blue) and as a CENTRED bloom (not a ring). Scoped behind the
 * hero only — never full-screen — so the TTI cost is a single small player.
 * Lottie renders gradients NATIVELY → no iOS alpha-RadialGradient bug (the
 * one CycleRing dodges with concentric strokes).
 *
 * SEAMLESS: every animated property returns to its t=0 value at t=LOOP.
 * Oro only — no magenta, to respect the 2-accent ceiling (the CTA owns one).
 *
 * Run:  node scripts/gen-auth-hero-glow.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = `${__dirname}/../assets/lottie/auth-hero-glow.json`

// Square canvas, generous margin so the bloom + orbit dust never clip.
const W = 260
const H = 260
const CX = W / 2
const CY = H / 2
const FR = 30
const LOOP = 420 // 14 s @ 30fps — calm master breath, slower than the ring

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

// Oro light ramp (theme oro* + hot-white) as Lottie [r,g,b].
const WHITE_HOT = [1, 0.992, 0.961] // #FFFDF5
const ORO_LECHE = [1, 0.965, 0.898] // #FFF6E5
const ORO_LIGHT = [1, 0.914, 0.761] // #FFE9C2
const ORO_SOFT = [0.91, 0.722, 0.447] // #E8B872
const ORO = [0.851, 0.682, 0.435] // #D9AE6F

// Halo for the orbiting motes — warm-pale centre fading to oro alpha 0.
const MOTE_HALO = [
  { pos: 0, c: ORO_LECHE, a: 0.6 },
  { pos: 0.4, c: ORO_LIGHT, a: 0.28 },
  { pos: 1, c: ORO, a: 0 },
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
// Seamless scale oscillation (3-axis) lo↔hi, two beats per loop.
function scaleOsc(lo, hi) {
  return {
    a: 1,
    k: [
      { t: 0, s: [lo, lo, 100], ...EASE_IO },
      { t: LOOP / 2, s: [hi, hi, 100], ...EASE_IO },
      { t: LOOP, s: [lo, lo, 100] },
    ],
  }
}

const BACK = [] // core bloom (deepest)
const MID = [] // aura ring
const DUST = [] // orbiting motes
const GLINTS = [] // sharp sparkles (front)

// ── Core bloom (back) — THE glow. A soft oro radial that breathes in
//    scale + opacity. White-hot core → oro alpha 0, so it has no edge: it
//    dissolves into the warm-black sky instead of reading as a disc. ──
BACK.push(
  layer(
    'coreBloom',
    {
      o: oscK(1, 62, 92, false),
      r: { a: 0, k: 0 },
      p: { a: 0, k: [CX, CY, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: scaleOsc(94, 106),
    },
    [
      group([
        ellipse(150),
        radialFill(
          [
            { pos: 0, c: WHITE_HOT, a: 0.55 },
            { pos: 0.18, c: ORO_LECHE, a: 0.4 },
            { pos: 0.5, c: ORO_LIGHT, a: 0.18 },
            { pos: 1, c: ORO, a: 0 },
          ],
          75,
        ),
      ]),
    ],
  ),
)

// ── Aura ring (mid) — a wider, fainter second falloff, phase-offset from
//    the core so the light feels volumetric (double bloom), not a single
//    flat puff. ──
MID.push(
  layer(
    'auraRing',
    {
      o: oscK(1, 28, 50, true),
      r: { a: 0, k: 0 },
      p: { a: 0, k: [CX, CY, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: {
        a: 1,
        k: [
          { t: 0, s: [104, 104, 100], ...EASE_IO },
          { t: LOOP / 2, s: [96, 96, 100], ...EASE_IO },
          { t: LOOP, s: [104, 104, 100] },
        ],
      },
    },
    [
      group([
        ellipse(240),
        radialFill(
          [
            { pos: 0, c: ORO_LIGHT, a: 0.16 },
            { pos: 0.45, c: ORO_SOFT, a: 0.08 },
            { pos: 1, c: ORO, a: 0 },
          ],
          120,
        ),
      ]),
    ],
  ),
)

// ── Orbiting dust (8) — oro motes circling the star on a slow shared
//    rotation (Genshin "light caught in orbit"). Each mote = halo gradient
//    + white-hot core, breathing its own alpha. The whole field is parented
//    to a null-style rotation by placing them on a circle and rotating via
//    a per-mote angular sweep that returns to start at LOOP. ──
const DUST_COUNT = 8
for (let i = 0; i < DUST_COUNT; i++) {
  const a0 = (i / DUST_COUNT) * Math.PI * 2 + rand() * 0.4
  const radius = 58 + rand() * 26 // 58–84, just outside the 64px star
  const tier = rand()
  const coreD = tier < 0.33 ? 1.8 : tier < 0.66 ? 1.2 : 0.8
  const haloD = tier < 0.33 ? 11 : tier < 0.66 ? 7 : 5
  // Slow orbit: a fraction of a full turn over the loop (some CW, some CCW),
  // sampled into keyframes so it returns exactly to a0 at LOOP.
  const dir = rand() < 0.5 ? 1 : -1
  const sweep = (0.25 + rand() * 0.35) * Math.PI * 2 * dir // partial arc
  const STEPS = 6
  const posK = []
  for (let s = 0; s <= STEPS; s++) {
    // out-and-back sweep so it ends where it began (seamless)
    const phase = s <= STEPS / 2 ? s / (STEPS / 2) : (STEPS - s) / (STEPS / 2)
    const ang = a0 + sweep * phase
    const px = CX + Math.cos(ang) * radius
    const py = CY + Math.sin(ang) * radius
    const t = Math.round((LOOP / STEPS) * s)
    posK.push(
      s === STEPS
        ? { t, s: [px, py, 0] }
        : { t, s: [px, py, 0], ...EASE_IO, to: [0, 0, 0], ti: [0, 0, 0] },
    )
  }
  const cycles = rand() < 0.5 ? 1 : 2
  DUST.push(
    layer(
      `dust${i}`,
      {
        o: oscK(cycles, 14, 46, rand() < 0.5),
        r: { a: 0, k: 0 },
        p: { a: 1, k: posK },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      [
        group([ellipse(haloD), radialFill(MOTE_HALO, haloD / 2)]),
        group([ellipse(coreD), solidFill(WHITE_HOT)]),
      ],
    ),
  )
}

// ── Glints (3) — sharp 4-point oro sparkles, staggered, near the star.
//    The Genshin signature. Oro, NOT magenta. ──
const GLINT_POS = [
  [CX + 70, CY - 52],
  [CX - 64, CY + 40],
  [CX + 30, CY + 74],
]
for (let i = 0; i < GLINT_POS.length; i++) {
  const [gx, gy] = GLINT_POS[i]
  const or = 4 + rand() * 2.5
  const ir = or * (0.18 + rand() * 0.05)
  const haloD = or * 2.6
  const popAt = 50 + i * 120 // 50, 170, 290 — last ends before LOOP
  GLINTS.push(
    layer(
      `glint${i}`,
      {
        o: {
          a: 1,
          k: [
            { t: popAt, s: [0], ...EASE_SNAP },
            { t: popAt + 4, s: [90], ...EASE_IO },
            { t: popAt + 12, s: [25], ...EASE_IO },
            { t: popAt + 16, s: [80], ...EASE_IO },
            { t: popAt + 32, s: [0] },
          ],
        },
        r: {
          a: 1,
          k: [
            { t: popAt, s: [0], ...EASE_IO },
            { t: popAt + 32, s: [30] },
          ],
        },
        p: { a: 0, k: [gx, gy, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: popAt, s: [0, 0, 100], ...EASE_SNAP },
            { t: popAt + 4, s: [120, 120, 100], ...EASE_IO },
            { t: popAt + 32, s: [80, 80, 100] },
          ],
        },
      },
      [
        group([ellipse(haloD), radialFill(MOTE_HALO, haloD / 2)]),
        group([star4(or, ir), solidFill(WHITE_HOT)]),
      ],
    ),
  )
}

// Layer order (index 0 = TOP): glints, dust, aura, core bloom (back).
const layers = [...GLINTS, ...DUST, ...MID, ...BACK]
layers.forEach((l, i) => (l.ind = i))

const lottie = { v: '5.7.4', fr: FR, ip: 0, op: LOOP, w: W, h: H, nm: 'auth-hero-glow', ddd: 0, assets: [], layers }

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(lottie))
console.log(`[lottie] wrote ${OUT} — ${layers.length} layers, loop ${(LOOP / FR).toFixed(1)}s @ ${FR}fps`)
