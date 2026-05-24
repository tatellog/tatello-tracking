import { Circle, Ellipse, G, Path } from 'react-native-svg'

import { colors } from '@/theme'

/*
 * Static layers of the orbital constellation
 * (orbital_constellation_no_labels.svg). Source viewBox 1200 × 1200.
 *
 * Split into Back + Front so AnimatedConstellation can interleave
 * its rotating orbital ellipses + curves between them, matching the
 * source SVG's z-order:
 *
 *   1. outer guides + core axes  (Back)
 *   2. orbital ellipses + curves (AnimatedConstellation, rotating)
 *   3. central rings + node rings + glows + orbit points + micro-stars (Front)
 *   4. dimension star nodes      (StarNode / DecorativeStar in OrbitalSystem)
 *
 * The SVG's `star-nodes` group is NOT rendered here — the app's
 * StarNode (interactive) + DecorativeStar (centre) handle every
 * luminous point. Everything else is painted with `colors.magenta`
 * at varied opacities so the figure sits inside STELAR's palette
 * while preserving the source structure.
 */

const STROKE = colors.magenta

export function ConstellationDrawingBack() {
  return (
    <>
      {/* Outer dotted orbital guides — three concentric-ish shells
          drawn in a thin dashed line so they read as ambient
          scaffolding rather than as visible orbits. */}
      <G
        stroke={STROKE}
        fill="none"
        strokeWidth={1.15}
        strokeLinecap="round"
        strokeDasharray="2 8"
        opacity={0.28}
      >
        <Circle cx={600} cy={600} r={455} />
        <Circle cx={600} cy={600} r={335} />
        <Ellipse cx={600} cy={600} rx={420} ry={250} transform="rotate(-19 600 600)" />
      </G>
      {/* Core axes — vertical, horizontal, and two diagonals. The
          compass cross of the astrolabe. */}
      <G stroke={STROKE} fill="none" strokeWidth={1} strokeLinecap="round" opacity={0.22}>
        <Path d="M600 120 L600 1080" />
        <Path d="M120 600 L1080 600" />
        <Path d="M260 940 L940 260" />
        <Path d="M260 260 L940 940" />
      </G>
      {/* Constellation outline — a thin hexagonal line that passes
          EXACTLY through the six dimension nodes. Makes the stars
          read as anchored points of a single figure rather than
          drifting bodies near the orbital scaffold. Drawn here in
          Back so the stars + orbits render on top. */}
      <G stroke={STROKE} fill="none" strokeWidth={1.4} strokeLinecap="round" opacity={0.38}>
        <Path d="M 600 185 L 1020 455 L 890 885 L 600 1035 L 310 885 L 180 455 Z" />
      </G>
    </>
  )
}

// Six dimension node positions + the centre. Used by the Front
// layer to draw their rings, glows, and compass-tick markers.
const NODE_POS = [
  { x: 600, y: 185 }, // mente (top)
  { x: 180, y: 455 }, // cuerpo (upper-left)
  { x: 1020, y: 455 }, // sueno (upper-right)
  { x: 310, y: 885 }, // energia (lower-left)
  { x: 890, y: 885 }, // alimento (lower-right)
  { x: 600, y: 1035 }, // ciclo (bottom)
] as const

// 17 small "orbit point" dots — minor planet markers scattered
// along the orbital paths. 10 brighter (`tiny`, opacity 0.7),
// 7 fainter (`tiny-soft`, opacity 0.38).
const ORBIT_POINTS: { x: number; y: number; r: number; op: number }[] = [
  { x: 760, y: 250, r: 7, op: 0.7 },
  { x: 745, y: 350, r: 5, op: 0.7 },
  { x: 835, y: 415, r: 7, op: 0.7 },
  { x: 930, y: 322, r: 5, op: 0.7 },
  { x: 450, y: 448, r: 5, op: 0.7 },
  { x: 520, y: 510, r: 6, op: 0.7 },
  { x: 385, y: 735, r: 7, op: 0.7 },
  { x: 695, y: 735, r: 5, op: 0.7 },
  { x: 720, y: 820, r: 7, op: 0.7 },
  { x: 790, y: 885, r: 5, op: 0.7 },
  { x: 270, y: 298, r: 3, op: 0.38 },
  { x: 935, y: 252, r: 3, op: 0.38 },
  { x: 1058, y: 790, r: 3, op: 0.38 },
  { x: 178, y: 790, r: 3, op: 0.38 },
  { x: 468, y: 930, r: 3, op: 0.38 },
  { x: 350, y: 570, r: 3, op: 0.38 },
  { x: 980, y: 590, r: 3, op: 0.38 },
]

