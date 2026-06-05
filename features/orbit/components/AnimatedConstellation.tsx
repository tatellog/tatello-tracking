import { useEffect } from 'react'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { Ellipse, G, Path } from 'react-native-svg'

import { colors } from '@/theme'

import {
  CONSTELLATION_COLORS,
  getConstellationProfile,
  type ConstellationIntensity,
} from '../constants/constellationTheme'
import { ConstellationDrawingBack, ConstellationDrawingFront } from './ConstellationDrawing'

const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)
const AnimatedPath = Animated.createAnimatedComponent(Path)

/*
 * Animated orbital layer. Seven orbits in total:
 *
 *   • Five tilted closed ellipses — render statically at their
 *     baseRotation. Each carries a small bright particle dash that
 *     travels around the closed curve via an animated
 *     strokeDashoffset (offset wrap is invisible because the path
 *     is closed).
 *
 *   • Two open S-curve paths sweeping through the centre — render
 *     statically. Open paths would show the loop respawn at the
 *     wrap, so no travelling particle is drawn on them.
 *
 * The orbits themselves do NOT rotate (an earlier version spun
 * each one around the centre; the user found the motion too busy).
 * Only the dash highlight slides along the closed ellipses.
 */

type OrbitBase = {
  baseRotation: number
  /** Whether this orbit gets the travelling energy beam. False ones
   *  render as static line — the line still tracks lineBoost, so it
   *  thickens during zoom along with the rest of the scaffold. */
  flow?: boolean
}
type EllipseOrbit = OrbitBase & {
  kind: 'ellipse'
  cx: number
  cy: number
  rx: number
  ry: number
}
type PathOrbit = OrbitBase & {
  kind: 'path'
  d: string
}
type OrbitSpec = EllipseOrbit | PathOrbit

// daily_constellation.svg authors six concentric rings at radii 430,
// 397, 354, 301, 244, 185 (centre 512, 512). The outer two carry the
// travelling energy beam (the brightest plasma sweep); the inner
// four are static lines that still respond to the lineBoost at zoom.
// Spreading the particles across only the outer two keeps the figure
// from feeling busy — the eye follows the sweep at the rim while
// the inner rings read as the orbital depth.
const ORBITS: readonly OrbitSpec[] = [
  { kind: 'ellipse', cx: 512, cy: 512, rx: 430, ry: 430, baseRotation: 0, flow: true },
  { kind: 'ellipse', cx: 512, cy: 512, rx: 397, ry: 397, baseRotation: 0, flow: true },
  { kind: 'ellipse', cx: 512, cy: 512, rx: 354, ry: 354, baseRotation: 0, flow: false },
  { kind: 'ellipse', cx: 512, cy: 512, rx: 301, ry: 301, baseRotation: 0, flow: false },
  { kind: 'ellipse', cx: 512, cy: 512, rx: 244, ry: 244, baseRotation: 0, flow: false },
  { kind: 'ellipse', cx: 512, cy: 512, rx: 185, ry: 185, baseRotation: 0, flow: false },
] as const

type Props = {
  intensity?: ConstellationIntensity
  highlightColor?: string
  /** Zoom progress (0 → 1). When > 0 the orbit particles get an
   *  opacity boost — the "energy through the lines" pulse the
   *  Genshin reference uses at the moment of selection. */
  zoomT?: SharedValue<number>
}

