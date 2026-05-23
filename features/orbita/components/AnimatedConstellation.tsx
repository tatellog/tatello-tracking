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

import {
  CONSTELLATION_COLORS,
  getConstellationProfile,
  type ConstellationIntensity,
} from '../constants/constellationTheme'
import { ConstellationDrawing } from './ConstellationDrawing'

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)

/*
 * The four orbital ellipses from orbital_tab_day.svg. Each gets a
 * small bright dash that travels around its closed perimeter — the
 * "particle on an orbit" energy flow. Closed paths means the dash
 * wraps invisibly at offset = -1, so the orbit loops feel continuous
 * with no respawn artefact.
 */
const ANIMATED_ORBITS = [
  { cx: 600, cy: 600, rx: 360, ry: 150, rotation: 20 },
  { cx: 600, cy: 600, rx: 180, ry: 420, rotation: 10 },
  { cx: 600, cy: 600, rx: 420, ry: 210, rotation: -28 },
  { cx: 600, cy: 600, rx: 240, ry: 120, rotation: -55 },
] as const

type Props = {
  /** Animation intensity. Default 'medium'. */
  intensity?: ConstellationIntensity
  /** Stroke colour for the bright travelling particle. */
  highlightColor?: string
}

/*
 * Wraps the static ConstellationDrawing and overlays an animated
 * "particle on an orbit" highlight on each of the four orbital
 * ellipses. Drop-in for <ConstellationDrawing /> — emits the same
 * drawing plus the moving highlights, ready to live inside the
 * parent SVG's transform group.
 */
export function AnimatedConstellation({
  intensity = 'medium',
  highlightColor = CONSTELLATION_COLORS.lineFlow,
}: Props) {
  const reducedMotion = useReducedMotion()
  const profile = getConstellationProfile(intensity, reducedMotion ?? false)

  // One shared clock for the orbital particles — each particle adds
  // a phase shift so they don't all sit at the same angle.
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

  // A small dash relative to the orbit's circumference — the
  // particle is a brief blip, not a long streak. Half of the path
  // profile's dashLength setting because orbital "particles" read
  // better tighter than a connecting-line streak.
  const orbitDashLength = profile.flowDashLength * 0.45

  return (
    <>
      {/* Base layer — the static orbital drawing. */}
      <ConstellationDrawing />

      {/* Energy-flow overlay — one travelling particle per orbit. */}
      {profile.flowEnabled
        ? ANIMATED_ORBITS.map((orbit, i) => (
            <OrbitParticle
              key={`orbit-${i}`}
              orbit={orbit}
              clock={flowClock}
              phase={i / ANIMATED_ORBITS.length}
              color={highlightColor}
              maxOpacity={profile.flowOpacity}
              dashLength={orbitDashLength}
            />
          ))
        : null}
    </>
  )
}

/*
 * A single orbit's travelling particle. Uses pathLength=1 +
 * strokeDasharray + an animated strokeDashoffset on a duplicate
 * <Ellipse> over each orbital path. The dash is small, so it reads
 * as a particle on a closed orbit — and because the orbit IS
 * closed, the offset wrap loops seamlessly.
 */
function OrbitParticle({
  orbit,
  clock,
  phase,
  color,
  maxOpacity,
  dashLength,
}: {
  orbit: { cx: number; cy: number; rx: number; ry: number; rotation: number }
  clock: SharedValue<number>
  phase: number
  color: string
  maxOpacity: number
  dashLength: number
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const t = (clock.value + phase) % 1
    return { strokeDashoffset: -t }
  })
  // `pathLength` is supported at runtime by react-native-svg 15 but
  // not in its TS types yet — spread through a Record cast.
  const runtimeProps = { pathLength: 1 } as Record<string, unknown>
  return (
    <G transform={`rotate(${orbit.rotation} ${orbit.cx} ${orbit.cy})`}>
      <AnimatedEllipse
        cx={orbit.cx}
        cy={orbit.cy}
        rx={orbit.rx}
        ry={orbit.ry}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${dashLength} ${1 - dashLength}`}
        opacity={maxOpacity}
        animatedProps={animatedProps}
        {...runtimeProps}
      />
    </G>
  )
}
