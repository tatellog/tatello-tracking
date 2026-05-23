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
import { Path } from 'react-native-svg'

import {
  CONSTELLATION_COLORS,
  getConstellationProfile,
  type ConstellationIntensity,
} from '../constants/constellationTheme'
import { ConstellationDrawing } from './ConstellationDrawing'

const AnimatedPath = Animated.createAnimatedComponent(Path)

/*
 * The eight MAIN connecting lines from constellation_app_day.svg.
 * Each gets a sliding bright dash overlay for the energy-flow effect.
 * The ornamental scrollwork from ConstellationDrawing stays static —
 * animating ALL of it would feel circuital; animating only the
 * star-to-star traces reads as energy flowing through the figure.
 */
const MAIN_LINES = [
  'M323 252 L492 145',
  'M492 145 L662 252',
  'M662 252 C731 315 750 404 719 488',
  'M662 252 L604 568',
  'M719 488 L604 568 L509 755',
  'M319 563 L509 755',
  'M323 252 C257 347 259 475 319 563',
  'M509 755 L509 528',
] as const

type Props = {
  /** Animation intensity. Default 'medium'. */
  intensity?: ConstellationIntensity
  /** Stroke colour for the bright flow highlight. */
  highlightColor?: string
}

/*
 * Wraps the static ConstellationDrawing and overlays an animated
 * energy-flow layer on the connecting lines. Drop-in replacement for
 * <ConstellationDrawing /> — emits the same drawing plus the moving
 * highlights, ready to live inside the parent SVG's transform group.
 */
export function AnimatedConstellation({
  intensity = 'medium',
  highlightColor = CONSTELLATION_COLORS.lineFlow,
}: Props) {
  const reducedMotion = useReducedMotion()
  const profile = getConstellationProfile(intensity, reducedMotion ?? false)

  // One shared clock for the flow effect — each path adds a phase
  // shift so they don't all light up in lock-step.
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

  return (
    <>
      {/* Base layer — the static drawing (lines + scrollwork). */}
      <ConstellationDrawing />

      {/* Energy-flow overlay — only when the profile enables it. */}
      {profile.flowEnabled
        ? MAIN_LINES.map((d, i) => (
            <FlowSegment
              key={`flow-${i}`}
              d={d}
              clock={flowClock}
              phase={i / MAIN_LINES.length}
              color={highlightColor}
              maxOpacity={profile.flowOpacity}
              dashLength={profile.flowDashLength}
            />
          ))
        : null}
    </>
  )
}

/*
 * A single line's flow highlight. The dash slides from path start to
 * end over one clock cycle, with `fade-in` at the start and `fade-out`
 * at the end so the loop wrap (offset jump back to 0) is invisible.
 */
function FlowSegment({
  d,
  clock,
  phase,
  color,
  maxOpacity,
  dashLength,
}: {
  d: string
  clock: SharedValue<number>
  phase: number
  color: string
  maxOpacity: number
  dashLength: number
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const t = (clock.value + phase) % 1
    // Fade band at the start and end of each cycle (10 % each)
    // smooths the dash's re-spawn at the loop boundary.
    const fadeIn = Math.min(1, t / 0.1)
    const fadeOut = Math.min(1, (1 - t) / 0.1)
    const visibility = Math.max(0, Math.min(fadeIn, fadeOut))
    return {
      strokeDashoffset: -t,
      opacity: visibility * maxOpacity,
    }
  })

  // `pathLength` IS supported at runtime by react-native-svg 15
  // (and is the cleanest way to make strokeDasharray work in
  // normalised 0–1 units regardless of the curve's true length), but
  // the TS types haven't caught up yet. Spread bypass + cast keeps
  // the source readable without an inline `as any` on every prop.
  const runtimeProps = { pathLength: 1 } as Record<string, unknown>
  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={3.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={`${dashLength} ${1 - dashLength}`}
      animatedProps={animatedProps}
      {...runtimeProps}
    />
  )
}