export function AnimatedConstellation({
  intensity = 'medium',
  highlightColor = CONSTELLATION_COLORS.lineFlow,
  zoomT,
}: Props) {
  const reducedMotion = useReducedMotion()
  const profile = getConstellationProfile(intensity, reducedMotion ?? false)

  // Single clock shared across every closed-ellipse particle. Each
  // ellipse picks its own phase so the highlights don't bunch up.
  const flowClock = useSharedValue(0)
  useEffect(() => {
    if (!profile.flowEnabled) {
      flowClock.value = 0
      return
    }
    flowClock.value = withRepeat(
      withTiming(1, { duration: profile.flowDurationMs, easing: Easing.linear }),
      -1,
      false,
    )
    return () => cancelAnimation(flowClock)
  }, [profile.flowEnabled, profile.flowDurationMs, flowClock])

  // Tighter dash than the connecting-line setting — reads as a
  // "particle" not a streak.
  const orbitDashLength = profile.flowDashLength * 0.45

  // Boost orbit + hexagon stroke during zoom — the orbital
  // scaffold grows in thickness + brightness alongside the
  // focused star instead of staying thin while everything else
  // amplifies. Static at rest; at zoomT = 1 the lines are ~1.9 ×
  // thicker and noticeably brighter, so the figure feels
  // "alive" + bigger as a whole, not just the selected node.
  const lineBoost = useAnimatedProps(() => {
    'worklet'
    const z = zoomT ? zoomT.value : 0
    return { strokeWidth: 1.8 + z * 1.7, opacity: 0.72 + z * 0.2 }
  })
  // Hexagon outline — drawn as FIVE stacked layers so it reads like
  // the Genshin reference: a vibrant bi-tone core line bleeding into
  // a wide bloom, with a bright cream "shine" sliding around the
  // perimeter as if energy is filling the figure.
  //
  //   1. outlineGlowOuter — widest faint halo (18 → 28 pt at zoom).
  //      Ambient scatter around the line, like the atmosphere.
  //   2. outlineGlow      — closer bloom (9 → 15 pt). Magenta.
  //   3. outlineBoost     — magenta core (3.8 → 6.4 pt, 0.85 → 1.0).
  //   4. outlineShine     — cream highlight on top of the magenta
  //      core (1.6 → 2.8 pt) so the line reads bi-tone — warm pink
  //      shine ON magenta instead of plain magenta. This is the
  //      "other colour for more shine" the reference asked for.
  //   5. hexFill (head + halo) — a bright cream-pink dash that
  //      slides around the hexagon perimeter on flowClock, leaving
  //      a wider magenta wake just behind it. Reads as "energy
  //      filling the constellation" — same vocabulary as the
  //      travelling beam on the orbital rings.
  const outlineGlowOuter = useAnimatedProps(() => {
    'worklet'
    const z = zoomT ? zoomT.value : 0
    return { strokeWidth: 18 + z * 10, opacity: 0.16 + z * 0.22 }
  })
  const outlineGlow = useAnimatedProps(() => {
    'worklet'
    const z = zoomT ? zoomT.value : 0
    return { strokeWidth: 9 + z * 6, opacity: 0.32 + z * 0.32 }
  })
  const outlineBoost = useAnimatedProps(() => {
    'worklet'
    const z = zoomT ? zoomT.value : 0
    return { strokeWidth: 3.8 + z * 2.6, opacity: 0.85 + z * 0.15 }
  })
  const outlineShine = useAnimatedProps(() => {
    'worklet'
    const z = zoomT ? zoomT.value : 0
    return { strokeWidth: 1.6 + z * 1.2, opacity: 0.55 + z * 0.35 }
  })

  // Travelling fill dash — slides around the hexagon perimeter on
  // flowClock so the constellation feels like it's continuously
  // being charged. Same head + halo vocabulary as the orbital
  // beam: a bright narrow cream head followed by a wider magenta
  // halo trailing slightly behind. Both share an opacity pulse so
  // the sweep crescendos + dims rhythmically (PULSE_FREQ = 1.5).
  const HEX_HALO_TRAIL = 0.022
  const HEX_PULSE_FREQ = 1.5
  const hexFillHead = useAnimatedProps(() => {
    'worklet'
    const z = zoomT ? zoomT.value : 0
    const t = flowClock.value
    const pulse = 0.55 + 0.45 * Math.sin(flowClock.value * 2 * Math.PI * HEX_PULSE_FREQ)
    const op = Math.min(1, (0.75 + z * 0.25) * pulse * 1.25)
    return { strokeDashoffset: -t, opacity: op }
  })
  const hexFillHalo = useAnimatedProps(() => {
    'worklet'
    const z = zoomT ? zoomT.value : 0
    const t = (flowClock.value - HEX_HALO_TRAIL + 1) % 1
    const pulse = 0.55 + 0.45 * Math.sin(flowClock.value * 2 * Math.PI * HEX_PULSE_FREQ)
    const op = Math.min(1, (0.45 + z * 0.25) * pulse)
    return { strokeDashoffset: -t, opacity: op }
  })

  // The static scaffold (outer guides, axis cross, central rings,
  // node rings, orbit dots, micro stars) is the "context" of the
  // figure — useful at rest, but at zoom it forms a perfect-circle
  // + cross pattern around the selected star that reads as a
  // rifle-scope reticle. Fade aggressively: 1 at rest, ~0.06 at
  // full zoom — basically invisible so the selected star + its
  // flare are the only things in the frame. The orbits and their
  // particles render OUTSIDE this dim group, so they keep their
  // own opacity.
  const scaffoldDim = useAnimatedProps(() => {
    'worklet'
    const z = zoomT ? zoomT.value : 0
    return { opacity: 1 - z * 0.94 }
  })

  return (
    <>
      <AnimatedG animatedProps={scaffoldDim}>
        <ConstellationDrawingBack />
      </AnimatedG>

      {/* Hexagonal constellation outline — passes EXACTLY through
          the six dimension nodes (top, upper-right, lower-right,
          bottom, lower-left, upper-left). Stays OUT of the
          scaffoldDim fade and grows in stroke + brightness
          alongside the focused star, so the figure remains
          legible at zoom.

          Five stacked layers — see the outline* / hexFill*
          useAnimatedProps blocks above for the brightness +
          stroke ramps. Bottom layer paints first, brightest
          travelling head paints last. */}
      <HexagonOutline
        outlineGlowOuter={outlineGlowOuter}
        outlineGlow={outlineGlow}
        outlineBoost={outlineBoost}
        outlineShine={outlineShine}
        hexFillHead={hexFillHead}
        hexFillHalo={hexFillHalo}
        flowEnabled={profile.flowEnabled}
      />

      {ORBITS.map((orbit, i) =>
        orbit.kind === 'ellipse' ? (
          <StaticEllipseOrbit
            key={`orbit-${i}`}
            orbit={orbit}
            flowClock={flowClock}
            flowEnabled={profile.flowEnabled && (orbit.flow ?? true)}
            flowMaxOpacity={profile.flowOpacity}
            flowDashLength={orbitDashLength}
            flowColor={highlightColor}
            phase={i / ORBITS.length}
            zoomT={zoomT}
            lineBoost={lineBoost}
          />
        ) : (
          <StaticPathOrbit key={`orbit-${i}`} orbit={orbit} lineBoost={lineBoost} />
        ),
      )}

      <AnimatedG animatedProps={scaffoldDim}>
        <ConstellationDrawingFront flowClock={flowClock} />
      </AnimatedG>
    </>
  )
}

