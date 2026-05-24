import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { Circle, G, Path } from 'react-native-svg'

import { colors } from '@/theme'

/*
 * Static + lightly-animated layers of the orbital constellation
 * (daily_constellation.svg). Source viewBox 1024 × 1024.
 *
 * Layered for "más volumen + identidad":
 *
 *   Back  — six concentric outer rings + axis cross.
 *   Front — spokes, INNER HEX, central ornament, double-ring node
 *           frames (r=48 + r=64), three groups of beads (perimeter,
 *           spokes, inner hex), cardinal ornaments, corner sparks.
 *
 * The spoke beads pulse in a chase pattern outward from the centre —
 * a small wave of brightness that travels each spoke from centre to
 * vertex, giving the impression that energy is flowing from the
 * "tú" star outward to each dimension.
 */

const STROKE = colors.magenta
const CENTRE = { x: 512, y: 512 }

// Outer hex (1024-space) — passes through the six dimension nodes.
// Order matches CLOCKWISE: top → upper-right → lower-right →
// bottom → lower-left → upper-left.
const HEX_OUTER = [
  { x: 512, y: 210 }, // mente
  { x: 773.5, y: 361 }, // sueno
  { x: 773.5, y: 663 }, // alimento
  { x: 512, y: 814 }, // ciclo
  { x: 250.5, y: 663 }, // energia
  { x: 250.5, y: 361 }, // cuerpo
] as const
const HEX_OUTER_R = 302 // distance from centre to any vertex

// Inner hex — same orientation, ~33 % scale. Sits between the centre
// ornament (r ≈ 66) and the first spoke bead. Reads as the
// "hexagram inside the hexagon" the user asked for to add volume.
const HEX_INNER_R = 100
const HEX_INNER = HEX_OUTER.map((v) => ({
  x: CENTRE.x + (v.x - CENTRE.x) * (HEX_INNER_R / HEX_OUTER_R),
  y: CENTRE.y + (v.y - CENTRE.y) * (HEX_INNER_R / HEX_OUTER_R),
}))
const HEX_INNER_PATH = `M ${HEX_INNER.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`

// Beads collected programmatically. Three groups:
//   • PERIMETER — 5 beads spaced along each outer-hex edge
//                 (30 total). The pearl-strung hex outline.
//   • SPOKE     — 3 beads per spoke between inner-hex vertex and
//                 outer-hex vertex (18 total). Chase-animated.
//   • INNER     — 2 beads per inner-hex edge (12 total).
const PERIMETER_BEADS: { x: number; y: number }[] = HEX_OUTER.flatMap((a, i) => {
  const b = HEX_OUTER[(i + 1) % HEX_OUTER.length]!
  return [1, 2, 3, 4, 5].map((f) => {
    const t = f / 6
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  })
})

// Spoke beads — 3 per spoke at fractions 0.4, 0.58, 0.76. These
// distances sit cleanly OUTSIDE the inner hex (t ≈ 0.33) and well
// INSIDE the outer node ring (t = 1). Stored with their `phase` so
// each one can chase outward on the shared flowClock.
const SPOKE_BEADS: { x: number; y: number; phase: number }[] = []
const SPOKE_FRACTIONS = [0.4, 0.58, 0.76] as const
for (const v of HEX_OUTER) {
  for (const t of SPOKE_FRACTIONS) {
    SPOKE_BEADS.push({
      x: CENTRE.x + (v.x - CENTRE.x) * t,
      y: CENTRE.y + (v.y - CENTRE.y) * t,
      // Closer-to-centre beads light up FIRST; further beads light
      // up after. The phase shift is the bead's fraction divided
      // by 3 (so 0.4 → 0.133, 0.58 → 0.193, 0.76 → 0.253). One
      // clock cycle = energy travels one spoke from centre out.
      phase: t / 3,
    })
  }
}

