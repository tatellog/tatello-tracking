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

const ORBITS: readonly OrbitSpec[] = [
  // Five closed ellipses.
  { kind: 'ellipse', cx: 600, cy: 600, rx: 430, ry: 138, baseRotation: 7 },
  { kind: 'ellipse', cx: 600, cy: 600, rx: 432, ry: 132, baseRotation: -32 },
  { kind: 'ellipse', cx: 600, cy: 600, rx: 210, ry: 455, baseRotation: 13 },
  { kind: 'ellipse', cx: 600, cy: 600, rx: 128, ry: 398, baseRotation: -23 },
  { kind: 'ellipse', cx: 600, cy: 600, rx: 278, ry: 110, baseRotation: -56 },
  // Two open S-curves sweeping through the centre (no rotation
  // transform — they sit in their authored orientation).
  {
    kind: 'path',
    d: 'M190 455 C340 472 465 520 600 600 C735 680 860 728 1010 745',
    baseRotation: 0,
  },
  {
    kind: 'path',
    d: 'M210 755 C355 735 488 670 600 600 C712 530 845 465 990 445',
    baseRotation: 0,
  },
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

      {ORBITS.map((orbit, i) =>
        orbit.kind === 'ellipse' ? (
          <StaticEllipseOrbit
            key={`orbit-${i}`}
            orbit={orbit}
            flowClock={flowClock}
            flowEnabled={profile.flowEnabled}
            flowMaxOpacity={profile.flowOpacity}
            flowDashLength={orbitDashLength}
            flowColor={highlightColor}
            phase={i / ORBITS.length}
            zoomT={zoomT}
          />
        ) : (
          <StaticPathOrbit key={`orbit-${i}`} orbit={orbit} />
        ),
      )}

      <AnimatedG animatedProps={scaffoldDim}>
        <ConstellationDrawingFront />
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
}: {
  orbit: EllipseOrbit
  flowClock: SharedValue<number>
  flowEnabled: boolean
  flowMaxOpacity: number
  flowDashLength: number
  flowColor: string
  phase: number
  zoomT?: SharedValue<number>
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
    <G transform={`rotate(${orbit.baseRotation} ${orbit.cx} ${orbit.cy})`}>
      <Ellipse
        cx={orbit.cx}
        cy={orbit.cy}
        rx={orbit.rx}
        ry={orbit.ry}
        fill="none"
        stroke={colors.magenta}
        strokeWidth={1.8}
        strokeLinecap="round"
        opacity={0.72}
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
function StaticPathOrbit({ orbit }: { orbit: PathOrbit }) {
  return (
    <Path
      d={orbit.d}
      fill="none"
      stroke={colors.magenta}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={0.72}
    />
  )
}