/*
 * A closed elliptical orbit drawn statically at its baseRotation,
 * with a particle dash sliding along the closed curve via animated
 * strokeDashoffset. The outer <G> uses a STATIC `transform` string
 * — no rotation animation.
 */
function StaticEllipseOrbit({
  orbit,
  flowClock,
  flowEnabled,
  flowMaxOpacity,
  flowDashLength,
  flowColor,
  phase,
  zoomT,
  lineBoost,
}: {
  orbit: EllipseOrbit
  flowClock: SharedValue<number>
  flowEnabled: boolean
  flowMaxOpacity: number
  flowDashLength: number
  flowColor: string
  phase: number
  zoomT?: SharedValue<number>
  /** Animated stroke+opacity boost driven by zoomT (see
   *  AnimatedConstellation). Applied to the static orbit line so
   *  the orbital scaffold grows alongside the focused star. */
  lineBoost: ReturnType<typeof useAnimatedProps>
}) {
  // The "energy beam" — two stacked dashes travelling around the
  // orbit. HEAD is a narrow bright-white core; HALO is a wider
  // magenta glow trailing slightly behind. Both share an opacity
  // PULSE driven by sin(flowClock·3) so the beam intensifies and
  // dims as it sweeps the orbit (like a real plasma pulse, not a
  // constant-brightness particle).
  //
  // Trail offset (HALO_TRAIL) sits the halo ~1.5 % of the perimeter
  // behind the head; the visual is a comet-like wake.
  const HALO_TRAIL = 0.018
  // Slower pulse — 1.5 brightness cycles per orbit cycle. At
  // flowDurationMs ≈ 9.5 s on medium intensity, that's a peak
  // every ~6.3 s. Combined with the slower flowClock the beam
  // reads as a build-up + sweep rather than a fast blip.
  const PULSE_FREQ = 1.5
  const headProps = useAnimatedProps(() => {
    'worklet'
    const t = (flowClock.value + phase) % 1
    const pulse = 0.55 + 0.45 * Math.sin((flowClock.value + phase) * 2 * Math.PI * PULSE_FREQ)
    const boost = zoomT ? 1 + zoomT.value * 0.7 : 1
    const op = Math.min(1, flowMaxOpacity * pulse * boost * 1.3)
    return { strokeDashoffset: -t, opacity: op }
  })
  const haloProps = useAnimatedProps(() => {
    'worklet'
    // +1 keeps the modulo positive when (t - HALO_TRAIL) is slightly
    // negative at the start of a cycle.
    const t = (flowClock.value + phase - HALO_TRAIL + 1) % 1
    const pulse = 0.55 + 0.45 * Math.sin((flowClock.value + phase) * 2 * Math.PI * PULSE_FREQ)
    const boost = zoomT ? 1 + zoomT.value * 0.7 : 1
    const op = Math.min(1, flowMaxOpacity * pulse * boost * 0.55)
    return { strokeDashoffset: -t, opacity: op }
  })
  // `pathLength` is supported at runtime by react-native-svg 15 but
  // not in its TS types yet — spread through a Record cast.
  const runtimeProps = { pathLength: 1 } as Record<string, unknown>
  return (
    <G
      transform={[
        { translateX: orbit.cx },
        { translateY: orbit.cy },
        { rotate: `${orbit.baseRotation}deg` },
        { translateX: -orbit.cx },
        { translateY: -orbit.cy },
      ]}
    >
      <AnimatedEllipse
        cx={orbit.cx}
        cy={orbit.cy}
        rx={orbit.rx}
        ry={orbit.ry}
        fill="none"
        stroke={colors.magenta}
        strokeLinecap="round"
        animatedProps={lineBoost}
      />
      {flowEnabled ? (
        <>
          {/* Halo — wider magenta glow, slightly longer dash, trails
              behind the head. Drawn first so the bright head sits on
              top in z-order. */}
          <AnimatedEllipse
            cx={orbit.cx}
            cy={orbit.cy}
            rx={orbit.rx}
            ry={orbit.ry}
            fill="none"
            stroke={CONSTELLATION_COLORS.starHalo}
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={`${flowDashLength * 1.5} ${1 - flowDashLength * 1.5}`}
            animatedProps={haloProps}
            {...runtimeProps}
          />
          {/* Head — narrow white-hot core. The bright crest of the
              energy pulse. */}
          <AnimatedEllipse
            cx={orbit.cx}
            cy={orbit.cy}
            rx={orbit.rx}
            ry={orbit.ry}
            fill="none"
            stroke={flowColor}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={`${flowDashLength * 0.85} ${1 - flowDashLength * 0.85}`}
            animatedProps={headProps}
            {...runtimeProps}
          />
        </>
      ) : null}
    </G>
  )
}

