/*
 * Generates assets/lottie/gold-fireworks.json — the Home reward firework.
 *
 * v3 · "Genshin" (illustrator recipe): the jump from flat to magical is
 * GLOW faked with radial gradients. Every spark = a soft gradient HALO
 * (oroLeche→oroLight→oro alpha 0) + a small solid white-hot CORE. Plus a
 * central core-flash + soft bloom (radial gradients), irregular light
 * shafts, and a swarm of glow particles that shoot out, DECELERATE, then
 * float/fade. Lottie renders gradients NATIVELY — no blur needed, no
 * RN-node crash.
 *
 * Run:  node scripts/gen-gold-fireworks-lottie.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = `${__dirname}/../assets/lottie/gold-fireworks.json`

const W = 300
const H = 300
const CX = W / 2
const CY = H / 2
const FR = 60
const OP = 100 // ~1.66 s

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

// Light ramp (theme oro* + a hot-white core).
const WHITE_HOT = [1, 0.992, 0.961] // #FFFDF5
const ORO_LECHE = [1, 0.965, 0.898]
const ORO_LIGHT = [1, 0.914, 0.761]
const ORO_SOFT = [0.91, 0.722, 0.447]
const ORO = [0.851, 0.682, 0.435]
const CORE_TINTS = [WHITE_HOT, WHITE_HOT, ORO_LECHE, ORO_LIGHT]

// Easings. Decel = the Genshin "shoot out then brake" curve.
const EASE_DECEL = { o: { x: [0.1], y: [0.85] }, i: { x: [0.25], y: [1] } }
const EASE_SNAP = { o: { x: [0.16], y: [1] }, i: { x: [0.3], y: [1] } }
const EASE_IO = { o: { x: [0.33], y: [0] }, i: { x: [0.67], y: [1] } }

// ── gradient builders ──
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
function linearFill(stops, x1, y1, x2, y2) {
  const g = gradStops(stops)
  return {
    ty: 'gf',
    o: { a: 0, k: 100 },
    r: 1,
    bm: 0,
    g: { p: g.p, k: { a: 0, k: g.k } },
    t: 1,
    s: { a: 0, k: [x1, y1] },
    e: { a: 0, k: [x2, y2] },
  }
}
function solidFill(color) {
  return { ty: 'fl', c: { a: 0, k: [...color, 1] }, o: { a: 0, k: 100 }, r: 1 }
}
function ellipse(size) {
  return { ty: 'el', d: 1, s: { a: 0, k: [size, size] }, p: { a: 0, k: [0, 0] } }
}
function rect(w, h, off) {
  return { ty: 'rc', d: 1, s: { a: 0, k: [w, h] }, p: { a: 0, k: off ?? [0, 0] }, r: { a: 0, k: w / 2 } }
}
// 4-point star (the sharp Genshin sparkle): outer radius = the spike tip,
// a small inner radius makes the spikes thin + pointy.
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
  return { ddd: 0, ind: ind++, ty: 4, nm: name, sr: 1, ks, ao: 0, shapes, ip: 0, op: OP, st: 0, bm: 0 }
}
function staticP(x, y) {
  return { a: 0, k: [x, y, 0] }
}

const HALO_STOPS = [
  { pos: 0, c: ORO_LECHE, a: 0.6 },
  { pos: 0.35, c: ORO_LIGHT, a: 0.32 },
  { pos: 1, c: ORO, a: 0 },
]

const topLayers = [] // cores + glitter (front)
const midLayers = [] // halos + shafts + flash
const backLayers = [] // bloom (back)

// ── Soft bloom (back) — the atmosphere of the burst ──
backLayers.push(
  layer(
    'bloom',
    {
      o: {
        a: 1,
        k: [
          { t: 0, s: [0], ...EASE_IO },
          { t: 8, s: [45], ...EASE_IO },
          { t: 54, s: [0] },
        ],
      },
      r: { a: 0, k: 0 },
      p: staticP(CX, CY),
      a: { a: 0, k: [0, 0, 0] },
      s: {
        a: 1,
        k: [
          { t: 0, s: [20, 20, 100], ...EASE_DECEL },
          { t: 54, s: [118, 118, 100] },
        ],
      },
    },
    [
      group([
        ellipse(180),
        radialFill(
          [
            { pos: 0, c: ORO_LIGHT, a: 0.4 },
            { pos: 0.5, c: ORO_SOFT, a: 0.18 },
            { pos: 1, c: ORO, a: 0 },
          ],
          90,
        ),
      ]),
    ],
  ),
)

// ── Gold wash (deepest back) — a soft golden glow that bathes the whole
//    card during the burst and fades out. Large radial, low opacity, so it
//    tints the background warm without washing out the lion art. ──
backLayers.push(
  layer(
    'goldWash',
    {
      o: {
        a: 1,
        k: [
          { t: 0, s: [0], ...EASE_IO },
          { t: 7, s: [100], ...EASE_IO },
          { t: 58, s: [100], ...EASE_IO },
          { t: 90, s: [0] },
        ],
      },
      r: { a: 0, k: 0 },
      p: staticP(CX, CY),
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    [
      group([
        ellipse(380),
        radialFill(
          [
            { pos: 0, c: ORO_SOFT, a: 0.3 },
            { pos: 0.55, c: ORO, a: 0.16 },
            { pos: 1, c: ORO, a: 0 },
          ],
          190,
        ),
      ]),
    ],
  ),
)

// ── Core flash (mid) — the punch ──
midLayers.push(
  layer(
    'coreFlash',
    {
      o: {
        a: 1,
        k: [
          { t: 0, s: [0], ...EASE_SNAP },
          { t: 4, s: [100], ...EASE_IO },
          { t: 10, s: [90], ...EASE_IO },
          { t: 28, s: [0] },
        ],
      },
      r: { a: 0, k: 0 },
      p: staticP(CX, CY),
      a: { a: 0, k: [0, 0, 0] },
      s: {
        a: 1,
        k: [
          { t: 0, s: [0, 0, 100], ...EASE_SNAP },
          { t: 4, s: [130, 130, 100], ...EASE_IO },
          { t: 10, s: [100, 100, 100], ...EASE_IO },
          { t: 28, s: [100, 100, 100] },
        ],
      },
    },
    [
      group([
        ellipse(90),
        radialFill(
          [
            { pos: 0, c: WHITE_HOT, a: 1 },
            { pos: 0.25, c: ORO_LECHE, a: 0.85 },
            { pos: 0.55, c: ORO_LIGHT, a: 0.35 },
            { pos: 1, c: ORO, a: 0 },
          ],
          45,
        ),
      ]),
    ],
  ),
)

// ── Light shafts (mid) — 6 irregular rays that grow then retract ──
const SHAFT_ANGLES = [4, 58, 118, 165, 212, 290]
for (let i = 0; i < SHAFT_ANGLES.length; i++) {
  const angleDeg = SHAFT_ANGLES[i] + (rand() - 0.5) * 14
  const len = 72 + rand() * 42 // 72–114
  const thick = 3 + rand() * 2
  // Shaft built along +X from origin; layer rotation aims it; linear
  // gradient bright at base (center) → alpha 0 at the tip.
  const shaftGroup = group([
    rect(len, thick, [len / 2, 0]),
    linearFill(
      [
        { pos: 0, c: WHITE_HOT, a: 0.9 },
        { pos: 0.3, c: ORO_LECHE, a: 0.5 },
        { pos: 1, c: ORO_LIGHT, a: 0 },
      ],
      0,
      0,
      len,
      0,
    ),
  ])
  midLayers.push(
    layer(
      `shaft${i}`,
      {
        o: {
          a: 1,
          k: [
            { t: 0, s: [0], ...EASE_SNAP },
            { t: 5, s: [85], ...EASE_IO },
            { t: 9, s: [85], ...EASE_IO },
            { t: 24, s: [0] },
          ],
        },
        r: { a: 0, k: angleDeg },
        p: staticP(CX, CY),
        a: { a: 0, k: [0, 0, 0] },
        // grow length out from the centre (scaleX), then settle
        s: {
          a: 1,
          k: [
            { t: 0, s: [0, 100, 100], ...EASE_SNAP },
            { t: 6, s: [110, 100, 100], ...EASE_IO },
            { t: 24, s: [92, 100, 100] },
          ],
        },
      },
      [shaftGroup],
    ),
  )
}

// ── Glow particles (28) — halo (gradient) + hot core, irregular, decel.
//    Now with a TINY-star tier so sizes vary from big glowy orbs to small
//    points (the swarm felt too uniform). ──
const PCOUNT = 28
for (let i = 0; i < PCOUNT; i++) {
  const angle = (i / PCOUNT) * Math.PI * 2 + (rand() - 0.5) * 0.63 // ±18°
  const reach = 76 + rand() * 62 // 76–138
  const ex = CX + Math.cos(angle) * reach
  const ey = CY + Math.sin(angle) * reach
  const tier = rand()
  // 25% big · 25% medium · 25% small · 25% tiny
  const coreD = tier < 0.25 ? 5 : tier < 0.5 ? 3.8 : tier < 0.75 ? 2.4 : 1.6
  const haloD = tier < 0.25 ? 22 : tier < 0.5 ? 15 : tier < 0.75 ? 9 : 6
  const coreColor = CORE_TINTS[Math.floor(rand() * CORE_TINTS.length)]
  const arrive = 26 + Math.floor(rand() * 10) // decelerate by here
  const fadeOut = 62 + Math.floor(rand() * 26) // staggered death
  // float/fall after arrival
  const driftX = (rand() - 0.5) * 12
  const fall = 10 + rand() * 14
  const opK = [
    { t: 2, s: [0], ...EASE_IO },
    { t: 5, s: [100], ...EASE_IO },
    { t: Math.min(fadeOut - 8, 50), s: [85], ...EASE_IO },
    { t: fadeOut, s: [0] },
  ]
  const posK = [
    { t: 2, s: [CX, CY, 0], ...EASE_DECEL, to: [0, 0, 0], ti: [0, 0, 0] },
    { t: arrive, s: [ex, ey, 0], o: { x: [0.4], y: [0] }, i: { x: [0.4], y: [1] }, to: [0, 0, 0], ti: [0, 0, 0] },
    { t: fadeOut, s: [ex + driftX, ey + fall, 0] },
  ]
  const halo = layer(
    `halo${i}`,
    { o: { a: 1, k: opK }, r: { a: 0, k: 0 }, p: { a: 1, k: posK }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
    [group([ellipse(haloD), radialFill(HALO_STOPS, haloD / 2)])],
  )
  midLayers.push(halo)
  // core shares the SAME motion (own layer so all cores sit on top)
  const coreOpK = [
    { t: 2, s: [0], ...EASE_IO },
    { t: 5, s: [100], ...EASE_IO },
    { t: Math.min(fadeOut - 6, 52), s: [90], ...EASE_IO },
    { t: fadeOut, s: [0] },
  ]
  const core = layer(
    `core${i}`,
    { o: { a: 1, k: coreOpK }, r: { a: 0, k: 0 }, p: { a: 1, k: posK }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
    [group([ellipse(coreD), solidFill(coreColor)])],
  )
  topLayers.push(core)
}

// ── Glitter (12) — tiny glow dots that twinkle late, filling gaps ──
const GCOUNT = 12
for (let i = 0; i < GCOUNT; i++) {
  const angle = rand() * Math.PI * 2
  const dist = 46 + rand() * 78
  const gx = CX + Math.cos(angle) * dist
  const gy = CY + Math.sin(angle) * dist
  const popAt = 24 + Math.floor(rand() * 40)
  const coreD = 2 + rand() * 1.6
  const haloD = 7 + rand() * 4
  const opK = [
    { t: popAt, s: [0], ...EASE_IO },
    { t: popAt + 3, s: [100], ...EASE_IO },
    { t: popAt + 7, s: [25], ...EASE_IO },
    { t: popAt + 11, s: [90], ...EASE_IO },
    { t: popAt + 18, s: [0] },
  ]
  topLayers.push(
    layer(
      `glit${i}`,
      { o: { a: 1, k: opK }, r: { a: 0, k: 0 }, p: staticP(gx, gy), a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
      [
        group([ellipse(haloD), radialFill(HALO_STOPS, haloD / 2)]),
        group([ellipse(coreD), solidFill(WHITE_HOT)]),
      ],
    ),
  )
}

// ── Star glints (7) — sharp 4-point sparkles, the Genshin signature.
//    Bright white star + a tiny halo, popping/twinkling at staggered times
//    with a slow rotation shimmer. On top of everything. ──
const SPARKLE_COUNT = 7
for (let i = 0; i < SPARKLE_COUNT; i++) {
  const angle = rand() * Math.PI * 2
  const dist = 38 + rand() * 88
  const sx = CX + Math.cos(angle) * dist
  const sy = CY + Math.sin(angle) * dist
  const or = 7 + rand() * 7 // 7–14 spike length
  const ir = or * (0.16 + rand() * 0.08) // thin, pointy spikes
  const popAt = 6 + Math.floor(rand() * 56)
  const haloD = or * 2.4
  const opK = [
    { t: popAt, s: [0], ...EASE_SNAP },
    { t: popAt + 3, s: [100], ...EASE_IO },
    { t: popAt + 9, s: [35], ...EASE_IO },
    { t: popAt + 13, s: [95], ...EASE_IO },
    { t: popAt + 22, s: [0] },
  ]
  topLayers.push(
    layer(
      `sparkle${i}`,
      {
        o: { a: 1, k: opK },
        r: {
          a: 1,
          k: [
            { t: popAt, s: [0], ...EASE_IO },
            { t: popAt + 22, s: [35] },
          ],
        },
        p: staticP(sx, sy),
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: popAt, s: [0, 0, 100], ...EASE_SNAP },
            { t: popAt + 3, s: [130, 130, 100], ...EASE_IO },
            { t: popAt + 22, s: [80, 80, 100] },
          ],
        },
      },
      [
        group([ellipse(haloD), radialFill(HALO_STOPS, haloD / 2)]),
        group([star4(or, ir), solidFill(WHITE_HOT)]),
      ],
    ),
  )
}

// Layer order: index 0 = TOP. Cores/glitter on top, then halos/shafts/flash,
// then bloom at the very back.
const layers = [...topLayers, ...midLayers, ...backLayers]
// Re-index after concatenation so `ind` is sequential top→bottom.
layers.forEach((l, i) => (l.ind = i))

const lottie = { v: '5.7.4', fr: FR, ip: 0, op: OP, w: W, h: H, nm: 'gold-fireworks', ddd: 0, assets: [], layers }

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(lottie))
console.log(`[lottie] wrote ${OUT} — ${layers.length} layers (glow), ${(OP / FR).toFixed(2)}s`)
