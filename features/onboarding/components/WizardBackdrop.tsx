import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

import { colors } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/*
 * The deep field behind every onboarding screen. Three layered
 * effects:
 *
 *   · soft magenta nebula glow anchored to the bottom-right corner,
 *     giving the dark canvas atmospheric depth (the wizard never
 *     reads as just "void on void");
 *   · a deterministic starfield (~50 small points) — same seed each
 *     render, so the constellation behind the user is stable
 *     between screens (continuity of place);
 *   · the Stelar presence mark in the top-right corner — a single
 *     luminous magenta dot with a soft breath. Same point that
 *     becomes the CosmicStar at the reveal: the visual contract
 *     "Stelar has been with you the whole way".
 *
 * Rendered once via the onboarding Stack layout so every screen
 * inherits the same backdrop without per-screen integration.
 */
export function WizardBackdrop() {
  // The Stelar mark breathes over a long 6-s cycle so the eye
  // catches movement without ever feeling busy.
  const presence = useSharedValue(0)
  useEffect(() => {
    presence.value = withRepeat(
      withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    return () => cancelAnimation(presence)
  }, [presence])

  const haloProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(presence.value * 2 * Math.PI)
    return { r: 14 + wave * 4, opacity: 0.12 + wave * 0.12 }
  })
  const coreProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(presence.value * 2 * Math.PI)
    return { r: 3 + wave * 0.6, opacity: 0.85 + wave * 0.15 }
  })

  return (
    <View style={styles.wrap} pointerEvents="none">
      {/* The base color — matches colors.bg so screens that opt out
          of the backdrop still meet the same shade. */}
      <View style={styles.base} />

      {/* Nebula glow — 4 concentric soft circles anchored to the
          bottom-right corner of the canvas. Gives the screen a
          sense of "light source somewhere" instead of flat black. */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="wbackdrop-neb" cx="50%" cy="50%" r="60%">
            <Stop offset="0%" stopColor={colors.magenta} stopOpacity={0.12} />
            <Stop offset="60%" stopColor={colors.magenta} stopOpacity={0.04} />
            <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="92%" cy="86%" r="48%" fill="url(#wbackdrop-neb)" />
        <Circle cx="-8%" cy="-12%" r="38%" fill="url(#wbackdrop-neb)" opacity={0.55} />
      </Svg>

      {/* Starfield — deterministic placement, mixed tints. Small
          enough to read as ambient depth, not decoration. */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        {STARS.map((s, i) => (
          <Circle
            key={`bg-star-${i}`}
            cx={`${s.x}%`}
            cy={`${s.y}%`}
            r={s.r}
            fill={s.color}
            opacity={s.opacity}
          />
        ))}
      </Svg>

      {/* Stelar's presence — corner watchful star, slow breath. */}
      <Svg width={64} height={64} style={styles.presence} pointerEvents="none">
        <Defs>
          <RadialGradient id="wbackdrop-core" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="50%" stopColor="#FBD7E3" />
            <Stop offset="100%" stopColor={colors.magenta} />
          </RadialGradient>
        </Defs>
        <AnimatedCircle cx={32} cy={32} fill={colors.magenta} animatedProps={haloProps} />
        <AnimatedCircle cx={32} cy={32} fill="url(#wbackdrop-core)" animatedProps={coreProps} />
      </Svg>
    </View>
  )
}

/* Deterministic pseudo-random star positions. Generated once at
 * module load with a fixed seed; never reshuffles. Mixed tints
 * (cream, cool, gold) so the field reads as starlight, not as
 * monochrome dots. */
type StarSpec = { x: number; y: number; r: number; opacity: number; color: string }
const STARS: readonly StarSpec[] = (() => {
  const out: StarSpec[] = []
  const rand = (seed: number) => {
    const v = Math.sin(seed * 9301 + 49297) * 233280
    return v - Math.floor(v)
  }
  for (let i = 0; i < 52; i++) {
    const a = rand(i + 1)
    const b = rand(i + 100)
    const c = rand(i + 200)
    const d = rand(i + 300)
    // Don't crowd the very top-right — that's where the presence
    // mark lives and the eye should land there cleanly.
    let x = a * 100
    let y = b * 100
    if (x > 78 && y < 18) {
      x = a * 60 // push out of the corner
    }
    const tint = c > 0.93 ? '#D9B57A' : c > 0.86 ? '#9DB5D6' : c > 0.55 ? '#F4ECDE' : '#FBD7E3'
    out.push({
      x,
      y,
      r: 0.4 + d * 1.2,
      opacity: 0.08 + a * b * 0.32,
      color: tint,
    })
  }
  return out
})()

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
  },
  presence: {
    position: 'absolute',
    top: 8,
    right: 10,
  },
})
