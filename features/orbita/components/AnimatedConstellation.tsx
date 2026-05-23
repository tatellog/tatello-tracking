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
}

export function AnimatedConstellation({
  intensity = 'medium',
  highlightColor = CONSTELLATION_COLORS.lineFlow,
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

  return (
    <>
      <ConstellationDrawingBack />

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
          />
        ) : (
          <StaticPathOrbit key={`orbit-${i}`} orbit={orbit} />
        ),
      )}

      <ConstellationDrawingFront />
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
}: {
  orbit: EllipseOrbit
  flowClock: SharedValue<number>
  flowEnabled: boolean
  flowMaxOpacity: number
  flowDashLength: number
  flowColor: string
  phase: number
}) {
  const particleProps = useAnimatedProps(() => {
    'worklet'
    const t = (flowClock.value + phase) % 1
    return { strokeDashoffset: -t }
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
        <AnimatedEllipse
          cx={orbit.cx}
          cy={orbit.cy}
          rx={orbit.rx}
          ry={orbit.ry}
          fill="none"
          stroke={flowColor}
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeDasharray={`${flowDashLength} ${1 - flowDashLength}`}
          opacity={flowMaxOpacity}
          animatedProps={particleProps}
          {...runtimeProps}
        />
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