/*
 * An open path orbit (S-curve). Drawn statically, with no rotation
 * and no travelling particle (open paths would show the loop's
 * respawn).
 */
function StaticPathOrbit({
  orbit,
  lineBoost,
}: {
  orbit: PathOrbit
  lineBoost: ReturnType<typeof useAnimatedProps>
}) {
  return (
    <AnimatedPath
      d={orbit.d}
      fill="none"
      stroke={colors.magenta}
      strokeLinecap="round"
      strokeLinejoin="round"
      animatedProps={lineBoost}
    />
  )
}

/*
 * The hexagonal constellation outline — six stacked layers painting
 * the same path:
 *
 *   1. Outer magenta bloom (widest, faintest)
 *   2. Inner magenta glow
 *   3. Magenta core line
 *   4. Cream "shine" highlight on top
 *   5. Dash halo (magenta, trailing wake of the sweep)
 *   6. Dash head (bright cream, the brightest crest)
 *
 * The dash layers use pathLength=1 so the dash pattern is path-
 * normalised; the head is 18 % of the perimeter, the halo 26 %.
 * Both slide on flowClock-driven strokeDashoffset → the sweep
 * travels around the six edges continuously, reading as "energy
 * filling the figure" — the same vocabulary as the orbit beams.
 */
const HEX_PATH = 'M 512 210 L 773.5 361 L 773.5 663 L 512 814 L 250.5 663 L 250.5 361 Z'
const HEX_DASH_RUNTIME = { pathLength: 1 } as Record<string, unknown>

