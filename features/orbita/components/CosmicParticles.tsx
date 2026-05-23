import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
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
import Svg, { Circle } from 'react-native-svg'

import {
  CONSTELLATION_COLORS,
  getConstellationProfile,
  type ConstellationIntensity,
} from '../constants/constellationTheme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/** Deterministic 0–1 hash so positions stay stable across renders. */
function rand(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

type Particle = {
  baseX: number
  baseY: number
  driftRadiusX: number
  driftRadiusY: number
  radius: number
  baseOpacity: number
  phase: number
  twinkleSpeed: number
}

function buildParticles(count: number, w: number, h: number): Particle[] {
  const out: Particle[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      baseX: rand(i, 1) * w,
      baseY: rand(i, 2) * h,
      // Drift radius caps so particles don't sail across the canvas;
      // ambient dust, not zooming meteors.
      driftRadiusX: 6 + rand(i, 3) * 14,
      driftRadiusY: 5 + rand(i, 4) * 12,
      radius: 0.7 + rand(i, 5) * 1.6,
      baseOpacity: 0.35 + rand(i, 6) * 0.6,
      phase: rand(i, 7),
      twinkleSpeed: 0.7 + rand(i, 8) * 1.4,
    })
  }
  return out
}

type Props = {
  /** Animation intensity ('low' | 'medium' | 'high'). Default 'medium'. */
  intensity?: ConstellationIntensity
  /** Particle colour. Defaults to the cream tint from the theme. */
  color?: string
}

/*
 * Background dust — ~14 (medium) particles drifting on slow elliptical
 * paths and twinkling on their own clocks. Self-measures via onLayout
 * so the parent can drop it as an `absoluteFill` overlay without
 * passing dimensions.
 *
 * If reduceMotion is on (or intensity collapses particleDriftMs to
 * Infinity), particles still render at their static base positions
 * with their base opacity but the drift clock never starts.
 */
export function CosmicParticles({
  intensity = 'medium',
  color = CONSTELLATION_COLORS.particle,
}: Props) {
  const reducedMotion = useReducedMotion()
  const profile = getConstellationProfile(intensity, reducedMotion ?? false)

  const [size, setSize] = useState({ w: 0, h: 0 })
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    if (width > 0 && height > 0 && (width !== size.w || height !== size.h)) {
      setSize({ w: width, h: height })
    }
  }

  const clock = useSharedValue(0)
  useEffect(() => {
    if (!Number.isFinite(profile.particleDriftMs)) {
      clock.value = 0
      return
    }
    clock.value = withRepeat(
      withTiming(1, { duration: profile.particleDriftMs, easing: Easing.linear }),
      -1,
      false,
    )
    return () => cancelAnimation(clock)
  }, [profile.particleDriftMs, clock])

  const particles = useMemo(
    () => (size.w > 0 ? buildParticles(profile.particleCount, size.w, size.h) : []),
    [profile.particleCount, size.w, size.h],
  )

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {size.w > 0 ? (
        <Svg width={size.w} height={size.h} pointerEvents="none">
          {particles.map((p, i) => (
            <ParticleDot
              key={i}
              particle={p}
              clock={clock}
              color={color}
              maxOpacity={profile.particleOpacity}
            />
          ))}
        </Svg>
      ) : null}
    </View>
  )
}

function ParticleDot({
  particle,
  clock,
  color,
  maxOpacity,
}: {
  particle: Particle
  clock: SharedValue<number>
  color: string
  maxOpacity: number
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const t = clock.value
    // Each particle traces a slow elliptical drift. The x/y offsets
    // run on slightly mismatched frequencies (0.73× on y) so the
    // path is a soft Lissajous loop rather than a closed circle.
    const angle = (t + particle.phase) * 2 * Math.PI
    const x = particle.baseX + Math.cos(angle) * particle.driftRadiusX
    const y = particle.baseY + Math.sin(angle * 0.73) * particle.driftRadiusY
    // Twinkle: a faster sine on opacity, distinct per particle.
    const twinkle =
      0.5 + 0.5 * Math.sin((t * 4 + particle.phase) * 2 * Math.PI * particle.twinkleSpeed)
    const op = particle.baseOpacity * maxOpacity * (0.45 + twinkle * 0.55)
    return { cx: x, cy: y, opacity: op }
  })

  return <AnimatedCircle r={particle.radius} fill={color} animatedProps={animatedProps} />
}