const INNER_BEADS: { x: number; y: number }[] = HEX_INNER.flatMap((a, i) => {
  const b = HEX_INNER[(i + 1) % HEX_INNER.length]!
  return [1, 2].map((f) => {
    const t = f / 3
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  })
})

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export function ConstellationDrawingBack() {
  return (
    <>
      {/* Six concentric outer rings — the orbital "shells". Stroke
          + opacity ramps so the outer ring reads as the boundary
          and the inner ones fade progressively, building depth. */}
      <G stroke={STROKE} fill="none" strokeLinecap="round">
        <Circle cx={512} cy={512} r={430} strokeWidth={2} />
        <Circle cx={512} cy={512} r={397} strokeWidth={1.2} opacity={0.8} />
        <Circle cx={512} cy={512} r={354} strokeWidth={1} opacity={0.65} />
        <Circle cx={512} cy={512} r={301} strokeWidth={0.9} opacity={0.45} />
        <Circle cx={512} cy={512} r={244} strokeWidth={0.8} opacity={0.35} />
        <Circle cx={512} cy={512} r={185} strokeWidth={0.8} opacity={0.3} />
      </G>
      {/* Axis cross + two diagonals. */}
      <G stroke={STROKE} fill="none" strokeLinecap="round">
        <Path d="M512 57 V967" strokeWidth={1.4} opacity={0.85} />
        <Path d="M57 512 H967" strokeWidth={1.4} opacity={0.85} />
        <Path d="M190.5 190.5 L833.5 833.5" strokeWidth={1} opacity={0.5} />
        <Path d="M833.5 190.5 L190.5 833.5" strokeWidth={1} opacity={0.5} />
      </G>
    </>
  )
}

