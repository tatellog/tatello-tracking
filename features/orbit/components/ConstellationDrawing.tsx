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
// Perimeter beads — `fraction` is the bead's position along the hex
// PERIMETER as a number in [0, 1). Same parameterisation the
// travelling sweep dash uses (strokeDashoffset on a pathLength=1
// path), so the bead under the sweep crest at any instant has its
// peak brightness — the beads light up in unison WITH the sweep,
// reading as the sweep "energising" each pearl as it passes.
const PERIMETER_BEADS: { x: number; y: number; fraction: number }[] = HEX_OUTER.flatMap((a, i) => {
  const b = HEX_OUTER[(i + 1) % HEX_OUTER.length]!
  return [1, 2, 3, 4, 5].map((f) => {
    const t = f / 6
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      // Six equal edges, so the perimeter fraction is just the edge
      // index plus the within-edge fraction, divided by 6.
      fraction: (i + t) / HEX_OUTER.length,
    }
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

// Mid-cardinal markers — 8 positions at 30°/60°/120°/150°/210°/240°/
// 300°/330° on the outermost orbital ring (r = 455 from centre).
// Combined with the 4 authored cardinal ornaments (N/E/S/W), they
// turn the outer ring into a 12-point astrolabe scale.
const MID_CARDINAL_R = 455
const MID_CARDINAL_ANGLES = [30, 60, 120, 150, 210, 240, 300, 330] as const
const MID_CARDINALS = MID_CARDINAL_ANGLES.map((angleDeg) => {
  // 0° = north (up). Convert to standard math angle (0° = east, ccw).
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: CENTRE.x + MID_CARDINAL_R * Math.cos(rad),
    y: CENTRE.y + MID_CARDINAL_R * Math.sin(rad),
    angle: angleDeg,
  }
})

/** A four-point diamond at (cx, cy) oriented so its long axis points
 *  toward the centre (i.e., perpendicular to the outer ring at the
 *  marker's angle). `halfW` is half the perpendicular width, `halfH`
 *  half the radial length. */
function diamondPath(cx: number, cy: number, halfW: number, halfH: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  // Local diamond: top (0, -halfH), right (halfW, 0), bottom (0, halfH),
  // left (-halfW, 0). Rotate by `rad` (long axis pointing outward),
  // then translate to (cx, cy).
  const pts = [
    [0, -halfH],
    [halfW, 0],
    [0, halfH],
    [-halfW, 0],
  ].map(([px, py]) => [px! * cos - py! * sin + cx, px! * sin + py! * cos + cy] as const)
  return `M ${pts[0]![0]} ${pts[0]![1]} L ${pts[1]![0]} ${pts[1]![1]} L ${pts[2]![0]} ${pts[2]![1]} L ${pts[3]![0]} ${pts[3]![1]} Z`
}

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

      {/* In-node symbols — one mythic icon per dimension authored
          inside the SVG. Sit deep INSIDE the StarNode bloom radius
          so they read as a faint silhouette / engraved medallion
          texture rather than a competing visual. Render BEFORE the
          luminous StarNode (which paints over them in z-order).
          Order matches HEX_OUTER: mente · sueno · alimento · ciclo
          · energia · cuerpo. */}
      <G
        stroke={STROKE}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.4}
        opacity={0.42}
      >
        {/* mente — 4-point star at the top */}
        <Path d="M512 182 L518 204 L540 210 L518 216 L512 238 L506 216 L484 210 L506 204 Z" />
        {/* sueno — eight-ray starburst at upper-right */}
        <Path d="M773.5 329 V393 M741.5 361 H805.5 M751 338.5 L796 383.5 M796 338.5 L751 383.5" />
        {/* alimento — wider diamond star at lower-right */}
        <Path d="M773.5 635 L784 652.5 L801.5 663 L784 673.5 L773.5 691 L763 673.5 L745.5 663 L763 652.5 Z" />
        {/* ciclo — crescent moon at the bottom */}
        <Path d="M527 790 C505 793 491 811 497 831 C504 852 529 859 548 844 C528 849 510 835 512 814 C514 802 520 794 527 790 Z" />
        {/* energia — three-petal lotus at lower-left */}
        <Path d="M250.5 690 C233 671 233 649 250.5 633 C268 649 268 671 250.5 690 Z" />
        <Path d="M250.5 688 C224 680 215 659 224 641 C242 649 251 665 250.5 688 Z" opacity={0.85} />
        <Path d="M250.5 688 C277 680 286 659 277 641 C259 649 250 665 250.5 688 Z" opacity={0.85} />
        {/* cuerpo — backward crescent at upper-left */}
        <Path d="M266 337 C245 341 232 359 238 379 C244 397 267 403 285 390 C263 394 246 379 250 358 C253 347 258 340 266 337 Z" />
      </G>

      {/* Perimeter beads — 5 spaced along each outer-hex edge,
          each pulsing on flowClock with a phase tied to its
          perimeter fraction so the wave of brightness travels
          around the hex in sync with the outline sweep. */}
      <G fill={STROKE}>
        {PERIMETER_BEADS.map((p, i) => (
          <PerimeterBead
            key={`pb-${i}`}
            cx={p.x}
            cy={p.y}
            fraction={p.fraction}
            flowClock={flowClock}
          />
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

      {/* Mid-cardinal markers — 8 small diamonds at the 30°/60°/120°/
          150°/210°/240°/300°/330° positions on the outermost ring
          (r=455). Combined with the 4 cardinals they form a 12-point
          astrolabe degree ring around the figure, denser + more
          ornamented than just the 4 cardinals like the reference. */}
      <G
        stroke={STROKE}
        fill="none"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.65}
      >
        {MID_CARDINALS.map((m, i) => (
          <Path key={`mc-${i}`} d={diamondPath(m.x, m.y, 5, 7, m.angle)} />
        ))}
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

/*
 * A single perimeter bead — sits at `fraction` along the outer-hex
 * perimeter (0 = top vertex, sweeping clockwise to 1). Pulses on
 * flowClock with a SHARP peak (cos³ envelope) right when the
 * travelling outline sweep crest passes over it, so the brightness
 * propagates around the hex in lock-step with the sweep dash.
 *
 * Static at 0.72 opacity when flowClock is missing (reduced-motion).
 */
function PerimeterBead({
  cx,
  cy,
  fraction,
  flowClock,
}: {
  cx: number
  cy: number
  fraction: number
  flowClock?: SharedValue<number>
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    if (!flowClock) return { opacity: 0.72 }
    // Cosine pulse centred on (flowClock - fraction). Cubed so the
    // peak is narrow — a sharp lit moment as the sweep crest passes
    // each bead, instead of all beads slowly oscillating together.
    const wave = 0.5 + 0.5 * Math.cos((flowClock.value - fraction) * 2 * Math.PI)
    const eased = wave * wave * wave
    return { opacity: 0.42 + eased * 0.55 }
  })
  return <AnimatedCircle cx={cx} cy={cy} r={3} animatedProps={animatedProps} />
}