// 7 tiny four-point stars used as decorative micro-stars in the
// surrounding field. Just path data + opacity.
const MICRO_STARS: { d: string; op: number }[] = [
  { d: 'M238 245 L243 257 L256 262 L243 267 L238 280 L233 267 L220 262 L233 257 Z', op: 0.75 },
  { d: 'M960 248 L965 260 L978 265 L965 270 L960 283 L955 270 L942 265 L955 260 Z', op: 0.65 },
  {
    d: 'M1080 780 L1086 794 L1100 800 L1086 806 L1080 820 L1074 806 L1060 800 L1074 794 Z',
    op: 0.65,
  },
  { d: 'M205 760 L211 774 L225 780 L211 786 L205 800 L199 786 L185 780 L199 774 Z', op: 0.65 },
  { d: 'M320 330 L324 339 L334 343 L324 347 L320 357 L316 347 L306 343 L316 339 Z', op: 0.45 },
  { d: 'M840 300 L844 309 L854 313 L844 317 L840 327 L836 317 L826 313 L836 309 Z', op: 0.45 },
  { d: 'M515 260 L519 269 L529 273 L519 277 L515 287 L511 277 L501 273 L511 269 Z', op: 0.45 },
]

export function ConstellationDrawingFront() {
  return (
    <>
      {/* The central-astrolabe rings (five concentric circles at
          r = 36/62/90/122/158 around the system centre) were
          removed — they all fell INSIDE the DecorativeStar's lens-
          flare radius and combined with it to look like a rifle-
          scope reticle around the central node. The orbital
          ellipses + axis cross + outer guides already supply
          enough astrolabe context around the centre. */}

      {/* Per-dimension framing — an inner ring + outer halo + four
          compass-tick markers at each node position. The bright
          StarNode lands inside this frame; the rings give every
          luminous point a small astrolabe medallion behind it. */}
      <G stroke={STROKE} fill="none" strokeWidth={1.2} opacity={0.55}>
        {NODE_POS.map((p, i) => (
          <Circle key={`nr-${i}`} cx={p.x} cy={p.y} r={i === 5 ? 42 : 48} />
        ))}
      </G>
      <G stroke={STROKE} fill="none" strokeWidth={1.2} opacity={0.25}>
        {NODE_POS.map((p, i) => (
          <Circle key={`nro-${i}`} cx={p.x} cy={p.y} r={i === 5 ? 62 : 72} />
        ))}
      </G>
      {/* Compass ticks — four short strokes at the cardinal
          directions of each node, like astrolabe degree markers.
          The expressions adapt to each node position; only the top
          (mente) and bottom (ciclo) use the vertical version while
          the left/right pairs use horizontal ones. */}
      <G stroke={STROKE} fill="none" strokeWidth={1.2} opacity={0.55}>
        <Path d="M600 105 L600 145 M600 225 L600 265" />
        <Path d="M140 455 L100 455 M220 455 L260 455" />
        <Path d="M980 455 L940 455 M1060 455 L1100 455" />
        <Path d="M270 885 L230 885 M350 885 L390 885" />
        <Path d="M850 885 L810 885 M930 885 L970 885" />
        <Path d="M600 963 L600 993 M600 1075 L600 1110" />
      </G>

      {/* Soft node glows — a magenta-tint pad under each node so the
          luminous star StarNode draws sits on a warm shadow. The
          centre gets two pads (a wider soft + a smaller mid). */}
      <G fill={STROKE}>
        {NODE_POS.map((p, i) => (
          <Circle key={`ng-${i}`} cx={p.x} cy={p.y} r={i === 5 ? 56 : 64} opacity={0.16} />
        ))}
        <Circle cx={600} cy={600} r={88} opacity={0.16} />
        <Circle cx={600} cy={600} r={42} opacity={0.28} />
      </G>

      {/* Orbit-point dots — tiny markers along the orbits, like
          minor planets or punctuation in the figure. */}
      <G fill={STROKE}>
        {ORBIT_POINTS.map((p, i) => (
          <Circle key={`op-${i}`} cx={p.x} cy={p.y} r={p.r} opacity={p.op} />
        ))}
      </G>

      {/* Decorative micro-stars — small 4-point stars in the
          ambient field. Lower opacity than the orbit dots. */}
      <G fill={STROKE}>
        {MICRO_STARS.map((s, i) => (
          <Path key={`ms-${i}`} d={s.d} opacity={s.op} />
        ))}
      </G>
    </>
  )
}
