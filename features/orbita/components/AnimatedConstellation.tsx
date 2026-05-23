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
import { Ellipse, G } from 'react-native-svg'

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
 * The four orbital ellipses. Each orbit gets:
 *  • A static base ellipse (the visible orbit line).
 *  • A particle overlay (small bright dash that travels around it
 *    via animated strokeDashoffset).
 *  • Both wrapped in an <AnimatedG> that rotates the group around
 *    the system's centre on its own clock.
 *
 * Per-orbit spin durations + alternating directions give the
 * cluster a "real" orbital feel — every body has its own period,
 * and adjacent orbits counter-rotate so the eye finds motion
 * everywhere it looks.
 */
type OrbitSpec = {
  cx: number
  cy: number
  rx: number
  ry: number
  /** Static tilt in degrees, on top of which the spin clock adds. */
  baseRotation: number
  /** Full revolution duration in milliseconds. */
  spinMs: number
  /** +1 = clockwise spin, -1 = counter-clockwise. */
  spinDir: 1 | -1
}

const ORBITS: readonly OrbitSpec[] = [
  { cx: 600, cy: 600, rx: 360, ry: 150, baseRotation: 20, spinMs: 56000, spinDir: 1 },
  { cx: 600, cy: 600, rx: 180, ry: 420, baseRotation: 10, spinMs: 78000, spinDir: -1 },
  { cx: 600, cy: 600, rx: 420, ry: 210, baseRotation: -28, spinMs: 68000, spinDir: 1 },
  { cx: 600, cy: 600, rx: 240, ry: 120, baseRotation: -55, spinMs: 92000, spinDir: -1 },
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

  // One clock per orbit for the rotation. Reanimated doesn't allow
  // an array of useSharedValue calls inside a single hook expression
  // because of the rules-of-hooks rule, so we declare them
  // explicitly. Four orbits = four shared values, one withRepeat
  // each, all linear so the rotation is constant-velocity.
  const spin0 = useSharedValue(0)
  const spin1 = useSharedValue(0)
  const spin2 = useSharedValue(0)
  const spin3 = useSharedValue(0)
  const spins = [spin0, spin1, spin2, spin3] as const

  useEffect(() => {
    if (!profile.flowEnabled) {
      // Reduced-motion fallback: every orbit stays at its base
      // tilt with no spin. (We still set the clock to 0 so any in-
      // flight withRepeat is cancelled cleanly on remount.)
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
    // Disabling the lint here keeps the four spin SharedValues out
    // of the dep array — they're stable refs from useSharedValue so
    // referencing them on every render would just create a no-op
    // dep churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.flowEnabled])

  // Energy flow shared across all four orbits — each orbit picks
  // its own phase so the particles don't sit at the same angle.
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

  // Slightly tighter than the connecting-line setting — for closed
  // orbits the highlight reads better as a "particle" than a long
  // streak.
  const orbitDashLength = profile.flowDashLength * 0.45

  return (
    <>
      {/* Behind the orbits — outer guide circles. */}
      <ConstellationDrawingBack />

      {/* Animated orbits. */}
      {ORBITS.map((orbit, i) => (
        <AnimatedOrbit
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
      ))}

      {/* In front of the orbits — central rings + axis cross. */}
      <ConstellationDrawingFront />
    </>
  )
}

/*
 * A single rotating orbit: static ellipse + travelling particle,
 * both inside an <AnimatedG> whose transform spins around the
 * orbit's centre. The particle ellipse sits on the same coordinate
 * frame as the base ellipse, so it stays glued to the orbit at any
 * rotation angle.
 */
function AnimatedOrbit({
  orbit,
  spinClock,
  flowClock,
  flowEnabled,
  flowMaxOpacity,
  flowDashLength,
  flowColor,
  phase,
}: {
  orbit: OrbitSpec
  spinClock: SharedValue<number>
  flowClock: SharedValue<number>
  flowEnabled: boolean
  flowMaxOpacity: number
  flowDashLength: number
  flowColor: string
  phase: number
}) {
  // Rotate the whole group: static tilt + the spinClock's 0→1
  // contribution scaled to a full revolution, signed by spinDir.
  // Translate-rotate-translate around the orbit's centre so the
  // ellipse spins in place rather than orbiting some other point.
  const spinTransform = useAnimatedProps(() => {
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

  const particleProps = useAnimatedProps(() => {
    'worklet'
    const t = (flowClock.value + phase) % 1
    return { strokeDashoffset: -t }
  })

  // `pathLength` is supported at runtime by react-native-svg 15 but
  // not in its TS types yet — spread through a Record cast.
  const runtimeProps = { pathLength: 1 } as Record<string, unknown>

  return (
    <AnimatedG animatedProps={spinTransform}>
      {/* Static orbit line. */}
      <Ellipse
        cx={orbit.cx}
        cy={orbit.cy}
        rx={orbit.rx}
        ry={orbit.ry}
        fill="none"
        stroke={colors.magenta}
        strokeWidth={3.5}
        strokeLinecap="round"
        opacity={0.7}
      />
      {/* Travelling particle — small dash that slides along the
          closed orbit. Skipped when flow is disabled (reduced
          motion). */}
      {flowEnabled ? (
        <AnimatedEllipse
          cx={orbit.cx}
          cy={orbit.cy}
          rx={orbit.rx}
          ry={orbit.ry}
          fill="none"
          stroke={flowColor}
          strokeWidth={5}
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