export function ConstellationDrawingFront({
  flowClock,
}: {
  /** Shared flow clock from AnimatedConstellation. Drives the spoke-
   *  bead chase animation when provided; static if omitted. */
  flowClock?: SharedValue<number>
}) {
  return (
    <>
      {/* Spokes — five lines from the centre out to non-bottom
          nodes. The bottom-spoke path lives in the vertical
          axis already (centre → ciclo). */}
      <G stroke={STROKE} fill="none" strokeLinecap="round" opacity={0.55} strokeWidth={1.2}>
        <Path d="M512 210 L512 512 L773.5 361" />
        <Path d="M512 512 L773.5 663" />
        <Path d="M512 512 L512 814" />
        <Path d="M512 512 L250.5 663" />
        <Path d="M512 512 L250.5 361" />
      </G>

      {/* Inner hex — small hexagon around the centre. Adds the
          "hexagram inside the hexagon" volume the reference shows.
          A thin magenta outline at low opacity; the bright beads
          along it (rendered below) carry the visual weight. */}
      <Path
        d={HEX_INNER_PATH}
        fill="none"
        stroke={STROKE}
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.45}
      />

      {/* Central star ornament — two concentric circles + 4-point
          star + axis stubs. Sits BEHIND the DecorativeStar's
          lens-flare core. */}
      <G stroke={STROKE} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}>
        <Circle cx={512} cy={512} r={66} />
        <Circle cx={512} cy={512} r={43} opacity={0.6} />
        <Path d="M512 427 L527 497 L597 512 L527 527 L512 597 L497 527 L427 512 L497 497 Z" />
        <Path d="M512 466 V558" opacity={0.9} />
        <Path d="M466 512 H558" opacity={0.9} />
      </G>

      {/* Double-ring node frames — an inner ring at r=48 (the
          authored SVG ring) and an OUTER concentric ring at r=64
          that sits just past the edge of StarNode's bloom. The two
          rings together read as a stronger medallion under each
          luminous body, matching the multiple concentric rings the
          reference shows around each node. */}
      <G stroke={STROKE} fill="none" strokeWidth={1.5} opacity={0.55}>
        {HEX_OUTER.map((p, i) => (
          <Circle key={`nr-${i}`} cx={p.x} cy={p.y} r={48} />
        ))}
      </G>
      <G stroke={STROKE} fill="none" strokeWidth={1.1} opacity={0.32}>
        {HEX_OUTER.map((p, i) => (
          <Circle key={`nro-${i}`} cx={p.x} cy={p.y} r={64} />
        ))}
      </G>

      {/* Perimeter beads — 5 spaced along each outer-hex edge. Reads
          like a pearl-strung hexagonal outline (the bright dots in
          the reference's hex perimeter). */}
      <G fill={STROKE}>
        {PERIMETER_BEADS.map((p, i) => (
          <Circle key={`pb-${i}`} cx={p.x} cy={p.y} r={3} opacity={0.72} />
        ))}
      </G>

      {/* Spoke beads — 3 per spoke, chase-animated outward from the
          centre when flowClock is provided. Closer-to-centre beads
          peak FIRST on the cycle; further beads peak after, so a
          wave of brightness sweeps the spoke from "tú" → dimension. */}
      <G fill={STROKE}>
        {SPOKE_BEADS.map((p, i) => (
          <SpokeBead key={`sb-${i}`} cx={p.x} cy={p.y} phase={p.phase} flowClock={flowClock} />
        ))}
      </G>

      {/* Inner-hex beads — 2 per inner-hex edge. */}
      <G fill={STROKE}>
        {INNER_BEADS.map((p, i) => (
          <Circle key={`ib-${i}`} cx={p.x} cy={p.y} r={2.5} opacity={0.5} />
        ))}
      </G>

      {/* Cardinal ornaments — diamond tips + small circles at N/E/S/W
          on the outermost ring. */}
      <G stroke={STROKE} fill="none" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M512 37 L521 57 L512 77 L503 57 Z" />
        <Path d="M512 947 L521 967 L512 987 L503 967 Z" />
        <Path d="M37 512 L57 503 L77 512 L57 521 Z" />
        <Path d="M947 512 L967 503 L987 512 L967 521 Z" />
        <Circle cx={512} cy={113} r={8} />
        <Circle cx={512} cy={911} r={8} />
        <Circle cx={113} cy={512} r={8} />
        <Circle cx={911} cy={512} r={8} />
      </G>

      {/* Corner sparks — four "+" marks + four small dots in the
          ambient field outside the orbit rings. */}
      <G stroke={STROKE} fill="none" strokeWidth={1} strokeLinecap="round" opacity={0.7}>
        <Path d="M182 205 V229 M170 217 H194" />
        <Path d="M842 205 V229 M830 217 H854" />
        <Path d="M182 795 V819 M170 807 H194" />
        <Path d="M842 795 V819 M830 807 H854" />
      </G>
      <G fill={STROKE} opacity={0.7}>
        <Circle cx={177} cy={332} r={4} />
        <Circle cx={847} cy={332} r={4} />
        <Circle cx={177} cy={692} r={4} />
        <Circle cx={847} cy={692} r={4} />
      </G>
    </>
  )
}

/*
 * A single spoke bead. Pulses on flowClock with a phase based on its
 * distance from the centre — beads closer to the centre peak first,
 * further beads peak later, so a wave of brightness sweeps the
 * spoke from "tú" → dimension every flowClock cycle.
 *
 * Falls back to a static opacity 0.62 when flowClock is missing
 * (the reduced-motion path), so the bead still reads as a dot.
 */
function SpokeBead({
  cx,
  cy,
  phase,
  flowClock,
}: {
  cx: number
  cy: number
  phase: number
  flowClock?: SharedValue<number>
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    if (!flowClock) return { opacity: 0.62 }
    // Cosine pulse centred on (flowClock - phase). At the peak
    // moment opacity = 0.95; troughs sit at 0.30. Wider peak (the
    // 0.6 power flattens the wave) so the brightness lingers as
    // it crosses the bead, rather than blinking.
    const wave = 0.5 + 0.5 * Math.cos((flowClock.value - phase) * 2 * Math.PI)
    const eased = Math.pow(wave, 0.6)
    return { opacity: 0.32 + eased * 0.62 }
  })
  return <AnimatedCircle cx={cx} cy={cy} r={3} animatedProps={animatedProps} />
}
