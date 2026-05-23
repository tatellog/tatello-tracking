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
 *   • Five tilted closed ellipses (orbit paths around the centre).
 *     Each rotates around (600, 600) on its own clock, and carries
 *     a small bright particle dash that travels around the closed
 *     curve (offset wrap is invisible because the path is closed).
 *
 *   • Two open S-curve paths sweeping through the centre. They
 *     rotate around (600, 600) on their own clocks but DON'T carry
 *     a travelling particle — open paths would show the loop's
 *     respawn at the wrap point.
 *
 * Adjacent orbits counter-rotate, and every orbit has a distinct
 * period so the cluster reads as a real ensemble of bodies on
 * independent traces rather than a coordinated spin.
 */

type OrbitBase = {
  baseRotation: number
  spinMs: number
  spinDir: 1 | -1
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
  cx: number
  cy: number
  d: string
}
type OrbitSpec = EllipseOrbit | PathOrbit

const ORBITS: readonly OrbitSpec[] = [
  // Five closed ellipses.
  {
    kind: 'ellipse',
    cx: 600,
    cy: 600,
    rx: 430,
    ry: 138,
    baseRotation: 7,
    spinMs: 58000,
    spinDir: 1,
  },
  {
    kind: 'ellipse',
    cx: 600,
    cy: 600,
    rx: 432,
    ry: 132,
    baseRotation: -32,
    spinMs: 72000,
    spinDir: -1,
  },
  {
    kind: 'ellipse',
    cx: 600,
    cy: 600,
    rx: 210,
    ry: 455,
    baseRotation: 13,
    spinMs: 84000,
    spinDir: 1,
  },
  {
    kind: 'ellipse',
    cx: 600,
    cy: 600,
    rx: 128,
    ry: 398,
    baseRotation: -23,
    spinMs: 96000,
    spinDir: -1,
  },
  {
    kind: 'ellipse',
    cx: 600,
    cy: 600,
    rx: 278,
    ry: 110,
    baseRotation: -56,
    spinMs: 66000,
    spinDir: 1,
  },
  // Two open S-curves sweeping through the centre.
  {
    kind: 'path',
    cx: 600,
    cy: 600,
    d: 'M190 455 C340 472 465 520 600 600 C735 680 860 728 1010 745',
    baseRotation: 0,
    spinMs: 112000,
    spinDir: -1,
  },
  {
    kind: 'path',
    cx: 600,
    cy: 600,
    d: 'M210 755 C355 735 488 670 600 600 C712 530 845 465 990 445',
    baseRotation: 0,
    spinMs: 104000,
    spinDir: 1,
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

  // One clock per orbit for the rotation. Reanimated requires every
  // useSharedValue to be a top-level hook call, so we declare them
  // explicitly (seven orbits → seven clocks).
  const spin0 = useSharedValue(0)
  const spin1 = useSharedValue(0)
  const spin2 = useSharedValue(0)
  const spin3 = useSharedValue(0)
  const spin4 = useSharedValue(0)
  const spin5 = useSharedValue(0)
  const spin6 = useSharedValue(0)
  const spins = [spin0, spin1, spin2, spin3, spin4, spin5, spin6] as const

  useEffect(() => {
    if (!profile.flowEnabled) {
      spins.forEach((s) => {
        s.value = 0
      })
      return
    }
    ORBITS.forEach((orbit, i) => {
      const s = spins[i]!
      s.value = withRepeat(
        withTiming(1, { duration: orbit.spinMs, easing: Easing.linear }),
        -1,
        false,
      )
    })
    return () => {
      spins.forEach((s) => cancelAnimation(s))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.flowEnabled])

  // Energy flow on the closed ellipses — one clock shared across all
  // ellipse particles. Each ellipse picks its own phase.
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

  // Tighter dash for orbital particles (vs the connecting-line
  // setting) — reads as a "particle" not a streak.
  const orbitDashLength = profile.flowDashLength * 0.45

  return (
    <>
      <ConstellationDrawingBack />

      {ORBITS.map((orbit, i) =>
        orbit.kind === 'ellipse' ? (
          <AnimatedEllipseOrbit
            key={`orbit-${i}`}
            orbit={orbit}
            spinClock={spins[i]!}
            flowClock={flowClock}
            flowEnabled={profile.flowEnabled}
            flowMaxOpacity={profile.flowOpacity}
            flowDashLength={orbitDashLength}
            flowColor={highlightColor}
            phase={i / ORBITS.length}
          />
        ) : (
          <AnimatedPathOrbit key={`orbit-${i}`} orbit={orbit} spinClock={spins[i]!} />
        ),
      )}

      <ConstellationDrawingFront />
    </>
  )
}

/* Rotation transform shared by both orbit-kind components.
 * Translate-rotate-translate around the orbit's centre so it spins
 * in place. The angle is `baseRotation + spinClock * 360 * spinDir`,
 * so spinClock cycling 0 → 1 = one full revolution per spinMs. */
function useSpinTransform(orbit: OrbitSpec, spinClock: SharedValue<number>) {
  return useAnimatedProps(() => {
    'worklet'
    const angle = orbit.baseRotation + spinClock.value * 360 * orbit.spinDir
    return {
      transform: [
        { translateX: orbit.cx },
        { translateY: orbit.cy },
        { rotate: `${angle}deg` },
        { translateX: -orbit.cx },
        { translateY: -orbit.cy },
      ],
    }
  })
}

/*
 * A closed elliptical orbit: static line + travelling particle, both
 * inside an AnimatedG whose transform spins the orbit around its
 * centre. Particle stays glued to the orbit at any rotation angle.
 */
function AnimatedEllipseOrbit({
  orbit,
  spinClock,
  flowClock,
  flowEnabled,
  flowMaxOpacity,
  flowDashLength,
  flowColor,
  phase,
}: {
  orbit: EllipseOrbit
  spinClock: SharedValue<number>
  flowClock: SharedValue<number>
  flowEnabled: boolean
  flowMaxOpacity: number
  flowDashLength: number
  flowColor: string
  phase: number
}) {
  const spinTransform = useSpinTransform(orbit, spinClock)
  const particleProps = useAnimatedProps(() => {
    'worklet'
    const t = (flowClock.value + phase) % 1
    return { strokeDashoffset: -t }
  })
  const runtimeProps = { pathLength: 1 } as Record<string, unknown>
  return (
    <AnimatedG animatedProps={spinTransform}>
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
    </AnimatedG>
  )
}

/*
 * An open path orbit (S-curve through the centre): static stroke
 * only. No travelling particle — open paths would show the loop's
 * respawn artifact at the wrap point.
 */
function AnimatedPathOrbit({
  orbit,
  spinClock,
}: {
  orbit: PathOrbit
  spinClock: SharedValue<number>
}) {
  const spinTransform = useSpinTransform(orbit, spinClock)
  return (
    <AnimatedG animatedProps={spinTransform}>
      <Path
        d={orbit.d}
        fill="none"
        stroke={colors.magenta}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.72}
      />
    </AnimatedG>
  )
}