function HexagonOutline({
  outlineGlowOuter,
  outlineGlow,
  outlineBoost,
  outlineShine,
  hexFillHead,
  hexFillHalo,
  flowEnabled,
}: {
  outlineGlowOuter: ReturnType<typeof useAnimatedProps>
  outlineGlow: ReturnType<typeof useAnimatedProps>
  outlineBoost: ReturnType<typeof useAnimatedProps>
  outlineShine: ReturnType<typeof useAnimatedProps>
  hexFillHead: ReturnType<typeof useAnimatedProps>
  hexFillHalo: ReturnType<typeof useAnimatedProps>
  flowEnabled: boolean
}) {
  return (
    <>
      {/* 1. Outermost magenta bloom — the ambient atmospheric scatter
            around the line, widest and faintest. */}
      <AnimatedPath
        d={HEX_PATH}
        fill="none"
        stroke={colors.magenta}
        strokeLinecap="round"
        strokeLinejoin="round"
        animatedProps={outlineGlowOuter}
      />
      {/* 2. Inner magenta glow — closer halo bleeding off the core. */}
      <AnimatedPath
        d={HEX_PATH}
        fill="none"
        stroke={colors.magenta}
        strokeLinecap="round"
        strokeLinejoin="round"
        animatedProps={outlineGlow}
      />
      {/* 3. Magenta core — the body of the line. */}
      <AnimatedPath
        d={HEX_PATH}
        fill="none"
        stroke={colors.magenta}
        strokeLinecap="round"
        strokeLinejoin="round"
        animatedProps={outlineBoost}
      />
      {/* 4. Cream "shine" highlight — sits ON TOP of the magenta
            core so the line reads bi-tone (warm pink shine over a
            magenta body) rather than a single-colour stroke. This
            is the "other colour for more brightness" the reference
            asked for. */}
      <AnimatedPath
        d={HEX_PATH}
        fill="none"
        stroke={CONSTELLATION_COLORS.lineFlow}
        strokeLinecap="round"
        strokeLinejoin="round"
        animatedProps={outlineShine}
      />
      {/* 5. + 6. Travelling fill — head + halo. Gated on flowEnabled
            so the OS reduced-motion fallback skips them. */}
      {flowEnabled ? (
        <>
          {/* Halo — wider magenta glow trailing the head. Drawn
              first so the bright head sits on top. */}
          <AnimatedPath
            d={HEX_PATH}
            fill="none"
            stroke={CONSTELLATION_COLORS.starHalo}
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="0.26 0.74"
            animatedProps={hexFillHalo}
            {...HEX_DASH_RUNTIME}
          />
          {/* Head — narrow bright cream crest. The brightest point
              of the sweep — the "filling" of the hexagon. */}
          <AnimatedPath
            d={HEX_PATH}
            fill="none"
            stroke={CONSTELLATION_COLORS.lineFlow}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="0.18 0.82"
            animatedProps={hexFillHead}
            {...HEX_DASH_RUNTIME}
          />
        </>
      ) : null}
    </>
  )
}
